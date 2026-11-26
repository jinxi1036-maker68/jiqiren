// ================= 100% 纯中文业务字典（消灭英文状态码） =================
const LABELS = {
  entity_type: {
    enterprise_vat: '企业主体（可开票）',
    sole_proprietor: '个体工商户',
    personal_captain: '个人团长（扣代征税点）',
  },
  deposit_status: {
    PAID: ['已缴设备押金', 'tag-green'],
    CORPORATE_GUARANTEE: ['企业协议担保', 'tag-blue'],
    ACQUAINTANCE_WAIVED: ['熟人特批免押', 'tag-amber'],
    UNPAID: ['未缴押金', 'tag-red'],
  },
  compliance_path: {
    WRITTEN_SUBCONTRACT_APPROVED: ['已获书面分包许可', 'tag-green'],
    LINGJU_UNIFIED_TEAM_ACCOUNT: ['凌矩统一子账号托管', 'tag-blue'],
    DRAFT_INTERNAL_ONLY: ['内部草稿（未开放）', 'tag-gray'],
  },
  scene_tier: {
    PENDING_REVIEW: ['待初筛', 'tag-amber'],
    S2_RESERVE: ['S2 常规储备', 'tag-green'],
    S1_BENCHMARK: ['S1 稀缺标杆（仅总控）', 'tag-blue'],
    REJECTED: ['已驳回', 'tag-red'],
  },
  scene_public: {
    HIDDEN: '未向代理公开',
    AVAILABLE: '脱敏可认领',
    LOCKED: '已锁单执行中',
  },
  asg_status: {
    PENDING_APPROVAL: ['待凌矩审批', 'tag-amber'],
    FIRST_PIECE_TRIAL: ['首件试采期（限1–2h）', 'tag-blue'],
    BATCH_GREEN_LIGHT: ['绿灯批量运行中', 'tag-green'],
    REJECTED: ['审批未通过', 'tag-red'],
    PAUSED: ['已暂停', 'tag-gray'],
    COMPLETED: ['已结项', 'tag-gray'],
  },
  fp_status: {
    NOT_SUBMITTED: '待提交首件样本',
    SUBMITTED: '首件已交·待点绿灯',
    APPROVED: '首件已过·绿灯放行',
    REJECTED: '首件打回·待整改',
  },
  qa_status: {
    PENDING_QA: ['待甲方审核', 'tag-amber'],
    QA_CONFIRMED: ['甲方已确认有效', 'tag-green'],
    QA_REJECTED: ['整批驳回无效', 'tag-red'],
  },
  settlement_stage: {
    PENDING_QA: ['待甲方QA核定', 'tag-gray'],
    PENDING_CLIENT_PAYMENT: ['待甲方回款', 'tag-amber'],
    CLIENT_PAID_READY_TO_SETTLE: ['甲方已回款·待结代理', 'tag-blue'],
    SETTLED_PAID: ['已打款（附回单）', 'tag-green'],
  },
  log_type: {
    FIRST_PIECE: '首件样片',
    BATCH: '批量日报',
  },
};

function tagHtml(mapObj, key) {
  const pair = mapObj[key];
  if (!pair) return `<span class="tag tag-gray">${esc(key)}</span>`;
  return `<span class="tag ${pair[1]}">${pair[0]}</span>`;
}

// ================= STATE =================
const state = {
  user: null,
  publicView: 'scene', // 'scene' | 'login'
  module: 'overview',
  subtab: '',
  searchCity: '',
  admin: { stats: {}, tasks: [], scenes: [], assignments: [], logs: [], agents: [] },
  agent: { tasks: [], scenes: [], assignments: [], logs: [] },
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
  toast._t = setTimeout(() => el.classList.add('hidden'), 3400);
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

// ================= DRAWER =================
function openDrawer(title, html, onMount) {
  $('#drawerTitle').textContent = title;
  $('#drawerBody').innerHTML = html;
  $('#drawerBackdrop').classList.remove('hidden');
  if (onMount) onMount($('#drawerBody'));
}
function closeDrawer() {
  $('#drawerBackdrop').classList.add('hidden');
  $('#drawerBody').innerHTML = '';
}
$('#btnCloseDrawer').onclick = closeDrawer;
$('#drawerBackdrop').onclick = (e) => {
  if (e.target === $('#drawerBackdrop')) closeDrawer();
};

// ================= SHELL SWITCHING =================
function showPublic(page = 'scene') {
  state.publicView = page;
  $('#appShell').classList.add('hidden');
  $('#publicShell').classList.remove('hidden');
  $('#publicScenePage').classList.toggle('hidden', page !== 'scene');
  $('#publicLoginPage').classList.toggle('hidden', page !== 'login');
}

function showApp() {
  $('#publicShell').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  const u = state.user;
  $('#sidebarRoleLabel').textContent = u.role === 'admin' ? '凌矩总控台' : '认证代理工作台';
  $('#sidebarUserName').textContent = u.display_name;
  $('#sidebarUserMeta').textContent = u.role === 'admin'
    ? '内部管理权限'
    : `${LABELS.entity_type[u.entity_type] || u.entity_type} · ${LABELS.deposit_status[u.deposit_status]?.[0] || ''}`;
}

$('#pubNavScene').onclick = () => showPublic('scene');
$('#pubNavLogin').onclick = () => showPublic('login');
$('#btnSwitchPublic').onclick = () => showPublic('scene');
$('#btnLogout').onclick = async () => {
  await api('/api/auth/logout', { method: 'POST' });
  state.user = null;
  showPublic('login');
  toast('已安全退出登录');
};

$$('.chip-btn[data-fill]').forEach((btn) => {
  btn.onclick = () => {
    const [u, p] = btn.dataset.fill.split('|');
    const form = $('#loginForm');
    form.username.value = u;
    form.password.value = p;
  };
});

// ================= PUBLIC FORMS =================
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
    toast('已提交免费备案');
  } catch (err) { toast(err.message, true); }
};

$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  try {
    const res = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    state.user = res.user;
    state.module = 'overview';
    state.subtab = '';
    showApp();
    await refreshWorkspaceData();
    renderWorkspace();
    toast(`欢迎回来，${state.user.display_name}`);
  } catch (err) { toast(err.message, true); }
};

// ================= DATA LOADING =================
async function refreshWorkspaceData() {
  if (!state.user) return;
  if (state.user.role === 'admin') {
    const [ov, tasks, scenes, asgs, logs, agents] = await Promise.all([
      api('/api/admin/overview'),
      api('/api/admin/tasks'),
      api('/api/admin/scenes'),
      api('/api/admin/assignments'),
      api('/api/admin/logs'),
      api('/api/admin/agents'),
    ]);
    state.admin = {
      stats: ov.stats,
      tasks: tasks.tasks,
      scenes: scenes.scenes,
      assignments: asgs.assignments,
      logs: logs.logs,
      agents: agents.agents,
    };
  } else {
    const [tasks, scenes, asgs, logs] = await Promise.all([
      api('/api/agent/tasks'),
      api('/api/agent/scenes'),
      api('/api/agent/assignments'),
      api('/api/agent/logs'),
    ]);
    state.agent = {
      tasks: tasks.tasks,
      scenes: scenes.scenes,
      assignments: asgs.assignments,
      logs: logs.logs,
    };
  }
}

