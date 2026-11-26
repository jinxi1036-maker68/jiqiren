const state = {
  user: null,
  agentTasks: [],
  agentScenes: [],
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function esc(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast ${isError ? 'error' : ''}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 3600);
}

async function api(url, opts = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

function showView(viewId) {
  $$('.view').forEach((v) => v.classList.add('hidden'));
  $(`#view-${viewId}`)?.classList.remove('hidden');
}

function renderTopActions() {
  const nav = $('#topActions');
  if (!state.user) {
    nav.innerHTML = `
      <button class="btn btn-ghost" data-view="public-scene">实体老板 30秒场景备案</button>
      <button class="btn btn-primary" data-view="login">认证账号登录</button>
    `;
  } else {
    const roleLabel = state.user.role === 'admin' ? '总控管理员' : '认证代理';
    nav.innerHTML = `
      <span class="small">${esc(state.user.display_name)}（${roleLabel}）</span>
      <button class="btn btn-ghost" data-view="public-scene">老板备案页</button>
      <button class="btn btn-primary" data-view="${state.user.role}">我的工作台</button>
      <button class="btn btn-ghost" id="btnLogout">退出登录</button>
    `;
    $('#btnLogout').onclick = async () => {
      await api('/api/auth/logout', { method: 'POST' });
      state.user = null;
      renderTopActions();
      showView('login');
      toast('已安全退出登录');
    };
  }
  $$('#topActions [data-view]').forEach((b) => {
    b.onclick = () => {
      const v = b.dataset.view;
      showView(v);
      if (v === 'admin') loadAdminAll();
      if (v === 'agent') loadAgentAll();
    };
  });
}

// ================= PUBLIC SCENE FORM =================
$('#publicSceneForm').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.zero_promise_ack = fd.get('zero_promise_ack') === 'on';
  try {
    const res = await api('/api/public/scene-leads', { method: 'POST', body: JSON.stringify(payload) });
    const box = $('#publicSceneResult');
    box.textContent = `备案成功（编号 ${res.code}）：${res.message}`;
    box.classList.remove('hidden');
    e.target.reset();
    toast('场景备案已提交进入凌矩储备池');
  } catch (err) {
    toast(err.message, true);
  }
};

// ================= LOGIN =================
$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  try {
    const res = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    state.user = res.user;
    renderTopActions();
    if (state.user.role === 'admin') {
      showView('admin');
      await loadAdminAll();
    } else {
      showView('agent');
      await loadAgentAll();
    }
    toast(`欢迎回来，${state.user.display_name}`);
  } catch (err) {
    toast(err.message, true);
  }
};

