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
    if (setCookie) {
      cookie = setCookie.split(';')[0];
    }
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };
}

test('Lingju Platform V1.0 end-to-end compliance, security, first-piece lock & back-to-back settlement', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lingju-platform-test-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const { server, db } = createApp({ dbPath, dataDir: tmpDir });
  seedDatabase(db, { includeDemoData: true });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const pub = createClient(baseUrl);
  const admin = createClient(baseUrl);
  const agentWaived = createClient(baseUrl);

  try {
    // 1. Public registration MUST be blocked (blocks C-class self-signup)
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
    assert.ok(okLead.data.code.startsWith('SCN-'));

    // 3. Login admin & acquaintance-waived agent
    assert.equal((await admin('POST', '/api/auth/login', { username: 'admin', password: 'Lingju@2026!' })).status, 200);
    assert.equal((await agentWaived('POST', '/api/auth/login', { username: 'agent_demo_cap', password: 'Agent@2026!' })).status, 200);

    // 4. Verify Agent Task Hall hides DRAFT_INTERNAL_ONLY and NEVER leaks upstream name / base rate / internal SOP
    const tasksRes = await agentWaived('GET', '/api/agent/tasks');
    assert.equal(tasksRes.status, 200);
    assert.equal(tasksRes.data.tasks.some((t) => t.code === 'TP-DEMO-DRAFT'), false, 'DRAFT task must be hidden');
    const tp1 = tasksRes.data.tasks.find((t) => t.code === 'TP-DEMO-001');
    assert.ok(tp1, 'Compliant task must be visible');
    assert.equal(tp1.upstream_name_internal, undefined, 'Upstream name must NEVER leak to agent');
    assert.equal(tp1.upstream_base_rate_cny, undefined, 'Upstream base rate must NEVER leak to agent');
    assert.equal(tp1.sop_full_internal, undefined, 'Internal SOP must NOT leak before lock');

    // 5. Verify Agent Scene Pool hides PENDING_REVIEW and S1_BENCHMARK, and strips real PII on S2_RESERVE
    const scenesBefore = await agentWaived('GET', '/api/agent/scenes');
    assert.equal(scenesBefore.data.scenes.some((s) => s.code === 'SCN-DEMO-S1-01'), false, 'S1 benchmark must be hidden from agents');
    assert.equal(scenesBefore.data.scenes.some((s) => s.code === okLead.data.code), false, 'Pending IP lead must be hidden before triage');
    const s2 = scenesBefore.data.scenes.find((s) => s.code === 'SCN-DEMO-S2-01');
    assert.ok(s2);
    assert.equal(s2.real_contact_phone, undefined, 'Real phone must NOT exist in pool DTO');
    assert.equal(s2.real_store_name, undefined, 'Real store name must NOT exist in pool DTO');

    // 6. Admin triages new Luoyang IP lead as S2_RESERVE + AVAILABLE
    const adminScenes = await admin('GET', '/api/admin/scenes');
    const luoyang = adminScenes.data.scenes.find((s) => s.code === okLead.data.code);
    assert.ok(luoyang);
    assert.equal(
      (await admin('PATCH', `/api/admin/scenes/${luoyang.id}`, { tier: 'S2_RESERVE', public_status: 'AVAILABLE' })).status,
      200
    );

    // 7. Agent applies for TP-DEMO-001 + Luoyang S2 scene (must require agreement)
    const badClaim = await agentWaived('POST', '/api/agent/assignments', {
      task_pack_id: tp1.id, mode: 'PLATFORM_SCENE', scene_id: luoyang.id, agreement_signed: false,
    });
    assert.equal(badClaim.status, 400);

    const claim = await agentWaived('POST', '/api/agent/assignments', {
      task_pack_id: tp1.id, mode: 'PLATFORM_SCENE', scene_id: luoyang.id, agreement_signed: true,
    });
    assert.equal(claim.status, 201);
    const asgId = claim.data.id;

    // Before Admin approves, real store & phone MUST stay locked!
    let myAsgs = await agentWaived('GET', '/api/agent/assignments');
    let myAsg = myAsgs.data.assignments.find((a) => a.id === asgId);
    assert.equal(myAsg.scene_info.unlocked, false);
    assert.equal(myAsg.sop_full_internal, null);
    assert.notEqual(myAsg.scene_info.real_contact_phone, '13999990000');

    // 8. Admin approves assignment with acquaintance-waived device -> enters FIRST_PIECE_TRIAL
    const approveRes = await admin('POST', `/api/admin/assignments/${asgId}/decision`, {
      decision: 'APPROVE',
      device_arrangement: 'PLATFORM_ISSUED_WAIVED',
      admin_note: '种子熟人特批免押，强制首件试采',
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.data.status, 'FIRST_PIECE_TRIAL');

    // Now real contact & full internal SOP ARE unlocked for this approved agent
    myAsgs = await agentWaived('GET', '/api/agent/assignments');
    myAsg = myAsgs.data.assignments.find((a) => a.id === asgId);
    assert.equal(myAsg.scene_info.unlocked, true);
    assert.equal(myAsg.scene_info.real_contact_phone, '13999990000');
    assert.ok(myAsg.sop_full_internal.includes('已解锁内部V3执行SOP要点'));

    // 9. HARD LOCK CHECK (Audit Item 2): Even acquaintance-waived agent CANNOT submit BATCH before Green Light!
    const blockedBatch = await agentWaived('POST', '/api/agent/logs', {
      assignment_id: asgId, log_date: '2026-11-26', log_type: 'BATCH',
      devices_used: 3, raw_hours: 15, uploaded_hours: 15, batch_ref: 'B-ILLEGAL',
    });
    assert.equal(blockedBatch.status, 403, 'BATCH log before Green Light MUST be blocked with 403');

    // Exceeding first-piece max hours (2h) is also rejected
    const tooBigFp = await agentWaived('POST', '/api/agent/logs', {
      assignment_id: asgId, log_date: '2026-11-26', log_type: 'FIRST_PIECE',
      devices_used: 1, raw_hours: 5, uploaded_hours: 5, batch_ref: 'FP-TOO-BIG',
    });
    assert.equal(tooBigFp.status, 400);

    // Valid 1.5h first-piece submission succeeds
    const fpSub = await agentWaived('POST', '/api/agent/logs', {
      assignment_id: asgId, log_date: '2026-11-26', log_type: 'FIRST_PIECE',
      devices_used: 1, raw_hours: 1.5, uploaded_hours: 1.5, batch_ref: 'FP-001',
    });
    assert.equal(fpSub.status, 201);

    // 10. Admin reviews first piece & lights BATCH_GREEN_LIGHT
    const greenLight = await admin('POST', `/api/admin/assignments/${asgId}/first-piece-review`, {
      decision: 'APPROVE_GREEN_LIGHT', review_note: '样片过关，允许放量',
    });
    assert.equal(greenLight.status, 200);
    assert.equal(greenLight.data.status, 'BATCH_GREEN_LIGHT');

    // Now BATCH log succeeds!
    const okBatch = await agentWaived('POST', '/api/agent/logs', {
      assignment_id: asgId, log_date: '2026-11-27', log_type: 'BATCH',
      devices_used: 3, raw_hours: 12, uploaded_hours: 12, batch_ref: 'B-1127-01',
    });
    assert.equal(okBatch.status, 201);
    const batchLogId = okBatch.data.id;

    // 11. Back-to-back settlement & three-party financial math + bank receipt enforcement
    // Marking SETTLED_PAID without bank receipt ref MUST fail
    const noReceipt = await admin('PATCH', `/api/admin/logs/${batchLogId}`, {
      qa_status: 'QA_CONFIRMED', qa_valid_hours: 10,
      settlement_stage: 'SETTLED_PAID', venue_fee_cny: 25,
    });
    assert.equal(noReceipt.status, 400);

    // Valid QA confirmation + client paid + settled with bank receipt
    const paidRes = await admin('PATCH', `/api/admin/logs/${batchLogId}`, {
      qa_status: 'QA_CONFIRMED', qa_valid_hours: 10,
      settlement_stage: 'SETTLED_PAID', venue_fee_cny: 25,
      payout_receipt_ref: 'BANK-20261130-8899',
    });
    assert.equal(paidRes.status, 200);

    // Check Agent view: applied rate = 27 (platform scene), valid = 10h -> gross 270, 6% tax deduction = 16.2, net = 253.8
    // And upstream base rate / Lingju margin MUST NOT appear in agent logs!
    const agentLogs = await agentWaived('GET', '/api/agent/logs');
    const bLog = agentLogs.data.logs.find((l) => l.id === batchLogId);
    assert.equal(bLog.agent_gross_cny, 270);
    assert.equal(bLog.agent_tax_deduction_cny, 16.2);
    assert.equal(bLog.agent_net_payable_cny, 253.8);
    assert.equal(bLog.upstream_base_rate_cny, undefined);
    assert.equal(bLog.lingju_pre_overhead_margin_cny, undefined);

    // Check Admin view sees full three-party math:
    // upstream_gross = 10*40 = 400; 3% VAT = 400*3/103 = 11.65; agent_gross = 270; venue_fee = 25 -> margin = 93.35
    const adminLogs = await admin('GET', '/api/admin/logs');
    const aLog = adminLogs.data.logs.find((l) => l.id === batchLogId);
    assert.equal(aLog.financials.upstream_gross_cny, 400);
    assert.equal(aLog.financials.upstream_vat_est_cny, 11.65);
    assert.equal(aLog.financials.lingju_pre_overhead_margin_cny, 93.35);
  } finally {
    server.close();
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
