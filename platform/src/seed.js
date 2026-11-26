import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, nowIso, round2 } from './db.js';
import { hashPassword } from './auth.js';
import { translateBadReasons } from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.resolve(__dirname, '../data');

export function seedDatabase(db, { includeDemoData = false } = {}) {
  const ts = nowIso();
  const adminUser = process.env.INIT_ADMIN_USER || 'admin';
  const adminPass = process.env.INIT_ADMIN_PASS || 'Lingju@2026!';

  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUser);
  if (!existingAdmin) {
    db.prepare(`
      INSERT INTO users (
        username, password_hash, role, display_name, entity_type, tax_deduction_rate,
        deposit_status, deposit_amount_cny, city, verified_headcount, has_own_scene, status, notes, created_at
      ) VALUES (?, ?, 'admin', '凌矩总控管理员', 'enterprise_vat', 0, 'PAID', 0, '河南平顶山', 0, 1, 'ACTIVE', '平台初始管理员账号，上线生产前请立即修改密码', ?)
    `).run(adminUser, hashPassword(adminPass), ts);
  }

  if (!includeDemoData) return;

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (
      username, password_hash, role, display_name, entity_type, tax_deduction_rate,
      deposit_status, deposit_amount_cny, city, verified_headcount, has_own_scene, status, notes, created_at
    ) VALUES (?, ?, 'agent', ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
  `);

  insertUser.run(
    'agent_demo_ent', hashPassword('Agent@2026!'), '豫中实业采集团队',
    'enterprise_vat', 0, 'PAID', 5000, '平顶山', 8, 1, '演示样本：可开3%专票，已缴设备履约押金', ts
  );
  insertUser.run(
    'agent_demo_cap', hashPassword('Agent@2026!'), '周口诚达采集服务部',
    'personal_captain', 0.06, 'ACQUAINTANCE_WAIVED', 0, '周口', 5, 0, '演示样本：内部种子团长特批免押，个人自担6%合规代征税点；首件绿灯仍不可跳过', ts
  );

  // 1. Whole Projects (1,000h - 10,000h pools)
  const insertProject = db.prepare(`
    INSERT OR IGNORE INTO projects (
      code, title, upstream_name_internal, upstream_base_rate_cny,
      upstream_platform_name, upstream_portal_mode, upstream_upload_guide,
      total_quota_hours, deadline_date, modality, scene_category, city_scope,
      compliance_path, agent_rate_own_scene_cny, agent_rate_platform_scene_cny,
      scene_owner_fee_note, qa_red_lines, sop_summary, sop_full_internal,
      current_rule_version, first_piece_min_hours, first_piece_max_hours,
      settlement_days_after_client_pay, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
  `);

  insertProject.run(
    'PRJ-2026-001',
    '华北零售门店第一视角理货与补货交付项目（一期 1,000h）',
    '华北具身智能客户 A', 40,
    '客户 A 内部上传后台', 'SUBACCOUNT_UPLOAD_ONLY',
    '仅使用凌矩下发的受限传片子账号上传 MP4 原片，禁止尝试跨模块查询；所有 QA 评估与收益统一回凌矩本平台查看。',
    1000, '2026-12-31', 'EGO第一视角', '零售购物空间', '河南省内优先',
    'WRITTEN_SUBCONTRACT_APPROVED', 30, 27,
    '使用平台场景时预留约 2–3 元/h（含场地费及凭证税耗）',
    '1. 双手出画超 3 秒片段整段作废；2. 严禁空桌摆拍与一次性胶带耗材；3. 避开顾客正脸及未成年人',
    '面向真实文具店/商超的日常补货、排面整理与套装配货整包交付项目；单队最低切分 100h 起，须先过 1–2h 首件绿灯。',
    '【已解锁内部V3执行SOP要点】\n1. 开机自检镜头倾角确保双手与桌面/货架全在视野内；\n2. 任务 S01–S12/P01–P12 循环复用物料，严禁撕贴一次性标签；\n3. 每完成一轮自然复位，使用绑定设备编号上传至指定传片账号，无需去上游看结果；\n4. 发现异常直接呼出项目专属小优或反馈人工督导。',
    'v1.1', 1.0, 2.0, 5, ts
  );

  insertProject.run(
    'PRJ-2026-002',
    '全国轻型工业装配与外观质检整包项目（10,000h 长期池）',
    '华东具身机器人客户 B', 50,
    '客户 B 数据工厂', 'LINGJU_RELAY_SHIELDED',
    '本项目对外全隔离屏蔽：代理使用绑定设备传至凌矩指定采集盒/中转桶，由小优自动归集对接客户 B 后台并回传审核诊断。',
    10000, '2027-03-31', '双目/夹爪', '工厂车间', '全国可配对',
    'LINGJU_UNIFIED_TEAM_ACCOUNT', 36, 33,
    '使用平台工厂场景时预留约 3 元/h 用于场地方合作费与税耗',
    '1. 须为真实运转工位，严禁反复拆装同一废品；2. 纳入凌矩统一设备编号体系；3. 禁止跨客户混用设备',
    '面向轻工装配线（中性笔/小家电/五金件）的双目/夹爪长周期大项目，支持多团队分片认领。',
    '【已解锁内部执行SOP要点】\n1. 使用凌矩下发统一编号设备采集；\n2. 核对来料与成品区分离，完整记录自然装配起止动作；\n3. 不得拍摄工厂涉密图纸与非授权人员面部。',
    'v1.0', 1.0, 2.0, 5, ts
  );

  insertProject.run(
    'PRJ-DEMO-DRAFT',
    '居家厨房收纳场景待核验储备项目（2,000h 草稿）',
    '华南潜在客户 C', 45,
    '客户 C 待定系统', 'LINGJU_RELAY_SHIELDED',
    '内部草稿占位',
    2000, '2027-02-28', 'EGO第一视角', '其他', '暂不开放',
    'DRAFT_INTERNAL_ONLY', 32, 29,
    '尚未取得书面分包许可，系统硬拦截不对代理展示',
    '待补充客户 QA 红线', '草稿阶段', '待签署分包授权后完善内部 SOP',
    'v1.0', 1.0, 2.0, 5, ts
  );

  // Rule revision on PRJ-2026-001
  const prj1 = db.prepare('SELECT id FROM projects WHERE code = ?').get('PRJ-2026-001');
  const prj2 = db.prepare('SELECT id FROM projects WHERE code = ?').get('PRJ-2026-002');
  const adminRow = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');

  if (prj1 && db.prepare('SELECT COUNT(*) AS c FROM project_rule_revisions').get().c === 0) {
    db.prepare(`
      INSERT INTO project_rule_revisions (
        project_id, version_code, raw_client_notice, ai_structured_diff, change_summary,
        effective_at, published_by_admin_id, created_at
      ) VALUES (?, 'v1.1', ?, ?, ?, ?, ?, ?)
    `).run(
      prj1.id,
      '客户群通知：明天起理货时相机视角统一往下再压 5 度，不要拍到顾客正面，手离开镜头不能超过 3 秒。',
      '【小优提炼 v1.1 规则变更要点】\n1. 相机视角统一下压 5 度，确保手部全程不超 3 秒出画\n2. 严禁拍到无关顾客正脸与未成年人',
      '相机视角统一下压 5 度；双手出画不超 3 秒；严禁入镜顾客正脸。',
      '2026-11-26 18:00',
      adminRow?.id || null,
      ts
    );
  }

  // 2. Scenes Pool
  const insertScene = db.prepare(`
    INSERT OR IGNORE INTO scenes (
      code, province, city, district, category, daily_work_desc, open_hours_desc,
      estimated_device_capacity, tier, public_status,
      real_store_name, real_contact_name, real_contact_phone, real_address,
      venue_fee_model, source_channel, zero_promise_ack, review_note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DOUYIN_IP', 1, ?, ?)
  `);

  insertScene.run(
    'SCN-DEMO-S2-01', '河南', '平顶山', '新华区', '零售购物空间',
    '晨光/得力常规文具上架补货、货架排面整理、练习本分类与学生组合配套', '每日 09:00–18:00 避开午间客流高峰',
    3, 'S2_RESERVE', 'AVAILABLE',
    '新华路文汇文具书店（演示）', '张老板（演示）', '138-0000-0001', '平顶山市新华区示范路88号',
    '按实际核验订单/有效小时由平台直结，需保留合规凭证', '已核验为真实正常营业文具店，纳入 S2 常规储备上架', ts
  );

  insertScene.run(
    'SCN-DEMO-S1-01', '浙江', '金华', '义乌市', '工厂车间',
    '日产万支中性笔与手电筒真实手工装配流水线，6 条工位连续作业', '周一至周六 08:30–17:30',
    10, 'S1_BENCHMARK', 'HIDDEN',
    '义乌博兴轻工组装厂（演示）', '陈厂长（演示）', '139-0000-0002', '义乌市工业园区示范街16号',
    'S1 稀缺标杆厂：总控持实景短片反向拓展大甲方定制单', '符合 S1 稀缺标杆标准，不对代理公开，作为商务拓甲方筹码', ts
  );

  insertScene.run(
    'SCN-DEMO-PEND-01', '河南', '许昌', '魏都区', '仓库',
    '百货电商小件拣货、扫描封箱、周转筐上架归位，日均订单 1200+ 件', '每日 09:00–19:00',
    5, 'PENDING_REVIEW', 'HIDDEN',
    '魏都宏远云仓配货中心（演示）', '刘主管（演示）', '137-0000-0003', '许昌市魏都区仓储物流园3栋',
    '待初筛评估场地合作方式', '抖音 IP 新进老板备案，待总控初筛分级', ts
  );

  // 3. Quota Assignments + Device Attribution + XiaoYou QA Reports + Escalation Ticket
  const ent = db.prepare('SELECT id, tax_deduction_rate FROM users WHERE username = ?').get('agent_demo_ent');
  if (ent && prj1 && prj2) {
    const insertAsg = db.prepare(`
      INSERT OR IGNORE INTO assignments (
        code, project_id, agent_user_id, mode, scene_id, own_scene_desc,
        quota_hours_requested, quota_hours_approved, upstream_upload_account, bound_device_ids_json,
        upload_channel_note, applied_agent_rate_cny, device_arrangement, agreement_signed,
        status, first_piece_status, first_piece_review_note, admin_note, created_at, approved_at, green_light_at
      ) VALUES (?, ?, ?, 'OWN_SCENE', NULL, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAsg.run(
      'ASG-DEMO-BATCH', prj1.id, ent.id, '平顶山自营合作文具门店工位，4 名全职采集员',
      300, 300, 'lj_sub_yz_01', JSON.stringify(['EGO-PDS-01', 'EGO-PDS-02', 'EGO-PDS-03']),
      '仅限上传原片，审核结果与预估收益回凌矩平台查看',
      30, 'PLATFORM_ISSUED_DEPOSIT', 'BATCH_GREEN_LIGHT', 'APPROVED',
      '首件画面手部居中清晰、灯光均匀，点亮批量放量绿灯', '已绑定 3 台设备编号用于小优归因回流', ts, ts, ts
    );

    insertAsg.run(
      'ASG-DEMO-FP', prj2.id, ent.id, '平顶山高新区轻工小电器组装测试工位（3台机位）',
      500, 500, 'lj_relay_yz_02', JSON.stringify(['DUAL-PDS-11', 'DUAL-PDS-12']),
      '走凌矩加密采集盒直传通道',
      36, 'AGENT_OWN_DEVICE', 'FIRST_PIECE_TRIAL', 'SUBMITTED',
      '', '已锁单进入首件试采，等待总控审看 1.5h 首件样本', ts, ts, null
    );

    const asgBatch = db.prepare('SELECT id FROM assignments WHERE code = ?').get('ASG-DEMO-BATCH');
    const asgFp = db.prepare('SELECT id FROM assignments WHERE code = ?').get('ASG-DEMO-FP');

    if (asgBatch && asgFp && db.prepare('SELECT COUNT(*) AS c FROM daily_logs').get().c === 0) {
      const insertLog = db.prepare(`
        INSERT INTO daily_logs (
          assignment_id, log_date, log_type, devices_used,
          raw_hours, uploaded_hours, batch_ref, qa_status, qa_valid_hours,
          qa_reject_reason, venue_fee_cny, settlement_stage, payout_receipt_ref,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertLog.run(
        asgBatch.id, '2026-11-24', 'BATCH', 3, 18.0, 17.5, 'EGO-PDS-01-1124',
        'QA_CONFIRMED', 16.0, '', 0, 'SETTLED_PAID', 'CMB-20261126-09128', ts, ts
      );
      insertLog.run(
        asgBatch.id, '2026-11-25', 'BATCH', 3, 22.0, 21.0, 'EGO-PDS-02-1125',
        'PENDING_QA', 0, '', 0, 'PENDING_QA', '', ts, ts
      );
      insertLog.run(
        asgFp.id, '2026-11-26', 'FIRST_PIECE', 1, 1.5, 1.5, 'DUAL-PDS-11-FP01',
        'PENDING_QA', 0, '', 0, 'PENDING_QA', '', ts, ts
      );
    }

    // Seed XiaoYou QA Reports (1 verified + 1 freshly synced awaiting admin check)
    if (asgBatch && db.prepare('SELECT COUNT(*) AS c FROM xiaoyou_qa_reports').get().c === 0) {
      const insertQa = db.prepare(`
        INSERT INTO xiaoyou_qa_reports (
          code, project_id, assignment_id, matched_key, report_date, upstream_batch_ref,
          uploaded_hours, valid_hours, invalid_hours, invalid_reasons_json, xiaoyou_summary,
          estimated_agent_gross_cny, estimated_agent_tax_cny, estimated_agent_net_cny,
          sync_source, verify_status, created_at, verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const r1Reasons = translateBadReasons([
        { clip_ref: '14:22-14:40', hours: 1.5, raw_tag: 'HAND_OUT_3S' },
      ]);
      insertQa.run(
        'XYQA-1124-01', prj1.id, asgBatch.id, 'EGO-PDS-01', '2026-11-24', 'UP-A-1124-01',
        17.5, 16.0, 1.5, JSON.stringify(r1Reasons),
        '有效率 91.4%，1 处双手出画超 3 秒已转为白话整改提示',
        480, 0, 480, 'API_READONLY', 'ADMIN_VERIFIED', ts, ts
      );

      const r2Reasons = translateBadReasons([
        { clip_ref: '10:05-11:35', hours: 2.0, raw_tag: 'OCCLUSION' },
        { clip_ref: '16:10-17:10', hours: 1.5, raw_tag: 'BLUR' },
      ]);
      const gross2 = round2(17.5 * 30);
      insertQa.run(
        'XYQA-1125-02', prj1.id, asgBatch.id, 'EGO-PDS-02', '2026-11-25', 'UP-A-1125-02',
        21.0, 17.5, 3.5, JSON.stringify(r2Reasons),
        '小优已从上游后台拉取最新评估：有效 17.5h、无效 3.5h（含遮挡 2.0h 与虚焦 1.5h）',
        gross2, 0, gross2, 'XIAOYOU_RPA', 'AI_SYNCED_PENDING_CHECK', ts, null
      );
    }

    // Seed isolated XiaoYou message + 1 open escalation ticket
    if (asgBatch && db.prepare('SELECT COUNT(*) AS c FROM agent_ai_messages').get().c === 0) {
      db.prepare(`
        INSERT INTO agent_ai_messages (project_id, agent_user_id, assignment_id, sender, content, escalated, created_at)
        VALUES (?, ?, ?, 'xiaoyou', ?, 0, ?)
      `).run(
        prj1.id, ent.id, asgBatch.id,
        '您好，我是「华北零售门店第一视角理货与补货交付项目」专属小优。已为您绑定设备 EGO-PDS-01/02/03 并同步 11-25 批次上游评估（有效 17.5h，预估净收益 ¥525）。如有动作疑问可随时问我，涉及 QA 申诉或改价我将为您转人工督导。',
        ts
      );
    }

    if (asgBatch && db.prepare('SELECT COUNT(*) AS c FROM escalation_tickets').get().c === 0) {
      db.prepare(`
        INSERT INTO escalation_tickets (
          code, project_id, assignment_id, agent_user_id, category, summary, status, created_at
        ) VALUES ('ESC-2026-001', ?, ?, ?, 'QA_DISPUTE', ?, 'OPEN', ?)
      `).run(
        prj1.id, asgBatch.id, ent.id,
        '[PRJ-2026-001] 豫中实业采集团队对 11-25 批次中 2.0h 货架遮挡判罚申请人工介入与甲方复核',
        ts
      );
    }
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const includeDemo = process.argv.includes('--demo');
  const dataDir = process.env.DATA_DIR || DEFAULT_DATA_DIR;
  const dbPath = path.join(dataDir, 'lingju_platform.db');
  const db = openDatabase(dbPath);
  seedDatabase(db, { includeDemoData: includeDemo });
  console.log(`[Lingju Platform v2.0] Seed complete (demo=${includeDemo}, db=${dbPath})`);
  db.close();
}
