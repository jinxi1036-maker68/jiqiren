import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, nowIso } from './db.js';
import { hashPassword } from './auth.js';

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

  // Demo seed data — realistic trial pipeline records with clear demo disclaimer in notes, zero real PII
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

  const insertTask = db.prepare(`
    INSERT OR IGNORE INTO task_packs (
      code, title, upstream_name_internal, upstream_base_rate_cny, modality, scene_category,
      city_scope, compliance_path, agent_rate_own_scene_cny, agent_rate_platform_scene_cny,
      scene_owner_fee_note, qa_red_lines, sop_summary, sop_full_internal,
      first_piece_min_hours, first_piece_max_hours, settlement_days_after_client_pay, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
  `);

  insertTask.run(
    'TP-DEMO-001',
    '零售文具店补货与理货第一视角采集',
    '华北具身智能客户 A',
    40,
    'EGO第一视角',
    '零售购物空间',
    '河南省内优先',
    'WRITTEN_SUBCONTRACT_APPROVED',
    30,
    27,
    '使用平台场景时预留约 2–3 元/h（含场地费及凭证税耗）',
    '1. 双手出画超 3 秒片段整段作废；2. 严禁空桌摆拍与一次性胶带耗材；3. 避开顾客正脸及未成年人',
    '真实文具店/商超日常补货、排面整理、学生套装配货动作；须先提交 1–2 小时首件试采点亮绿灯。',
    '【已解锁内部V3执行SOP要点】\n1. 开机自检镜头倾角确保双手与桌面/货架全在视野内；\n2. 任务 S01–S12/P01–P12 循环复用物料，严禁撕贴一次性标签；\n3. 每完成一轮自然复位，当日上传后在平台填报原始/上传小时及批次号；\n4. 发现异常立即停采反馈总控。',
    1.0,
    2.0,
    5,
    ts
  );

  insertTask.run(
    'TP-DEMO-002',
    '轻型工业装配与质检（双目/夹爪）',
    '华东具身机器人客户 B',
    50,
    '双目/夹爪',
    '工厂车间',
    '全国可配对',
    'LINGJU_UNIFIED_TEAM_ACCOUNT',
    36,
    33,
    '使用平台工厂场景时预留约 3 元/h 用于场地方合作费与税耗',
    '1. 须为真实运转工位，严禁反复拆装同一废品；2. 纳入凌矩统一子账号体系交付；3. 禁止跨客户混用设备',
    '笔类/小电器/五金轻型装配、外观逐面质检与分格装盒；须先过 1–2h 首件样片审核。',
    '【已解锁内部执行 SOP 要点】\n1. 使用凌矩下发统一项目子账号登录上传；\n2. 核对来料与成品区分离，完整记录自然装配起止动作；\n3. 不得拍摄工厂涉密图纸与非授权人员面部。',
    1.0,
    2.0,
    5,
    ts
  );

  insertTask.run(
    'TP-DEMO-DRAFT',
    '居家厨房收纳场景待核验采集单',
    '华南潜在客户 C',
    45,
    'EGO第一视角',
    '其他',
    '暂不开放',
    'DRAFT_INTERNAL_ONLY',
    32,
    29,
    '尚未取得书面分包许可，系统拦截不对代理展示',
    '待补充客户 QA 红线',
    '草稿阶段',
    '待签署分包授权后完善内部 SOP',
    1.0,
    2.0,
    5,
    ts
  );

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

  // Seed realistic sample pipeline state for agent_demo_ent (OWN_SCENE) without touching agent_demo_cap or SCN-DEMO-S2-01
  const ent = db.prepare('SELECT id FROM users WHERE username = ?').get('agent_demo_ent');
  const tp1 = db.prepare('SELECT id FROM task_packs WHERE code = ?').get('TP-DEMO-001');
  const tp2 = db.prepare('SELECT id FROM task_packs WHERE code = ?').get('TP-DEMO-002');
  if (ent && tp1 && tp2) {
    const insertAsg = db.prepare(`
      INSERT OR IGNORE INTO assignments (
        code, task_pack_id, agent_user_id, mode, scene_id, own_scene_desc,
        applied_agent_rate_cny, device_arrangement, agreement_signed,
        status, first_piece_status, first_piece_review_note, admin_note, created_at, approved_at, green_light_at
      ) VALUES (?, ?, ?, 'OWN_SCENE', NULL, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAsg.run(
      'ASG-DEMO-BATCH', tp1.id, ent.id, '平顶山自营合作文具门店工位，4 名全职采集员',
      30, 'PLATFORM_ISSUED_DEPOSIT', 'BATCH_GREEN_LIGHT', 'APPROVED',
      '首件画面手部居中清晰、灯光均匀，点亮批量放量绿灯', '已核验自有场景与押金凭证', ts, ts, ts
    );

    insertAsg.run(
      'ASG-DEMO-FP', tp2.id, ent.id, '平顶山高新区轻工小电器组装测试工位（3台机位）',
      36, 'AGENT_OWN_DEVICE', 'FIRST_PIECE_TRIAL', 'SUBMITTED',
      '', '已锁单进入首件试采，等待总控审看 1.5h 首件样本', ts, ts, null
    );

    const asgBatch = db.prepare('SELECT id FROM assignments WHERE code = ?').get('ASG-DEMO-BATCH');
    const asgFp = db.prepare('SELECT id FROM assignments WHERE code = ?').get('ASG-DEMO-FP');
    const logCount = db.prepare('SELECT COUNT(*) AS c FROM daily_logs').get().c;
    if (logCount === 0 && asgBatch && asgFp) {
      const insertLog = db.prepare(`
        INSERT INTO daily_logs (
          assignment_id, log_date, log_type, devices_used,
          raw_hours, uploaded_hours, batch_ref, qa_status, qa_valid_hours,
          qa_reject_reason, venue_fee_cny, settlement_stage, payout_receipt_ref,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // 1. Settled paid batch log
      insertLog.run(
        asgBatch.id, '2026-11-24', 'BATCH', 3, 18.0, 17.5, 'B-1124-PDS-01',
        'QA_CONFIRMED', 16.0, '', 0, 'SETTLED_PAID', 'CMB-20261126-09128', ts, ts
      );
      // 2. Batch awaiting QA confirmation
      insertLog.run(
        asgBatch.id, '2026-11-25', 'BATCH', 4, 22.0, 21.0, 'B-1125-PDS-02',
        'PENDING_QA', 0, '', 0, 'PENDING_QA', '', ts, ts
      );
      // 3. Submitted first-piece sample awaiting green light
      insertLog.run(
        asgFp.id, '2026-11-26', 'FIRST_PIECE', 1, 1.5, 1.5, 'FP-1126-PDS-01',
        'PENDING_QA', 0, '', 0, 'PENDING_QA', '', ts, ts
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
  console.log(`[Lingju Platform] Seed complete (demo=${includeDemo}, db=${dbPath})`);
  db.close();
}