// ================= NAVIGATION DEFINITIONS =================
function getNavConfig() {
  if (state.user.role === 'admin') {
    const s = state.admin.stats;
    const pendingAsg = (s.assignments_pending || 0) + (s.first_piece_pending || 0);
    const pendingFinance = (s.logs_pending_qa || 0) + (s.logs_ready_to_settle || 0);
    return [
      { id: 'overview', icon: '📊', label: '总览首页', badge: 0, subtabs: [] },
      {
        id: 'resources', icon: '📦', label: '资源中心', badge: s.scenes_pending || 0,
        subtabs: [
          { id: 'tasks', label: '上游任务分包', count: state.admin.tasks.length },
          { id: 'scenes', label: '全国场景池 (S1/S2)', count: state.admin.scenes.length },
        ],
      },
      {
        id: 'dispatch', icon: '🚦', label: '派单与首件', badge: pendingAsg,
        subtabs: [
          { id: 'pending', label: '待审批认领', count: s.assignments_pending || 0 },
          { id: 'first_piece', label: '首件绿灯审核', count: s.first_piece_pending || 0 },
          { id: 'active', label: '运行中与全部', count: state.admin.assignments.length },
        ],
      },
      {
        id: 'finance', icon: '💰', label: 'QA 与对账', badge: pendingFinance,
        subtabs: [
          { id: 'pending_qa', label: '待回填 QA', count: s.logs_pending_qa || 0 },
          { id: 'all_logs', label: '背靠背结算台账', count: state.admin.logs.length },
        ],
      },
      {
        id: 'agents', icon: '🤝', label: '认证代理库', badge: 0,
        subtabs: [{ id: 'list', label: '已发号代理档案', count: state.admin.agents.length }],
      },
    ];
  }

  // Agent Role Nav
  const myTrial = state.agent.assignments.filter((a) => a.status === 'PENDING_APPROVAL' || a.status === 'FIRST_PIECE_TRIAL').length;
  const myBatch = state.agent.assignments.filter((a) => a.status === 'BATCH_GREEN_LIGHT').length;
  return [
    { id: 'overview', icon: '🏠', label: '工作台首页', badge: 0, subtabs: [] },
    {
      id: 'hall', icon: '🔍', label: '资源承接大厅', badge: 0,
      subtabs: [
        { id: 'tasks', label: '开放合规任务包', count: state.agent.tasks.length },
        { id: 'scenes', label: '全国脱敏场景池', count: state.agent.scenes.length },
      ],
    },
    {
      id: 'delivery', icon: '📋', label: '我的交付执行', badge: myTrial,
      subtabs: [
        { id: 'trial', label: '待审与首件试采', count: myTrial },
        { id: 'batch', label: '绿灯批量运行中', count: myBatch },
      ],
    },
    {
      id: 'bills', icon: '💳', label: '我的背靠背账单', badge: 0,
      subtabs: [
        { id: 'all', label: '全部结算批次', count: state.agent.logs.length },
        { id: 'unpaid', label: '待审与待回款', count: state.agent.logs.filter((l) => l.settlement_stage !== 'SETTLED_PAID').length },
      ],
    },
  ];
}

function go(moduleId, subtabId = '') {
  state.module = moduleId;
  state.subtab = subtabId;
  renderWorkspace();
}

function renderWorkspace() {
  const navConfig = getNavConfig();
  let current = navConfig.find((n) => n.id === state.module) || navConfig[0];
  state.module = current.id;
  if (current.subtabs.length > 0) {
    if (!current.subtabs.some((st) => st.id === state.subtab)) {
      state.subtab = current.subtabs[0].id;
    }
  } else {
    state.subtab = '';
  }

  // Render Left Sidebar
  $('#sideNav').innerHTML = navConfig.map((n) => `
    <button class="nav-item ${n.id === state.module ? 'active' : ''}" data-mod="${n.id}">
      <span class="nav-left"><span>${n.icon}</span><span>${n.label}</span></span>
      ${n.badge > 0 ? `<span class="nav-badge">${n.badge}</span>` : ''}
    </button>
  `).join('');
  $$('#sideNav .nav-item').forEach((btn) => {
    btn.onclick = () => go(btn.dataset.mod);
  });

  // Render Subtabs Bar
  const subBar = $('#subtabsBar');
  if (current.subtabs.length > 0) {
    subBar.classList.remove('hidden');
    subBar.innerHTML = current.subtabs.map((st) => `
      <button class="subtab ${st.id === state.subtab ? 'active' : ''}" data-st="${st.id}">
        ${esc(st.label)} <span class="subtab-count">${st.count}</span>
      </button>
    `).join('');
    $$('#subtabsBar .subtab').forEach((btn) => {
      btn.onclick = () => { state.subtab = btn.dataset.st; renderWorkspace(); };
    });
  } else {
    subBar.classList.add('hidden');
    subBar.innerHTML = '';
  }

  // Dispatch page renderer
  if (state.user.role === 'admin') {
    renderAdminPage();
  } else {
    renderAgentPage();
  }
}

