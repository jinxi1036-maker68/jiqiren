import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openDatabase(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'agent')),
      display_name TEXT NOT NULL,
      entity_type TEXT NOT NULL DEFAULT 'enterprise_vat'
        CHECK(entity_type IN ('enterprise_vat', 'sole_proprietor', 'personal_captain')),
      tax_deduction_rate REAL NOT NULL DEFAULT 0,
      deposit_status TEXT NOT NULL DEFAULT 'UNPAID'
        CHECK(deposit_status IN ('PAID', 'CORPORATE_GUARANTEE', 'ACQUAINTANCE_WAIVED', 'UNPAID')),
      deposit_amount_cny REAL NOT NULL DEFAULT 0,
      city TEXT NOT NULL DEFAULT '',
      verified_headcount INTEGER NOT NULL DEFAULT 0,
      has_own_scene INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'SUSPENDED')),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    -- v2.0 Whole Projects Pool (1,000h - 10,000h scale) replacing tiny isolated tasks
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      upstream_name_internal TEXT NOT NULL,
      upstream_base_rate_cny REAL NOT NULL,
      upstream_platform_name TEXT NOT NULL DEFAULT '甲方专属数据平台',
      upstream_portal_mode TEXT NOT NULL DEFAULT 'LINGJU_RELAY_SHIELDED'
        CHECK(upstream_portal_mode IN ('SUBACCOUNT_UPLOAD_ONLY', 'LINGJU_RELAY_SHIELDED')),
      upstream_upload_guide TEXT NOT NULL DEFAULT '使用凌矩分配的专属传片通道/子账号上传；严禁尝试查看甲方商务或结算模块',
      total_quota_hours REAL NOT NULL DEFAULT 1000,
      deadline_date TEXT NOT NULL DEFAULT '',
      modality TEXT NOT NULL,
      scene_category TEXT NOT NULL,
      city_scope TEXT NOT NULL DEFAULT '全国适用',
      compliance_path TEXT NOT NULL DEFAULT 'DRAFT_INTERNAL_ONLY'
        CHECK(compliance_path IN ('WRITTEN_SUBCONTRACT_APPROVED', 'LINGJU_UNIFIED_TEAM_ACCOUNT', 'DRAFT_INTERNAL_ONLY')),
      agent_rate_own_scene_cny REAL NOT NULL,
      agent_rate_platform_scene_cny REAL NOT NULL,
      scene_owner_fee_note TEXT NOT NULL DEFAULT '',
      qa_red_lines TEXT NOT NULL,
      sop_summary TEXT NOT NULL,
      sop_full_internal TEXT NOT NULL,
      current_rule_version TEXT NOT NULL DEFAULT 'v1.0',
      first_piece_min_hours REAL NOT NULL DEFAULT 1.0,
      first_piece_max_hours REAL NOT NULL DEFAULT 2.0,
      settlement_days_after_client_pay INTEGER NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'PAUSED', 'CLOSED')),
      created_at TEXT NOT NULL
    );

    -- Dynamic Rule Revisions & Mandatory Agent Read Receipts
    CREATE TABLE IF NOT EXISTS project_rule_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      version_code TEXT NOT NULL,
      raw_client_notice TEXT NOT NULL DEFAULT '',
      ai_structured_diff TEXT NOT NULL,
      change_summary TEXT NOT NULL,
      effective_at TEXT NOT NULL,
      published_by_admin_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rule_acknowledgements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      revision_id INTEGER NOT NULL REFERENCES project_rule_revisions(id),
      agent_user_id INTEGER NOT NULL REFERENCES users(id),
      ack_ip TEXT NOT NULL DEFAULT '',
      acked_at TEXT NOT NULL,
      UNIQUE(revision_id, agent_user_id)
    );

    -- Two-Tier National IP Scene Pool (S1 Benchmark hidden vs S2 Reserve desensitized)
    CREATE TABLE IF NOT EXISTS scenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      province TEXT NOT NULL,
      city TEXT NOT NULL,
      district TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      daily_work_desc TEXT NOT NULL,
      open_hours_desc TEXT NOT NULL DEFAULT '',
      estimated_device_capacity INTEGER NOT NULL DEFAULT 1,
      tier TEXT NOT NULL DEFAULT 'PENDING_REVIEW'
        CHECK(tier IN ('PENDING_REVIEW', 'S2_RESERVE', 'S1_BENCHMARK', 'REJECTED')),
      public_status TEXT NOT NULL DEFAULT 'HIDDEN'
        CHECK(public_status IN ('HIDDEN', 'AVAILABLE', 'LOCKED')),
      real_store_name TEXT NOT NULL,
      real_contact_name TEXT NOT NULL,
      real_contact_phone TEXT NOT NULL,
      real_address TEXT NOT NULL,
      venue_fee_model TEXT NOT NULL DEFAULT '待确认（按协议与合规凭证核算）',
      source_channel TEXT NOT NULL DEFAULT 'DOUYIN_IP',
      zero_promise_ack INTEGER NOT NULL DEFAULT 1,
      review_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    -- Project Quota Allocations & Device/Subaccount Attribution Mapping
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      agent_user_id INTEGER NOT NULL REFERENCES users(id),
      mode TEXT NOT NULL CHECK(mode IN ('OWN_SCENE', 'PLATFORM_SCENE')),
      scene_id INTEGER REFERENCES scenes(id),
      own_scene_desc TEXT NOT NULL DEFAULT '',
      quota_hours_requested REAL NOT NULL DEFAULT 200,
      quota_hours_approved REAL NOT NULL DEFAULT 0,
      upstream_upload_account TEXT NOT NULL DEFAULT '',
      bound_device_ids_json TEXT NOT NULL DEFAULT '[]',
      upload_channel_note TEXT NOT NULL DEFAULT '',
      applied_agent_rate_cny REAL NOT NULL,
      agreement_signed INTEGER NOT NULL DEFAULT 0,
      agreement_ip TEXT NOT NULL DEFAULT '',
      agreement_at TEXT NOT NULL DEFAULT '',
      device_arrangement TEXT NOT NULL DEFAULT 'PLATFORM_ISSUED_DEPOSIT'
        CHECK(device_arrangement IN ('AGENT_OWN_DEVICE', 'PLATFORM_ISSUED_DEPOSIT', 'PLATFORM_ISSUED_WAIVED')),
      status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL'
        CHECK(status IN ('PENDING_APPROVAL', 'REJECTED', 'FIRST_PIECE_TRIAL', 'BATCH_GREEN_LIGHT', 'PAUSED', 'COMPLETED')),
      first_piece_status TEXT NOT NULL DEFAULT 'NOT_SUBMITTED'
        CHECK(first_piece_status IN ('NOT_SUBMITTED', 'SUBMITTED', 'APPROVED', 'REJECTED')),
      first_piece_review_note TEXT NOT NULL DEFAULT '',
      admin_note TEXT NOT NULL DEFAULT '',
      approved_at TEXT,
      green_light_at TEXT,
      created_at TEXT NOT NULL
    );

    -- Agent Daily Production Logs & Three-Party Back-to-Back Settlement
    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES assignments(id),
      log_date TEXT NOT NULL,
      log_type TEXT NOT NULL CHECK(log_type IN ('FIRST_PIECE', 'BATCH')),
      devices_used INTEGER NOT NULL,
      raw_hours REAL NOT NULL,
      uploaded_hours REAL NOT NULL,
      batch_ref TEXT NOT NULL DEFAULT '',
      agent_note TEXT NOT NULL DEFAULT '',
      qa_status TEXT NOT NULL DEFAULT 'PENDING_QA'
        CHECK(qa_status IN ('PENDING_QA', 'QA_CONFIRMED', 'QA_REJECTED')),
      qa_valid_hours REAL NOT NULL DEFAULT 0,
      qa_reject_reason TEXT NOT NULL DEFAULT '',
      settlement_stage TEXT NOT NULL DEFAULT 'PENDING_QA'
        CHECK(settlement_stage IN ('PENDING_QA', 'PENDING_CLIENT_PAYMENT', 'CLIENT_PAID_READY_TO_SETTLE', 'SETTLED_PAID')),
      venue_fee_cny REAL NOT NULL DEFAULT 0,
      venue_fee_voucher_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE'
        CHECK(venue_fee_voucher_status IN ('NOT_APPLICABLE', 'INVOICE_PENDING', 'VOUCHER_VERIFIED')),
      agent_invoice_status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK(agent_invoice_status IN ('PENDING', 'INVOICE_RECEIVED', 'PERSONAL_TAX_DEDUCTED')),
      payout_receipt_ref TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- XiaoYou Upstream QA Ingestion & Isolation Wall (stores sanitized evaluation + estimated payout)
    CREATE TABLE IF NOT EXISTS xiaoyou_qa_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      assignment_id INTEGER REFERENCES assignments(id),
      matched_key TEXT NOT NULL DEFAULT '',
      report_date TEXT NOT NULL,
      upstream_batch_ref TEXT NOT NULL DEFAULT '',
      uploaded_hours REAL NOT NULL DEFAULT 0,
      valid_hours REAL NOT NULL DEFAULT 0,
      invalid_hours REAL NOT NULL DEFAULT 0,
      invalid_reasons_json TEXT NOT NULL DEFAULT '[]',
      xiaoyou_summary TEXT NOT NULL DEFAULT '',
      estimated_agent_gross_cny REAL NOT NULL DEFAULT 0,
      estimated_agent_tax_cny REAL NOT NULL DEFAULT 0,
      estimated_agent_net_cny REAL NOT NULL DEFAULT 0,
      sync_source TEXT NOT NULL DEFAULT 'XIAOYOU_RPA'
        CHECK(sync_source IN ('CSV_PARSE', 'API_READONLY', 'XIAOYOU_RPA', 'ADMIN_SYNC')),
      verify_status TEXT NOT NULL DEFAULT 'AI_SYNCED_PENDING_CHECK'
        CHECK(verify_status IN ('AI_SYNCED_PENDING_CHECK', 'ADMIN_VERIFIED', 'DISPUTED')),
      linked_daily_log_id INTEGER REFERENCES daily_logs(id),
      created_at TEXT NOT NULL,
      verified_at TEXT
    );

    -- Per-(Project x Agent) Isolated XiaoYou Assistant Messages
    CREATE TABLE IF NOT EXISTS agent_ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      agent_user_id INTEGER NOT NULL REFERENCES users(id),
      assignment_id INTEGER REFERENCES assignments(id),
      sender TEXT NOT NULL CHECK(sender IN ('agent', 'xiaoyou', 'human_cs')),
      content TEXT NOT NULL,
      escalated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- Human CS Exception Escalation Tickets (1 human handles 15-20 pairs by exception only)
    CREATE TABLE IF NOT EXISTS escalation_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      assignment_id INTEGER REFERENCES assignments(id),
      agent_user_id INTEGER NOT NULL REFERENCES users(id),
      category TEXT NOT NULL
        CHECK(category IN ('QA_DISPUTE', 'PRICE_OR_SETTLEMENT', 'DEVICE_OR_SCENE', 'REPEAT_ERROR', 'PORTAL_BLOCKED', 'OTHER')),
      summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED')),
      resolution_note TEXT NOT NULL DEFAULT '',
      resolved_by_admin_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      ip_addr TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

