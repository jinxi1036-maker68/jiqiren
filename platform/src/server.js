import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  openDatabase,
  nowIso,
  generateCode,
  logAudit,
  computeFinancials,
  round2,
} from './db.js';
import {
  getOrCreateSecret,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  parseCookies,
} from './auth.js';
import {
  notifyFeishu,
  translateBadReasons,
  draftRuleRevisionFromNotice,
  parseUpstreamQaLines,
  runProjectXiaoyouAssistant,
  buildCsvUtf8Bom,
} from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const DEFAULT_DATA_DIR = path.resolve(__dirname, '../data');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('INVALID_JSON')); }
    });
    req.on('error', reject);
  });
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function parseDeviceList(input) {
  if (Array.isArray(input)) return input.map((s) => String(s).trim()).filter(Boolean);
  return String(input || '').split(/[,，\s;；]+/).map((s) => s.trim()).filter(Boolean);
}

// Compute live quota allocation & confirmed valid hours per project
function enrichProjectWithQuota(db, row) {
  const alloc = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN quota_hours_approved > 0 THEN quota_hours_approved ELSE quota_hours_requested END), 0) AS c
    FROM assignments
    WHERE project_id = ? AND status != 'REJECTED'
  `).get(row.id).c;

  const validFromQa = db.prepare(`
    SELECT COALESCE(SUM(valid_hours), 0) AS c FROM xiaoyou_qa_reports
    WHERE project_id = ? AND verify_status = 'ADMIN_VERIFIED'
  `).get(row.id).c;

  const validFromLogs = db.prepare(`
    SELECT COALESCE(SUM(d.qa_valid_hours), 0) AS c
    FROM daily_logs d JOIN assignments a ON a.id = d.assignment_id
    WHERE a.project_id = ? AND d.qa_status = 'QA_CONFIRMED'
  `).get(row.id).c;

  const deliveredValid = Math.max(validFromQa, validFromLogs);
  const remaining = Math.max(0, round2(Number(row.total_quota_hours) - Number(alloc)));
  return {
    ...row,
    allocated_hours: round2(alloc),
    remaining_quota_hours: remaining,
    delivered_valid_hours: round2(deliveredValid),
  };
}

// Strict Agent DTO sanitizers (ZERO upstream name, base rate, internal portal name, or pre-lock SOP!)
function sanitizeProjectForAgent(db, row, agentUserId) {
  const q = enrichProjectWithQuota(db, row);
  const latestRev = db.prepare(`
    SELECT id, version_code, change_summary, effective_at, created_at
    FROM project_rule_revisions WHERE project_id = ? ORDER BY id DESC LIMIT 1
  `).get(row.id);

  let ruleAcked = true;
  if (latestRev && agentUserId) {
    const ack = db.prepare('SELECT id FROM rule_acknowledgements WHERE revision_id = ? AND agent_user_id = ?').get(latestRev.id, agentUserId);
    ruleAcked = Boolean(ack);
  }

  return {
    id: q.id,
    code: q.code,
    title: q.title,
    modality: q.modality,
    scene_category: q.scene_category,
    city_scope: q.city_scope,
    total_quota_hours: q.total_quota_hours,
    allocated_hours: q.allocated_hours,
    remaining_quota_hours: q.remaining_quota_hours,
    delivered_valid_hours: q.delivered_valid_hours,
    deadline_date: q.deadline_date,
    upstream_portal_mode: q.upstream_portal_mode,
    upstream_upload_guide: q.upstream_upload_guide,
    current_rule_version: q.current_rule_version,
    latest_revision: latestRev ? { ...latestRev, acked_by_me: ruleAcked } : null,
    agent_rate_own_scene_cny: q.agent_rate_own_scene_cny,
    agent_rate_platform_scene_cny: q.agent_rate_platform_scene_cny,
    qa_red_lines: q.qa_red_lines,
    sop_summary: q.sop_summary,
    first_piece_min_hours: q.first_piece_min_hours,
    first_piece_max_hours: q.first_piece_max_hours,
    settlement_days_after_client_pay: q.settlement_days_after_client_pay,
    status: q.status,
    created_at: q.created_at,
  };
}

function sanitizeSceneForAgentPool(row) {
  return {
    id: row.id,
    code: row.code,
    province: row.province,
    city: row.city,
    district: row.district,
    category: row.category,
    daily_work_desc: row.daily_work_desc,
    open_hours_desc: row.open_hours_desc,
    estimated_device_capacity: row.estimated_device_capacity,
    public_status: row.public_status,
    contact_unlock_notice: '已脱敏：提交项目认领并经凌矩总控审批锁单后解锁真实门店与对接人',
    created_at: row.created_at,
  };
}

function matchAssignmentByKey(db, projectId, key) {
  const target = String(key || '').trim().toUpperCase();
  if (!target) return null;
  const candidates = db.prepare(`
    SELECT a.*, u.tax_deduction_rate
    FROM assignments a JOIN users u ON u.id = a.agent_user_id
    WHERE a.project_id = ? AND a.status != 'REJECTED'
  `).all(projectId);

  for (const c of candidates) {
    if (String(c.code).toUpperCase() === target) return c;
    if (c.upstream_upload_account && String(c.upstream_upload_account).toUpperCase() === target) return c;
    const devs = parseDeviceList(JSON.parse(c.bound_device_ids_json || '[]')).map((d) => d.toUpperCase());
    if (devs.some((d) => d === target || target.startsWith(d) || d.startsWith(target))) return c;
  }
  return null;
}

export function createApp({ dbPath, dataDir = DEFAULT_DATA_DIR } = {}) {
  const resolvedDbPath = dbPath || path.join(dataDir, 'lingju_platform.db');
  const db = openDatabase(resolvedDbPath);
  const secret = getOrCreateSecret(dataDir);

  function getAuthUser(req) {
    const cookies = parseCookies(req.headers.cookie);
    const payload = verifyToken(cookies.lj_session, secret);
    if (!payload || !payload.uid) return null;
    const user = db.prepare(`
      SELECT id, username, role, display_name, entity_type, tax_deduction_rate,
             deposit_status, deposit_amount_cny, city, verified_headcount, has_own_scene, status, notes
      FROM users WHERE id = ?
    `).get(payload.uid);
    return user && user.status === 'ACTIVE' ? user : null;
  }

  function requireAuth(req, res, allowedRoles) {
    const user = getAuthUser(req);
    if (!user) {
      sendJson(res, 401, { error: '请先登录认证账号' });
      return null;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      sendJson(res, 403, { error: '无权访问该接口' });
      return null;
    }
    return user;
  }

  const server = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = urlObj.pathname;
    const method = req.method || 'GET';
    const ipAddr = getClientIp(req);

    try {
      if (method === 'GET' && pathname === '/api/health') {
        return sendJson(res, 200, { ok: true, service: 'lingju-agent-platform-v2', time: nowIso() });
      }

      // ================= AUTH =================
      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await readBody(req);
        const username = String(body.username || '').trim();
        const password = String(body.password || '');
        if (!username || !password) return sendJson(res, 400, { error: '请输入账号和密码' });
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user || !verifyPassword(password, user.password_hash)) {
          return sendJson(res, 401, { error: '账号或密码错误' });
        }
        if (user.status !== 'ACTIVE') return sendJson(res, 403, { error: '该账号已暂停，请联系凌矩总控' });

        const token = signToken({ uid: user.id, role: user.role }, secret);
        logAudit(db, { actorUserId: user.id, actorRole: user.role, action: 'LOGIN', targetType: 'user', targetId: user.id, ipAddr });
        const secureFlag = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
        return sendJson(
          res, 200,
          {
            user: {
              id: user.id, username: user.username, role: user.role, display_name: user.display_name,
              entity_type: user.entity_type, tax_deduction_rate: user.tax_deduction_rate,
              deposit_status: user.deposit_status, city: user.city,
            },
          },
          { 'Set-Cookie': `lj_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secureFlag}` }
        );
      }

      if (method === 'POST' && pathname === '/api/auth/logout') {
        return sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'lj_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
      }

      if (method === 'GET' && pathname === '/api/auth/me') {
        return sendJson(res, 200, { user: getAuthUser(req) || null });
      }

      if (method === 'POST' && pathname === '/api/auth/change-password') {
        const user = requireAuth(req, res);
        if (!user) return;
        const b = await readBody(req);
        const oldPw = String(b.old_password || '');
        const newPw = String(b.new_password || '');
        if (newPw.length < 6) return sendJson(res, 400, { error: '新密码长度不能少于 6 位' });
        const full = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id);
        if (!verifyPassword(oldPw, full.password_hash)) return sendJson(res, 400, { error: '原密码不正确' });
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPw), user.id);
        logAudit(db, { actorUserId: user.id, actorRole: user.role, action: 'CHANGE_OWN_PASSWORD', targetType: 'user', targetId: user.id, ipAddr });
        return sendJson(res, 200, { ok: true });
      }

      if (pathname === '/api/auth/register') {
        return sendJson(res, 403, { error: '本平台不开放公开自主注册，代理商须经凌矩总控核验后由后台发号' });
      }

      // ================= PUBLIC SCENE LEADS =================
      if (method === 'POST' && pathname === '/api/public/scene-leads') {
        const b = await readBody(req);
        const province = String(b.province || '').trim();
        const city = String(b.city || '').trim();
        const district = String(b.district || '').trim();
        const category = String(b.category || '').trim();
        const dailyWorkDesc = String(b.daily_work_desc || '').trim();
        const openHoursDesc = String(b.open_hours_desc || '').trim();
        const capacity = Math.max(1, Number(b.estimated_device_capacity || 1));
        const storeName = String(b.real_store_name || '').trim();
        const contactName = String(b.real_contact_name || '').trim();
        const contactPhone = String(b.real_contact_phone || '').trim();
        const address = String(b.real_address || '').trim();
        const zeroAck = b.zero_promise_ack === true || b.zero_promise_ack === 1;

        if (!province || !city || !category || !dailyWorkDesc || !storeName || !contactName || !contactPhone || !address) {
          return sendJson(res, 400, { error: '请完整填写城市、场景类型、日常真实作业、店名及联系方式' });
        }
        if (!zeroAck) {
          return sendJson(res, 400, { error: '请先勾选确认免费备案与不承诺立刻排单声明' });
        }

        const code = generateCode('SCN');
        const info = db.prepare(`
          INSERT INTO scenes (
            code, province, city, district, category, daily_work_desc, open_hours_desc,
            estimated_device_capacity, tier, public_status,
            real_store_name, real_contact_name, real_contact_phone, real_address,
            source_channel, zero_promise_ack, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_REVIEW', 'HIDDEN', ?, ?, ?, ?, 'DOUYIN_IP', 1, ?)
        `).run(code, province, city, district, category, dailyWorkDesc, openHoursDesc, capacity, storeName, contactName, contactPhone, address, nowIso());

        logAudit(db, { actorRole: 'public_scene_owner', action: 'SUBMIT_IP_SCENE_LEAD', targetType: 'scene', targetId: info.lastInsertRowid, detail: `${province}-${city} ${category}`, ipAddr });
        notifyFeishu('收到新老板 30s 场景备案', [`编号：${code}`, `地区：${province}${city} · ${category}（约 ${capacity} 机位）`, `请尽快登录总控台完成 S1/S2 初筛`]);
        return sendJson(res, 201, {
          ok: true, code,
          message: '您的场景信息已免费备案进入凌矩全国储备库。待匹配到同城同行业正式甲方项目及认证团队时，工作人员将联系核对进场细节（不收费、不承诺立刻排单）。',
        });
      }

      // ================= ADMIN ENDPOINTS =================
      if (pathname.startsWith('/api/admin/')) {
        const admin = requireAuth(req, res, ['admin']);
        if (!admin) return;

        if (method === 'GET' && pathname === '/api/admin/overview') {
          const stats = {
            active_agents: db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='agent' AND status='ACTIVE'").get().c,
            open_compliant_projects: db.prepare("SELECT COUNT(*) AS c FROM projects WHERE status='OPEN' AND compliance_path != 'DRAFT_INTERNAL_ONLY'").get().c,
            total_quota_pool: db.prepare("SELECT COALESCE(SUM(total_quota_hours), 0) AS c FROM projects WHERE status='OPEN' AND compliance_path != 'DRAFT_INTERNAL_ONLY'").get().c,
            scenes_pending: db.prepare("SELECT COUNT(*) AS c FROM scenes WHERE tier='PENDING_REVIEW'").get().c,
            scenes_s2: db.prepare("SELECT COUNT(*) AS c FROM scenes WHERE tier='S2_RESERVE'").get().c,
            scenes_s1: db.prepare("SELECT COUNT(*) AS c FROM scenes WHERE tier='S1_BENCHMARK'").get().c,
            assignments_pending: db.prepare("SELECT COUNT(*) AS c FROM assignments WHERE status='PENDING_APPROVAL'").get().c,
            first_piece_pending: db.prepare("SELECT COUNT(*) AS c FROM assignments WHERE status='FIRST_PIECE_TRIAL' AND first_piece_status='SUBMITTED'").get().c,
            green_light_active: db.prepare("SELECT COUNT(*) AS c FROM assignments WHERE status='BATCH_GREEN_LIGHT'").get().c,
            logs_pending_qa: db.prepare("SELECT COUNT(*) AS c FROM daily_logs WHERE qa_status='PENDING_QA'").get().c,
            logs_ready_to_settle: db.prepare("SELECT COUNT(*) AS c FROM daily_logs WHERE settlement_stage='CLIENT_PAID_READY_TO_SETTLE'").get().c,
            xiaoyou_pending_check: db.prepare("SELECT COUNT(*) AS c FROM xiaoyou_qa_reports WHERE verify_status='AI_SYNCED_PENDING_CHECK'").get().c,
            escalations_open: db.prepare("SELECT COUNT(*) AS c FROM escalation_tickets WHERE status != 'RESOLVED'").get().c,
          };
          return sendJson(res, 200, { stats });
        }

        // --- Agents ---
        if (method === 'GET' && pathname === '/api/admin/agents') {
          const agents = db.prepare(`
            SELECT id, username, role, display_name, entity_type, tax_deduction_rate,
                   deposit_status, deposit_amount_cny, city, verified_headcount, has_own_scene, status, notes, created_at
            FROM users WHERE role='agent' ORDER BY id DESC
          `).all();
          return sendJson(res, 200, { agents });
        }

        if (method === 'POST' && pathname === '/api/admin/agents') {
          const b = await readBody(req);
          const username = String(b.username || '').trim();
          const password = String(b.password || '');
          const displayName = String(b.display_name || '').trim();
          const entityType = b.entity_type || 'enterprise_vat';
          const taxRate = Number(b.tax_deduction_rate ?? (entityType === 'personal_captain' ? 0.06 : 0));
          const depositStatus = b.deposit_status || 'UNPAID';
          const depositAmount = Number(b.deposit_amount_cny || 0);
          const city = String(b.city || '').trim();
          const headcount = Math.max(0, Number(b.verified_headcount || 0));
          const notes = String(b.notes || '').trim();
          if (!username || password.length < 6 || !displayName) {
            return sendJson(res, 400, { error: '请填写代理账号、至少6位初始密码与团队名称' });
          }
          try {
            const info = db.prepare(`
              INSERT INTO users (
                username, password_hash, role, display_name, entity_type, tax_deduction_rate,
                deposit_status, deposit_amount_cny, city, verified_headcount, has_own_scene, status, notes, created_at
              ) VALUES (?, ?, 'agent', ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
            `).run(username, hashPassword(password), displayName, entityType, taxRate, depositStatus, depositAmount, city, headcount, b.has_own_scene ? 1 : 0, notes, nowIso());
            logAudit(db, { actorUserId: admin.id, actorRole: 'admin', action: 'CREATE_AGENT', targetType: 'user', targetId: info.lastInsertRowid, detail: displayName, ipAddr });
            return sendJson(res, 201, { ok: true, id: info.lastInsertRowid });
          } catch (e) {
            if (String(e.message).includes('UNIQUE')) return sendJson(res, 409, { error: '该登录账号已存在' });
            throw e;
          }
        }

        const agentResetMatch = pathname.match(/^\/api\/admin\/agents\/(\d+)\/reset-password$/);
        if (method === 'POST' && agentResetMatch) {
          const agentId = Number(agentResetMatch[1]);
          const b = await readBody(req);
          const newPw = String(b.new_password || '');
          if (newPw.length < 6) return sendJson(res, 400, { error: '重置密码长度不能少于 6 位' });
          const ex = db.prepare("SELECT id FROM users WHERE id = ? AND role='agent'").get(agentId);
          if (!ex) return sendJson(res, 404, { error: '代理账号不存在' });
          db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPw), agentId);
          logAudit(db, { actorUserId: admin.id, actorRole: 'admin', action: 'RESET_AGENT_PASSWORD', targetType: 'user', targetId: agentId, ipAddr });
          return sendJson(res, 200, { ok: true });
        }

        const agentPatchMatch = pathname.match(/^\/api\/admin\/agents\/(\d+)$/);
        if (method === 'PATCH' && agentPatchMatch) {
          const agentId = Number(agentPatchMatch[1]);
          const b = await readBody(req);
          const ex = db.prepare("SELECT * FROM users WHERE id = ? AND role='agent'").get(agentId);
          if (!ex) return sendJson(res, 404, { error: '代理账号不存在' });
          const status = b.status || ex.status;
          const depositStatus = b.deposit_status || ex.deposit_status;
          const depositAmount = b.deposit_amount_cny !== undefined ? Number(b.deposit_amount_cny) : ex.deposit_amount_cny;
          const taxRate = b.tax_deduction_rate !== undefined ? Number(b.tax_deduction_rate) : ex.tax_deduction_rate;
          const notes = b.notes !== undefined ? String(b.notes) : ex.notes;
          db.prepare('UPDATE users SET status=?, deposit_status=?, deposit_amount_cny=?, tax_deduction_rate=?, notes=? WHERE id=?')
            .run(status, depositStatus, depositAmount, taxRate, notes, agentId);
          logAudit(db, { actorUserId: admin.id, actorRole: 'admin', action: 'UPDATE_AGENT', targetType: 'user', targetId: agentId, detail: `status=${status}`, ipAddr });
          return sendJson(res, 200, { ok: true });
        }

        // --- Projects Pool & Rule Revisions ---
        if (method === 'GET' && pathname === '/api/admin/projects') {
          const rows = db.prepare('SELECT * FROM projects ORDER BY id DESC').all();
          const projects = rows.map((r) => {
            const revs = db.prepare('SELECT * FROM project_rule_revisions WHERE project_id = ? ORDER BY id DESC').all(r.id);
            return { ...enrichProjectWithQuota(db, r), revisions: revs };
          });
          return sendJson(res, 200, { projects });
        }

        if (method === 'POST' && pathname === '/api/admin/projects') {
          const b = await readBody(req);
          const title = String(b.title || '').trim();
          const upstreamName = String(b.upstream_name_internal || '').trim();
          const baseRate = Number(b.upstream_base_rate_cny || 0);
          const ownRate = Number(b.agent_rate_own_scene_cny || 0);
          const platRate = Number(b.agent_rate_platform_scene_cny || 0);
          const totalQuota = Number(b.total_quota_hours || 0);
          const sceneCategory = String(b.scene_category || '').trim();
          const qaRedLines = String(b.qa_red_lines || '').trim();

          if (!title || !upstreamName || baseRate <= 0 || ownRate <= 0 || platRate <= 0 || totalQuota <= 0 || !sceneCategory || !qaRedLines) {
            return sendJson(res, 400, { error: '请完整填写项目标题、总包小时配额、内部甲方名、甲方底价、两档代理净价、场景类别及QA红线' });
          }
          if (ownRate >= baseRate || platRate > ownRate) {
            return sendJson(res, 400, { error: '定价校验失败：代理净价须低于甲方底价，且平台场景净价不应高于自带场景净价' });
          }

          const code = generateCode('PRJ');
          const compliancePath = b.compliance_path || 'DRAFT_INTERNAL_ONLY';
          const info = db.prepare(`
            INSERT INTO projects (
              code, title, upstream_name_internal, upstream_base_rate_cny,
              upstream_platform_name, upstream_portal_mode, upstream_upload_guide,
              total_quota_hours, deadline_date, modality, scene_category, city_scope,
              compliance_path, agent_rate_own_scene_cny, agent_rate_platform_scene_cny,
              scene_owner_fee_note, qa_red_lines, sop_summary, sop_full_internal,
              current_rule_version, first_piece_min_hours, first_piece_max_hours,
              settlement_days_after_client_pay, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'v1.0', ?, ?, ?, 'OPEN', ?)
          `).run(
            code, title, upstreamName, baseRate,
            String(b.upstream_platform_name || '甲方专属后台').trim(),
            b.upstream_portal_mode || 'LINGJU_RELAY_SHIELDED',
            String(b.upstream_upload_guide || '使用凌矩分配的专属传片通道/子账号上传，所有 QA 评估与收益统一回本平台查看').trim(),
            totalQuota, String(b.deadline_date || '').trim(),
            String(b.modality || 'EGO第一视角').trim(), sceneCategory,
            String(b.city_scope || '全国适用').trim(), compliancePath, ownRate, platRate,
            String(b.scene_owner_fee_note || '').trim(), qaRedLines,
            String(b.sop_summary || qaRedLines).trim(), String(b.sop_full_internal || qaRedLines).trim(),
            Number(b.first_piece_min_hours || 1.0), Number(b.first_piece_max_hours || 2.0),
            Math.max(1, Number(b.settlement_days_after_client_pay || 5)), nowIso()
          );

          logAudit(db, { actorUserId: admin.id, actorRole: 'admin', action: 'CREATE_PROJECT', targetType: 'project', targetId: info.lastInsertRowid, detail: `${code} (${totalQuota}h)`, ipAddr });
          return sendJson(res, 201, { ok: true, id: info.lastInsertRowid, code });
        }

        const prjPatchMatch = pathname.match(/^\/api\/admin\/projects\/(\d+)$/);
        if (method === 'PATCH' && prjPatchMatch) {
          const prjId = Number(prjPatchMatch[1]);
          const b = await readBody(req);
          const ex = db.prepare('SELECT * FROM projects WHERE id = ?').get(prjId);
          if (!ex) return sendJson(res, 404, { error: '项目不存在' });
          const compliancePath = b.compliance_path || ex.compliance_path;
          const portalMode = b.upstream_portal_mode || ex.upstream_portal_mode;
          const status = b.status || ex.status;
          db.prepare('UPDATE projects SET compliance_path=?, upstream_portal_mode=?, status=? WHERE id=?')
            .run(compliancePath, portalMode, status, prjId);
          logAudit(db, { actorUserId: admin.id, actorRole: 'admin', action: 'UPDATE_PROJECT', targetType: 'project', targetId: prjId, detail: `compliance=${compliancePath}`, ipAddr });
          return sendJson(res, 200, { ok: true });
        }

        const ruleDraftMatch = pathname.match(/^\/api\/admin\/projects\/(\d+)\/rule-draft$/);
        if (method === 'POST' && ruleDraftMatch) {
          const prjId = Number(ruleDraftMatch[1]);
          const ex = db.prepare('SELECT * FROM projects WHERE id = ?').get(prjId);
          if (!ex) return sendJson(res, 404, { error: '项目不存在' });
          const b = await readBody(req);
          const nextNum = db.prepare('SELECT COUNT(*) AS c FROM project_rule_revisions WHERE project_id = ?').get(prjId).c + 1;
          const nextVer = `v1.${nextNum}`;
          return sendJson(res, 200, draftRuleRevisionFromNotice(b.raw_client_notice || '', nextVer));
        }

        const rulePubMatch = pathname.match(/^\/api\/admin\/projects\/(\d+)\/rules$/);
        if (method === 'POST' && rulePubMatch) {
          const prjId = Number(rulePubMatch[1]);
          const ex = db.prepare('SELECT * FROM projects WHERE id = ?').get(prjId);
          if (!ex) return sendJson(res, 404, { error: '项目不存在' });
          const b = await readBody(req);
          const versionCode = String(b.version_code || '').trim();
          const summary = String(b.change_summary || '').trim();
          if (!versionCode || !summary) return sendJson(res, 400, { error: '请填写规则版本号与变更摘要' });
          const ts = nowIso();
          const info = db.prepare(`
            INSERT INTO project_rule_revisions (
              project_id, version_code, raw_client_notice, ai_structured_diff,
              change_summary, effective_at, published_by_admin_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(prjId, versionCode, String(b.raw_client_notice || ''), String(b.ai_structured_diff || summary), summary, String(b.effective_at || '立即生效'), admin.id, ts);

          const updatedRedLines = b.append_to_red_lines ? `${ex.qa_red_lines}；【${versionCode}新规】${summary}` : ex.qa_red_lines;
          db.prepare('UPDATE projects SET current_rule_version = ?, qa_red_lines = ? WHERE id = ?').run(versionCode, updatedRedLines, prjId);
          logAudit(db, { actorUserId: admin.id, actorRole: 'admin', action: 'PUBLISH_RULE_REVISION', targetType: 'project', targetId: prjId, detail: `${versionCode}: ${summary}`, ipAddr });
          return sendJson(res, 201, { ok: true, id: info.lastInsertRowid, version_code: versionCode });
        }

        // --- Scenes ---
        if (method === 'GET' && pathname === '/api/admin/scenes') {
          return sendJson(res, 200, { scenes: db.prepare('SELECT * FROM scenes ORDER BY id DESC').all() });
        }

        const scenePatchMatch = pathname.match(/^\/api\/admin\/scenes\/(\d+)$/);
        if (method === 'PATCH' && scenePatchMatch) {
          const sceneId = Number(scenePatchMatch[1]);
          const b = await readBody(req);
          const ex = db.prepare('SELECT * FROM scenes WHERE id = ?').get(sceneId);
          if (!ex) return sendJson(res, 404, { error: '场景不存在' });
          const tier = b.tier || ex.tier;
          const publicStatus = tier !== 'S2_RESERVE' ? 'HIDDEN' : (b.public_status || ex.public_status);
          db.prepare('UPDATE scenes SET tier=?, public_status=?, venue_fee_model=?, review_note=? WHERE id=?')
            .run(tier, publicStatus, b.venue_fee_model ?? ex.venue_fee_model, b.review_note ?? ex.review_note, sceneId);
          logAudit(db, { actorUserId: admin.id, actorRole: 'admin', action: 'TRIAGE_SCENE', targetType: 'scene', targetId: sceneId, detail: `tier=${tier}`, ipAddr });
          return sendJson(res, 200, { ok: true, tier, public_status: publicStatus });
        }

        // --- Assignments + Device/Subaccount Attribution Binding ---
        if (method === 'GET' && pathname === '/api/admin/assignments') {
          const rows = db.prepare(`
            SELECT a.*, p.code AS project_code, p.title AS project_title, p.upstream_name_internal,
                   p.upstream_base_rate_cny, p.compliance_path, p.total_quota_hours,
                   u.display_name AS agent_name, u.entity_type, u.deposit_status, u.city AS agent_city,
                   s.code AS scene_code, s.city AS scene_city, s.category AS scene_category,
                   s.real_store_name, s.real_contact_name, s.real_contact_phone
            FROM assignments a
            JOIN projects p ON p.id = a.project_id
            JOIN users u ON u.id = a.agent_user_id
            LEFT JOIN scenes s ON s.id = a.scene_id
            ORDER BY a.id DESC
          `).all();
          return sendJson(res, 200, { assignments: rows });
        }

        const asgApproveMatch = pathname.match(/^\/api\/admin\/assignments\/(\d+)\/decision$/);
        if (method === 'POST' && asgApproveMatch) {
          const asgId = Number(asgApproveMatch[1]);
          const b = await readBody(req);
          const decision = b.decision;
          const asg = db.prepare('SELECT * FROM assignments WHERE id = ?').get(asgId);
          if (!asg) return sendJson(res, 404, { error: '认领单不存在' });
          if (asg.status !== 'PENDING_APPROVAL') return sendJson(res, 400, { error: '该认领单不处于待审批状态' });

          if (decision === 'REJECT') {
            db.prepare("UPDATE assignments SET status='REJECTED', admin_note=? WHERE id=?").run(String(b.admin_note || ''), asgId);
            return sendJson(res, 200, { ok: true, status: 'REJECTED' });
          }
          if (decision !== 'APPROVE') return sendJson(res, 400, { error: '无效审批操作' });

          const agent = db.prepare('SELECT * FROM users WHERE id = ?').get(asg.agent_user_id);
          const deviceArrangement = b.device_arrangement || 'PLATFORM_ISSUED_DEPOSIT';
          if (deviceArrangement === 'PLATFORM_ISSUED_DEPOSIT' && agent.deposit_status === 'UNPAID') {
            return sendJson(res, 400, { error: '该代理尚未缴纳设备押金或企业担保；请改选“代理自带设备”或“熟人特批免押”' });
          }
          if (asg.mode === 'PLATFORM_SCENE' && asg.scene_id) {
            const sc = db.prepare('SELECT * FROM scenes WHERE id = ?').get(asg.scene_id);
            if (!sc || sc.public_status !== 'AVAILABLE') return sendJson(res, 409, { error: '该平台场景已被其他单锁定或不可用' });
            db.prepare("UPDATE scenes SET public_status='LOCKED' WHERE id=?").run(asg.scene_id);
          }

          const quotaApproved = Number(b.quota_hours_approved || asg.quota_hours_requested || 100);
          const devices = parseDeviceList(b.bound_device_ids);
          const subAccount = String(b.upstream_upload_account || `lj_sub_${asg.code.toLowerCase()}`).trim();
          const uploadNote = String(b.upload_channel_note || '仅限上传视频原片；审核明细与预估收益均在凌矩本平台查看').trim();

          db.prepare(`
            UPDATE assignments
            SET status='FIRST_PIECE_TRIAL', first_piece_status='NOT_SUBMITTED',
                device_arrangement=?, quota_hours_approved=?, upstream_upload_account=?,
                bound_device_ids_json=?, upload_channel_note=?, admin_note=?, approved_at=?
            WHERE id=?
          `).run(deviceArrangement, quotaApproved, subAccount, JSON.stringify(devices), uploadNote, String(b.admin_note || ''), nowIso(), asgId);

          logAudit(db, { actorUserId: admin.id, actorRole: 'admin', action: 'APPROVE_PROJECT_QUOTA', targetType: 'assignment', targetId: asgId, detail: `quota=${quotaApproved}h, devices=${devices.join(',')}`, ipAddr });
          return sendJson(res, 200, { ok: true, status: 'FIRST_PIECE_TRIAL' });
        }

        const fpReviewMatch = pathname.match(/^\/api\/admin\/assignments\/(\d+)\/first-piece-review$/);
        if (method === 'POST' && fpReviewMatch) {
          const asgId = Number(fpReviewMatch[1]);
          const b = await readBody(req);
          const asg = db.prepare('SELECT * FROM assignments WHERE id = ?').get(asgId);
          if (!asg) return sendJson(res, 404, { error: '派单不存在' });
          if (asg.status !== 'FIRST_PIECE_TRIAL' || asg.first_piece_status !== 'SUBMITTED') {
            return sendJson(res, 400, { error: '该派单尚未提交首件试采样片，无法审核点亮绿灯' });
          }
          if (b.decision === 'APPROVE_GREEN_LIGHT') {
            db.prepare("UPDATE assignments SET status='BATCH_GREEN_LIGHT', first_piece_status='APPROVED', first_piece_review_note=?, green_light_at=? WHERE id=?")
              .run(String(b.review_note || '首件过审，点亮批量开工绿灯'), nowIso(), asgId);
            return sendJson(res, 200, { ok: true, status: 'BATCH_GREEN_LIGHT' });
          }
          if (b.decision === 'REJECT_RETRY') {
            db.prepare("UPDATE assignments SET first_piece_status='REJECTED', first_piece_review_note=? WHERE id=?")
              .run(String(b.review_note || '首件未达标，请整改重提'), asgId);
            return sendJson(res, 200, { ok: true, first_piece_status: 'REJECTED' });
          }
          return sendJson(res, 400, { error: '无效首件审核动作' });
        }

        // --- XiaoYou Upstream QA Ingestion & Isolation Review ---
        if (method === 'GET' && pathname === '/api/admin/xiaoyou/reports') {
          const reports = db.prepare(`
            SELECT q.*, p.code AS project_code, p.title AS project_title,
                   a.code AS assignment_code, u.display_name AS agent_name
            FROM xiaoyou_qa_reports q
            JOIN projects p ON p.id = q.project_id
            LEFT JOIN assignments a ON a.id = q.assignment_id
            LEFT JOIN users u ON u.id = a.agent_user_id
            ORDER BY q.id DESC
          `).all();
          return sendJson(res, 200, { reports });
        }

        if (method === 'POST' && pathname === '/api/admin/xiaoyou/ingest') {
          const b = await readBody(req);
          const projectId = Number(b.project_id || 0);
          const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
          if (!project) return sendJson(res, 404, { error: '目标项目不存在' });

          let items = Array.isArray(b.rows) ? b.rows : [];
          if (!items.length && b.csv_text) items = parseUpstreamQaLines(b.csv_text);
          if (!items.length) return sendJson(res, 400, { error: '请提供要导入的上游 QA 明细行或结构化数据' });

          const created = [];
          const ts = nowIso();
          for (const it of items) {
            const matchedKey = String(it.matched_key || '').trim();
            const asg = it.assignment_id
              ? db.prepare('SELECT a.*, u.tax_deduction_rate FROM assignments a JOIN users u ON u.id = a.agent_user_id WHERE a.id = ?').get(Number(it.assignment_id))
              : matchAssignmentByKey(db, projectId, matchedKey);

            const uploaded = Number(it.uploaded_hours || 0);
            const valid = Math.min(uploaded, Math.max(0, Number(it.valid_hours || 0)));
            const invalid = round2(Math.max(0, uploaded - valid));
            const reasons = translateBadReasons(it.invalid_reasons || it.raw_reason || '');
            const rate = asg ? Number(asg.applied_agent_rate_cny || 0) : 0;
            const taxRate = asg ? Number(asg.tax_deduction_rate || 0) : 0;
            const gross = round2(valid * rate);
            const tax = round2(gross * taxRate);
            const net = round2(gross - tax);

            const code = generateCode('XYQA');
            const summary = `小优同步 ${uploaded}h → 有效 ${valid}h / 无效 ${invalid}h${reasons.length ? `（${reasons.map((r) => r.category_zh).join('、')}）` : ''}`;
            const info = db.prepare(`
              INSERT INTO xiaoyou_qa_reports (
                code, project_id, assignment_id, matched_key, report_date, upstream_batch_ref,
                uploaded_hours, valid_hours, invalid_hours, invalid_reasons_json, xiaoyou_summary,
                estimated_agent_gross_cny, estimated_agent_tax_cny, estimated_agent_net_cny,
                sync_source, verify_status, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AI_SYNCED_PENDING_CHECK', ?)
            `).run(
              code, projectId, asg?.id || null, matchedKey, String(it.report_date || ts.slice(0, 10)),
              String(it.upstream_batch_ref || ''), uploaded, valid, invalid, JSON.stringify(reasons),
              summary, gross, tax, net, b.sync_source || 'CSV_PARSE', ts
            );
            created.push({ id: info.lastInsertRowid, code, matched_assignment_id: asg?.id || null, estimated_agent_net_cny: net });
          }

          logAudit(db, { actorUserId: admin.id, actorRole: 'admin', action: 'XIAOYOU_QA_INGEST', targetType: 'project', targetId: projectId, detail: `count=${created.length}`, ipAddr });
          return sendJson(res, 201, { ok: true, imported: created });
        }

        const qaVerifyMatch = pathname.match(/^\/api\/admin\/xiaoyou\/reports\/(\d+)$/);
        if (method === 'PATCH' && qaVerifyMatch) {
          const repId = Number(qaVerifyMatch[1]);
          const b = await readBody(req);
          const rep = db.prepare('SELECT * FROM xiaoyou_qa_reports WHERE id = ?').get(repId);
          if (!rep) return sendJson(res, 404, { error: 'QA 回流记录不存在' });

          const asgId = b.assignment_id ? Number(b.assignment_id) : rep.assignment_id;
          const valid = b.valid_hours !== undefined ? Number(b.valid_hours) : rep.valid_hours;
          const invalid = round2(Math.max(0, rep.uploaded_hours - valid));
          const verifyStatus = b.verify_status || rep.verify_status;

          let gross = rep.estimated_agent_gross_cny;
          let tax = rep.estimated_agent_tax_cny;
          let net = rep.estimated_agent_net_cny;
          if (asgId) {
            const asg = db.prepare('SELECT a.applied_agent_rate_cny, u.tax_deduction_rate FROM assignments a JOIN users u ON u.id = a.agent_user_id WHERE a.id = ?').get(asgId);
            if (asg) {
              gross = round2(valid * Number(asg.applied_agent_rate_cny));
              tax = round2(gross * Number(asg.tax_deduction_rate));
              net = round2(gross - tax);
            }
          }

          let linkedLogId = rep.linked_daily_log_id;
          const ts = nowIso();
          if (verifyStatus === 'ADMIN_VERIFIED' && b.push_to_settlement && asgId && !linkedLogId) {
            const logInfo = db.prepare(`
              INSERT INTO daily_logs (
                assignment_id, log_date, log_type, devices_used, raw_hours, uploaded_hours, batch_ref,
                agent_note, qa_status, qa_valid_hours, qa_reject_reason, settlement_stage, created_at, updated_at
              ) VALUES (?, ?, 'BATCH', 1, ?, ?, ?, '由小优上游 QA 同步转入背靠背对账', 'QA_CONFIRMED', ?, ?, 'PENDING_CLIENT_PAYMENT', ?, ?)
            `).run(asgId, rep.report_date, rep.uploaded_hours, rep.uploaded_hours, rep.upstream_batch_ref, valid, invalid > 0 ? `无效 ${invalid}h` : '', ts, ts);
            linkedLogId = logInfo.lastInsertRowid;
          }

          db.prepare(`
            UPDATE xiaoyou_qa_reports
            SET assignment_id=?, valid_hours=?, invalid_hours=?, estimated_agent_gross_cny=?,
                estimated_agent_tax_cny=?, estimated_agent_net_cny=?, verify_status=?,
                linked_daily_log_id=?, verified_at=?
            WHERE id=?
          `).run(asgId || null, valid, invalid, gross, tax, net, verifyStatus, linkedLogId || null, verifyStatus === 'ADMIN_VERIFIED' ? ts : null, repId);

          logAudit(db, { actorUserId: admin.id, actorRole: 'admin', action: 'VERIFY_XIAOYOU_QA', targetType: 'xiaoyou_qa_report', targetId: repId, detail: `status=${verifyStatus}, valid=${valid}h`, ipAddr });
          return sendJson(res, 200, { ok: true, linked_daily_log_id: linkedLogId || null });
        }

        // --- Back-to-Back Settlement Logs + CSV Export ---
        if (method === 'GET' && pathname === '/api/admin/logs') {
          const rows = db.prepare(`
            SELECT d.*, a.code AS assignment_code, a.mode, a.applied_agent_rate_cny,
                   p.title AS project_title, p.upstream_name_internal, p.upstream_base_rate_cny,
                   p.settlement_days_after_client_pay,
                   u.display_name AS agent_name, u.entity_type, u.tax_deduction_rate,
                   s.code AS scene_code, s.real_store_name
            FROM daily_logs d
            JOIN assignments a ON a.id = d.assignment_id
            JOIN projects p ON p.id = a.project_id
            JOIN users u ON u.id = a.agent_user_id
            LEFT JOIN scenes s ON s.id = a.scene_id
            ORDER BY d.id DESC
          `).all();
          return sendJson(res, 200, { logs: rows.map((r) => ({ ...r, financials: computeFinancials(r) })) });
        }

        if (method === 'GET' && pathname === '/api/admin/logs/export.csv') {
          const rows = db.prepare(`
            SELECT d.*, a.code AS assignment_code, a.applied_agent_rate_cny,
                   p.code AS project_code, p.title AS project_title, p.upstream_name_internal, p.upstream_base_rate_cny,
                   u.display_name AS agent_name, u.tax_deduction_rate
            FROM daily_logs d
            JOIN assignments a ON a.id = d.assignment_id
            JOIN projects p ON p.id = a.project_id
            JOIN users u ON u.id = a.agent_user_id
            ORDER BY d.id DESC
          `).all();
          const headers = ['批次ID', '日期', '类型', '项目编号', '项目名称', '内部甲方', '派单号', '代理团队', '上传小时', '有效小时', 'QA状态', '结算阶段', '甲方含税营收', '代理毛应付', '代征扣税', '代理净应付', '场地费', '凌矩留存', '公户回单号'];
          const csvRows = rows.map((r) => {
            const f = computeFinancials(r);
            return [r.id, r.log_date, r.log_type, r.project_code, r.project_title, r.upstream_name_internal, r.assignment_code, r.agent_name, r.uploaded_hours, r.qa_valid_hours, r.qa_status, r.settlement_stage, f.upstream_gross_cny, f.agent_gross_cny, f.agent_tax_deduction_cny, f.agent_net_payable_cny, f.venue_fee_cny, f.lingju_pre_overhead_margin_cny, r.payout_receipt_ref];
          });
          const csv = buildCsvUtf8Bom(headers, csvRows);
          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="lingju-settlement-ledger.csv"',
          });
          return res.end(csv);
        }

        const logPatchMatch = pathname.match(/^\/api\/admin\/logs\/(\d+)$/);
        if (method === 'PATCH' && logPatchMatch) {
          const logId = Number(logPatchMatch[1]);
          const b = await readBody(req);
          const ex = db.prepare('SELECT * FROM daily_logs WHERE id = ?').get(logId);
          if (!ex) return sendJson(res, 404, { error: '日报批次不存在' });

          const qaStatus = b.qa_status || ex.qa_status;
          const qaValid = b.qa_valid_hours !== undefined ? Number(b.qa_valid_hours) : ex.qa_valid_hours;
          const venueFee = b.venue_fee_cny !== undefined ? Number(b.venue_fee_cny) : ex.venue_fee_cny;
          const payoutRef = b.payout_receipt_ref !== undefined ? String(b.payout_receipt_ref).trim() : ex.payout_receipt_ref;
          let stage = b.settlement_stage || ex.settlement_stage;
          if (qaStatus === 'PENDING_QA' || qaStatus === 'QA_REJECTED') stage = 'PENDING_QA';
          else if (qaStatus === 'QA_CONFIRMED' && stage === 'PENDING_QA') stage = 'PENDING_CLIENT_PAYMENT';

          if (stage === 'SETTLED_PAID' && !payoutRef) return sendJson(res, 400, { error: '标记“已打款”必须填写公户转账回单号' });
          if (qaValid < 0 || qaValid > ex.uploaded_hours) return sendJson(res, 400, { error: 'QA有效小时不能为负且不能大于上传小时' });

          db.prepare(`
            UPDATE daily_logs SET qa_status=?, qa_valid_hours=?, qa_reject_reason=?, settlement_stage=?,
                   venue_fee_cny=?, payout_receipt_ref=?, updated_at=? WHERE id=?
          `).run(qaStatus, qaValid, b.qa_reject_reason ?? ex.qa_reject_reason, stage, venueFee, payoutRef, nowIso(), logId);
          logAudit(db, { actorUserId: admin.id, actorRole: 'admin', action: 'UPDATE_QA_SETTLEMENT', targetType: 'daily_log', targetId: logId, detail: `stage=${stage}`, ipAddr });
          return sendJson(res, 200, { ok: true, settlement_stage: stage });
        }

        // --- Escalation Tickets ---
        if (method === 'GET' && pathname === '/api/admin/escalations') {
          const tickets = db.prepare(`
            SELECT e.*, p.code AS project_code, p.title AS project_title,
                   u.display_name AS agent_name, a.code AS assignment_code
            FROM escalation_tickets e
            JOIN projects p ON p.id = e.project_id
            JOIN users u ON u.id = e.agent_user_id
            LEFT JOIN assignments a ON a.id = e.assignment_id
            ORDER BY CASE WHEN e.status='OPEN' THEN 0 ELSE 1 END, e.id DESC
          `).all();
          return sendJson(res, 200, { tickets });
        }

        const escPatchMatch = pathname.match(/^\/api\/admin\/escalations\/(\d+)$/);
        if (method === 'PATCH' && escPatchMatch) {
          const tId = Number(escPatchMatch[1]);
          const b = await readBody(req);
          const ex = db.prepare('SELECT * FROM escalation_tickets WHERE id = ?').get(tId);
          if (!ex) return sendJson(res, 404, { error: '异常工单不存在' });
          const status = b.status || 'RESOLVED';
          const note = String(b.resolution_note || '').trim();
          const ts = nowIso();
          db.prepare('UPDATE escalation_tickets SET status=?, resolution_note=?, resolved_by_admin_id=?, resolved_at=? WHERE id=?')
            .run(status, note, admin.id, status === 'RESOLVED' ? ts : null, tId);
          if (note) {
            db.prepare('INSERT INTO agent_ai_messages (project_id, agent_user_id, assignment_id, sender, content, escalated, created_at) VALUES (?, ?, ?, \'human_cs\', ?, 0, ?)')
              .run(ex.project_id, ex.agent_user_id, ex.assignment_id, `【凌矩人工督导答复 · ${ex.code}】${note}`, ts);
          }
          logAudit(db, { actorUserId: admin.id, actorRole: 'admin', action: 'RESOLVE_ESCALATION', targetType: 'escalation_ticket', targetId: tId, detail: status, ipAddr });
          return sendJson(res, 200, { ok: true });
        }
      }

      // ================= AGENT ENDPOINTS =================
      if (pathname.startsWith('/api/agent/')) {
        const agent = requireAuth(req, res, ['agent']);
        if (!agent) return;

        if (method === 'GET' && pathname === '/api/agent/projects') {
          const rows = db.prepare("SELECT * FROM projects WHERE status='OPEN' AND compliance_path != 'DRAFT_INTERNAL_ONLY' ORDER BY id DESC").all();
          return sendJson(res, 200, { projects: rows.map((r) => sanitizeProjectForAgent(db, r, agent.id)) });
        }

        if (method === 'GET' && pathname === '/api/agent/scenes') {
          const cityFilter = String(urlObj.searchParams.get('city') || '').trim();
          const rows = cityFilter
            ? db.prepare("SELECT * FROM scenes WHERE tier='S2_RESERVE' AND public_status='AVAILABLE' AND city LIKE ? ORDER BY id DESC").all(`%${cityFilter}%`)
            : db.prepare("SELECT * FROM scenes WHERE tier='S2_RESERVE' AND public_status='AVAILABLE' ORDER BY id DESC").all();
          return sendJson(res, 200, { scenes: rows.map(sanitizeSceneForAgentPool) });
        }

        const ackMatch = pathname.match(/^\/api\/agent\/revisions\/(\d+)\/ack$/);
        if (method === 'POST' && ackMatch) {
          const revId = Number(ackMatch[1]);
          const rev = db.prepare('SELECT id FROM project_rule_revisions WHERE id = ?').get(revId);
          if (!rev) return sendJson(res, 404, { error: '规则版本不存在' });
          db.prepare('INSERT OR IGNORE INTO rule_acknowledgements (revision_id, agent_user_id, ack_ip, acked_at) VALUES (?, ?, ?, ?)')
            .run(revId, agent.id, ipAddr, nowIso());
          return sendJson(res, 200, { ok: true });
        }

        if (method === 'POST' && pathname === '/api/agent/assignments') {
          const b = await readBody(req);
          const projectId = Number(b.project_id || 0);
          const mode = b.mode;
          const sceneId = b.scene_id ? Number(b.scene_id) : null;
          const ownSceneDesc = String(b.own_scene_desc || '').trim();
          const quotaReq = Number(b.quota_hours_requested || 200);
          if (!(b.agreement_signed === true || b.agreement_signed === 1)) {
            return sendJson(res, 400, { error: '请先勾选签署《防绕单保密、禁止二次转包、首件熔断与背靠背结算协议》' });
          }

          const rawProject = db.prepare("SELECT * FROM projects WHERE id = ? AND status='OPEN' AND compliance_path != 'DRAFT_INTERNAL_ONLY'").get(projectId);
          if (!rawProject) return sendJson(res, 404, { error: '该项目不存在或尚未开放合规承接' });
          const proj = enrichProjectWithQuota(db, rawProject);
          if (quotaReq <= 0 || quotaReq > proj.remaining_quota_hours) {
            return sendJson(res, 400, { error: `申请配额须大于 0 且不能超出项目当前剩余可配额度（剩余 ${proj.remaining_quota_hours}h）` });
          }

          let appliedRate;
          if (mode === 'OWN_SCENE') {
            if (!ownSceneDesc) return sendJson(res, 400, { error: '请填写您自有场地的城市、类型与作业说明' });
            appliedRate = proj.agent_rate_own_scene_cny;
          } else if (mode === 'PLATFORM_SCENE') {
            if (!sceneId) return sendJson(res, 400, { error: '请选择一个可用的同城平台脱敏场景' });
            const sc = db.prepare("SELECT * FROM scenes WHERE id = ? AND tier='S2_RESERVE' AND public_status='AVAILABLE'").get(sceneId);
            if (!sc) return sendJson(res, 409, { error: '所选平台场景当前不可认领' });
            appliedRate = proj.agent_rate_platform_scene_cny;
          } else {
            return sendJson(res, 400, { error: '无效承接模式' });
          }

          const code = generateCode('ASG');
          const ts = nowIso();
          const info = db.prepare(`
            INSERT INTO assignments (
              code, project_id, agent_user_id, mode, scene_id, own_scene_desc,
              quota_hours_requested, applied_agent_rate_cny, agreement_signed, agreement_ip, agreement_at,
              status, first_piece_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'PENDING_APPROVAL', 'NOT_SUBMITTED', ?)
          `).run(code, projectId, agent.id, mode, sceneId, ownSceneDesc, quotaReq, appliedRate, ipAddr, ts, ts);

          logAudit(db, { actorUserId: agent.id, actorRole: 'agent', action: 'APPLY_PROJECT_QUOTA', targetType: 'assignment', targetId: info.lastInsertRowid, detail: `prj=${proj.code}, quota=${quotaReq}h`, ipAddr });
          return sendJson(res, 201, { ok: true, id: info.lastInsertRowid, code });
        }

        if (method === 'GET' && pathname === '/api/agent/assignments') {
          const rows = db.prepare(`
            SELECT a.*, p.code AS project_code, p.title AS project_title, p.modality, p.scene_category,
                   p.upstream_portal_mode, p.upstream_upload_guide, p.current_rule_version,
                   p.qa_red_lines, p.sop_summary, p.sop_full_internal,
                   p.first_piece_min_hours, p.first_piece_max_hours, p.settlement_days_after_client_pay,
                   s.code AS scene_code, s.province AS scene_province, s.city AS scene_city, s.district AS scene_district,
                   s.category AS scene_type, s.daily_work_desc, s.open_hours_desc,
                   s.real_store_name, s.real_contact_name, s.real_contact_phone, s.real_address
            FROM assignments a
            JOIN projects p ON p.id = a.project_id
            LEFT JOIN scenes s ON s.id = a.scene_id
            WHERE a.agent_user_id = ?
            ORDER BY a.id DESC
          `).all(agent.id);

          const unlockedStatuses = new Set(['FIRST_PIECE_TRIAL', 'BATCH_GREEN_LIGHT', 'PAUSED', 'COMPLETED']);
          const safeRows = rows.map((r) => {
            const isUnlocked = unlockedStatuses.has(r.status);
            const latestRev = db.prepare('SELECT id, version_code, change_summary, effective_at FROM project_rule_revisions WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(r.project_id);
            const ruleAcked = latestRev ? Boolean(db.prepare('SELECT id FROM rule_acknowledgements WHERE revision_id = ? AND agent_user_id = ?').get(latestRev.id, agent.id)) : true;
            return {
              id: r.id,
              code: r.code,
              project_id: r.project_id,
              project_code: r.project_code,
              project_title: r.project_title,
              modality: r.modality,
              scene_category: r.scene_category,
              upstream_portal_mode: r.upstream_portal_mode,
              upstream_upload_guide: r.upstream_upload_guide,
              current_rule_version: r.current_rule_version,
              latest_revision: latestRev ? { ...latestRev, acked_by_me: ruleAcked } : null,
              quota_hours_requested: r.quota_hours_requested,
              quota_hours_approved: r.quota_hours_approved,
              upstream_upload_account: isUnlocked ? r.upstream_upload_account : '[待锁单下发]',
              bound_device_ids: isUnlocked ? JSON.parse(r.bound_device_ids_json || '[]') : [],
              upload_channel_note: r.upload_channel_note,
              qa_red_lines: r.qa_red_lines,
              sop_summary: r.sop_summary,
              sop_full_internal: isUnlocked ? r.sop_full_internal : null,
              first_piece_min_hours: r.first_piece_min_hours,
              first_piece_max_hours: r.first_piece_max_hours,
              settlement_days_after_client_pay: r.settlement_days_after_client_pay,
              mode: r.mode,
              own_scene_desc: r.own_scene_desc,
              applied_agent_rate_cny: r.applied_agent_rate_cny,
              device_arrangement: r.device_arrangement,
              status: r.status,
              first_piece_status: r.first_piece_status,
              first_piece_review_note: r.first_piece_review_note,
              admin_note: r.admin_note,
              approved_at: r.approved_at,
              green_light_at: r.green_light_at,
              created_at: r.created_at,
              scene_info: r.scene_id
                ? {
                    code: r.scene_code, province: r.scene_province, city: r.scene_city, district: r.scene_district,
                    category: r.scene_type, daily_work_desc: r.daily_work_desc, open_hours_desc: r.open_hours_desc,
                    unlocked: isUnlocked,
                    real_store_name: isUnlocked ? r.real_store_name : '[待审批锁单后解锁]',
                    real_contact_name: isUnlocked ? r.real_contact_name : '[待解锁]',
                    real_contact_phone: isUnlocked ? r.real_contact_phone : '[待解锁]',
                    real_address: isUnlocked ? r.real_address : '[待解锁]',
                  }
                : null,
            };
          });
          return sendJson(res, 200, { assignments: safeRows });
        }

        if (method === 'POST' && pathname === '/api/agent/logs') {
          const b = await readBody(req);
          const asgId = Number(b.assignment_id || 0);
          const logDate = String(b.log_date || nowIso().slice(0, 10)).trim();
          const logType = b.log_type;
          const devicesUsed = Math.max(1, Number(b.devices_used || 1));
          const rawHours = Number(b.raw_hours || 0);
          const uploadedHours = Number(b.uploaded_hours || 0);
          const batchRef = String(b.batch_ref || '').trim();
          const agentNote = String(b.agent_note || '').trim();

          const asg = db.prepare(`
            SELECT a.*, p.first_piece_min_hours, p.first_piece_max_hours, p.title AS project_title
            FROM assignments a JOIN projects p ON p.id = a.project_id
            WHERE a.id = ? AND a.agent_user_id = ?
          `).get(asgId, agent.id);
          if (!asg) return sendJson(res, 404, { error: '派单不存在' });
          if (rawHours <= 0 || uploadedHours <= 0 || uploadedHours > rawHours) {
            return sendJson(res, 400, { error: '请填写合理的原始录制小时与已上传小时（已上传不能大于原始时长）' });
          }

          if (logType === 'FIRST_PIECE') {
            if (asg.status !== 'FIRST_PIECE_TRIAL') return sendJson(res, 400, { error: '当前派单不在首件试采阶段' });
            if (rawHours > asg.first_piece_max_hours) {
              return sendJson(res, 400, { error: `首件试采防损红线：本单首件样本上限为 ${asg.first_piece_max_hours} 原始小时` });
            }
            const ts = nowIso();
            const info = db.prepare(`
              INSERT INTO daily_logs (assignment_id, log_date, log_type, devices_used, raw_hours, uploaded_hours, batch_ref, agent_note, qa_status, settlement_stage, created_at, updated_at)
              VALUES (?, ?, 'FIRST_PIECE', ?, ?, ?, ?, ?, 'PENDING_QA', 'PENDING_QA', ?, ?)
            `).run(asgId, logDate, devicesUsed, rawHours, uploadedHours, batchRef, agentNote, ts, ts);
            db.prepare("UPDATE assignments SET first_piece_status='SUBMITTED' WHERE id=?").run(asgId);
            notifyFeishu('代理已提交首件样本', [`项目：${asg.project_title}`, `派单：${asg.code}（${uploadedHours}h）`, `请登录总控台点亮绿灯或打回`]);
            return sendJson(res, 201, { ok: true, id: info.lastInsertRowid });
          }

          if (logType === 'BATCH') {
            if (asg.status !== 'BATCH_GREEN_LIGHT' || asg.first_piece_status !== 'APPROVED') {
              return sendJson(res, 403, { error: '系统熔断拦截：该派单尚未通过 1–2 小时首件试采并点亮「批量开工绿灯」，禁止提交批量采集日报' });
            }
            // Enforce rule ack if a newer revision exists!
            const latestRev = db.prepare('SELECT id, version_code FROM project_rule_revisions WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(asg.project_id);
            if (latestRev) {
              const ack = db.prepare('SELECT id FROM rule_acknowledgements WHERE revision_id = ? AND agent_user_id = ?').get(latestRev.id, agent.id);
              if (!ack) {
                return sendJson(res, 409, { error: `本项目已发布最新规则 ${latestRev.version_code}，请先在交付卡片点击「确认已读新规」后再提交批量日报` });
              }
            }
            const ts = nowIso();
            const info = db.prepare(`
              INSERT INTO daily_logs (assignment_id, log_date, log_type, devices_used, raw_hours, uploaded_hours, batch_ref, agent_note, qa_status, settlement_stage, created_at, updated_at)
              VALUES (?, ?, 'BATCH', ?, ?, ?, ?, ?, 'PENDING_QA', 'PENDING_QA', ?, ?)
            `).run(asgId, logDate, devicesUsed, rawHours, uploadedHours, batchRef, agentNote, ts, ts);
            return sendJson(res, 201, { ok: true, id: info.lastInsertRowid });
          }
          return sendJson(res, 400, { error: '无效填报类型' });
        }

        // Agent's sanitized XiaoYou QA Evaluations & Estimated Fee (NEVER exposes upstream_name or upstream_base_rate!)
        if (method === 'GET' && pathname === '/api/agent/qa-reports') {
          const rows = db.prepare(`
            SELECT q.id, q.code, q.project_id, q.assignment_id, q.report_date, q.upstream_batch_ref,
                   q.uploaded_hours, q.valid_hours, q.invalid_hours, q.invalid_reasons_json,
                   q.xiaoyou_summary, q.estimated_agent_gross_cny, q.estimated_agent_tax_cny,
                   q.estimated_agent_net_cny, q.verify_status, q.created_at,
                   p.code AS project_code, p.title AS project_title, a.code AS assignment_code
            FROM xiaoyou_qa_reports q
            JOIN assignments a ON a.id = q.assignment_id
            JOIN projects p ON p.id = q.project_id
            WHERE a.agent_user_id = ?
            ORDER BY q.id DESC
          `).all(agent.id);
          return sendJson(res, 200, { reports: rows });
        }

        if (method === 'GET' && pathname === '/api/agent/logs') {
          const rows = db.prepare(`
            SELECT d.*, a.code AS assignment_code, a.applied_agent_rate_cny,
                   p.title AS project_title, p.settlement_days_after_client_pay,
                   u.tax_deduction_rate, u.entity_type
            FROM daily_logs d
            JOIN assignments a ON a.id = d.assignment_id
            JOIN projects p ON p.id = a.project_id
            JOIN users u ON u.id = a.agent_user_id
            WHERE a.agent_user_id = ?
            ORDER BY d.id DESC
          `).all(agent.id);
          const safeLogs = rows.map((r) => {
            const fin = computeFinancials({ ...r, upstream_base_rate_cny: 0, venue_fee_cny: 0 });
            return {
              id: r.id, assignment_id: r.assignment_id, assignment_code: r.assignment_code,
              project_title: r.project_title, log_date: r.log_date, log_type: r.log_type,
              devices_used: r.devices_used, raw_hours: r.raw_hours, uploaded_hours: r.uploaded_hours,
              batch_ref: r.batch_ref, qa_status: r.qa_status, qa_valid_hours: r.qa_valid_hours,
              qa_reject_reason: r.qa_reject_reason, settlement_stage: r.settlement_stage,
              settlement_days_after_client_pay: r.settlement_days_after_client_pay,
              applied_agent_rate_cny: r.applied_agent_rate_cny, payout_receipt_ref: r.payout_receipt_ref,
              agent_gross_cny: fin.agent_gross_cny, agent_tax_deduction_cny: fin.agent_tax_deduction_cny,
              agent_net_payable_cny: fin.agent_net_payable_cny, created_at: r.created_at,
            };
          });
          return sendJson(res, 200, { logs: safeLogs });
        }

        // Agent's isolated Project XiaoYou Chat & Escalation Trigger
        if (method === 'GET' && pathname === '/api/agent/ai-chat') {
          const projectId = Number(urlObj.searchParams.get('project_id') || 0);
          const msgs = db.prepare(`
            SELECT id, project_id, assignment_id, sender, content, escalated, created_at
            FROM agent_ai_messages WHERE project_id = ? AND agent_user_id = ? ORDER BY id ASC
          `).all(projectId, agent.id);
          return sendJson(res, 200, { messages: msgs });
        }

        if (method === 'POST' && pathname === '/api/agent/ai-chat') {
          const b = await readBody(req);
          const projectId = Number(b.project_id || 0);
          const question = String(b.content || '').trim();
          if (!question) return sendJson(res, 400, { error: '请输入要咨询专属小优的问题' });

          const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
          if (!project) return sendJson(res, 404, { error: '项目不存在' });
          const assignment = db.prepare('SELECT * FROM assignments WHERE project_id = ? AND agent_user_id = ? ORDER BY id DESC LIMIT 1').get(projectId, agent.id);
          const qaReports = assignment
            ? db.prepare('SELECT * FROM xiaoyou_qa_reports WHERE assignment_id = ? ORDER BY id DESC LIMIT 5').all(assignment.id)
            : [];
          const ruleRevs = db.prepare('SELECT * FROM project_rule_revisions WHERE project_id = ? ORDER BY id DESC LIMIT 3').all(projectId);

          const ts = nowIso();
          db.prepare('INSERT INTO agent_ai_messages (project_id, agent_user_id, assignment_id, sender, content, escalated, created_at) VALUES (?, ?, ?, \'agent\', ?, 0, ?)')
            .run(projectId, agent.id, assignment?.id || null, question, ts);

          const out = runProjectXiaoyouAssistant({ project, assignment, qaReports, ruleRevisions: ruleRevs, question });
          db.prepare('INSERT INTO agent_ai_messages (project_id, agent_user_id, assignment_id, sender, content, escalated, created_at) VALUES (?, ?, ?, \'xiaoyou\', ?, ?, ?)')
            .run(projectId, agent.id, assignment?.id || null, out.reply, out.shouldEscalate ? 1 : 0, ts);

          let ticketCode = null;
          if (out.shouldEscalate) {
            ticketCode = generateCode('ESC');
            db.prepare(`
              INSERT INTO escalation_tickets (code, project_id, assignment_id, agent_user_id, category, summary, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?)
            `).run(ticketCode, projectId, assignment?.id || null, agent.id, out.escalateCategory, out.escalateSummary, ts);
            notifyFeishu('小优触发人工升级工单', [`工单号：${ticketCode}`, `代理：${agent.display_name}`, `摘要：${out.escalateSummary}`]);
          }

          return sendJson(res, 201, { ok: true, reply: out.reply, escalated: out.shouldEscalate, ticket_code: ticketCode });
        }
      }

      // ================= STATIC FRONTEND =================
      if (method === 'GET' && !pathname.startsWith('/api/')) {
        const cleanPath = pathname === '/' ? '/index.html' : pathname;
        const fullPath = path.resolve(PUBLIC_DIR, `.${cleanPath}`);
        if (!fullPath.startsWith(PUBLIC_DIR) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
          const fallback = path.join(PUBLIC_DIR, 'index.html');
          if (fs.existsSync(fallback)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return fs.createReadStream(fallback).pipe(res);
          }
          res.writeHead(404);
          return res.end('Not Found');
        }
        const ext = path.extname(fullPath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        return fs.createReadStream(fullPath).pipe(res);
      }

      return sendJson(res, 404, { error: '接口不存在' });
    } catch (err) {
      if (err.message === 'INVALID_JSON') return sendJson(res, 400, { error: '请求 JSON 格式错误' });
      if (err.message === 'PAYLOAD_TOO_LARGE') return sendJson(res, 413, { error: '请求体过大' });
      console.error('[platform error]', err);
      return sendJson(res, 500, { error: '服务器内部错误' });
    }
  });

  return { server, db };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT || 3810);
  const host = process.env.HOST || '127.0.0.1';
  const dataDir = process.env.DATA_DIR || DEFAULT_DATA_DIR;
  const { server } = createApp({ dataDir });
  server.listen(port, host, () => {
    console.log(`[Lingju Platform v2.0] listening on http://${host}:${port} (dataDir=${dataDir})`);
  });
}