// ================= ADMIN PAGES =================
function renderAdminPage() {
  const actions = $('#wsActions');
  actions.innerHTML = '';

  if (state.module === 'overview') {
    $('#wsTitle').textContent = '经营总览';
    $('#wsSub').textContent = '只看今天最需要您拍板的 4 件事，点击卡片直接进入处理';
    const s = state.admin.stats;
    $('#wsContent').innerHTML = `
      <div class="kpi-row">
        <div class="kpi-card" onclick="window.navGo('resources','scenes')">
          <div class="kpi-label">待初筛 IP 场景</div>
          <div class="kpi-num ${s.scenes_pending ? 'alert' : ''}">${s.scenes_pending || 0}</div>
          <div class="kpi-hint">S2储备 ${s.scenes_s2 || 0} 个 · S1标杆 ${s.scenes_s1 || 0} 个</div>
        </div>
        <div class="kpi-card" onclick="window.navGo('dispatch','pending')">
          <div class="kpi-label">待审派单 / 首件绿灯</div>
          <div class="kpi-num ${(s.assignments_pending + s.first_piece_pending) ? 'alert' : ''}">${(s.assignments_pending || 0) + (s.first_piece_pending || 0)}</div>
          <div class="kpi-hint">待审认领 ${s.assignments_pending || 0} · 待点绿灯 ${s.first_piece_pending || 0}</div>
        </div>
        <div class="kpi-card" onclick="window.navGo('finance','pending_qa')">
          <div class="kpi-label">待回填 QA / 待结批次</div>
          <div class="kpi-num ${(s.logs_pending_qa + s.logs_ready_to_settle) ? 'alert' : ''}">${(s.logs_pending_qa || 0) + (s.logs_ready_to_settle || 0)}</div>
          <div class="kpi-hint">待回填QA ${s.logs_pending_qa || 0} · 已回款待结 ${s.logs_ready_to_settle || 0}</div>
        </div>
        <div class="kpi-card" onclick="window.navGo('resources','tasks')">
          <div class="kpi-label">在线合规任务 / 活跃代理</div>
          <div class="kpi-num highlight">${s.open_compliant_tasks || 0} / ${s.active_agents || 0}</div>
          <div class="kpi-hint">绿灯运行中派单 ${s.green_light_active || 0} 个</div>
        </div>
      </div>

      <div class="surface-card">
        <div class="row-between" style="margin-bottom:14px;">
          <h3 style="font-size:15px;">快捷操作入口</h3>
          <span class="small muted">日常高频动作一键打开</span>
        </div>
        <div class="row-gap">
          <button class="btn btn-primary" onclick="window.openCreateTaskDrawer()">+ 新建上游任务包</button>
          <button class="btn btn-secondary" onclick="window.openCreateAgentDrawer()">+ 核验发放新代理账号</button>
          <button class="btn btn-secondary" onclick="window.navGo('resources','scenes')">去审核 IP 场景线索</button>
          <button class="btn btn-secondary" onclick="window.navGo('finance','all_logs')">查看背靠背三方对账</button>
        </div>
      </div>
    `;
    return;
  }

  if (state.module === 'resources' && state.subtab === 'tasks') {
    $('#wsTitle').textContent = '资源中心 · 上游任务分包';
    $('#wsSub').textContent = '仅开放已确认合规路径的任务；内部甲方名称与底价对代理端绝对保密';
    actions.innerHTML = `<button class="btn btn-primary" onclick="window.openCreateTaskDrawer()">+ 新建任务包</button>`;
    const tasks = state.admin.tasks;
    $('#wsContent').innerHTML = tasks.length ? `
      <div class="table-card">
        <table>
          <thead><tr><th>任务包</th><th>内部甲方与底价（保密）</th><th>代理净价（自带 / 用平台场景）</th><th>合规状态</th><th>操作</th></tr></thead>
          <tbody>
            ${tasks.map((t) => `<tr>
              <td>
                <div style="font-weight:700;">${esc(t.title)}</div>
                <div class="small muted">${esc(t.code)} · ${esc(t.modality)} · ${esc(t.scene_category)}</div>
              </td>
              <td>
                <div style="font-weight:600;">${esc(t.upstream_name_internal)}</div>
                <div class="small muted">底价 ¥${t.upstream_base_rate_cny}/h</div>
              </td>
              <td><strong>¥${t.agent_rate_own_scene_cny}</strong> / <strong>¥${t.agent_rate_platform_scene_cny}</strong> 元/h</td>
              <td>${tagHtml(LABELS.compliance_path, t.compliance_path)}</td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="window.openTaskComplianceDrawer(${t.id})">调整状态</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="empty-box">暂无任务包，请点击右上角「+ 新建任务包」</div>';
    return;
  }

  if (state.module === 'resources' && state.subtab === 'scenes') {
    $('#wsTitle').textContent = '资源中心 · 全国场景双层池';
    $('#wsSub').textContent = 'S2 常规储备脱敏上架供代理认领；S1 稀缺标杆仅总控可见，用于反向撬动大甲方';
    const scenes = state.admin.scenes;
    $('#wsContent').innerHTML = scenes.length ? `
      <div class="stack-md">
        ${scenes.map((s) => `
          <div class="entity-card">
            <div class="row-between">
              <div class="row-gap">
                <span class="entity-title">${esc(s.province)} ${esc(s.city)} ${esc(s.district)} · ${esc(s.category)}</span>
                ${tagHtml(LABELS.scene_tier, s.tier)}
                <span class="tag tag-gray">${LABELS.scene_public[s.public_status] || s.public_status}</span>
              </div>
              <button class="btn btn-sm btn-primary" onclick="window.openSceneTriageDrawer(${s.id})">分级与管理</button>
            </div>
            <div class="small">${esc(s.daily_work_desc)}</div>
            <div class="meta-strip">
              <span>编号：${esc(s.code)}</span>
              <span>机位容量：约 ${s.estimated_device_capacity} 台</span>
              <span>保密信息：${esc(s.real_store_name)}（${esc(s.real_contact_name)} ${esc(s.real_contact_phone)}）</span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '<div class="empty-box">暂无场景线索，可由抖音老板通过「实体老板场景备案页」提交</div>';
    return;
  }

  if (state.module === 'dispatch') {
    $('#wsTitle').textContent = '派单审批与首件绿灯';
    $('#wsSub').textContent = '押金可分级，但 1–2 小时首件试采绿灯人人必过、系统硬锁';
    let list = state.admin.assignments;
    if (state.subtab === 'pending') list = list.filter((a) => a.status === 'PENDING_APPROVAL');
    if (state.subtab === 'first_piece') list = list.filter((a) => a.status === 'FIRST_PIECE_TRIAL' && a.first_piece_status === 'SUBMITTED');

    $('#wsContent').innerHTML = list.length ? `
      <div class="stack-md">
        ${list.map((a) => `
          <div class="entity-card">
            <div class="row-between">
              <div class="row-gap">
                <span class="entity-title">${esc(a.agent_name)}</span>
                ${tagHtml(LABELS.asg_status, a.status)}
                <span class="tag tag-gray">${LABELS.fp_status[a.first_piece_status] || a.first_piece_status}</span>
              </div>
              <div class="row-gap">
                ${a.status === 'PENDING_APPROVAL' ? `<button class="btn btn-sm btn-primary" onclick="window.openApproveAsgDrawer(${a.id})">审批锁单</button>` : ''}
                ${a.status === 'FIRST_PIECE_TRIAL' && a.first_piece_status === 'SUBMITTED' ? `<button class="btn btn-sm btn-primary" onclick="window.openReviewFPDrawer(${a.id})">审核首件点绿灯</button>` : ''}
              </div>
            </div>
            <div class="meta-strip">
              <span>派单号：${esc(a.code)}</span>
              <span>任务：${esc(a.task_title)}</span>
              <span>代理净价：¥${a.applied_agent_rate_cny}/h（内部甲方底价 ¥${a.upstream_base_rate_cny}/h）</span>
              <span>押金：${LABELS.deposit_status[a.deposit_status]?.[0] || a.deposit_status}</span>
            </div>
            <div class="small muted">场景：${a.mode === 'PLATFORM_SCENE' ? `平台场景 ${esc(a.scene_code)}（${esc(a.real_store_name)}）` : `代理自有场景（${esc(a.own_scene_desc)}）`}</div>
          </div>
        `).join('')}
      </div>
    ` : '<div class="empty-box">当前分类下暂无待处理派单</div>';
    return;
  }

  if (state.module === 'finance') {
    $('#wsTitle').textContent = 'QA 回传与背靠背三方对账';
    $('#wsSub').textContent = '按甲方确认有效小时核算；标记已打款必填公户回单号，绝不替甲方垫资';
    let list = state.admin.logs;
    if (state.subtab === 'pending_qa') list = list.filter((l) => l.qa_status === 'PENDING_QA');

    $('#wsContent').innerHTML = list.length ? `
      <div class="table-card">
        <table>
          <thead><tr><th>批次 / 代理</th><th>上传 / QA有效</th><th>QA 与账期状态</th><th>三方金额拆解</th><th>操作</th></tr></thead>
          <tbody>
            ${list.map((l) => `<tr>
              <td>
                <div style="font-weight:700;">#${l.id} · ${esc(l.agent_name)}</div>
                <div class="small muted">${esc(l.log_date)} · ${LABELS.log_type[l.log_type] || l.log_type} · ${esc(l.assignment_code)}</div>
              </td>
              <td>上传 ${l.uploaded_hours}h<br/><strong>有效 ${l.qa_valid_hours}h</strong></td>
              <td>${tagHtml(LABELS.qa_status, l.qa_status)}<div style="margin-top:6px;">${tagHtml(LABELS.settlement_stage, l.settlement_stage)}</div></td>
              <td class="small">
                代理净付：<strong>¥${l.financials.agent_net_payable_cny}</strong>（扣税 ¥${l.financials.agent_tax_deduction_cny}）<br/>
                场景费：¥${l.financials.venue_fee_cny} ｜ <strong>凌矩留存：¥${l.financials.lingju_pre_overhead_margin_cny}</strong>
              </td>
              <td><button class="btn btn-sm btn-primary" onclick="window.openAdminLogDrawer(${l.id})">回填 QA / 结算</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="empty-box">暂无采集批次记录</div>';
    return;
  }

  if (state.module === 'agents') {
    $('#wsTitle').textContent = '认证代理发号库';
    $('#wsSub').textContent = '仅准入核验通过的小团队、企业或成熟地方团长，严禁 C 类二道贩子';
    actions.innerHTML = `<button class="btn btn-primary" onclick="window.openCreateAgentDrawer()">+ 发放新代理账号</button>`;
    const agents = state.admin.agents;
    $('#wsContent').innerHTML = agents.length ? `
      <div class="table-card">
        <table>
          <thead><tr><th>代理名称 / 账号</th><th>城市与人数</th><th>开票主体与扣点</th><th>押金 / 担保</th><th>账号状态</th></tr></thead>
          <tbody>
            ${agents.map((a) => `<tr>
              <td><strong>${esc(a.display_name)}</strong><div class="small muted">账号：${esc(a.username)}</div></td>
              <td>${esc(a.city || '未填')} · 验真 ${a.verified_headcount} 人</td>
              <td>${LABELS.entity_type[a.entity_type] || a.entity_type}<div class="small muted">税点扣除 ${(a.tax_deduction_rate * 100).toFixed(1)}%</div></td>
              <td>${tagHtml(LABELS.deposit_status, a.deposit_status)} <span class="small muted">¥${a.deposit_amount_cny}</span></td>
              <td>
                <button class="btn btn-sm ${a.status === 'ACTIVE' ? 'btn-secondary' : 'btn-primary'}"
                  onclick="window.adminToggleAgent(${a.id}, '${a.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'}')">
                  ${a.status === 'ACTIVE' ? '正常（点此暂停）' : '已暂停（点此恢复）'}
                </button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="empty-box">暂无认证代理，请点击右上角「+ 发放新代理账号」</div>';
  }
}

