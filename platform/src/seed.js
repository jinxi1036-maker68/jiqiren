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

  // Demo seed data — CLEARLY MARKED AS DEMO SAMPLE DATA, NO REAL PII OR CONFIDENTIAL CONTRACT PRICES
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (
      username, password_hash, role, display_name, entity_type, tax_deduction_rate,
      deposit_status, deposit_amount_cny, city, verified_headcount, has_own_scene, status, notes, created_at
    ) VALUES (?, ?, 'agent', ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
  `);

  insertUser.run(
    'agent_demo_ent', hashPassword('Agent@2026!'), '【演示】豫中实业采集团队（企业开票）',
    'enterprise_vat', 0, 'PAID', 5000, '平顶山', 8, 1, '演示数据：可开3%专票，已缴设备履约押金', ts
  );
  insertUser.run(
    'agent_demo_cap', hashPassword('Agent@2026!'), '【演示】周口合作团长（熟人特批免押）',
    'personal_captain', 0.06, 'ACQUAINTANCE_WAIVED', 0, '周口', 5, 0, '演示数据：内部种子团长特批免押，个人自担6%合规代征税点；首件绿灯仍不可跳过', ts
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
    '【演示任务】零售文具店补货与理货第一视角采集',
    '演示上游A（内部保密，代理端不可见）',
    40,
    'EGO第一视角',
    '零售购物空间',
    '河南省内优先',
    'WRITTEN_SUBCONTRACT_APPROVED',
    30,
    27,
    '使用平台场景时预留约2-3元/h（含场地费及凭证税耗）',
    '1. 双手出画超3秒片段作废；2. 严禁空桌摆拍与一次性胶带耗材；3. 避开顾客人脸及未成年人',
    '真实文具店/商超日常补货、排面整理、学生套装配货等动作；强制先提交1-2小时首件试采过审点亮绿灯。',
    '【已解锁内部V3执行SOP要点】\n1. 开机自检镜头倾角确保双手与桌面/货架全在视野内；\n2. 任务S01-S12/P01-P12循环复用物料，严禁撕贴一次性标签；\n3. 每完成一轮自然复位，当日上传后在平台填报原始/上传小时及批次号；\n4. 发现异常立即停采反馈总控。',
    1.0,
    2.0,
    5,
    ts
  );

  insertTask.run(
    'TP-DEMO-002',
    '【演示任务】轻型工业装配与质检（双目/夹爪）',
    '演示上游B（内部保密，代理端不可见）',
    50,
    '双目/夹爪',
    '工厂车间',
    '全国可配对',
    'LINGJU_UNIFIED_TEAM_ACCOUNT',
    36,
    33,
    '使用平台工厂场景时预留约3元/h用于场地方合作费与税耗',
    '1. 须为真实运转工位，严禁反复拆装同一废品；2. 纳入凌矩统一子账号体系交付；3. 禁止跨客户混用设备',
    '笔类/小电器/五金轻型装配、外观逐面质检与分格装盒；需先过1-2h首件样片审核。',
    '【已解锁内部执行SOP要点】\n1. 使用凌矩下发统一项目子账号登录上传；\n2. 核对来料与成品区分离，完整记录自然装配起止动作；\n3. 不得拍摄工厂涉密图纸与非授权人员面部。',
    1.0,
    2.0,
    5,
    ts
  );

  insertTask.run(
    'TP-DEMO-DRAFT',
    '【内部草稿-未获分包许可】某上游待核实居家采集单',
    '待核实上游C（代理端绝不可见）',
    45,
    'EGO第一视角',
    '其他',
    '暂不开放',
    'DRAFT_INTERNAL_ONLY',
    32,
    29,
    '尚未取得书面分包许可，系统硬拦截不对代理展示',
    '草稿占位',
    '草稿占位',
    '草稿占位',
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
    '晨光/得力常规文具上架补货、货架排面整理、练习本分类与学生组合配套', '每日 09:00-18:00 避开午间客流高峰',
    3, 'S2_RESERVE', 'AVAILABLE',
    '【演示】新华路某文具书店（锁单后可见）', '张老板（演示）', '138-0000-0001（演示）', '平顶山市新华区演示地址88号',
    '示例：按实际核验归还订单/有效小时由平台直结，需保留合规凭证', '已核验为真实正常营业文具店，纳入S2常规储备上架', ts
  );

  insertScene.run(
    'SCN-DEMO-S1-01', '浙江', '金华', '义乌市', '工厂车间',
    '日产万支中性笔与手电筒真实手工装配流水线，6条工位连续作业', '周一至周六 08:30-17:30',
    10, 'S1_BENCHMARK', 'HIDDEN',
    '【演示S1稀缺标杆】义乌某轻工组装厂（仅总控可见）', '陈厂长（演示）', '139-0000-0002（演示）', '义乌市工业园区演示地址16号',
    'S1标杆厂：总控私下拿实景短片反推多家大甲方定制单', '符合S1稀缺标杆标准，不对代理公开，作为商务拓甲方筹码', ts
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const includeDemo = process.argv.includes('--demo');
  const dataDir = process.env.DATA_DIR || DEFAULT_DATA_DIR;
  const dbPath = path.join(dataDir, 'lingju_platform.db');
  const db = openDatabase(dbPath);
  seedDatabase(db, { includeDemoData: includeDemo });
  console.log(`[Lingju Platform V1.0] Seed complete (demo=${includeDemo}, db=${dbPath})`);
  db.close();
}
