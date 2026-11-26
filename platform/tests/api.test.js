import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.js';
import { seedDatabase } from '../src/seed.js';

function createClient(baseUrl) {
  let cookie = '';
  return async function req(method, urlPath, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { status: res.status, data, headers: res.headers };
  };
}

test('Lingju Platform v2.0 project quota, rule ack, XiaoYou QA isolation wall, escalation & settlement', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lingju-platform-v2-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const { server, db } = createApp({ dbPath, dataDir: tmpDir });
  seedDatabase(db, { includeDemoData: true });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const pub = createClient(baseUrl);
  const admin = createClient(baseUrl);
  const agentCap = createClient(baseUrl);

  try {
    // 1. Public registration remains strictly blocked (403)
    const reg = await pub('POST', '/api/auth/register', { username: 'hacker', password: 'Password123' });
    assert.equal(reg.status, 403);

    // 2. Public 30-sec IP Scene Lead Form enforces zero-promise ack
    const badLead = await pub('POST', '/api/public/scene-leads', {
      province: '河南', city: '洛阳', category: '零售购物空间',
      daily_work_desc: '文具上架与排面整理',
      real_store_name: '洛阳测试文具店', real_contact_name: '李老板',
      real_contact_phone: '13999990000', real_address: '洛阳市涧西区测试路1号',
      zero_promise_ack: false,
    });
    assert.equal(badLead.status, 400);

    const okLead = await pub('POST', '/api/public/scene-leads', {
      province: '河南', city: '洛阳', category: '零售购物空间',
      daily_work_desc: '文具上架与排面整理',
      real_store_name: '洛阳测试文具店', real_contact_name: '李老板',
      real_contact_phone: '13999990000', real_address: '洛阳市涧西区测试路1号',
      zero_promise_ack: true,
    });
    assert.equal(okLead.status, 201);

    // 3. Login admin & acquaintance-waived agent
    assert.equal((await admin('POST', '/api/auth/login', { username: 'admin', password: 'Lingju@2026!' })).status, 200);
    assert.equal((await agentCap('POST', '/api/auth/login', { username: 'agent_demo_cap', password: 'Agent@2026!' })).status, 200);

    // 4. Whole Projects Hall hides DRAFT projects & NEVER leaks upstream name / base rate / internal platform name
    const prjRes = await agentCap('GET', '/api/agent/projects');
    assert.equal(prjRes.status, 200);
    assert.equal(prjRes.data.projects.some((p) => p.code === 'PRJ-DEMO-DRAFT'), false);
    const prj1 = prjRes.data.projects.find((p) => p.code === 'PRJ-2026-001');
    assert.ok(prj1);
    assert.equal(prj1.total_quota_hours, 1000);
    assert.equal(prj1.remaining_quota_hours, 700, '300h already allocated in seed');
    assert.equal(prj1.upstream_name_internal, undefined);
    assert.equal(prj1.upstream_base_rate_cny, undefined);
    assert.equal(prj1.upstream_platform_name, undefined);

    // 5. Scenes pool hides S1 & PENDING_REVIEW and strips real PII
    const scenesBefore = await agentCap('GET', '/api/agent/scenes');
    assert.equal(scenesBefore.data.scenes.some((s) => s.code === 'SCN-DEMO-S1-01'), false);
    assert.equal(scenesBefore.data.scenes.some((s) => s.code === okLead.data.code), false);
    const adminScenes = await admin('GET', '/api/admin/scenes');
    const luoyang = adminScenes.data.scenes.find((s) => s.code === okLead.data.code);
    assert.equal((await admin('PATCH', `/api/admin/scenes/${luoyang.id}`, { tier: 'S2_RESERVE', public_status: 'AVAILABLE' })).status, 200);

    // 6. Agent claims a project quota slice (200h) + Luoyang S2 scene
    const tooMuchQuota = await agentCap('POST', '/api/agent/assignments', {
      project_id: prj1.id, mode: 'PLATFORM_SCENE', scene_id: luoyang.id,
      quota_hours_requested: 9999, agreement_signed: true,
    });
    assert.equal(tooMuchQuota.status, 400, 'Cannot claim more than remaining project quota');

    const claim = await agentCap('POST', '/api/agent/assignments', {
      project_id: prj1.id, mode: 'PLATFORM_SCENE', scene_id: luoyang.id,
      quota_hours_requested: 200, agreement_signed: true,
    });
    assert.equal(claim.status, 201);
    const asgId = claim.data.id;

    // 7. Admin approves quota + binds device IDs & restricted upload subaccount -> enters FIRST_PIECE_TRIAL
    const approveRes = await admin('POST', `/api/admin/assignments/${asgId}/decision`, {
      decision: 'APPROVE',
      device_arrangement: 'PLATFORM_ISSUED_WAIVED',
      quota_hours_approved: 200,
      upstream_upload_account: 'lj_sub_zk_99',
      bound_device_ids: 'EGO-ZK-01, EGO-ZK-02',
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.data.status, 'FIRST_PIECE_TRIAL');

    // Real contact & device mapping unlocked
    const myAsg = (await agentCap('GET', '/api/agent/assignments')).data.assignments.find((a) => a.id === asgId);
    assert.equal(myAsg.scene_info.unlocked, true);
    assert.equal(myAsg.upstream_upload_account, 'lj_sub_zk_99');
    assert.deepEqual(myAsg.bound_device_ids, ['EGO-ZK-01', 'EGO-ZK-02']);

    // 8. First-piece hard lock blocks BATCH before green light (403)
    const blockedBatch = await agentCap('POST', '/api/agent/logs', {
      assignment_id: asgId, log_date: '2026-11-26', log_type: 'BATCH',
      devices_used: 2, raw_hours: 10, uploaded_hours: 10,
    });
    assert.equal(blockedBatch.status, 403);

    // Submit 1.5h first-piece & Admin lights Green Light
    assert.equal((await agentCap('POST', '/api/agent/logs', {
      assignment_id: asgId, log_date: '2026-11-26', log_type: 'FIRST_PIECE',
      devices_used: 1, raw_hours: 1.5, uploaded_hours: 1.5, batch_ref: 'EGO-ZK-01-FP',
    })).status, 201);
    assert.equal((await admin('POST', `/api/admin/assignments/${asgId}/first-piece-review`, {
      decision: 'APPROVE_GREEN_LIGHT', review_note: '首件合格放行',
    })).status, 200);

    // 9. Rule Revision Broadcast & Mandatory Read Receipt Check!
    // Un-acked revision v1.1 (from seed) blocks BATCH log with 409 until acked!
    const unackedBatch = await agentCap('POST', '/api/agent/logs', {
      assignment_id: asgId, log_date: '2026-11-27', log_type: 'BATCH',
      devices_used: 2, raw_hours: 12, uploaded_hours: 12, batch_ref: 'EGO-ZK-01-B1',
    });
    assert.equal(unackedBatch.status, 409, 'Must acknowledge latest rule revision before batch reporting');

    const latestRevId = myAsg.latest_revision.id;
    assert.equal((await agentCap('POST', `/api/agent/revisions/${latestRevId}/ack`)).status, 200);

    // Now BATCH succeeds!
    const okBatch = await agentCap('POST', '/api/agent/logs', {
      assignment_id: asgId, log_date: '2026-11-27', log_type: 'BATCH',
      devices_used: 2, raw_hours: 12, uploaded_hours: 12, batch_ref: 'EGO-ZK-01-B1',
    });
    assert.equal(okBatch.status, 201);
    const batchLogId = okBatch.data.id;

    // 10. XiaoYou Upstream QA Ingestion -> Device Attribution -> Sanitized Agent Diagnosis & Estimated Fee
    const ingest = await admin('POST', '/api/admin/xiaoyou/ingest', {
      project_id: prj1.id,
      sync_source: 'CSV_PARSE',
      csv_text: 'UP-9901, EGO-ZK-02, 2026-11-27, 12.0, 10.0, HAND_OUT; BLUR',
    });
    assert.equal(ingest.status, 201);
    assert.equal(ingest.data.imported[0].matched_assignment_id, asgId);
    // 10h * 27 (platform scene rate) = 270 gross, 6% personal tax = 16.2, estimated net = 253.8
    assert.equal(ingest.data.imported[0].estimated_agent_net_cny, 253.8);

    // Agent sees translated invalid advice & estimated fee inside Lingju platform (ZERO upstream leaks)
    const agentQa = await agentCap('GET', '/api/agent/qa-reports');
    const rep = agentQa.data.reports.find((r) => r.id === ingest.data.imported[0].id);
    assert.ok(rep);
    assert.equal(rep.valid_hours, 10);
    assert.equal(rep.invalid_hours, 2);
    assert.equal(rep.estimated_agent_net_cny, 253.8);
    assert.equal(rep.upstream_base_rate_cny, undefined);
    const reasons = JSON.parse(rep.invalid_reasons_json);
    assert.equal(reasons.length, 2);
    assert.ok(reasons[0].xiaoyou_plain_advice.includes('双手超出镜头视野'));

    // Admin verifies QA report & pushes to settlement, or settles batchLogId with receipt enforcement
    const qaVerify = await admin('PATCH', `/api/admin/xiaoyou/reports/${rep.id}`, {
      verify_status: 'ADMIN_VERIFIED', valid_hours: 10, push_to_settlement: true,
    });
    assert.equal(qaVerify.status, 200);
    assert.ok(qaVerify.data.linked_daily_log_id);

    // Bank receipt enforcement
    assert.equal((await admin('PATCH', `/api/admin/logs/${batchLogId}`, {
      qa_status: 'QA_CONFIRMED', qa_valid_hours: 10, settlement_stage: 'SETTLED_PAID',
    })).status, 400);
    assert.equal((await admin('PATCH', `/api/admin/logs/${batchLogId}`, {
      qa_status: 'QA_CONFIRMED', qa_valid_hours: 10, settlement_stage: 'SETTLED_PAID',
      venue_fee_cny: 25, payout_receipt_ref: 'BANK-20261130-8899',
    })).status, 200);

    // CSV Export works
    const csvRes = await admin('GET', '/api/admin/logs/export.csv');
    assert.equal(csvRes.status, 200);
    assert.ok(csvRes.data.raw.includes('BANK-20261130-8899'));

    // 11. Isolated Project XiaoYou Assistant & Human Escalation Trigger
    const routineChat = await agentCap('POST', '/api/agent/ai-chat', {
      project_id: prj1.id, content: '请告诉我怎么上传以及绑定了哪些设备号？',
    });
    assert.equal(routineChat.status, 201);
    assert.equal(routineChat.data.escalated, false);
    assert.ok(routineChat.data.reply.includes('EGO-ZK-01'));

    const escalateChat = await agentCap('POST', '/api/agent/ai-chat', {
      project_id: prj1.id, content: '甲方判的这 2 小时无效我不认可，我要申诉复核！',
    });
    assert.equal(escalateChat.status, 201);
    assert.equal(escalateChat.data.escalated, true);
    assert.ok(escalateChat.data.ticket_code.startsWith('ESC-'));

    const escs = await admin('GET', '/api/admin/escalations');
    const esc = escs.data.tickets.find((t) => t.code === escalateChat.data.ticket_code);
    assert.ok(esc);
    assert.equal((await admin('PATCH', `/api/admin/escalations/${esc.id}`, {
      status: 'RESOLVED', resolution_note: '已核对片源，已帮您提交甲方申诉复议。',
    })).status, 200);

    // 12. Admin reset password + agent self change password
    assert.equal((await admin('POST', `/api/admin/agents/${myAsg.agent_user_id || 3}/reset-password`, {
      new_password: 'TempPass999',
    })).status, 200);
  } finally {
    server.close();
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