// ================= ADMIN WORKSPACE =================
$$('#adminTabs .tab').forEach((t) => {
  t.onclick = () => {
    $$('#adminTabs .tab').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    const target = t.dataset.tab;
    $$('.admin-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== target));
  };
});

async function loadAdminAll() {
  const [ov, tasks, scenes, asgs, logs, agents] = await Promise.all([
    api('/api/admin/overview'),
    api('/api/admin/tasks'),
    api('/api/admin/scenes'),
    api('/api/admin/assignments'),
    api('/api/admin/logs'),
    api('/api/admin/agents'),
  ]);
  renderAdminKpis(ov.stats);
  renderAdminTasks(tasks.tasks);
  renderAdminScenes(scenes.scenes);
  renderAdminAssignments(asgs.assignments);
  renderAdminLogs(logs.logs);
  renderAdminAgents(agents.agents);
}

function renderAdminKpis(s) {
  const items = [
    ['活跃认证代理', s.active_agents],
    ['在线合规任务', s.open_compliant_tasks],
    ['内部草稿任务', s.draft_tasks],
    ['待初筛IP场景', s.scenes_pending],
    ['S2常规储备池', s.scenes_s2],
    ['S1稀缺标杆池', s.scenes_s1],
    ['待审认领派单', s.assignments_pending],
    ['待审首件绿灯', s.first_piece_pending],
    ['绿灯批量运行中', s.green_light_active],
    ['待回填QA批次', s.logs_pending_qa],
    ['甲方已回款待结', s.logs_ready_to_settle],
  ];
  $('#adminKpis').innerHTML = items.map(([l, v]) => `
    <div class="kpi"><div class="kpi-val">${v}</div><div class="kpi-lbl">${l}</div></div>
  `).join('');
}

const COMPLIANCE_MAP = {
  WRITTEN_SUBCONTRACT_APPROVED: ['已获书面分包许可', 'pill-green'],
  LINGJU_UNIFIED_TEAM_ACCOUNT: ['凌矩统一子账号托管', 'pill-blue'],
  DRAFT_INTERNAL_ONLY: ['内部草稿(隐藏)', 'pill-gray'],
};

function renderAdminTasks(tasks) {
  $('#adminTaskList').innerHTML = `
    <table>
      <thead><tr><th>编号/标题</th><th>内部甲方与底价(保密)</th><th>代理两档净价</th><th>合规路径锁</th><th>状态切换</th></tr></thead>
      <tbody>
        ${tasks.map((t) => {
          const [clbl, ccls] = COMPLIANCE_MAP[t.compliance_path] || [t.compliance_path, 'pill-gray'];
          return `<tr>
            <td><strong>${esc(t.code)}</strong><br/>${esc(t.title)}<div class="small muted">${esc(t.modality)} · ${esc(t.scene_category)} · ${esc(t.city_scope)}</div></td>
            <td><strong>${esc(t.upstream_name_internal)}</strong><br/>底价 ¥${t.upstream_base_rate_cny}/h<div class="small muted">${esc(t.scene_owner_fee_note)}</div></td>
            <td>自带场景：¥${t.agent_rate_own_scene_cny}/h<br/>平台场景：¥${t.agent_rate_platform_scene_cny}/h</td>
            <td><span class="pill ${ccls}">${clbl}</span></td>
            <td>
              <select class="input-sm" onchange="window.adminPatchTask(${t.id}, this.value)">
                <option value="DRAFT_INTERNAL_ONLY" ${t.compliance_path==='DRAFT_INTERNAL_ONLY'?'selected':''}>设为内部草稿(隐藏)</option>
                <option value="WRITTEN_SUBCONTRACT_APPROVED" ${t.compliance_path==='WRITTEN_SUBCONTRACT_APPROVED'?'selected':''}>书面分包开放</option>
                <option value="LINGJU_UNIFIED_TEAM_ACCOUNT" ${t.compliance_path==='LINGJU_UNIFIED_TEAM_ACCOUNT'?'selected':''}>凌矩统一子账号开放</option>
              </select>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

window.adminPatchTask = async (id, compliance_path) => {
  try {
    await api(`/api/admin/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ compliance_path }) });
    toast('任务合规路径已更新');
    loadAdminAll();
  } catch (e) { toast(e.message, true); }
};

$('#createTaskForm').onsubmit = async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  try {
    await api('/api/admin/tasks', { method: 'POST', body: JSON.stringify(payload) });
    e.target.reset();
    toast('任务包已创建');
    loadAdminAll();
  } catch (err) { toast(err.message, true); }
};

function renderAdminScenes(scenes) {
  $('#adminSceneList').innerHTML = scenes.map((s) => `
    <div class="item-card">
      <div class="row-between">
        <div>
          <strong>${esc(s.code)}</strong> · ${esc(s.province)} ${esc(s.city)} ${esc(s.district)} · <strong>${esc(s.category)}</strong>
          <span class="pill ${s.tier==='S1_BENCHMARK'?'pill-amber':s.tier==='S2_RESERVE'?'pill-green':'pill-gray'}">${esc(s.tier)}</span>
          <span class="pill pill-blue">代理可见状态：${esc(s.public_status)}</span>
        </div>
        <div class="row-gap">
          <button class="btn btn-sm btn-primary" onclick="window.adminTriageScene(${s.id}, 'S2_RESERVE', 'AVAILABLE')">归入S2并脱敏上架</button>
          <button class="btn btn-sm btn-secondary" onclick="window.adminTriageScene(${s.id}, 'S1_BENCHMARK', 'HIDDEN')">归入S1稀缺标杆(仅总控)</button>
          <button class="btn btn-sm btn-danger" onclick="window.adminTriageScene(${s.id}, 'REJECTED', 'HIDDEN')">驳回</button>
        </div>
      </div>
      <div class="small" style="margin-top:6px;"><strong>日常真实作业：</strong>${esc(s.daily_work_desc)}（机位容量约 ${s.estimated_device_capacity} 台 · 时段：${esc(s.open_hours_desc)}）</div>
      <div class="small muted" style="margin-top:4px;"><strong>保密信息（仅总控可见）：</strong>${esc(s.real_store_name)} ｜ ${esc(s.real_contact_name)} ｜ ${esc(s.real_contact_phone)} ｜ ${esc(s.real_address)}</div>
      <div class="small muted"><strong>场地费与凭证口径：</strong>${esc(s.venue_fee_model)}</div>
    </div>
  `).join('') || '<p class="muted">暂无场景线索</p>';
}

window.adminTriageScene = async (id, tier, public_status) => {
  try {
    await api(`/api/admin/scenes/${id}`, { method: 'PATCH', body: JSON.stringify({ tier, public_status }) });
    toast(`场景已更新为 ${tier} / ${public_status}`);
    loadAdminAll();
  } catch (e) { toast(e.message, true); }
};

function renderAdminAssignments(asgs) {
  $('#adminAssignmentList').innerHTML = asgs.map((a) => `
    <div class="item-card">
      <div class="row-between">
        <div>
          <strong>${esc(a.code)}</strong> · 代理：<strong>${esc(a.agent_name)}</strong>（押金：${esc(a.deposit_status)}）
          <span class="pill ${a.status==='BATCH_GREEN_LIGHT'?'pill-green':a.status==='FIRST_PIECE_TRIAL'?'pill-amber':'pill-blue'}">${esc(a.status)}</span>
          <span class="pill pill-gray">首件：${esc(a.first_piece_status)}</span>
        </div>
        <div class="small muted">代理净价 ¥${a.applied_agent_rate_cny}/h（内部甲方：${esc(a.upstream_name_internal)} ¥${a.upstream_base_rate_cny}/h）</div>
      </div>
      <div class="small" style="margin-top:6px;">任务：${esc(a.task_code)} ${esc(a.task_title)} ｜ 模式：${a.mode==='PLATFORM_SCENE'?`平台场景 ${esc(a.scene_code)} (${esc(a.real_store_name)})`:`自有场景 (${esc(a.own_scene_desc)})`}</div>
      ${a.status === 'PENDING_APPROVAL' ? `
        <div class="row-gap" style="margin-top:10px;">
          <select id="dev-arr-${a.id}" class="input-sm">
            <option value="PLATFORM_ISSUED_DEPOSIT">平台发设备(须已押/担保)</option>
            <option value="AGENT_OWN_DEVICE">代理自带合规设备</option>
            <option value="PLATFORM_ISSUED_WAIVED">熟人特批免押发设备</option>
          </select>
          <button class="btn btn-sm btn-primary" onclick="window.adminDecideAsg(${a.id}, 'APPROVE')">批准锁单(进入1-2h首件期)</button>
          <button class="btn btn-sm btn-danger" onclick="window.adminDecideAsg(${a.id}, 'REJECT')">拒绝</button>
        </div>
      ` : ''}
      ${a.status === 'FIRST_PIECE_TRIAL' && a.first_piece_status === 'SUBMITTED' ? `
        <div class="row-gap" style="margin-top:10px;">
          <input id="fp-note-${a.id}" class="input-sm" style="width:260px" placeholder="填写首件审核意见或打回原因" />
          <button class="btn btn-sm btn-primary" onclick="window.adminReviewFP(${a.id}, 'APPROVE_GREEN_LIGHT')">首件合格·点亮批量绿灯</button>
          <button class="btn btn-sm btn-danger" onclick="window.adminReviewFP(${a.id}, 'REJECT_RETRY')">打回整改重提首件</button>
        </div>
      ` : ''}
    </div>
  `).join('') || '<p class="muted">暂无认领派单记录</p>';
}

window.adminDecideAsg = async (id, decision) => {
  const devEl = $(`#dev-arr-${id}`);
  try {
    await api(`/api/admin/assignments/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, device_arrangement: devEl?.value || 'PLATFORM_ISSUED_DEPOSIT' }),
    });
    toast(decision === 'APPROVE' ? '已批准锁单，进入 1–2 小时首件试采期' : '已拒绝该认领申请');
    loadAdminAll();
  } catch (e) { toast(e.message, true); }
};

window.adminReviewFP = async (id, decision) => {
  const note = $(`#fp-note-${id}`)?.value || '';
  try {
    await api(`/api/admin/assignments/${id}/first-piece-review`, {
      method: 'POST',
      body: JSON.stringify({ decision, review_note: note }),
    });
    toast(decision === 'APPROVE_GREEN_LIGHT' ? '已点亮批量开工绿灯！' : '已打回首件要求整改');
    loadAdminAll();
  } catch (e) { toast(e.message, true); }
};

function renderAdminLogs(logs) {
  $('#adminLogList').innerHTML = logs.map((l) => `
    <div class="item-card">
      <div class="row-between">
        <div>
          <strong>#${l.id}</strong> [${esc(l.log_type)}] ${esc(l.log_date)} · ${esc(l.agent_name)} · ${esc(l.assignment_code)}
          <span class="pill ${l.qa_status==='QA_CONFIRMED'?'pill-green':l.qa_status==='QA_REJECTED'?'pill-red':'pill-amber'}">${esc(l.qa_status)}</span>
          <span class="pill pill-blue">${esc(l.settlement_stage)}</span>
        </div>
        <div class="small">原始 ${l.raw_hours}h / 上传 ${l.uploaded_hours}h / <strong>QA有效 ${l.qa_valid_hours}h</strong></div>
      </div>
      <div class="small muted" style="margin-top:4px;">
        上游毛收入 ¥${l.financials.upstream_gross_cny}（估3%增值税 ¥${l.financials.upstream_vat_est_cny}）｜
        代理应得 ¥${l.financials.agent_gross_cny}（扣税点 ¥${l.financials.agent_tax_deduction_cny} → 净付 <strong>¥${l.financials.agent_net_payable_cny}</strong>）｜
        场景场地费 ¥${l.financials.venue_fee_cny} ｜
        <strong>凌矩费前留存 ¥${l.financials.lingju_pre_overhead_margin_cny}</strong>
      </div>
      <form class="grid-3" style="margin-top:10px;" onsubmit="window.adminUpdateLog(event, ${l.id})">
        <label>QA审核状态
          <select name="qa_status">
            <option value="PENDING_QA" ${l.qa_status==='PENDING_QA'?'selected':''}>待甲方QA</option>
            <option value="QA_CONFIRMED" ${l.qa_status==='QA_CONFIRMED'?'selected':''}>甲方已确认有效</option>
            <option value="QA_REJECTED" ${l.qa_status==='QA_REJECTED'?'selected':''}>整批驳回无效</option>
          </select>
        </label>
        <label>QA有效小时<input type="number" step="0.1" name="qa_valid_hours" value="${l.qa_valid_hours}" /></label>
        <label>背靠背账期状态
          <select name="settlement_stage">
            <option value="PENDING_QA" ${l.settlement_stage==='PENDING_QA'?'selected':''}>待甲方QA</option>
            <option value="PENDING_CLIENT_PAYMENT" ${l.settlement_stage==='PENDING_CLIENT_PAYMENT'?'selected':''}>待甲方回款</option>
            <option value="CLIENT_PAID_READY_TO_SETTLE" ${l.settlement_stage==='CLIENT_PAID_READY_TO_SETTLE'?'selected':''}>甲方已回款·待结代理</option>
            <option value="SETTLED_PAID" ${l.settlement_stage==='SETTLED_PAID'?'selected':''}>已打款(须填回单号)</option>
          </select>
        </label>
        <label>场景方场地费(元)<input type="number" step="0.01" name="venue_fee_cny" value="${l.venue_fee_cny}" /></label>
        <label>公户转账回单号<input name="payout_receipt_ref" value="${esc(l.payout_receipt_ref)}" placeholder="标记已打款必填" /></label>
        <label>QA驳回/扣减说明<input name="qa_reject_reason" value="${esc(l.qa_reject_reason)}" /></label>
        <div style="grid-column: 1 / -1; display:flex; justify-content:flex-end;">
          <button type="submit" class="btn btn-sm btn-primary">保存 QA 与背靠背账单</button>
        </div>
      </form>
    </div>
  `).join('') || '<p class="muted">暂无代理提交的采集批次</p>';
}

window.adminUpdateLog = async (e, id) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  try {
    await api(`/api/admin/logs/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    toast('QA 与三方对账已更新');
    loadAdminAll();
  } catch (err) { toast(err.message, true); }
};

function renderAdminAgents(agents) {
  $('#adminAgentList').innerHTML = `
    <table>
      <thead><tr><th>账号/名称</th><th>城市/验真人数</th><th>主体与税点</th><th>押金/担保</th><th>状态</th></tr></thead>
      <tbody>
        ${agents.map((a) => `<tr>
          <td><strong>${esc(a.username)}</strong><br/>${esc(a.display_name)}</td>
          <td>${esc(a.city)} · ${a.verified_headcount}人</td>
          <td>${esc(a.entity_type)}<br/>代征扣点：${(a.tax_deduction_rate * 100).toFixed(1)}%</td>
          <td>${esc(a.deposit_status)} (¥${a.deposit_amount_cny})</td>
          <td>
            <button class="btn btn-sm ${a.status==='ACTIVE'?'btn-secondary':'btn-primary'}"
              onclick="window.adminToggleAgent(${a.id}, '${a.status==='ACTIVE'?'SUSPENDED':'ACTIVE'}')">
              ${a.status==='ACTIVE'?'运行中(点此暂停)':'已暂停(点此恢复)'}
            </button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}

window.adminToggleAgent = async (id, status) => {
  try {
    await api(`/api/admin/agents/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    toast('代理状态已更新');
    loadAdminAll();
  } catch (e) { toast(e.message, true); }
};

$('#createAgentForm').onsubmit = async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  try {
    await api('/api/admin/agents', { method: 'POST', body: JSON.stringify(payload) });
    e.target.reset();
    toast('新认证代理账号已发放');
    loadAdminAll();
  } catch (err) { toast(err.message, true); }
};

// ================= AGENT WORKSPACE =================
$$('#agentTabs .tab').forEach((t) => {
  t.onclick = () => {
    $$('#agentTabs .tab').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    const target = t.dataset.tab;
    $$('.agent-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== target));
  };
});

async function loadAgentAll() {
  const u = state.user;
  $('#agentBanner').innerHTML = `
    <div class="row-between">
      <div>
        <strong>${esc(u.display_name)}</strong>（城市：${esc(u.city || '未填')}）
        <span class="pill pill-blue">主体：${esc(u.entity_type)}</span>
        <span class="pill pill-amber">税点扣除：${(Number(u.tax_deduction_rate || 0) * 100).toFixed(1)}%</span>
        <span class="pill pill-green">押金状态：${esc(u.deposit_status)}</span>
      </div>
      <div class="small muted">所有新单均须先过 1–2 小时首件试采绿灯 · 严禁二次转包与跳单</div>
    </div>
  `;
  const [tasks, scenes, asgs, logs] = await Promise.all([
    api('/api/agent/tasks'),
    api('/api/agent/scenes'),
    api('/api/agent/assignments'),
    api('/api/agent/logs'),
  ]);
  state.agentTasks = tasks.tasks;
  state.agentScenes = scenes.scenes;
  renderAgentTasks(tasks.tasks);
  renderAgentScenes(scenes.scenes);
  renderAgentAssignments(asgs.assignments);
  renderAgentBills(logs.logs);
}

$('#sceneCitySearch').oninput = () => {
  const q = $('#sceneCitySearch').value.trim();
  const filtered = q ? state.agentScenes.filter((s) => `${s.province}${s.city}${s.district}`.includes(q)) : state.agentScenes;
  renderAgentScenes(filtered);
};

function renderAgentTasks(tasks) {
  $('#agentTaskList').innerHTML = tasks.map((t) => `
    <div class="item-card">
      <div class="row-between">
        <div><strong>${esc(t.code)}</strong> · <strong>${esc(t.title)}</strong></div>
        <span class="pill pill-blue">${esc(t.modality)}</span>
      </div>
      <div class="small" style="margin-top:6px;">
        <strong>自带场景净价：¥${t.agent_rate_own_scene_cny}/有效h</strong> ｜
        <strong>用平台场景净价：¥${t.agent_rate_platform_scene_cny}/有效h</strong>
      </div>
      <div class="small muted" style="margin-top:4px;">适配场景：${esc(t.scene_category)} · ${esc(t.city_scope)} · 甲方回款后 ${t.settlement_days_after_client_pay} 工作日内背靠背结算</div>
      <div class="small" style="margin-top:6px;color:#991b1b;"><strong>QA 红线：</strong>${esc(t.qa_red_lines)}</div>
      <div class="small muted" style="margin-top:4px;">${esc(t.sop_summary)}</div>
      <div class="form-actions"><button class="btn btn-sm btn-primary" onclick="window.openClaimModal(${t.id})">申请承接此任务</button></div>
    </div>
  `).join('') || '<p class="muted">当前暂无开放任务包</p>';
}

function renderAgentScenes(scenes) {
  $('#agentSceneList').innerHTML = scenes.map((s) => `
    <div class="item-card">
      <div class="row-between">
        <div><strong>${esc(s.code)}</strong> · ${esc(s.province)} ${esc(s.city)} ${esc(s.district)}</div>
        <span class="pill pill-green">${esc(s.category)} · 约${s.estimated_device_capacity}机位</span>
      </div>
      <div class="small" style="margin-top:6px;"><strong>日常真实作业：</strong>${esc(s.daily_work_desc)}</div>
      <div class="small muted">可采时段：${esc(s.open_hours_desc || '待锁单后确认')}</div>
      <div class="small muted" style="margin-top:4px;">🔒 ${esc(s.contact_unlock_notice)}</div>
    </div>
  `).join('') || '<p class="muted">当前暂无匹配条件的可用脱敏场景</p>';
}

window.openClaimModal = (taskId) => {
  const t = state.agentTasks.find((x) => x.id === taskId);
  if (!t) return;
  const form = $('#claimForm');
  form.reset();
  form.task_pack_id.value = t.id;
  $('#claimTaskSummary').innerHTML = `<strong>${esc(t.code)} ${esc(t.title)}</strong><br/>自带场景净价 ¥${t.agent_rate_own_scene_cny}/h ｜ 使用平台场景净价 ¥${t.agent_rate_platform_scene_cny}/h`;
  $('#claimSceneSelect').innerHTML = state.agentScenes.map((s) =>
    `<option value="${s.id}">${esc(s.code)} · ${esc(s.city)} ${esc(s.category)} (${esc(s.daily_work_desc.slice(0, 22))}...)</option>`
  ).join('') || '<option value="">暂无可用平台脱敏场景</option>';
  $('#ownSceneField').classList.remove('hidden');
  $('#platformSceneField').classList.add('hidden');
  $('#claimModal').classList.remove('hidden');
};

$('#closeClaimModal').onclick = () => $('#claimModal').classList.add('hidden');
$('#claimModeSelect').onchange = (e) => {
  const isPlat = e.target.value === 'PLATFORM_SCENE';
  $('#ownSceneField').classList.toggle('hidden', isPlat);
  $('#platformSceneField').classList.toggle('hidden', !isPlat);
};

$('#claimForm').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.agreement_signed = fd.get('agreement_signed') === 'on';
  try {
    await api('/api/agent/assignments', { method: 'POST', body: JSON.stringify(payload) });
    $('#claimModal').classList.add('hidden');
    toast('认领申请已提交，请等待凌矩总控审批锁单');
    loadAgentAll();
  } catch (err) { toast(err.message, true); }
};

function renderAgentAssignments(asgs) {
  $('#agentAssignmentList').innerHTML = asgs.map((a) => `
    <div class="item-card">
      <div class="row-between">
        <div>
          <strong>${esc(a.code)}</strong> · ${esc(a.task_title)}
          <span class="pill ${a.status==='BATCH_GREEN_LIGHT'?'pill-green':a.status==='FIRST_PIECE_TRIAL'?'pill-amber':'pill-blue'}">${esc(a.status)}</span>
          <span class="pill pill-gray">首件状态：${esc(a.first_piece_status)}</span>
        </div>
        <div><strong>本单净价：¥${a.applied_agent_rate_cny}/有效h</strong></div>
      </div>

      ${a.scene_info ? `
        <div class="${a.scene_info.unlocked ? 'callout-info' : 'callout-danger'}" style="margin-top:8px;">
          <strong>匹配平台场景 ${esc(a.scene_info.code)}：</strong>
          ${esc(a.scene_info.real_store_name)} ｜ 对接人：${esc(a.scene_info.real_contact_name)} ｜ 电话：${esc(a.scene_info.real_contact_phone)} ｜ 地址：${esc(a.scene_info.real_address)}
        </div>
      ` : `<div class="small muted" style="margin-top:6px;">自有场景：${esc(a.own_scene_desc)}</div>`}

      ${a.sop_full_internal ? `
        <div style="margin-top:8px;"><strong class="small">已解锁完整内部执行 SOP：</strong><pre class="sop-box">${esc(a.sop_full_internal)}</pre></div>
      ` : '<div class="small muted" style="margin-top:6px;">🔒 审批锁单后将自动解锁本单完整内部 SOP</div>'}

      ${a.first_piece_review_note ? `<div class="small" style="color:#92400e;">首件审核反馈：${esc(a.first_piece_review_note)}</div>` : ''}

      ${a.status === 'FIRST_PIECE_TRIAL' ? `
        <form class="grid-3" style="margin-top:10px;" onsubmit="window.agentSubmitLog(event, ${a.id}, 'FIRST_PIECE')">
          <label>日期<input type="date" name="log_date" value="${new Date().toISOString().slice(0,10)}" required /></label>
          <label>首件原始小时(上限${a.first_piece_max_hours}h)<input type="number" step="0.1" max="${a.first_piece_max_hours}" name="raw_hours" value="1.5" required /></label>
          <label>首件已上传小时<input type="number" step="0.1" name="uploaded_hours" value="1.5" required /></label>
          <label>上传批次号/说明<input name="batch_ref" placeholder="例：FP-001" /></label>
          <div style="display:flex;align-items:flex-end;">
            <button type="submit" class="btn btn-sm btn-primary">提交 1–2h 首件样本申请绿灯</button>
          </div>
        </form>
        <div class="small muted" style="margin-top:4px;">⛔ 首件未点亮「批量开工绿灯」前，系统已锁定禁止提交大批量日报。</div>
      ` : ''}

      ${a.status === 'BATCH_GREEN_LIGHT' ? `
        <form class="grid-3" style="margin-top:10px;" onsubmit="window.agentSubmitLog(event, ${a.id}, 'BATCH')">
          <label>采集日期<input type="date" name="log_date" value="${new Date().toISOString().slice(0,10)}" required /></label>
          <label>在岗设备数<input type="number" min="1" name="devices_used" value="3" required /></label>
          <label>原始录制小时<input type="number" step="0.1" name="raw_hours" required placeholder="例：18" /></label>
          <label>已上传小时<input type="number" step="0.1" name="uploaded_hours" required placeholder="例：18" /></label>
          <label>批次号/备注<input name="batch_ref" placeholder="例：B-1126-01" /></label>
          <div style="display:flex;align-items:flex-end;">
            <button type="submit" class="btn btn-sm btn-primary">提交今日批量日报</button>
          </div>
        </form>
      ` : ''}
    </div>
  `).join('') || '<p class="muted">您尚未认领任何任务，请前往「资源承接大厅」申请。</p>';
}

window.agentSubmitLog = async (e, assignment_id, log_type) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  payload.assignment_id = assignment_id;
  payload.log_type = log_type;
  try {
    await api('/api/agent/logs', { method: 'POST', body: JSON.stringify(payload) });
    toast(log_type === 'FIRST_PIECE' ? '首件样本已提交，待凌矩预检点亮绿灯' : '批量采集日报已提交，等待上游 QA 核定');
    loadAgentAll();
  } catch (err) { toast(err.message, true); }
};

function renderAgentBills(logs) {
  $('#agentBillList').innerHTML = `
    <table>
      <thead><tr><th>日期/类型</th><th>派单与任务</th><th>上传 / QA有效</th><th>QA状态与原因</th><th>背靠背账期状态</th><th>净到手金额</th></tr></thead>
      <tbody>
        ${logs.map((l) => {
          const eff = l.uploaded_hours > 0 && l.qa_status !== 'PENDING_QA'
            ? `${((l.qa_valid_hours / l.uploaded_hours) * 100).toFixed(1)}%` : '待审';
          return `<tr>
            <td>${esc(l.log_date)}<br/><span class="pill pill-gray">${esc(l.log_type)}</span></td>
            <td>${esc(l.assignment_code)}<br/><span class="small muted">${esc(l.task_title)}</span></td>
            <td>上传 ${l.uploaded_hours}h<br/><strong>有效 ${l.qa_valid_hours}h</strong>（${eff}）</td>
            <td>${esc(l.qa_status)}<div class="small muted">${esc(l.qa_reject_reason)}</div></td>
            <td><span class="pill pill-blue">${esc(l.settlement_stage)}</span><div class="small muted">${l.payout_receipt_ref ? `回单号：${esc(l.payout_receipt_ref)}` : `甲方回款后 ${l.settlement_days_after_client_pay} 工作日内结`}</div></td>
            <td><strong>¥${l.agent_net_payable_cny}</strong><div class="small muted">毛 ¥${l.agent_gross_cny} - 税点 ¥${l.agent_tax_deduction_cny}</div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  ` || '<p class="muted">暂无台账记录</p>';
}

// ================= BOOTSTRAP =================
(async function init() {
  try {
    const res = await api('/api/auth/me');
    state.user = res.user;
  } catch {
    state.user = null;
  }
  renderTopActions();
  if (state.user?.role === 'admin') {
    showView('admin');
    await loadAdminAll();
  } else if (state.user?.role === 'agent') {
    showView('agent');
    await loadAgentAll();
  } else {
    showView('public-scene');
  }
})();