export function nowIso() {
  return new Date().toISOString();
}

export function generateCode(prefix) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${ymd}-${rand}`;
}

export function logAudit(db, { actorUserId = null, actorRole, action, targetType, targetId, detail = '', ipAddr = '' }) {
  db.prepare(`
    INSERT INTO audit_logs (actor_user_id, actor_role, action, target_type, target_id, detail, ip_addr, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(actorUserId, actorRole, action, targetType, String(targetId), detail, ipAddr, nowIso());
}

export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Pure financial breakdown for a single daily_log or QA report.
 */
export function computeFinancials(row) {
  const validHours = Number(row.qa_valid_hours ?? row.valid_hours ?? 0);
  const agentRate = Number(row.applied_agent_rate_cny || 0);
  const taxRate = Number(row.tax_deduction_rate || 0);
  const venueFee = Number(row.venue_fee_cny || 0);
  const upstreamBaseRate = Number(row.upstream_base_rate_cny || 0);

  const agentGross = round2(validHours * agentRate);
  const agentTaxDeduction = round2(agentGross * taxRate);
  const agentNetPayable = round2(agentGross - agentTaxDeduction);

  const upstreamGross = round2(validHours * upstreamBaseRate);
  const upstreamVatEst = round2((upstreamGross * 3) / 103);
  const lingjuPreOverheadMargin = round2(upstreamGross - upstreamVatEst - agentGross - venueFee);

  return {
    agent_gross_cny: agentGross,
    agent_tax_deduction_cny: agentTaxDeduction,
    agent_net_payable_cny: agentNetPayable,
    venue_fee_cny: round2(venueFee),
    upstream_gross_cny: upstreamGross,
    upstream_vat_est_cny: upstreamVatEst,
    lingju_pre_overhead_margin_cny: lingjuPreOverheadMargin,
  };
}