// ================= AGENT PAGES =================
function renderAgentPage() {
  $('#wsActions').innerHTML = '';
  const u = state.user;

  if (state.module === 'overview') {
    $('#wsTitle').textContent = `你好，${u.display_name}`;
    $('#wsSub').textContent = '先看清当前最优先的一步，按首件绿灯规则稳步交付';
    const asgs = state.agent.assignments;
    const logs = state.agent.logs;
    const activeBatch = asgs.filter((a) => a.status === 'BATCH_GREEN_LIGHT').length;
    const waitingTrial = asgs.filter((a) => a.status === 'FIRST_PIECE_TRIAL' || a.status === 'PENDING_APPROVAL').length;
    const confirmedPay = logs
      .filter((l) => l.qa_status === 'QA_CONFIRMED')
      .reduce((sum, l) => sum + Number(l.agent_net_payable_cny || 0), 0);

    $('#wsContent').innerHTML = `
      <div class="kpi-row">
        <div class="kpi-card" onclick="window.navGo('hall','tasks')">
          <div class="kpi-label">可承接开放任务</div>
          <div class="kpi-num highlight">${state.agent.tasks.length}</div>
          <div class="kpi-hint">同城/全国可用脱敏场景 ${state.agent.scenes.length} 个</div>
        </div>
        <div class="kpi-card" onclick="window.navGo('delivery','trial')">
          <div class="kpi-label">待审与首件试采单</div>
          <div class="kpi-num ${waitingTrial ? 'alert' : ''}">${waitingTrial}</div>
          <div class="kpi-hint">绿灯批量运行中 ${activeBatch} 单</div>
        </div>
        <div class="kpi-card" onclick="window.navGo('bills','all')">
          <div class="kpi-label">已确认有效净收益</div>
          <div class="kpi-num highlight">¥${confirmedPay.toFixed(2)}</div>
          <div class="kpi-hint">甲方回款后按背靠背周期结算</div>
        </div>
      </div>

      <div class="surface-card">
        <div class="row-between">
          <div>
            <h3 style="font-size:15px;">我的准入档案</h3>
            <div class="meta-strip" style="margin-top:8px;">
              <span>所在城市：<strong>${esc(u.city || '未填')}</strong></span>
              <span>主体类型：<strong>${LABELS.entity_type[u.entity_type] || u.entity_type}</strong></span>
              <span>代征税点：<strong>${(Number(u.tax_deduction_rate || 0) * 100).toFixed(1)}%</strong></span>
              <span>押金状态：${tagHtml(LABELS.deposit_status, u.deposit_status)}</span>
            </div>
          </div>
          <button class="btn btn-primary" onclick="window.navGo('hall','tasks')">前往资源大厅领单 →</button>
        </div>
      </div>
    `;
    return;
  }

  if (state.module === 'hall' && state.subtab === 'tasks') {
    $('#wsTitle').textContent = '资源大厅 · 开放合规任务包';
    $('#wsSub').textContent = '以下展示您的代理净到手价；按甲方最终确认有效小时背靠背结算';
    const tasks = state.agent.tasks;
    $('#wsContent').innerHTML = tasks.length ? `
      <div class="stack-md">
        ${tasks.map((t) => `
          <div class="entity-card">
            <div class="row-between" style="align-items:flex-start;">
              <div>
                <div class="row-gap" style="margin-bottom:6px;">
                  <span class="tag tag-blue">${esc(t.modality)}</span>
                  <span class="tag tag-gray">${esc(t.scene_category)}</span>
                  <span class="small muted">${esc(t.city_scope)}</span>
                </div>
                <div class="entity-title">${esc(t.title)}</div>
              </div>
              <div class="price-hero">
                <div class="price-main">¥${t.agent_rate_own_scene_cny} <span style="font-size:13px;font-weight:500;">/有效h</span></div>
                <div class="price-sub">自带场景价 ｜ 用平台场景 ¥${t.agent_rate_platform_scene_cny}/h</div>
              </div>
            </div>
            <div class="redline-bar"><strong>QA 红线：</strong>${esc(t.qa_red_lines)}</div>
            <div class="row-between">
              <span class="small muted">首件试采上限 ${t.first_piece_max_hours}h · 甲方回款后 ${t.settlement_days_after_client_pay} 个工作日内结算</span>
              <button class="btn btn-primary" onclick="window.openClaimDrawer(${t.id})">申请承接此任务</button>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '<div class="empty-box">当前暂无开放任务包</div>';
    return;
  }

  if (state.module === 'hall' && state.subtab === 'scenes') {
    $('#wsTitle').textContent = '资源大厅 · 全国脱敏场景池';
    $('#wsSub').textContent = '锁单审批通过后，系统将自动解锁该场景的真实店名、地址与对接人';
    const q = state.searchCity.trim();
    const list = q ? state.agent.scenes.filter((s) => `${s.province}${s.city}${s.district}${s.category}`.includes(q)) : state.agent.scenes;

    $('#wsContent').innerHTML = `
      <div class="filter-bar">
        <input id="citySearchInput" class="search-input" value="${esc(state.searchCity)}" placeholder="输入城市或行业筛选（如：平顶山）" />
        <span class="small muted">共 ${list.length} 个可用脱敏场景</span>
      </div>
      ${list.length ? `
        <div class="grid-2">
          ${list.map((s) => `
            <div class="entity-card">
              <div class="row-between">
                <span class="entity-title">${esc(s.province)} ${esc(s.city)} ${esc(s.district)}</span>
                <span class="tag tag-green">${esc(s.category)} · 约 ${s.estimated_device_capacity} 机位</span>
              </div>
              <div class="small">${esc(s.daily_work_desc)}</div>
              <div class="small muted">开放时段：${esc(s.open_hours_desc || '锁单后确认')}</div>
              <div class="lock-bar">🔒 店名与联系方式已脱敏，请在「开放合规任务包」中组合认领解锁</div>
            </div>
          `).join('')}
        </div>
      ` : '<div class="empty-box">暂无匹配的脱敏场景</div>'}
    `;
    const inp = $('#citySearchInput');
    if (inp) {
      inp.oninput = () => {
        state.searchCity = inp.value;
        renderAgentPage();
        const el = $('#citySearchInput');
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      };
    }
    return;
  }

  if (state.module === 'delivery') {
    $('#wsTitle').textContent = '我的交付执行';
    $('#wsSub').textContent = '新单必须先通过 1–2 小时首件试采点亮绿灯，才解锁批量日报提交';
    let list = state.agent.assignments;
    if (state.subtab === 'trial') list = list.filter((a) => a.status === 'PENDING_APPROVAL' || a.status === 'FIRST_PIECE_TRIAL');
    if (state.subtab === 'batch') list = list.filter((a) => a.status === 'BATCH_GREEN_LIGHT');

    $('#wsContent').innerHTML = list.length ? `
      <div class="stack-md">
        ${list.map((a) => `
          <div class="entity-card">
            <div class="row-between">
              <div class="row-gap">
                <span class="entity-title">${esc(a.task_title)}</span>
                ${tagHtml(LABELS.asg_status, a.status)}
                <span class="tag tag-gray">${LABELS.fp_status[a.first_piece_status] || a.first_piece_status}</span>
              </div>
              <strong style="color:var(--primary);font-size:16px;">¥${a.applied_agent_rate_cny}/有效h</strong>
            </div>

            ${a.scene_info ? (a.scene_info.unlocked
              ? `<div class="unlock-bar"><strong>已解锁场景对接：</strong>${esc(a.scene_info.real_store_name)} ｜ ${esc(a.scene_info.real_contact_name)} ${esc(a.scene_info.real_contact_phone)} ｜ ${esc(a.scene_info.real_address)}</div>`
              : `<div class="lock-bar">🔒 匹配场景 ${esc(a.scene_info.code)}（待凌矩审批锁单后解锁真联系）</div>`
            ) : `<div class="small muted">自有场景：${esc(a.own_scene_desc)}</div>`}

            <div class="row-between">
              <span class="small muted">派单号：${esc(a.code)}${a.first_piece_review_note ? ` · 审核反馈：${esc(a.first_piece_review_note)}` : ''}</span>
              <div class="row-gap">
                ${a.sop_full_internal ? `<button class="btn btn-sm btn-secondary" onclick="window.openSopDrawer(${a.id})">查看完整 SOP</button>` : ''}
                ${a.status === 'FIRST_PIECE_TRIAL' ? `<button class="btn btn-sm btn-primary" onclick="window.openSubmitLogDrawer(${a.id}, 'FIRST_PIECE')">提交首件样本 (1–2h)</button>` : ''}
                ${a.status === 'BATCH_GREEN_LIGHT' ? `<button class="btn btn-sm btn-primary" onclick="window.openSubmitLogDrawer(${a.id}, 'BATCH')">+ 提交今日批量日报</button>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '<div class="empty-box">当前分类下暂无派单，可前往左侧「资源承接大厅」认领任务</div>';
    return;
  }

  if (state.module === 'bills') {
    $('#wsTitle').textContent = '我的背靠背账单';
    $('#wsSub').textContent = '清晰区分待审、待甲方回款与已打款回单号';
    let list = state.agent.logs;
    if (state.subtab === 'unpaid') list = list.filter((l) => l.settlement_stage !== 'SETTLED_PAID');

    $('#wsContent').innerHTML = list.length ? `
      <div class="table-card">
        <table>
          <thead><tr><th>日期 / 类型</th><th>派单与任务</th><th>上传 / 有效小时</th><th>QA 与账期状态</th><th>净到手金额</th></tr></thead>
          <tbody>
            ${list.map((l) => `<tr>
              <td><strong>${esc(l.log_date)}</strong><div class="small muted">${LABELS.log_type[l.log_type] || l.log_type}</div></td>
              <td>${esc(l.task_title)}<div class="small muted">${esc(l.assignment_code)}</div></td>
              <td>上传 ${l.uploaded_hours}h<br/><strong>有效 ${l.qa_valid_hours}h</strong></td>
              <td>
                ${tagHtml(LABELS.qa_status, l.qa_status)}
                <div style="margin-top:6px;">${tagHtml(LABELS.settlement_stage, l.settlement_stage)}</div>
                ${l.payout_receipt_ref ? `<div class="small muted" style="margin-top:4px;">回单：${esc(l.payout_receipt_ref)}</div>` : ''}
                ${l.qa_reject_reason ? `<div class="small" style="color:#b91c1c;margin-top:4px;">${esc(l.qa_reject_reason)}</div>` : ''}
              </td>
              <td><strong style="font-size:16px;color:var(--primary);">¥${l.agent_net_payable_cny}</strong><div class="small muted">毛 ¥${l.agent_gross_cny} - 税 ¥${l.agent_tax_deduction_cny}</div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="empty-box">暂无结算台账记录</div>';
  }
}

// ================= DRAWER ACTIONS =================
window.navGo = go;

window.openCreateTaskDrawer = () => {
  openDrawer('新建上游任务分包', `
    <form id="drawerTaskForm" class="stack-md">
      <label>任务标题 *<input name="title" required placeholder="如：文具店补货理货第一视角采集" /></label>
      <div class="grid-2">
        <label>内部甲方名 *(保密)<input name="upstream_name_internal" required /></label>
        <label>甲方含税底价(元/h) *(保密)<input type="number" step="0.01" name="upstream_base_rate_cny" required /></label>
      </div>
      <div class="grid-2">
        <label>设备模态 *
          <select name="modality">
            <option value="EGO第一视角">EGO第一视角</option>
            <option value="双目/夹爪">双目/夹爪</option>
            <option value="夹爪">夹爪</option>
            <option value="双目">双目</option>
          </select>
        </label>
        <label>适配场景类别 *<input name="scene_category" required placeholder="如：零售购物空间" /></label>
      </div>
      <div class="grid-2">
        <label>代理净价-自带场景(元/h) *<input type="number" step="0.01" name="agent_rate_own_scene_cny" required /></label>
        <label>代理净价-平台场景(元/h) *<input type="number" step="0.01" name="agent_rate_platform_scene_cny" required /></label>
      </div>
      <label>合规路径锁 *
        <select name="compliance_path">
          <option value="DRAFT_INTERNAL_ONLY">仅内部草稿（不对代理展示）</option>
          <option value="WRITTEN_SUBCONTRACT_APPROVED">已获甲方书面分包许可</option>
          <option value="LINGJU_UNIFIED_TEAM_ACCOUNT">纳入凌矩统一子账号项目管理</option>
        </select>
      </label>
      <div class="grid-2">
        <label>地域范围<input name="city_scope" value="全国适用" /></label>
        <label>甲方回款后结代理(工作日)<input type="number" name="settlement_days_after_client_pay" value="5" /></label>
      </div>
      <label>场地费及税耗预留备注<input name="scene_owner_fee_note" placeholder="如：预留2-3元/h用于场地费及税耗" /></label>
      <label>QA 红线 *（代理可见）<input name="qa_red_lines" required placeholder="手出画超3秒作废；严禁空桌摆拍" /></label>
      <label>锁单后解锁的完整内部 SOP<textarea name="sop_full_internal" rows="4"></textarea></label>
      <div class="row-end"><button type="submit" class="btn btn-primary">确认创建</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerTaskForm').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/api/admin/tasks', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
        closeDrawer();
        toast('任务包已创建');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  });
};

window.openTaskComplianceDrawer = (id) => {
  const t = state.admin.tasks.find((x) => x.id === id);
  if (!t) return;
  openDrawer(`调整任务合规状态 · ${t.code}`, `
    <form id="drawerPatchTask" class="stack-md">
      <div class="small muted">${esc(t.title)}</div>
      <label>合规路径锁
        <select name="compliance_path">
          <option value="DRAFT_INTERNAL_ONLY" ${t.compliance_path==='DRAFT_INTERNAL_ONLY'?'selected':''}>内部草稿（不对代理展示）</option>
          <option value="WRITTEN_SUBCONTRACT_APPROVED" ${t.compliance_path==='WRITTEN_SUBCONTRACT_APPROVED'?'selected':''}>已获甲方书面分包许可（开放）</option>
          <option value="LINGJU_UNIFIED_TEAM_ACCOUNT" ${t.compliance_path==='LINGJU_UNIFIED_TEAM_ACCOUNT'?'selected':''}>凌矩统一子账号托管（开放）</option>
        </select>
      </label>
      <div class="row-end"><button type="submit" class="btn btn-primary">保存变更</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerPatchTask').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(`/api/admin/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
        closeDrawer();
        toast('合规状态已更新');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  });
};

window.openSceneTriageDrawer = (id) => {
  const s = state.admin.scenes.find((x) => x.id === id);
  if (!s) return;
  openDrawer(`场景分级管理 · ${s.code}`, `
    <form id="drawerSceneForm" class="stack-md">
      <div class="unlock-bar">
        <strong>保密联系信息：</strong><br/>
        ${esc(s.real_store_name)} ｜ ${esc(s.real_contact_name)} ${esc(s.real_contact_phone)}<br/>
        地址：${esc(s.real_address)}
      </div>
      <label>场景分层 *
        <select name="tier">
          <option value="S2_RESERVE" ${s.tier==='S2_RESERVE'?'selected':''}>S2 常规储备池（脱敏上架给代理）</option>
          <option value="S1_BENCHMARK" ${s.tier==='S1_BENCHMARK'?'selected':''}>S1 稀缺标杆池（仅总控可见，反推大甲方）</option>
          <option value="PENDING_REVIEW" ${s.tier==='PENDING_REVIEW'?'selected':''}>待初筛（隐藏）</option>
          <option value="REJECTED" ${s.tier==='REJECTED'?'selected':''}>驳回不采用</option>
        </select>
      </label>
      <label>代理池可见状态（仅 S2 可开放）
        <select name="public_status">
          <option value="AVAILABLE" ${s.public_status==='AVAILABLE'?'selected':''}>脱敏上架可认领</option>
          <option value="HIDDEN" ${s.public_status==='HIDDEN'?'selected':''}>暂隐藏储备</option>
        </select>
      </label>
      <label>场地费与发票/税耗口径<input name="venue_fee_model" value="${esc(s.venue_fee_model)}" /></label>
      <label>初筛备注<textarea name="review_note" rows="2">${esc(s.review_note)}</textarea></label>
      <div class="row-end"><button type="submit" class="btn btn-primary">保存分级</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerSceneForm').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(`/api/admin/scenes/${id}`, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
        closeDrawer();
        toast('场景分级已更新');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  });
};

window.openCreateAgentDrawer = () => {
  openDrawer('核验发放新代理账号', `
    <form id="drawerAgentForm" class="stack-md">
      <div class="grid-2">
        <label>登录账号 *<input name="username" required placeholder="如：agent_zz_01" /></label>
        <label>初始密码 *(至少6位)<input name="password" required placeholder="如：Team@2026" /></label>
      </div>
      <label>团队 / 企业名称 *<input name="display_name" required placeholder="如：郑州XX数采团队" /></label>
      <div class="grid-2">
        <label>开票主体类型 *
          <select name="entity_type">
            <option value="enterprise_vat">企业主体（可开票）</option>
            <option value="sole_proprietor">个体工商户</option>
            <option value="personal_captain">个人团长（扣代征税点）</option>
          </select>
        </label>
        <label>代征税点（如 0 或 0.06）<input type="number" step="0.01" min="0" max="0.3" name="tax_deduction_rate" value="0" /></label>
      </div>
      <div class="grid-2">
        <label>设备押金 / 担保状态 *
          <select name="deposit_status">
            <option value="PAID">已缴设备押金</option>
            <option value="CORPORATE_GUARANTEE">企业协议担保</option>
            <option value="ACQUAINTANCE_WAIVED">熟人特批免押（仍须过首件绿灯）</option>
            <option value="UNPAID">未缴押金</option>
          </select>
        </label>
        <label>实缴押金金额(元)<input type="number" name="deposit_amount_cny" value="0" /></label>
      </div>
      <div class="grid-2">
        <label>所在城市<input name="city" placeholder="如：平顶山" /></label>
        <label>验真在岗人数<input type="number" name="verified_headcount" value="5" /></label>
      </div>
      <label>核验备注<input name="notes" placeholder="如：已视频验真场地与团队" /></label>
      <div class="row-end"><button type="submit" class="btn btn-primary">确认发号</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerAgentForm').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/api/admin/agents', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
        closeDrawer();
        toast('新代理账号已发放');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  });
};

