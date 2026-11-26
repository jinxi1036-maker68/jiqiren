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

    CREATE TABLE IF NOT EXISTS task_packs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      upstream_name_internal TEXT NOT NULL,
      upstream_base_rate_cny REAL NOT NULL,
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
      first_piece_min_hours REAL NOT NULL DEFAULT 1.0,
      first_piece_max_hours REAL NOT NULL DEFAULT 2.0,
      settlement_days_after_client_pay INTEGER NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'PAUSED', 'CLOSED')),
      created_at TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      task_pack_id INTEGER NOT NULL REFERENCES task_packs(id),
      agent_user_id INTEGER NOT NULL REFERENCES users(id),
      mode TEXT NOT NULL CHECK(mode IN ('OWN_SCENE', 'PLATFORM_SCENE')),
      scene_id INTEGER REFERENCES scenes(id),
      own_scene_desc TEXT NOT NULL DEFAULT '',
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

/**
 * Pure financial breakdown for a single daily_log joined with assignment/task/agent.
 * Strictly follows Module 5 + Audit Item 4 (three-party transparent ledger).
 */
export function computeFinancials(row) {
  const validHours = Number(row.qa_valid_hours || 0);
  const agentRate = Number(row.applied_agent_rate_cny || 0);
  const taxRate = Number(row.tax_deduction_rate || 0);
  const venueFee = Number(row.venue_fee_cny || 0);
  const upstreamBaseRate = Number(row.upstream_base_rate_cny || 0);

  const agentGross = round2(validHours * agentRate);
  const agentTaxDeduction = round2(agentGross * taxRate);
  const agentNetPayable = round2(agentGross - agentTaxDeduction);

  const upstreamGross = round2(validHours * upstreamBaseRate);
  // Small-scale / 3% VAT inclusive estimate: upstreamGross * 3 / 103
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

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
