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
} from './db.js';
import {
  getOrCreateSecret,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  parseCookies,
} from './auth.js';

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
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
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
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

// Strict DTO sanitizers to guarantee ZERO accidental leakage to Agent role
function sanitizeTaskForAgent(row) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    modality: row.modality,
    scene_category: row.scene_category,
    city_scope: row.city_scope,
    agent_rate_own_scene_cny: row.agent_rate_own_scene_cny,
    agent_rate_platform_scene_cny: row.agent_rate_platform_scene_cny,
    qa_red_lines: row.qa_red_lines,
    sop_summary: row.sop_summary,
    first_piece_min_hours: row.first_piece_min_hours,
    first_piece_max_hours: row.first_piece_max_hours,
    settlement_days_after_client_pay: row.settlement_days_after_client_pay,
    status: row.status,
    created_at: row.created_at,
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
    contact_unlock_notice: '已脱敏：提交认领并经凌矩总控审批锁单后解锁真实门店与对接人',
    created_at: row.created_at,
  };
}

export function createApp({ dbPath, dataDir = DEFAULT_DATA_DIR } = {}) {
  const resolvedDbPath = dbPath || path.join(dataDir, 'lingju_platform.db');
  const db = openDatabase(resolvedDbPath);
  const secret = getOrCreateSecret(dataDir);

  function getAuthUser(req) {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies.lj_session;
    const payload = verifyToken(token, secret);
    if (!payload || !payload.uid) return null;
    const user = db.prepare(`
      SELECT id, username, role, display_name, entity_type, tax_deduction_rate,
             deposit_status, deposit_amount_cny, city, verified_headcount, has_own_scene, status, notes
      FROM users WHERE id = ?
    `).get(payload.uid);
    if (!user || user.status !== 'ACTIVE') return null;
    return user;
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
      // ================= HEALTH =================
      if (method === 'GET' && pathname === '/api/health') {
        return sendJson(res, 200, { ok: true, service: 'lingju-agent-platform-v1', time: nowIso() });
      }

      // ================= AUTH =================
      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await readBody(req);
        const username = String(body.username || '').trim();
        const password = String(body.password || '');
        if (!username || !password) {
          return sendJson(res, 400, { error: '请输入账号和密码' });
        }
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user || !verifyPassword(password, user.password_hash)) {
          return sendJson(res, 401, { error: '账号或密码错误' });
        }
        if (user.status !== 'ACTIVE') {
          return sendJson(res, 403, { error: '该账号已暂停，请联系凌矩总控' });
        }
        const token = signToken({ uid: user.id, role: user.role }, secret);
        logAudit(db, {
          actorUserId: user.id,
          actorRole: user.role,
          action: 'LOGIN',
          targetType: 'user',
          targetId: user.id,
          ipAddr,
        });
        const secureFlag = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
        return sendJson(
          res,
          200,
          {
            user: {
              id: user.id,
              username: user.username,
              role: user.role,
              display_name: user.display_name,
              entity_type: user.entity_type,
              tax_deduction_rate: user.tax_deduction_rate,
              deposit_status: user.deposit_status,
              city: user.city,
            },
          },
          {
            'Set-Cookie': `lj_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secureFlag}`,
          }
        );
      }

      if (method === 'POST' && pathname === '/api/auth/logout') {
        return sendJson(
          res,
          200,
          { ok: true },
          { 'Set-Cookie': 'lj_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' }
        );
      }

      if (method === 'GET' && pathname === '/api/auth/me') {
        const user = getAuthUser(req);
        return sendJson(res, 200, { user: user || null });
      }

      // Explicitly block public self-registration (Audit Item 5 & Module 1 C-class prevention)
      if (pathname === '/api/auth/register') {
        return sendJson(res, 403, { error: '本平台不开放公开自主注册，代理商须经凌矩总控核验后由后台发号' });
      }

      // ================= PUBLIC: 30-SEC IP SCENE LEAD FORM =================
      if (method === 'POST' && pathname === '/api/public/scene-leads') {
        const body = await readBody(req);
        const province = String(body.province || '').trim();
        const city = String(body.city || '').trim();
        const district = String(body.district || '').trim();
        const category = String(body.category || '').trim();
        const dailyWorkDesc = String(body.daily_work_desc || '').trim();
        const openHoursDesc = String(body.open_hours_desc || '').trim();
        const capacity = Math.max(1, Number(body.estimated_device_capacity || 1));
        const storeName = String(body.real_store_name || '').trim();
        const contactName = String(body.real_contact_name || '').trim();
        const contactPhone = String(body.real_contact_phone || '').trim();
        const address = String(body.real_address || '').trim();
        const zeroPromiseAck = body.zero_promise_ack === true || body.zero_promise_ack === 1;

        if (!province || !city || !category || !dailyWorkDesc || !storeName || !contactName || !contactPhone || !address) {
          return sendJson(res, 400, { error: '请完整填写城市、场景类型、日常真实作业、店名及联系方式' });
        }
        if (!zeroPromiseAck) {
          return sendJson(res, 400, { error: '请先勾选确认“免费备案、匹配同城同行业甲方任务时再联系、不承诺立刻排单”说明' });
        }

        const code = generateCode('SCN');
        const info = db.prepare(`
          INSERT INTO scenes (
            code, province, city, district, category, daily_work_desc, open_hours_desc,
            estimated_device_capacity, tier, public_status,
            real_store_name, real_contact_name, real_contact_phone, real_address,
            source_channel, zero_promise_ack, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_REVIEW', 'HIDDEN', ?, ?, ?, ?, 'DOUYIN_IP', 1, ?)
        `).run(
          code, province, city, district, category, dailyWorkDesc, openHoursDesc,
          capacity, storeName, contactName, contactPhone, address, nowIso()
        );

        logAudit(db, {
          actorRole: 'public_scene_owner',
          action: 'SUBMIT_IP_SCENE_LEAD',
          targetType: 'scene',
          targetId: info.lastInsertRowid,
          detail: `${province}-${city} ${category}`,
          ipAddr,
        });

        return sendJson(res, 201, {
          ok: true,
          code,
          message: '您的场景信息已免费备案进入凌矩全国储备库。待匹配到您所在行业与城市的正式甲方任务及认证团队时，工作人员将与您核对进场细节（不收费、不承诺立刻排单）。',
        });
      }

      // ================= ADMIN ENDPOINTS =================
      if (pathname.startsWith('/api/admin/')) {
        const admin = requireAuth(req, res, ['admin']);
        if (!admin) return;

        if (method === 'GET' && pathname === '/api/admin/overview') {
          const stats = {
            active_agents: db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='agent' AND status='ACTIVE'").get().c,
            open_compliant_tasks: db.prepare("SELECT COUNT(*) AS c FROM task_packs WHERE status='OPEN' AND compliance_path != 'DRAFT_INTERNAL_ONLY'").get().c,
            draft_tasks: db.prepare("SELECT COUNT(*) AS c FROM task_packs WHERE compliance_path = 'DRAFT_INTERNAL_ONLY'").get().c,
            scenes_pending: db.prepare("SELECT COUNT(*) AS c FROM scenes WHERE tier='PENDING_REVIEW'").get().c,
            scenes_s2: db.prepare("SELECT COUNT(*) AS c FROM scenes WHERE tier='S2_RESERVE'").get().c,
            scenes_s1: db.prepare("SELECT COUNT(*) AS c FROM scenes WHERE tier='S1_BENCHMARK'").get().c,
            assignments_pending: db.prepare("SELECT COUNT(*) AS c FROM assignments WHERE status='PENDING_APPROVAL'").get().c,
            first_piece_pending: db.prepare("SELECT COUNT(*) AS c FROM assignments WHERE status='FIRST_PIECE_TRIAL' AND first_piece_status='SUBMITTED'").get().c,
            green_light_active: db.prepare("SELECT COUNT(*) AS c FROM assignments WHERE status='BATCH_GREEN_LIGHT'").get().c,
            logs_pending_qa: db.prepare("SELECT COUNT(*) AS c FROM daily_logs WHERE qa_status='PENDING_QA'").get().c,
            logs_ready_to_settle: db.prepare("SELECT COUNT(*) AS c FROM daily_logs WHERE settlement_stage='CLIENT_PAID_READY_TO_SETTLE'").get().c,
          };
          return sendJson(res, 200, { stats });
        }

        // --- Agents Management (Admin-issued accounts only) ---
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
          const hasOwnScene = b.has_own_scene ? 1 : 0;
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
            `).run(
              username, hashPassword(password), displayName, entityType, taxRate,
              depositStatus, depositAmount, city, headcount, hasOwnScene, notes, nowIso()
            );
            logAudit(db, {
              actorUserId: admin.id, actorRole: 'admin', action: 'CREATE_AGENT',
              targetType: 'user', targetId: info.lastInsertRowid, detail: `${displayName} (${entityType}, ${depositStatus})`, ipAddr,
            });
            return sendJson(res, 201, { ok: true, id: info.lastInsertRowid });
          } catch (e) {
            if (String(e.message).includes('UNIQUE')) {
              return sendJson(res, 409, { error: '该登录账号已存在' });
            }
            throw e;
          }
        }

        const agentStatusMatch = pathname.match(/^\/api\/admin\/agents\/(\d+)$/);
        if (method === 'PATCH' && agentStatusMatch) {
          const agentId = Number(agentStatusMatch[1]);
          const b = await readBody(req);
          const existing = db.prepare("SELECT * FROM users WHERE id = ? AND role='agent'").get(agentId);
          if (!existing) return sendJson(res, 404, { error: '代理账号不存在' });

          const status = b.status || existing.status;
          const depositStatus = b.deposit_status || existing.deposit_status;
          const depositAmount = b.deposit_amount_cny !== undefined ? Number(b.deposit_amount_cny) : existing.deposit_amount_cny;
          const taxRate = b.tax_deduction_rate !== undefined ? Number(b.tax_deduction_rate) : existing.tax_deduction_rate;
          const notes = b.notes !== undefined ? String(b.notes) : existing.notes;
          const newPwHash = b.new_password && String(b.new_password).length >= 6
            ? hashPassword(String(b.new_password))
            : existing.password_hash;

          db.prepare(`
            UPDATE users
            SET status = ?, deposit_status = ?, deposit_amount_cny = ?, tax_deduction_rate = ?, notes = ?, password_hash = ?
            WHERE id = ?
          `).run(status, depositStatus, depositAmount, taxRate, notes, newPwHash, agentId);

          logAudit(db, {
            actorUserId: admin.id, actorRole: 'admin', action: 'UPDATE_AGENT',
            targetType: 'user', targetId: agentId, detail: `status=${status}, deposit=${depositStatus}`, ipAddr,
          });
          return sendJson(res, 200, { ok: true });
        }

        // --- Task Packs Management ---
        if (method === 'GET' && pathname === '/api/admin/tasks') {
          const tasks = db.prepare('SELECT * FROM task_packs ORDER BY id DESC').all();
          return sendJson(res, 200, { tasks });
        }

        if (method === 'POST' && pathname === '/api/admin/tasks') {
          const b = await readBody(req);
          const title = String(b.title || '').trim();
          const upstreamName = String(b.upstream_name_internal || '').trim();
          const baseRate = Number(b.upstream_base_rate_cny || 0);
          const ownRate = Number(b.agent_rate_own_scene_cny || 0);
          const platRate = Number(b.agent_rate_platform_scene_cny || 0);
          const modality = String(b.modality || 'EGO第一视角').trim();
          const sceneCategory = String(b.scene_category || '').trim();
          const cityScope = String(b.city_scope || '全国适用').trim();
          const compliancePath = b.compliance_path || 'DRAFT_INTERNAL_ONLY';
          const sceneOwnerFeeNote = String(b.scene_owner_fee_note || '').trim();
          const qaRedLines = String(b.qa_red_lines || '').trim();
          const sopSummary = String(b.sop_summary || '').trim();
          const sopFull = String(b.sop_full_internal || '').trim();
          const minH = Number(b.first_piece_min_hours || 1.0);
          const maxH = Number(b.first_piece_max_hours || 2.0);
          const settleDays = Math.max(1, Number(b.settlement_days_after_client_pay || 5));

          if (!title || !upstreamName || baseRate <= 0 || ownRate <= 0 || platRate <= 0 || !sceneCategory || !qaRedLines) {
            return sendJson(res, 400, { error: '请填写任务标题、内部甲方名称、甲方底价、两档代理净价、场景类别及QA红线' });
          }
          if (ownRate >= baseRate || platRate > ownRate) {
            return sendJson(res, 400, { error: '定价校验失败：代理净价须低于甲方底价，且使用平台场景的净价不应高于自带场景净价' });
          }

          const code = generateCode('TP');
          const info = db.prepare(`
            INSERT INTO task_packs (
              code, title, upstream_name_internal, upstream_base_rate_cny, modality, scene_category,
              city_scope, compliance_path, agent_rate_own_scene_cny, agent_rate_platform_scene_cny,
              scene_owner_fee_note, qa_red_lines, sop_summary, sop_full_internal,
              first_piece_min_hours, first_piece_max_hours, settlement_days_after_client_pay, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
          `).run(
            code, title, upstreamName, baseRate, modality, sceneCategory,
            cityScope, compliancePath, ownRate, platRate,
            sceneOwnerFeeNote, qaRedLines, sopSummary || qaRedLines, sopFull || sopSummary || qaRedLines,
            minH, maxH, settleDays, nowIso()
          );

          logAudit(db, {
            actorUserId: admin.id, actorRole: 'admin', action: 'CREATE_TASK_PACK',
            targetType: 'task_pack', targetId: info.lastInsertRowid, detail: `${code} (${compliancePath})`, ipAddr,
          });
          return sendJson(res, 201, { ok: true, id: info.lastInsertRowid, code });
        }

        const taskPatchMatch = pathname.match(/^\/api\/admin\/tasks\/(\d+)$/);
        if (method === 'PATCH' && taskPatchMatch) {
          const taskId = Number(taskPatchMatch[1]);
          const b = await readBody(req);
          const existing = db.prepare('SELECT * FROM task_packs WHERE id = ?').get(taskId);
          if (!existing) return sendJson(res, 404, { error: '任务包不存在' });

          const compliancePath = b.compliance_path || existing.compliance_path;
          const status = b.status || existing.status;
          db.prepare('UPDATE task_packs SET compliance_path = ?, status = ? WHERE id = ?')
            .run(compliancePath, status, taskId);

          logAudit(db, {
            actorUserId: admin.id, actorRole: 'admin', action: 'UPDATE_TASK_PACK',
            targetType: 'task_pack', targetId: taskId, detail: `compliance=${compliancePath}, status=${status}`, ipAddr,
          });
          return sendJson(res, 200, { ok: true });
        }

        // --- Scenes Management (S1 Benchmark vs S2 Reserve) ---
        if (method === 'GET' && pathname === '/api/admin/scenes') {
          const scenes = db.prepare('SELECT * FROM scenes ORDER BY id DESC').all();
          return sendJson(res, 200, { scenes });
        }

        const scenePatchMatch = pathname.match(/^\/api\/admin\/scenes\/(\d+)$/);
        if (method === 'PATCH' && scenePatchMatch) {
          const sceneId = Number(scenePatchMatch[1]);
          const b = await readBody(req);
          const existing = db.prepare('SELECT * FROM scenes WHERE id = ?').get(sceneId);
          if (!existing) return sendJson(res, 404, { error: '场景不存在' });

          const tier = b.tier || existing.tier;
          // Enforce S1_BENCHMARK / PENDING_REVIEW / REJECTED are ALWAYS HIDDEN from agents!
          let publicStatus = b.public_status || existing.public_status;
          if (tier !== 'S2_RESERVE') {
            publicStatus = 'HIDDEN';
          }
          const venueFeeModel = b.venue_fee_model !== undefined ? String(b.venue_fee_model) : existing.venue_fee_model;
          const reviewNote = b.review_note !== undefined ? String(b.review_note) : existing.review_note;

          db.prepare(`
            UPDATE scenes SET tier = ?, public_status = ?, venue_fee_model = ?, review_note = ? WHERE id = ?
          `).run(tier, publicStatus, venueFeeModel, reviewNote, sceneId);

          logAudit(db, {
            actorUserId: admin.id, actorRole: 'admin', action: 'TRIAGE_SCENE',
            targetType: 'scene', targetId: sceneId, detail: `tier=${tier}, public_status=${publicStatus}`, ipAddr,
          });
          return sendJson(res, 200, { ok: true, tier, public_status: publicStatus });
        }

        // --- Assignments Approval & First-Piece Green Light ---
        if (method === 'GET' && pathname === '/api/admin/assignments') {
          const rows = db.prepare(`
            SELECT a.*, t.code AS task_code, t.title AS task_title, t.upstream_name_internal,
                   t.upstream_base_rate_cny, t.compliance_path,
                   u.display_name AS agent_name, u.entity_type, u.deposit_status, u.city AS agent_city,
                   s.code AS scene_code, s.city AS scene_city, s.category AS scene_category,
                   s.real_store_name, s.real_contact_name, s.real_contact_phone
            FROM assignments a
            JOIN task_packs t ON t.id = a.task_pack_id
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
          const decision = b.decision; // 'APPROVE' | 'REJECT'
          const deviceArrangement = b.device_arrangement || 'PLATFORM_ISSUED_DEPOSIT';
          const adminNote = String(b.admin_note || '').trim();

          const asg = db.prepare('SELECT * FROM assignments WHERE id = ?').get(asgId);
          if (!asg) return sendJson(res, 404, { error: '认领单不存在' });
          if (asg.status !== 'PENDING_APPROVAL') {
            return sendJson(res, 400, { error: '该认领单不处于待审批状态' });
          }

          if (decision === 'REJECT') {
            db.prepare("UPDATE assignments SET status='REJECTED', admin_note=? WHERE id=?").run(adminNote, asgId);
            logAudit(db, {
              actorUserId: admin.id, actorRole: 'admin', action: 'REJECT_ASSIGNMENT',
              targetType: 'assignment', targetId: asgId, detail: adminNote, ipAddr,
            });
            return sendJson(res, 200, { ok: true, status: 'REJECTED' });
          }

          if (decision !== 'APPROVE') {
            return sendJson(res, 400, { error: '无效审批操作' });
          }

          // Check deposit guardrail unless agent brings own device or has valid deposit/waiver
          const agent = db.prepare('SELECT * FROM users WHERE id = ?').get(asg.agent_user_id);
          if (deviceArrangement === 'PLATFORM_ISSUED_DEPOSIT' && agent.deposit_status === 'UNPAID') {
            return sendJson(res, 400, {
              error: '该代理尚未缴纳设备押金或企业担保；请先在代理库更新押金/担保状态，或改选“代理自带设备”/“熟人特批免押”',
            });
          }

          // Lock platform scene if mode is PLATFORM_SCENE
          if (asg.mode === 'PLATFORM_SCENE' && asg.scene_id) {
            const sc = db.prepare('SELECT * FROM scenes WHERE id = ?').get(asg.scene_id);
            if (!sc || sc.public_status !== 'AVAILABLE') {
              return sendJson(res, 409, { error: '该平台场景已被其他单锁定或不可用' });
            }
            db.prepare("UPDATE scenes SET public_status='LOCKED' WHERE id=?").run(asg.scene_id);
          }

          // Always enter FIRST_PIECE_TRIAL first (NEVER jump straight to BATCH_GREEN_LIGHT — Audit Item 2!)
          db.prepare(`
            UPDATE assignments
            SET status='FIRST_PIECE_TRIAL', first_piece_status='NOT_SUBMITTED',
                device_arrangement=?, admin_note=?, approved_at=?
            WHERE id=?
          `).run(deviceArrangement, adminNote, nowIso(), asgId);

          logAudit(db, {
            actorUserId: admin.id, actorRole: 'admin', action: 'APPROVE_ASSIGNMENT_ENTER_FIRST_PIECE',
            targetType: 'assignment', targetId: asgId, detail: `device=${deviceArrangement}; ${adminNote}`, ipAddr,
          });
          return sendJson(res, 200, { ok: true, status: 'FIRST_PIECE_TRIAL' });
        }

        const fpReviewMatch = pathname.match(/^\/api\/admin\/assignments\/(\d+)\/first-piece-review$/);
        if (method === 'POST' && fpReviewMatch) {
          const asgId = Number(fpReviewMatch[1]);
          const b = await readBody(req);
          const decision = b.decision; // 'APPROVE_GREEN_LIGHT' | 'REJECT_RETRY'
          const note = String(b.review_note || '').trim();

          const asg = db.prepare('SELECT * FROM assignments WHERE id = ?').get(asgId);
          if (!asg) return sendJson(res, 404, { error: '派单不存在' });
          if (asg.status !== 'FIRST_PIECE_TRIAL' || asg.first_piece_status !== 'SUBMITTED') {
            return sendJson(res, 400, { error: '该派单尚未提交首件试采样片，无法审核点亮绿灯' });
          }

          if (decision === 'APPROVE_GREEN_LIGHT') {
            db.prepare(`
              UPDATE assignments
              SET status='BATCH_GREEN_LIGHT', first_piece_status='APPROVED',
                  first_piece_review_note=?, green_light_at=?
              WHERE id=?
            `).run(note || '首件过审，正式点亮批量开工绿灯', nowIso(), asgId);
            logAudit(db, {
              actorUserId: admin.id, actorRole: 'admin', action: 'APPROVE_FIRST_PIECE_GREEN_LIGHT',
              targetType: 'assignment', targetId: asgId, detail: note, ipAddr,
            });
            return sendJson(res, 200, { ok: true, status: 'BATCH_GREEN_LIGHT' });
          }

          if (decision === 'REJECT_RETRY') {
            db.prepare(`
              UPDATE assignments
              SET first_piece_status='REJECTED', first_piece_review_note=?
              WHERE id=?
            `).run(note || '首件未达标，请按驳回原因整改后重提首件', asgId);
            logAudit(db, {
              actorUserId: admin.id, actorRole: 'admin', action: 'REJECT_FIRST_PIECE',
              targetType: 'assignment', targetId: asgId, detail: note, ipAddr,
            });
            return sendJson(res, 200, { ok: true, first_piece_status: 'REJECTED' });
          }

          return sendJson(res, 400, { error: '无效首件审核动作' });
        }

        // --- Daily Logs QA & Back-to-Back Settlement Ledger ---
        if (method === 'GET' && pathname === '/api/admin/logs') {
          const rows = db.prepare(`
            SELECT d.*, a.code AS assignment_code, a.mode, a.applied_agent_rate_cny,
                   t.title AS task_title, t.upstream_name_internal, t.upstream_base_rate_cny,
                   t.settlement_days_after_client_pay,
                   u.display_name AS agent_name, u.entity_type, u.tax_deduction_rate,
                   s.code AS scene_code, s.real_store_name
            FROM daily_logs d
            JOIN assignments a ON a.id = d.assignment_id
            JOIN task_packs t ON t.id = a.task_pack_id
            JOIN users u ON u.id = a.agent_user_id
            LEFT JOIN scenes s ON s.id = a.scene_id
            ORDER BY d.id DESC
          `).all();
          const enriched = rows.map((r) => ({ ...r, financials: computeFinancials(r) }));
          return sendJson(res, 200, { logs: enriched });
        }

        const logPatchMatch = pathname.match(/^\/api\/admin\/logs\/(\d+)$/);
        if (method === 'PATCH' && logPatchMatch) {
          const logId = Number(logPatchMatch[1]);
          const b = await readBody(req);
          const existing = db.prepare('SELECT * FROM daily_logs WHERE id = ?').get(logId);
          if (!existing) return sendJson(res, 404, { error: '日报批次不存在' });

          const qaStatus = b.qa_status || existing.qa_status;
          const qaValidHours = b.qa_valid_hours !== undefined ? Number(b.qa_valid_hours) : existing.qa_valid_hours;
          const qaRejectReason = b.qa_reject_reason !== undefined ? String(b.qa_reject_reason) : existing.qa_reject_reason;
          const venueFee = b.venue_fee_cny !== undefined ? Number(b.venue_fee_cny) : existing.venue_fee_cny;
          const venueVoucher = b.venue_fee_voucher_status || existing.venue_fee_voucher_status;
          const agentInvoice = b.agent_invoice_status || existing.agent_invoice_status;
          const payoutRef = b.payout_receipt_ref !== undefined ? String(b.payout_receipt_ref).trim() : existing.payout_receipt_ref;

          let stage = b.settlement_stage || existing.settlement_stage;
          if (qaStatus === 'PENDING_QA') {
            stage = 'PENDING_QA';
          } else if (qaStatus === 'QA_REJECTED') {
            stage = 'PENDING_QA';
          } else if (qaStatus === 'QA_CONFIRMED' && stage === 'PENDING_QA') {
            stage = 'PENDING_CLIENT_PAYMENT';
          }

          // Enforce back-to-back payout receipt rule: cannot mark SETTLED_PAID without a bank receipt ref!
          if (stage === 'SETTLED_PAID' && !payoutRef) {
            return sendJson(res, 400, { error: '标记“已打款”必须填写公户转账回单号/付款凭证编号' });
          }
          if (qaValidHours < 0 || qaValidHours > existing.uploaded_hours) {
            return sendJson(res, 400, { error: 'QA有效小时不能为负，且不能超过已上传小时数' });
          }

          db.prepare(`
            UPDATE daily_logs
            SET qa_status=?, qa_valid_hours=?, qa_reject_reason=?, settlement_stage=?,
                venue_fee_cny=?, venue_fee_voucher_status=?, agent_invoice_status=?,
                payout_receipt_ref=?, updated_at=?
            WHERE id=?
          `).run(
            qaStatus, qaValidHours, qaRejectReason, stage,
            venueFee, venueVoucher, agentInvoice, payoutRef, nowIso(), logId
          );

          logAudit(db, {
            actorUserId: admin.id, actorRole: 'admin', action: 'UPDATE_QA_AND_SETTLEMENT',
            targetType: 'daily_log', targetId: logId,
            detail: `qa=${qaStatus}(${qaValidHours}h), stage=${stage}, venueFee=${venueFee}, receipt=${payoutRef}`,
            ipAddr,
          });
          return sendJson(res, 200, { ok: true, settlement_stage: stage });
        }

        if (method === 'GET' && pathname === '/api/admin/audit-logs') {
          const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100').all();
          return sendJson(res, 200, { audit_logs: logs });
        }
      }

      // ================= AGENT ENDPOINTS =================
      if (pathname.startsWith('/api/agent/')) {
        const agent = requireAuth(req, res, ['agent']);
        if (!agent) return;

        // Task hall: ONLY OPEN tasks with a legal compliance path, strictly sanitized (NO upstream name/base rate/internal SOP)
        if (method === 'GET' && pathname === '/api/agent/tasks') {
          const rows = db.prepare(`
            SELECT * FROM task_packs
            WHERE status = 'OPEN' AND compliance_path != 'DRAFT_INTERNAL_ONLY'
            ORDER BY id DESC
          `).all();
          return sendJson(res, 200, { tasks: rows.map(sanitizeTaskForAgent) });
        }

        // Scene pool: ONLY S2_RESERVE scenes with public_status='AVAILABLE', strictly desensitized!
        if (method === 'GET' && pathname === '/api/agent/scenes') {
          const cityFilter = String(urlObj.searchParams.get('city') || '').trim();
          let rows;
          if (cityFilter) {
            rows = db.prepare(`
              SELECT * FROM scenes
              WHERE tier = 'S2_RESERVE' AND public_status = 'AVAILABLE' AND city LIKE ?
              ORDER BY id DESC
            `).all(`%${cityFilter}%`);
          } else {
            rows = db.prepare(`
              SELECT * FROM scenes
              WHERE tier = 'S2_RESERVE' AND public_status = 'AVAILABLE'
              ORDER BY id DESC
            `).all();
          }
          return sendJson(res, 200, { scenes: rows.map(sanitizeSceneForAgentPool) });
        }

        // Agent applies to claim a task (+ optional S2 platform scene)
        if (method === 'POST' && pathname === '/api/agent/assignments') {
          const b = await readBody(req);
          const taskPackId = Number(b.task_pack_id || 0);
          const mode = b.mode; // 'OWN_SCENE' | 'PLATFORM_SCENE'
          const sceneId = b.scene_id ? Number(b.scene_id) : null;
          const ownSceneDesc = String(b.own_scene_desc || '').trim();
          const agreementSigned = b.agreement_signed === true || b.agreement_signed === 1;

          if (!agreementSigned) {
            return sendJson(res, 400, { error: '请先勾选签署《防绕单保密、禁止二次转包、首件熔断与背靠背结算协议》' });
          }

          const task = db.prepare(`
            SELECT * FROM task_packs WHERE id = ? AND status = 'OPEN' AND compliance_path != 'DRAFT_INTERNAL_ONLY'
          `).get(taskPackId);
          if (!task) {
            return sendJson(res, 404, { error: '该任务包不存在或尚未开放合规承接' });
          }

          let appliedRate;
          if (mode === 'OWN_SCENE') {
            if (!ownSceneDesc) return sendJson(res, 400, { error: '选择自带场景时，请填写您自有场地的城市、类型与作业简述' });
            appliedRate = task.agent_rate_own_scene_cny;
          } else if (mode === 'PLATFORM_SCENE') {
            if (!sceneId) return sendJson(res, 400, { error: '请选择一个可用的同城平台脱敏场景' });
            const sc = db.prepare(`
              SELECT * FROM scenes WHERE id = ? AND tier = 'S2_RESERVE' AND public_status = 'AVAILABLE'
            `).get(sceneId);
            if (!sc) return sendJson(res, 409, { error: '所选平台场景当前不可认领' });
            appliedRate = task.agent_rate_platform_scene_cny;
          } else {
            return sendJson(res, 400, { error: '无效承接模式' });
          }

          const code = generateCode('ASG');
          const ts = nowIso();
          const info = db.prepare(`
            INSERT INTO assignments (
              code, task_pack_id, agent_user_id, mode, scene_id, own_scene_desc,
              applied_agent_rate_cny, agreement_signed, agreement_ip, agreement_at,
              status, first_piece_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'PENDING_APPROVAL', 'NOT_SUBMITTED', ?)
          `).run(code, taskPackId, agent.id, mode, sceneId, ownSceneDesc, appliedRate, ipAddr, ts, ts);

          logAudit(db, {
            actorUserId: agent.id, actorRole: 'agent', action: 'APPLY_ASSIGNMENT',
            targetType: 'assignment', targetId: info.lastInsertRowid,
            detail: `task=${task.code}, mode=${mode}, rate=${appliedRate}`, ipAddr,
          });
          return sendJson(res, 201, { ok: true, id: info.lastInsertRowid, code });
        }

        // Agent's own assignments (unlocks full SOP & real scene contact ONLY after Admin approval!)
        if (method === 'GET' && pathname === '/api/agent/assignments') {
          const rows = db.prepare(`
            SELECT a.*, t.code AS task_code, t.title AS task_title, t.modality, t.scene_category,
                   t.qa_red_lines, t.sop_summary, t.sop_full_internal,
                   t.first_piece_min_hours, t.first_piece_max_hours, t.settlement_days_after_client_pay,
                   s.code AS scene_code, s.province AS scene_province, s.city AS scene_city, s.district AS scene_district,
                   s.category AS scene_type, s.daily_work_desc, s.open_hours_desc,
                   s.real_store_name, s.real_contact_name, s.real_contact_phone, s.real_address
            FROM assignments a
            JOIN task_packs t ON t.id = a.task_pack_id
            LEFT JOIN scenes s ON s.id = a.scene_id
            WHERE a.agent_user_id = ?
            ORDER BY a.id DESC
          `).all(agent.id);

          const unlockedStatuses = new Set(['FIRST_PIECE_TRIAL', 'BATCH_GREEN_LIGHT', 'PAUSED', 'COMPLETED']);
          const safeRows = rows.map((r) => {
            const isUnlocked = unlockedStatuses.has(r.status);
            return {
              id: r.id,
              code: r.code,
              task_pack_id: r.task_pack_id,
              task_code: r.task_code,
              task_title: r.task_title,
              modality: r.modality,
              scene_category: r.scene_category,
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
                    code: r.scene_code,
                    province: r.scene_province,
                    city: r.scene_city,
                    district: r.scene_district,
                    category: r.scene_type,
                    daily_work_desc: r.daily_work_desc,
                    open_hours_desc: r.open_hours_desc,
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

        // Agent submits FIRST_PIECE or BATCH daily log — ENFORCES HARD FIRST-PIECE GREEN LIGHT LOCK!
        if (method === 'POST' && pathname === '/api/agent/logs') {
          const b = await readBody(req);
          const asgId = Number(b.assignment_id || 0);
          const logDate = String(b.log_date || nowIso().slice(0, 10)).trim();
          const logType = b.log_type; // 'FIRST_PIECE' | 'BATCH'
          const devicesUsed = Math.max(1, Number(b.devices_used || 1));
          const rawHours = Number(b.raw_hours || 0);
          const uploadedHours = Number(b.uploaded_hours || 0);
          const batchRef = String(b.batch_ref || '').trim();
          const agentNote = String(b.agent_note || '').trim();

          const asg = db.prepare(`
            SELECT a.*, t.first_piece_min_hours, t.first_piece_max_hours
            FROM assignments a
            JOIN task_packs t ON t.id = a.task_pack_id
            WHERE a.id = ? AND a.agent_user_id = ?
          `).get(asgId, agent.id);
          if (!asg) return sendJson(res, 404, { error: '派单不存在' });

          if (rawHours <= 0 || uploadedHours <= 0 || uploadedHours > rawHours) {
            return sendJson(res, 400, { error: '请填写合理的原始录制小时与已上传小时（已上传不能大于原始时长）' });
          }

          if (logType === 'FIRST_PIECE') {
            if (asg.status !== 'FIRST_PIECE_TRIAL') {
              return sendJson(res, 400, { error: '当前派单不在首件试采阶段' });
            }
            if (rawHours > asg.first_piece_max_hours) {
              return sendJson(res, 400, {
                error: `首件试采防损红线：本单首件样本上限为 ${asg.first_piece_max_hours} 原始小时，禁止未过绿灯前大批量猛采`,
              });
            }
            const ts = nowIso();
            const info = db.prepare(`
              INSERT INTO daily_logs (
                assignment_id, log_date, log_type, devices_used, raw_hours, uploaded_hours,
                batch_ref, agent_note, qa_status, settlement_stage, created_at, updated_at
              ) VALUES (?, ?, 'FIRST_PIECE', ?, ?, ?, ?, ?, 'PENDING_QA', 'PENDING_QA', ?, ?)
            `).run(asgId, logDate, devicesUsed, rawHours, uploadedHours, batchRef, agentNote, ts, ts);

            db.prepare("UPDATE assignments SET first_piece_status='SUBMITTED' WHERE id=?").run(asgId);

            logAudit(db, {
              actorUserId: agent.id, actorRole: 'agent', action: 'SUBMIT_FIRST_PIECE',
              targetType: 'daily_log', targetId: info.lastInsertRowid,
              detail: `asg=${asg.code}, raw=${rawHours}h, uploaded=${uploadedHours}h`, ipAddr,
            });
            return sendJson(res, 201, { ok: true, id: info.lastInsertRowid });
          }

          if (logType === 'BATCH') {
            // SYSTEM-LEVEL HARD LOCK (Audit Item 2): Cannot submit BATCH without APPROVED Green Light!
            if (asg.status !== 'BATCH_GREEN_LIGHT' || asg.first_piece_status !== 'APPROVED') {
              return sendJson(res, 403, {
                error: '系统熔断拦截：该派单尚未通过 1–2 小时首件试采并点亮「批量开工绿灯」，禁止提交批量采集日报（所有代理一视同仁，不可跳过）',
              });
            }
            const ts = nowIso();
            const info = db.prepare(`
              INSERT INTO daily_logs (
                assignment_id, log_date, log_type, devices_used, raw_hours, uploaded_hours,
                batch_ref, agent_note, qa_status, settlement_stage, created_at, updated_at
              ) VALUES (?, ?, 'BATCH', ?, ?, ?, ?, ?, 'PENDING_QA', 'PENDING_QA', ?, ?)
            `).run(asgId, logDate, devicesUsed, rawHours, uploadedHours, batchRef, agentNote, ts, ts);

            logAudit(db, {
              actorUserId: agent.id, actorRole: 'agent', action: 'SUBMIT_BATCH_LOG',
              targetType: 'daily_log', targetId: info.lastInsertRowid,
              detail: `asg=${asg.code}, raw=${rawHours}h, uploaded=${uploadedHours}h`, ipAddr,
            });
            return sendJson(res, 201, { ok: true, id: info.lastInsertRowid });
          }

          return sendJson(res, 400, { error: '无效填报类型' });
        }

        // Agent's own logs & back-to-back payout view (NEVER exposes upstream_base_rate or Lingju margin!)
        if (method === 'GET' && pathname === '/api/agent/logs') {
          const rows = db.prepare(`
            SELECT d.*, a.code AS assignment_code, a.applied_agent_rate_cny,
                   t.title AS task_title, t.settlement_days_after_client_pay,
                   u.tax_deduction_rate, u.entity_type
            FROM daily_logs d
            JOIN assignments a ON a.id = d.assignment_id
            JOIN task_packs t ON t.id = a.task_pack_id
            JOIN users u ON u.id = a.agent_user_id
            WHERE a.agent_user_id = ?
            ORDER BY d.id DESC
          `).all(agent.id);

          const safeLogs = rows.map((r) => {
            const fin = computeFinancials({ ...r, upstream_base_rate_cny: 0, venue_fee_cny: 0 });
            return {
              id: r.id,
              assignment_id: r.assignment_id,
              assignment_code: r.assignment_code,
              task_title: r.task_title,
              log_date: r.log_date,
              log_type: r.log_type,
              devices_used: r.devices_used,
              raw_hours: r.raw_hours,
              uploaded_hours: r.uploaded_hours,
              batch_ref: r.batch_ref,
              agent_note: r.agent_note,
              qa_status: r.qa_status,
              qa_valid_hours: r.qa_valid_hours,
              qa_reject_reason: r.qa_reject_reason,
              settlement_stage: r.settlement_stage,
              settlement_days_after_client_pay: r.settlement_days_after_client_pay,
              applied_agent_rate_cny: r.applied_agent_rate_cny,
              agent_invoice_status: r.agent_invoice_status,
              payout_receipt_ref: r.payout_receipt_ref,
              agent_gross_cny: fin.agent_gross_cny,
              agent_tax_deduction_cny: fin.agent_tax_deduction_cny,
              agent_net_payable_cny: fin.agent_net_payable_cny,
              created_at: r.created_at,
              updated_at: r.updated_at,
            };
          });
          return sendJson(res, 200, { logs: safeLogs });
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
      if (err.message === 'INVALID_JSON') {
        return sendJson(res, 400, { error: '请求 JSON 格式错误' });
      }
      if (err.message === 'PAYLOAD_TOO_LARGE') {
        return sendJson(res, 413, { error: '请求体过大' });
      }
      console.error('[platform error]', err);
      return sendJson(res, 500, { error: '服务器内部错误' });
    }
  });

  return { server, db };
}

// Run standalone if executed directly
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT || 3810);
  const host = process.env.HOST || '127.0.0.1';
  const dataDir = process.env.DATA_DIR || DEFAULT_DATA_DIR;
  const { server } = createApp({ dataDir });
  server.listen(port, host, () => {
    console.log(`[Lingju Platform V1.0] listening on http://${host}:${port} (dataDir=${dataDir})`);
  });
}