window.adminToggleAgent = async (id, status) => {
  try {
    await api(`/api/admin/agents/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    toast('代理状态已更新');
    await refreshWorkspaceData();
    renderWorkspace();
  } catch (e) { toast(e.message, true); }
};

window.openApproveAsgDrawer = (id) => {
  const a = state.admin.assignments.find((x) => x.id === id);
  if (!a) return;
  openDrawer(`审批派单 · ${a.code}`, `
    <form id="drawerApproveAsg" class="stack-md">
      <div class="small"><strong>代理：</strong>${esc(a.agent_name)}（押金：${LABELS.deposit_status[a.deposit_status]?.[0] || a.deposit_status}）</div>
      <div class="small"><strong>任务：</strong>${esc(a.task_title)}</div>
      <label>设备配置方式
        <select name="device_arrangement">
          <option value="PLATFORM_ISSUED_DEPOSIT">平台配发设备（须已缴押金/担保）</option>
          <option value="AGENT_OWN_DEVICE">代理自带合规设备</option>
          <option value="PLATFORM_ISSUED_WAIVED">熟人特批免押发设备</option>
        </select>
      </label>
      <label>审批备注<input name="admin_note" placeholder="可选" /></label>
      <div class="row-end">
        <button type="button" class="btn btn-danger" id="btnRejectAsg">拒绝申请</button>
        <button type="submit" class="btn btn-primary">批准锁单（进入首件期）</button>
      </div>
    </form>
  `, (body) => {
    const submitDecision = async (decision) => {
      const fd = new FormData(body.querySelector('#drawerApproveAsg'));
      try {
        await api(`/api/admin/assignments/${id}/decision`, {
          method: 'POST',
          body: JSON.stringify({ decision, ...Object.fromEntries(fd.entries()) }),
        });
        closeDrawer();
        toast(decision === 'APPROVE' ? '已锁单解锁，进入 1–2h 首件试采期' : '已拒绝申请');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
    body.querySelector('#drawerApproveAsg').onsubmit = (e) => { e.preventDefault(); submitDecision('APPROVE'); };
    body.querySelector('#btnRejectAsg').onclick = () => submitDecision('REJECT');
  });
};

window.openReviewFPDrawer = (id) => {
  openDrawer('审核 1–2h 首件试采样本', `
    <form id="drawerReviewFP" class="stack-md">
      <label>审核结论说明<textarea name="review_note" rows="3" placeholder="填写首件过审备注，或明确打回整改原因"></textarea></label>
      <div class="row-end">
        <button type="button" class="btn btn-danger" id="btnRejectFP">打回重提首件</button>
        <button type="submit" class="btn btn-primary">首件合格 · 点亮批量绿灯</button>
      </div>
    </form>
  `, (body) => {
    const send = async (decision) => {
      const note = body.querySelector('[name=review_note]').value;
      try {
        await api(`/api/admin/assignments/${id}/first-piece-review`, {
          method: 'POST', body: JSON.stringify({ decision, review_note: note }),
        });
        closeDrawer();
        toast(decision === 'APPROVE_GREEN_LIGHT' ? '已点亮批量开工绿灯！' : '已打回首件整改');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
    body.querySelector('#drawerReviewFP').onsubmit = (e) => { e.preventDefault(); send('APPROVE_GREEN_LIGHT'); };
    body.querySelector('#btnRejectFP').onclick = () => send('REJECT_RETRY');
  });
};

window.openAdminLogDrawer = (id) => {
  const l = state.admin.logs.find((x) => x.id === id);
  if (!l) return;
  openDrawer(`QA 回传与背靠背结算 · #${l.id}`, `
    <form id="drawerLogForm" class="stack-md">
      <div class="small muted">${esc(l.agent_name)} · 上传 ${l.uploaded_hours}h（原始 ${l.raw_hours}h）· 批次 ${esc(l.batch_ref || '无')}</div>
      <div class="grid-2">
        <label>甲方 QA 状态
          <select name="qa_status">
            <option value="PENDING_QA" ${l.qa_status==='PENDING_QA'?'selected':''}>待甲方审核</option>
            <option value="QA_CONFIRMED" ${l.qa_status==='QA_CONFIRMED'?'selected':''}>甲方已确认有效</option>
            <option value="QA_REJECTED" ${l.qa_status==='QA_REJECTED'?'selected':''}>整批驳回无效</option>
          </select>
        </label>
        <label>甲方确认有效小时<input type="number" step="0.1" name="qa_valid_hours" value="${l.qa_valid_hours}" /></label>
      </div>
      <label>背靠背账期推进
        <select name="settlement_stage">
          <option value="PENDING_QA" ${l.settlement_stage==='PENDING_QA'?'selected':''}>待甲方QA核定</option>
          <option value="PENDING_CLIENT_PAYMENT" ${l.settlement_stage==='PENDING_CLIENT_PAYMENT'?'selected':''}>待甲方回款</option>
          <option value="CLIENT_PAID_READY_TO_SETTLE" ${l.settlement_stage==='CLIENT_PAID_READY_TO_SETTLE'?'selected':''}>甲方已回款·待结代理</option>
          <option value="SETTLED_PAID" ${l.settlement_stage==='SETTLED_PAID'?'selected':''}>已打款（须填回单号）</option>
        </select>
      </label>
      <div class="grid-2">
        <label>场景方场地费(元)<input type="number" step="0.01" name="venue_fee_cny" value="${l.venue_fee_cny}" /></label>
        <label>公户转账回单号<input name="payout_receipt_ref" value="${esc(l.payout_receipt_ref)}" placeholder="标记已打款必填" /></label>
      </div>
      <label>QA 驳回或扣减原因说明<input name="qa_reject_reason" value="${esc(l.qa_reject_reason)}" /></label>
      <div class="row-end"><button type="submit" class="btn btn-primary">保存核销结果</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerLogForm').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(`/api/admin/logs/${id}`, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
        closeDrawer();
        toast('QA 与对账台账已保存');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  });
};

window.openClaimDrawer = (taskId) => {
  const t = state.agent.tasks.find((x) => x.id === taskId);
  if (!t) return;
  const sceneOptions = state.agent.scenes.map((s) =>
    `<option value="${s.id}">${esc(s.code)} · ${esc(s.city)} ${esc(s.category)}</option>`
  ).join('') || '<option value="">当前暂无可用平台脱敏场景</option>';

  openDrawer('申请承接任务包', `
    <form id="drawerClaimForm" class="stack-md">
      <div class="unlock-bar">
        <strong>${esc(t.title)}</strong><br/>
        自带场景净价 ¥${t.agent_rate_own_scene_cny}/有效h ｜ 使用平台场景净价 ¥${t.agent_rate_platform_scene_cny}/有效h
      </div>
      <label>选择承接场景模式 *
        <select name="mode" id="dClaimMode">
          <option value="OWN_SCENE">模式 A：自带当地自有场景（¥${t.agent_rate_own_scene_cny}/h）</option>
          <option value="PLATFORM_SCENE">模式 B：匹配同城平台场景（¥${t.agent_rate_platform_scene_cny}/h）</option>
        </select>
      </label>
      <label id="dOwnField">自有场地城市、类型与作业说明 *
        <textarea name="own_scene_desc" rows="2" placeholder="如：平顶山自有轻型装配工位，已有5名熟练人员"></textarea>
      </label>
      <label id="dPlatField" class="hidden">选择平台可用脱敏场景 *
        <select name="scene_id">${sceneOptions}</select>
      </label>
      <label class="ack-box">
        <input type="checkbox" name="agreement_signed" required />
        <span><strong>承诺底线：</strong>绝不跳单私联甲方或平台场景老板、绝不二次转包、严格先过 1–2 小时首件绿灯再放量（未过绿灯猛采及违规废片自担）、认可背靠背有效小时结算。</span>
      </label>
      <div class="row-end"><button type="submit" class="btn btn-primary">签署承诺并提交审批</button></div>
    </form>
  `, (body) => {
    const sel = body.querySelector('#dClaimMode');
    sel.onchange = () => {
      const isPlat = sel.value === 'PLATFORM_SCENE';
      body.querySelector('#dOwnField').classList.toggle('hidden', isPlat);
      body.querySelector('#dPlatField').classList.toggle('hidden', !isPlat);
    };
    body.querySelector('#drawerClaimForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      payload.task_pack_id = taskId;
      payload.agreement_signed = fd.get('agreement_signed') === 'on';
      try {
        await api('/api/agent/assignments', { method: 'POST', body: JSON.stringify(payload) });
        closeDrawer();
        toast('认领申请已提交，等待凌矩审批锁单');
        await refreshWorkspaceData();
        go('delivery', 'trial');
      } catch (err) { toast(err.message, true); }
    };
  });
};

window.openSopDrawer = (asgId) => {
  const a = state.agent.assignments.find((x) => x.id === asgId);
  if (!a) return;
  openDrawer(`已解锁内部 SOP · ${a.code}`, `
    <div class="stack-md">
      <div class="redline-bar"><strong>QA 红线：</strong>${esc(a.qa_red_lines)}</div>
      <pre class="sop-pre">${esc(a.sop_full_internal)}</pre>
    </div>
  `);
};

window.openSubmitLogDrawer = (asgId, logType) => {
  const a = state.agent.assignments.find((x) => x.id === asgId);
  if (!a) return;
  const isFp = logType === 'FIRST_PIECE';
  openDrawer(isFp ? `提交首件试采样本（上限 ${a.first_piece_max_hours}h）` : `提交今日批量日报 · ${a.code}`, `
    <form id="drawerSubmitLog" class="stack-md">
      <div class="grid-2">
        <label>采集日期 *<input type="date" name="log_date" value="${new Date().toISOString().slice(0,10)}" required /></label>
        <label>开工设备数 *<input type="number" min="1" name="devices_used" value="${isFp ? 1 : 3}" required /></label>
      </div>
      <div class="grid-2">
        <label>原始录制小时 *<input type="number" step="0.1" ${isFp ? `max="${a.first_piece_max_hours}"` : ''} name="raw_hours" value="${isFp ? 1.5 : ''}" required /></label>
        <label>已上传小时 *<input type="number" step="0.1" name="uploaded_hours" value="${isFp ? 1.5 : ''}" required /></label>
      </div>
      <label>上传批次号 / 外链备注<input name="batch_ref" placeholder="${isFp ? '如：FP-001' : '如：B-1126-01'}" /></label>
      <div class="row-end"><button type="submit" class="btn btn-primary">${isFp ? '提交首件申请绿灯' : '提交今日日报'}</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerSubmitLog').onsubmit = async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(e.target).entries());
      payload.assignment_id = asgId;
      payload.log_type = logType;
      try {
        await api('/api/agent/logs', { method: 'POST', body: JSON.stringify(payload) });
        closeDrawer();
        toast(isFp ? '首件样本已提交，等待点亮绿灯' : '今日批量日报已提交');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  });
};

// ================= BOOTSTRAP =================
(async function init() {
  try {
    const res = await api('/api/auth/me');
    state.user = res.user;
  } catch {
    state.user = null;
  }
  if (state.user) {
    showApp();
    await refreshWorkspaceData();
    renderWorkspace();
  } else {
    showPublic('scene');
  }
})();
