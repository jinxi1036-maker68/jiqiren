// ================= VECTOR SVG ICON SYSTEM (Zero Emojis) =================
const SVG = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
};

// ================= 100% 纯中文业务字典 =================
const LABELS = {
  entity_type: {
    enterprise_vat: '企业主体（可开票）',
    sole_proprietor: '个体工商户',
    personal_captain: '个人团长（代征扣税）',
  },
  deposit_status: {
    PAID: ['已缴设备押金', 'pill-green', 'dot-emerald'],
    CORPORATE_GUARANTEE: ['企业协议担保', 'pill-blue', 'dot-blue'],
    ACQUAINTANCE_WAIVED: ['熟人特批免押', 'pill-amber', 'dot-amber'],
    UNPAID: ['未缴押金', 'pill-red', 'dot-red'],
  },
  compliance_path: {
    WRITTEN_SUBCONTRACT_APPROVED: ['已获书面分包许可', 'pill-green', 'dot-emerald'],
    LINGJU_UNIFIED_TEAM_ACCOUNT: ['统一子账号托管', 'pill-blue', 'dot-blue'],
    DRAFT_INTERNAL_ONLY: ['内部草稿（未开放）', 'pill-gray', 'dot-slate'],
  },
  scene_tier: {
    PENDING_REVIEW: ['待初筛', 'pill-amber', 'dot-amber'],
    S2_RESERVE: ['S2 常规储备', 'pill-green', 'dot-emerald'],
    S1_BENCHMARK: ['S1 稀缺标杆（仅总控）', 'pill-blue', 'dot-blue'],
    REJECTED: ['已驳回', 'pill-red', 'dot-red'],
  },
  scene_public: {
    HIDDEN: '未向代理公开',
    AVAILABLE: '脱敏可认领',
    LOCKED: '已锁单执行中',
  },
  asg_status: {
    PENDING_APPROVAL: ['待凌矩审批', 'pill-amber', 'dot-amber'],
    FIRST_PIECE_TRIAL: ['首件试采期（1–2h）', 'pill-blue', 'dot-blue'],
    BATCH_GREEN_LIGHT: ['绿灯批量运行中', 'pill-green', 'dot-emerald'],
    REJECTED: ['审批未通过', 'pill-red', 'dot-red'],
    PAUSED: ['已暂停', 'pill-gray', 'dot-slate'],
    COMPLETED: ['已结项', 'pill-gray', 'dot-slate'],
  },
  fp_status: {
    NOT_SUBMITTED: '待提交首件样本',
    SUBMITTED: '首件已交·待点绿灯',
    APPROVED: '首件已过·绿灯放行',
    REJECTED: '首件打回·待整改',
  },
  qa_status: {
    PENDING_QA: ['待甲方审核', 'pill-amber', 'dot-amber'],
    QA_CONFIRMED: ['甲方已确认有效', 'pill-green', 'dot-emerald'],
    QA_REJECTED: ['整批驳回无效', 'pill-red', 'dot-red'],
  },
  settlement_stage: {
    PENDING_QA: ['待甲方 QA 核定', 'pill-gray', 'dot-slate'],
    PENDING_CLIENT_PAYMENT: ['待甲方回款', 'pill-amber', 'dot-amber'],
    CLIENT_PAID_READY_TO_SETTLE: ['甲方已回款·待结代理', 'pill-blue', 'dot-blue'],
    SETTLED_PAID: ['已打款（附回单）', 'pill-green', 'dot-emerald'],
  },
  log_type: {
    FIRST_PIECE: '首件样片',
    BATCH: '批量日报',
  },
};

function pillHtml(mapObj, key) {
  const item = mapObj[key];
  if (!item) return `<span class="status-pill pill-gray"><span class="dot dot-slate"></span>${esc(key)}</span>`;
  return `<span class="status-pill ${item[1]}"><span class="dot ${item[2]}"></span>${item[0]}</span>`;
}

// ================= STATE & HELPERS =================
const state = {
  user: null,
  publicView: 'scene',
  module: 'overview',
  subtab: '',
  searchQuery: '',
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
function openDrawer(title, html, onMount, subtitle = '') {
  $('#drawerTitle').textContent = title;
  $('#drawerSub').textContent = subtitle;
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
  $('#pubNavScene').classList.toggle('btn-primary', page === 'scene');
  $('#pubNavScene').classList.toggle('btn-nav-ghost', page !== 'scene');
  $('#pubNavLogin').classList.toggle('btn-primary', page === 'login');
  $('#pubNavLogin').classList.toggle('btn-nav-ghost', page !== 'login');
}

function showApp() {
  $('#publicShell').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  const u = state.user;
  $('#sidebarRoleLabel').textContent = u.role === 'admin' ? '凌矩总控后台' : '认证代理工作台';
  $('#sidebarUserName').textContent = u.display_name;
  $('#sidebarAvatar').textContent = (u.display_name || 'L').slice(0, 1);
  $('#sidebarUserMeta').textContent = u.role === 'admin'
    ? '最高风控管理权限'
    : `${LABELS.entity_type[u.entity_type] || u.entity_type}`;
  $('#postureText').textContent = u.role === 'admin'
    ? '防跳单脱敏 · 首件硬锁 · 背靠背账期'
    : `${LABELS.deposit_status[u.deposit_status]?.[0] || ''} · 税点 ${(Number(u.tax_deduction_rate || 0) * 100).toFixed(0)}%`;
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

$$('.role-switch-btn[data-fill]').forEach((btn) => {
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
    box.textContent = `场景备案已录入（备案号 ${res.code}）：${res.message}`;
    box.classList.remove('hidden');
    e.target.reset();
    toast('已成功提交免费备案');
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
    state.searchQuery = '';
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
      { id: 'overview', icon: SVG.dashboard, label: '经营总览', badge: 0, subtabs: [] },
      {
        id: 'resources', icon: SVG.layers, label: '资源中心', badge: s.scenes_pending || 0,
        subtabs: [
          { id: 'tasks', label: '上游任务分包', count: state.admin.tasks.length },
          { id: 'scenes', label: '全国场景双层池', count: state.admin.scenes.length },
        ],
      },
      {
        id: 'dispatch', icon: SVG.activity, label: '派单与首件', badge: pendingAsg,
        subtabs: [
          { id: 'pending', label: '待审批认领', count: s.assignments_pending || 0 },
          { id: 'first_piece', label: '首件绿灯审核', count: s.first_piece_pending || 0 },
          { id: 'active', label: '全部派单流水', count: state.admin.assignments.length },
        ],
      },
      {
        id: 'finance', icon: SVG.wallet, label: 'QA 与对账', badge: pendingFinance,
        subtabs: [
          { id: 'pending_qa', label: '待回填 QA', count: s.logs_pending_qa || 0 },
          { id: 'all_logs', label: '背靠背三方台账', count: state.admin.logs.length },
        ],
      },
      {
        id: 'agents', icon: SVG.users, label: '认证代理库', badge: 0,
        subtabs: [{ id: 'list', label: '准入代理档案', count: state.admin.agents.length }],
      },
    ];
  }

  const myTrial = state.agent.assignments.filter((a) => a.status === 'PENDING_APPROVAL' || a.status === 'FIRST_PIECE_TRIAL').length;
  const myBatch = state.agent.assignments.filter((a) => a.status === 'BATCH_GREEN_LIGHT').length;
  return [
    { id: 'overview', icon: SVG.dashboard, label: '工作台首页', badge: 0, subtabs: [] },
    {
      id: 'hall', icon: SVG.compass, label: '资源承接大厅', badge: 0,
      subtabs: [
        { id: 'tasks', label: '开放合规任务包', count: state.agent.tasks.length },
        { id: 'scenes', label: '全国脱敏场景池', count: state.agent.scenes.length },
      ],
    },
    {
      id: 'delivery', icon: SVG.clipboard, label: '我的交付执行', badge: myTrial,
      subtabs: [
        { id: 'trial', label: '待审与首件试采', count: myTrial },
        { id: 'batch', label: '绿灯批量运行中', count: myBatch },
      ],
    },
    {
      id: 'bills', icon: SVG.wallet, label: '我的背靠背账单', badge: 0,
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
  state.searchQuery = '';
  renderWorkspace();
}

function renderWorkspace() {
  const navConfig = getNavConfig();
  const current = navConfig.find((n) => n.id === state.module) || navConfig[0];
  state.module = current.id;

  let activeSubObj = null;
  if (current.subtabs.length > 0) {
    activeSubObj = current.subtabs.find((st) => st.id === state.subtab) || current.subtabs[0];
    state.subtab = activeSubObj.id;
  } else {
    state.subtab = '';
  }

  // Breadcrumb
  const roleLabel = state.user.role === 'admin' ? '凌矩总控台' : '代理工作台';
  $('#topbarBreadcrumb').innerHTML = `${roleLabel} / <strong>${esc(current.label)}</strong>${activeSubObj ? ` / ${esc(activeSubObj.label)}` : ''}`;

  // Sidebar items
  $('#sideNav').innerHTML = navConfig.map((n) => `
    <button class="nav-item ${n.id === state.module ? 'active' : ''}" data-mod="${n.id}">
      <span class="nav-left"><span class="nav-icon">${n.icon}</span><span>${n.label}</span></span>
      ${n.badge > 0 ? `<span class="nav-badge">${n.badge}</span>` : ''}
    </button>
  `).join('');
  $$('#sideNav .nav-item').forEach((btn) => {
    btn.onclick = () => go(btn.dataset.mod);
  });

  // Top utility quick actions
  $('#topbarActions').innerHTML = state.user.role === 'admin'
    ? `<button class="btn btn-sm btn-primary" onclick="window.openCreateTaskDrawer()">${SVG.plus}新建任务包</button>`
    : `<button class="btn btn-sm btn-secondary" onclick="window.navGo('hall','tasks')">领新任务 ${SVG.arrowRight}</button>`;

  // Secondary Subtabs Bar
  const subBar = $('#subtabsBar');
  if (current.subtabs.length > 0) {
    subBar.classList.remove('hidden');
    subBar.innerHTML = current.subtabs.map((st) => `
      <button class="subtab ${st.id === state.subtab ? 'active' : ''}" data-st="${st.id}">
        ${esc(st.label)} <span class="subtab-count">${st.count}</span>
      </button>
    `).join('');
    $$('#subtabsBar .subtab').forEach((btn) => {
      btn.onclick = () => { state.subtab = btn.dataset.st; state.searchQuery = ''; renderWorkspace(); };
    });
  } else {
    subBar.classList.add('hidden');
    subBar.innerHTML = '';
  }

  if (state.user.role === 'admin') renderAdminPage();
  else renderAgentPage();
}

// ================= ADMIN PAGES =================
function renderAdminPage() {
  const actions = $('#wsActions');
  actions.innerHTML = '';

  if (state.module === 'overview') {
    $('#wsTitle').textContent = '经营总览';
    $('#wsSub').textContent = '全链路交付进度、待拍板事项队列与三方实时毛利核算';
    actions.innerHTML = `
      <button class="btn btn-secondary" onclick="window.openCreateAgentDrawer()">${SVG.plus}核验发代理号</button>
      <button class="btn btn-primary" onclick="window.openCreateTaskDrawer()">${SVG.plus}新建上游任务</button>
    `;

    const s = state.admin.stats;
    const logs = state.admin.logs;
    const tasks = state.admin.tasks;
    const scenes = state.admin.scenes;
    const asgs = state.admin.assignments;

    // Build unified action queue
    const queue = [];
    scenes.filter((x) => x.tier === 'PENDING_REVIEW').forEach((x) => {
      queue.push({
        badge: '待初筛场景', pillClass: 'pill-amber', dotClass: 'dot-amber',
        title: `${x.province}${x.city} · ${x.category}（约 ${x.estimated_device_capacity} 机位）`,
        meta: `${x.code} · ${x.real_store_name} · ${x.daily_work_desc.slice(0, 36)}`,
        btnText: '初筛分级', action: `window.openSceneTriageDrawer(${x.id})`,
      });
    });
    asgs.filter((x) => x.status === 'PENDING_APPROVAL').forEach((x) => {
      queue.push({
        badge: '待审认领', pillClass: 'pill-amber', dotClass: 'dot-amber',
        title: `${x.agent_name} 申请承接 ${x.task_title}`,
        meta: `${x.code} · 代理净价 ¥${x.applied_agent_rate_cny}/h`,
        btnText: '审批锁单', action: `window.openApproveAsgDrawer(${x.id})`,
      });
    });
    asgs.filter((x) => x.status === 'FIRST_PIECE_TRIAL' && x.first_piece_status === 'SUBMITTED').forEach((x) => {
      queue.push({
        badge: '待点绿灯', pillClass: 'pill-blue', dotClass: 'dot-blue',
        title: `${x.agent_name} · 已交 1–2h 首件样本`,
        meta: `${x.code} · ${x.task_title}`,
        btnText: '审核绿灯', action: `window.openReviewFPDrawer(${x.id})`,
      });
    });
    logs.filter((x) => x.qa_status === 'PENDING_QA' || x.settlement_stage === 'CLIENT_PAID_READY_TO_SETTLE').forEach((x) => {
      queue.push({
        badge: x.qa_status === 'PENDING_QA' ? '待回填 QA' : '待打款结算',
        pillClass: x.qa_status === 'PENDING_QA' ? 'pill-amber' : 'pill-blue',
        dotClass: x.qa_status === 'PENDING_QA' ? 'dot-amber' : 'dot-blue',
        title: `#${x.id} ${x.agent_name}（上传 ${x.uploaded_hours}h）`,
        meta: `${x.log_date} · ${LABELS.log_type[x.log_type] || x.log_type} · 批次 ${x.batch_ref || '未填'}`,
        btnText: '处理核销', action: `window.openAdminLogDrawer(${x.id})`,
      });
    });

    // Financial rollup from confirmed logs
    const confirmed = logs.filter((l) => l.qa_status === 'QA_CONFIRMED');
    const sumValidH = confirmed.reduce((a, b) => a + Number(b.qa_valid_hours || 0), 0);
    const sumUpGross = confirmed.reduce((a, b) => a + Number(b.financials.upstream_gross_cny || 0), 0);
    const sumAgentNet = confirmed.reduce((a, b) => a + Number(b.financials.agent_net_payable_cny || 0), 0);
    const sumVenue = confirmed.reduce((a, b) => a + Number(b.financials.venue_fee_cny || 0), 0);
    const sumMargin = confirmed.reduce((a, b) => a + Number(b.financials.lingju_pre_overhead_margin_cny || 0), 0);

    $('#wsContent').innerHTML = `
      <div class="kpi-row-4">
        <div class="kpi-card" onclick="window.navGo('resources','scenes')">
          <div class="kpi-top">
            <span class="kpi-label">待初筛 IP 场景</span>
            <span class="kpi-icon-box amber">${SVG.layers}</span>
          </div>
          <div class="kpi-num ${s.scenes_pending ? 'amber' : ''}">${s.scenes_pending || 0}</div>
          <div class="kpi-foot"><span>S2 储备 ${s.scenes_s2 || 0}</span><span>S1 标杆 ${s.scenes_s1 || 0}</span></div>
        </div>

        <div class="kpi-card" onclick="window.navGo('dispatch','first_piece')">
          <div class="kpi-top">
            <span class="kpi-label">待审派单 / 首件绿灯</span>
            <span class="kpi-icon-box blue">${SVG.activity}</span>
          </div>
          <div class="kpi-num ${(s.assignments_pending + s.first_piece_pending) ? 'amber' : ''}">${(s.assignments_pending || 0) + (s.first_piece_pending || 0)}</div>
          <div class="kpi-foot"><span>待锁单 ${s.assignments_pending || 0}</span><span>待绿灯 ${s.first_piece_pending || 0}</span></div>
        </div>

        <div class="kpi-card" onclick="window.navGo('finance','pending_qa')">
          <div class="kpi-top">
            <span class="kpi-label">待回填 QA / 待结批次</span>
            <span class="kpi-icon-box amber">${SVG.wallet}</span>
          </div>
          <div class="kpi-num ${(s.logs_pending_qa + s.logs_ready_to_settle) ? 'amber' : ''}">${(s.logs_pending_qa || 0) + (s.logs_ready_to_settle || 0)}</div>
          <div class="kpi-foot"><span>待 QA ${s.logs_pending_qa || 0}</span><span>待付款 ${s.logs_ready_to_settle || 0}</span></div>
        </div>

        <div class="kpi-card" onclick="window.navGo('resources','tasks')">
          <div class="kpi-top">
            <span class="kpi-label">在线合规任务 / 活跃代理</span>
            <span class="kpi-icon-box emerald">${SVG.users}</span>
          </div>
          <div class="kpi-num emerald">${s.open_compliant_tasks || 0} / ${s.active_agents || 0}</div>
          <div class="kpi-foot"><span>绿灯运行中 ${s.green_light_active || 0} 单</span><span>已核销 ${sumValidH.toFixed(1)}h</span></div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">S2B 协同交付全链路节点</div>
          <span class="small muted">点击任一环节进入对应管理台</span>
        </div>
        <div class="panel-body">
          <div class="pipeline-strip">
            <div class="pipe-node" onclick="window.navGo('resources','tasks')">
              <div class="pipe-step">STAGE 01</div>
              <div class="pipe-name">上游合规任务</div>
              <div class="pipe-val">${s.open_compliant_tasks || 0} / ${tasks.length}</div>
              <div class="pipe-desc">已开放合规包 / 含草稿</div>
            </div>
            <div class="pipe-node" onclick="window.navGo('resources','scenes')">
              <div class="pipe-step">STAGE 02</div>
              <div class="pipe-name">场景双层储备</div>
              <div class="pipe-val">${(s.scenes_s2 || 0) + (s.scenes_s1 || 0)}</div>
              <div class="pipe-desc">S2 可派发 ${s.scenes_s2 || 0} · 待筛 ${s.scenes_pending || 0}</div>
            </div>
            <div class="pipe-node" onclick="window.navGo('dispatch','first_piece')">
              <div class="pipe-step">STAGE 03</div>
              <div class="pipe-name">首件 1–2h 审核</div>
              <div class="pipe-val">${s.first_piece_pending || 0}</div>
              <div class="pipe-desc">等待点亮批量绿灯</div>
            </div>
            <div class="pipe-node" onclick="window.navGo('dispatch','active')">
              <div class="pipe-step">STAGE 04</div>
              <div class="pipe-name">绿灯批量运行</div>
              <div class="pipe-val">${s.green_light_active || 0}</div>
              <div class="pipe-desc">已过首件放量采集中</div>
            </div>
            <div class="pipe-node" onclick="window.navGo('finance','all_logs')">
              <div class="pipe-step">STAGE 05</div>
              <div class="pipe-name">背靠背已核销</div>
              <div class="pipe-val">${confirmed.length}</div>
              <div class="pipe-desc">累计有效 ${sumValidH.toFixed(1)} 小时</div>
            </div>
          </div>
        </div>
      </div>

      <div class="overview-split">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">待您拍板事项队列 (${queue.length})</div>
            <button class="btn btn-sm btn-ghost" onclick="window.navGo('finance','all_logs')">查看全部台账</button>
          </div>
          ${queue.length ? `
            <div class="queue-list">
              ${queue.slice(0, 6).map((q) => `
                <div class="queue-row">
                  <div style="min-width:0;">
                    <div class="row-gap" style="margin-bottom:3px;">
                      <span class="status-pill ${q.pillClass}"><span class="dot ${q.dotClass}"></span>${q.badge}</span>
                      <span class="queue-title">${esc(q.title)}</span>
                    </div>
                    <div class="queue-meta">${esc(q.meta)}</div>
                  </div>
                  <button class="btn btn-sm btn-secondary" onclick="${q.action}">${q.btnText}</button>
                </div>
              `).join('')}
            </div>
          ` : '<div class="panel-body muted small">当前所有待初筛场景、首件审核与 QA 结算已全部清零。</div>'}
        </div>

        <div class="stack-md">
          <div class="panel">
            <div class="panel-header">
              <div class="panel-title">已确认批次三方分账核算</div>
              <span class="small muted">税前毛利口径</span>
            </div>
            <div class="panel-body">
              <div class="kv-list">
                <div class="kv-row"><span class="kv-label">上游有效含税营收</span><span class="kv-val">¥${sumUpGross.toFixed(2)}</span></div>
                <div class="kv-row"><span class="kv-label">认证代理净应付总额</span><span class="kv-val">¥${sumAgentNet.toFixed(2)}</span></div>
                <div class="kv-row"><span class="kv-label">第三方场景合作费</span><span class="kv-val">¥${sumVenue.toFixed(2)}</span></div>
                <div class="kv-row"><span class="kv-label">凌矩留存（扣税与费用后）</span><span class="kv-val emerald">¥${sumMargin.toFixed(2)}</span></div>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-header">
              <div class="panel-title">平台风控硬锁状态</div>
              <span class="small muted">系统级强约束</span>
            </div>
            <div class="panel-body stack-sm">
              <div class="guard-item">
                <span>未锁单前屏蔽甲方底价与真实门店</span>
                <span class="status-pill pill-green"><span class="dot dot-emerald"></span>已开启</span>
              </div>
              <div class="guard-item">
                <span>1–2h 首件未过审拦截批量日报</span>
                <span class="status-pill pill-green"><span class="dot dot-emerald"></span>HTTP 403 硬锁</span>
              </div>
              <div class="guard-item">
                <span>结算标记已打款强校验公户回单号</span>
                <span class="status-pill pill-green"><span class="dot dot-emerald"></span>已强制</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (state.module === 'resources' && state.subtab === 'tasks') {
    $('#wsTitle').textContent = '上游任务分包库';
    $('#wsSub').textContent = '仅向代理开放已确认合规路径的任务；内部甲方名称与底价对代理端绝对隔离';
    actions.innerHTML = `<button class="btn btn-primary" onclick="window.openCreateTaskDrawer()">${SVG.plus}新建任务包</button>`;
    const tasks = state.admin.tasks;
    $('#wsContent').innerHTML = tasks.length ? `
      <div class="table-card">
        <table>
          <thead>
            <tr>
              <th>任务编号与标题</th>
              <th>内部甲方与底价（保密）</th>
              <th>代理净价（自带 / 用平台）</th>
              <th>合规路径锁</th>
              <th style="text-align:right;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map((t) => `<tr>
              <td>
                <div style="font-weight:700;">${esc(t.title)}</div>
                <div class="small muted"><span class="mono">${esc(t.code)}</span> · ${esc(t.modality)} · ${esc(t.scene_category)}</div>
              </td>
              <td>
                <div style="font-weight:600;">${esc(t.upstream_name_internal)}</div>
                <div class="small muted num">甲方底价 ¥${t.upstream_base_rate_cny}/h</div>
              </td>
              <td class="num"><strong>¥${t.agent_rate_own_scene_cny}</strong> / <strong>¥${t.agent_rate_platform_scene_cny}</strong> <span class="small muted">/h</span></td>
              <td>${pillHtml(LABELS.compliance_path, t.compliance_path)}</td>
              <td style="text-align:right;">
                <button class="btn btn-sm btn-secondary" onclick="window.openTaskComplianceDrawer(${t.id})">调整合规锁</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="empty-box">暂无上游任务包，点击右上角「新建任务包」录入</div>';
    return;
  }

  if (state.module === 'resources' && state.subtab === 'scenes') {
    $('#wsTitle').textContent = '全国场景双层资源池';
    $('#wsSub').textContent = 'S2 常规储备脱敏上架供代理认领；S1 稀缺标杆仅总控可见，用于反向撬动大甲方';
    const scenes = state.admin.scenes;
    $('#wsContent').innerHTML = scenes.length ? `
      <div class="stack-md">
        ${scenes.map((s) => `
          <div class="entity-card">
            <div class="row-between">
              <div class="row-gap">
                <span class="mono muted">${esc(s.code)}</span>
                <span class="entity-title">${esc(s.province)} ${esc(s.city)} ${esc(s.district)} · ${esc(s.category)}</span>
                ${pillHtml(LABELS.scene_tier, s.tier)}
                <span class="status-pill pill-gray"><span class="dot dot-slate"></span>${LABELS.scene_public[s.public_status] || s.public_status}</span>
              </div>
              <button class="btn btn-sm btn-primary" onclick="window.openSceneTriageDrawer(${s.id})">初筛与分层管理</button>
            </div>
            <div style="color:var(--text-secondary);font-size:13.5px;">${esc(s.daily_work_desc)}</div>
            <div class="meta-strip">
              <span>机位容量：<strong class="num">${s.estimated_device_capacity}</strong> 台</span>
              <span>开放时段：${esc(s.open_hours_desc || '待确认')}</span>
              <span>保密实景：${esc(s.real_store_name)}（${esc(s.real_contact_name)} ${esc(s.real_contact_phone)}）</span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '<div class="empty-box">暂无场景线索，可通过公开备案页接收实体老板登记</div>';
    return;
  }

  if (state.module === 'dispatch') {
    $('#wsTitle').textContent = '派单审批与首件绿灯';
    $('#wsSub').textContent = '设备押金可分级审批，但 1–2 小时首件试采绿灯人人必过、系统级拦截未过审批量上报';
    let list = state.admin.assignments;
    if (state.subtab === 'pending') list = list.filter((a) => a.status === 'PENDING_APPROVAL');
    if (state.subtab === 'first_piece') list = list.filter((a) => a.status === 'FIRST_PIECE_TRIAL' && a.first_piece_status === 'SUBMITTED');

    $('#wsContent').innerHTML = list.length ? `
      <div class="stack-md">
        ${list.map((a) => `
          <div class="entity-card">
            <div class="row-between">
              <div class="row-gap">
                <span class="mono muted">${esc(a.code)}</span>
                <span class="entity-title">${esc(a.agent_name)}</span>
                ${pillHtml(LABELS.asg_status, a.status)}
                <span class="status-pill pill-gray"><span class="dot dot-slate"></span>${LABELS.fp_status[a.first_piece_status] || a.first_piece_status}</span>
              </div>
              <div class="row-gap">
                ${a.status === 'PENDING_APPROVAL' ? `<button class="btn btn-sm btn-primary" onclick="window.openApproveAsgDrawer(${a.id})">审批锁单</button>` : ''}
                ${a.status === 'FIRST_PIECE_TRIAL' && a.first_piece_status === 'SUBMITTED' ? `<button class="btn btn-sm btn-primary" onclick="window.openReviewFPDrawer(${a.id})">审核首件点绿灯</button>` : ''}
              </div>
            </div>
            <div class="meta-strip">
              <span>任务：<strong>${esc(a.task_title)}</strong></span>
              <span class="num">代理净价：<strong>¥${a.applied_agent_rate_cny}/h</strong>（内部底价 ¥${a.upstream_base_rate_cny}/h）</span>
              <span>押金：${LABELS.deposit_status[a.deposit_status]?.[0] || a.deposit_status}</span>
            </div>
            <div class="small muted">执行场地：${a.mode === 'PLATFORM_SCENE' ? `平台场景 ${esc(a.scene_code)}（${esc(a.real_store_name)}）` : `代理自有场地（${esc(a.own_scene_desc)}）`}</div>
          </div>
        `).join('')}
      </div>
    ` : '<div class="empty-box">当前分类下暂无待处理派单</div>';
    return;
  }

  if (state.module === 'finance') {
    $('#wsTitle').textContent = 'QA 回传与背靠背三方对账';
    $('#wsSub').textContent = '按甲方确认有效小时核算；标记已打款强制填写公户转账回单号，绝不替甲方垫资';
    let list = state.admin.logs;
    if (state.subtab === 'pending_qa') list = list.filter((l) => l.qa_status === 'PENDING_QA');

    $('#wsContent').innerHTML = list.length ? `
      <div class="table-card">
        <table>
          <thead>
            <tr>
              <th>批次 / 代理团队</th>
              <th>上传 / 确认有效</th>
              <th>QA 与账期进度</th>
              <th>三方金额拆解</th>
              <th style="text-align:right;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((l) => `<tr>
              <td>
                <div style="font-weight:700;">#${l.id} · ${esc(l.agent_name)}</div>
                <div class="small muted"><span class="mono">${esc(l.assignment_code)}</span> · ${esc(l.log_date)} · ${LABELS.log_type[l.log_type] || l.log_type}</div>
              </td>
              <td class="num">上传 ${l.uploaded_hours}h<br/><strong>有效 ${l.qa_valid_hours}h</strong></td>
              <td>
                ${pillHtml(LABELS.qa_status, l.qa_status)}
                <div style="margin-top:6px;">${pillHtml(LABELS.settlement_stage, l.settlement_stage)}</div>
                ${l.payout_receipt_ref ? `<div class="small muted mono" style="margin-top:4px;">回单：${esc(l.payout_receipt_ref)}</div>` : ''}
              </td>
              <td class="small num">
                代理净付：<strong>¥${l.financials.agent_net_payable_cny}</strong> <span class="muted">(代扣税 ¥${l.financials.agent_tax_deduction_cny})</span><br/>
                场景费：¥${l.financials.venue_fee_cny} ｜ <strong style="color:var(--primary);">凌矩留存：¥${l.financials.lingju_pre_overhead_margin_cny}</strong>
              </td>
              <td style="text-align:right;">
                <button class="btn btn-sm btn-secondary" onclick="window.openAdminLogDrawer(${l.id})">核销 / 结算</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="empty-box">暂无采集批次对账记录</div>';
    return;
  }

  if (state.module === 'agents') {
    $('#wsTitle').textContent = '认证代理发号库';
    $('#wsSub').textContent = '仅准入经视频或实地验真的小团队、企业与地方团长，严禁 C 类二道贩子';
    actions.innerHTML = `<button class="btn btn-primary" onclick="window.openCreateAgentDrawer()">${SVG.plus}核验发代理号</button>`;
    const agents = state.admin.agents;
    $('#wsContent').innerHTML = agents.length ? `
      <div class="table-card">
        <table>
          <thead>
            <tr>
              <th>代理团队 / 登录账号</th>
              <th>城市与人数</th>
              <th>开票主体与代征扣点</th>
              <th>押金 / 担保凭证</th>
              <th>账号状态</th>
              <th style="text-align:right;">管理</th>
            </tr>
          </thead>
          <tbody>
            ${agents.map((a) => `<tr>
              <td>
                <div style="font-weight:700;">${esc(a.display_name)}</div>
                <div class="small muted mono">${esc(a.username)}</div>
              </td>
              <td>${esc(a.city || '未填')} · 验真 <strong class="num">${a.verified_headcount}</strong> 人</td>
              <td>
                <div>${LABELS.entity_type[a.entity_type] || a.entity_type}</div>
                <div class="small muted num">扣点 ${(a.tax_deduction_rate * 100).toFixed(1)}%</div>
              </td>
              <td>${pillHtml(LABELS.deposit_status, a.deposit_status)} <span class="small muted num">¥${a.deposit_amount_cny}</span></td>
              <td>
                ${a.status === 'ACTIVE'
                  ? '<span class="status-pill pill-green"><span class="dot dot-emerald"></span>正常启用</span>'
                  : '<span class="status-pill pill-gray"><span class="dot dot-slate"></span>已暂停</span>'}
              </td>
              <td style="text-align:right;">
                <button class="btn btn-sm ${a.status === 'ACTIVE' ? 'btn-ghost' : 'btn-primary'}"
                  onclick="window.adminToggleAgent(${a.id}, '${a.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'}')">
                  ${a.status === 'ACTIVE' ? '暂停接单' : '恢复启用'}
                </button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="empty-box">暂无认证代理，点击右上角「核验发代理号」录入</div>';
  }
}

// ================= AGENT PAGES =================
function renderAgentPage() {
  $('#wsActions').innerHTML = '';
  const u = state.user;

  if (state.module === 'overview') {
    $('#wsTitle').textContent = `欢迎回来，${u.display_name}`;
    $('#wsSub').textContent = '先领合规任务，完成 1–2 小时首件试采绿灯即可正式放量采集';
    $('#wsActions').innerHTML = `<button class="btn btn-primary" onclick="window.navGo('hall','tasks')">前往资源大厅领单 ${SVG.arrowRight}</button>`;

    const asgs = state.agent.assignments;
    const logs = state.agent.logs;
    const activeBatch = asgs.filter((a) => a.status === 'BATCH_GREEN_LIGHT').length;
    const waitingTrial = asgs.filter((a) => a.status === 'FIRST_PIECE_TRIAL' || a.status === 'PENDING_APPROVAL').length;
    const confirmedPay = logs
      .filter((l) => l.qa_status === 'QA_CONFIRMED')
      .reduce((sum, l) => sum + Number(l.agent_net_payable_cny || 0), 0);

    $('#wsContent').innerHTML = `
      <div class="kpi-row-3">
        <div class="kpi-card" onclick="window.navGo('hall','tasks')">
          <div class="kpi-top">
            <span class="kpi-label">开放可承接任务包</span>
            <span class="kpi-icon-box emerald">${SVG.compass}</span>
          </div>
          <div class="kpi-num emerald">${state.agent.tasks.length}</div>
          <div class="kpi-foot"><span>可用脱敏场景 ${state.agent.scenes.length} 个</span><span>点击选单</span></div>
        </div>

        <div class="kpi-card" onclick="window.navGo('delivery','trial')">
          <div class="kpi-top">
            <span class="kpi-label">待审与首件试采派单</span>
            <span class="kpi-icon-box blue">${SVG.clipboard}</span>
          </div>
          <div class="kpi-num ${waitingTrial ? 'amber' : ''}">${waitingTrial}</div>
          <div class="kpi-foot"><span>绿灯运行中 ${activeBatch} 单</span><span>查看进度</span></div>
        </div>

        <div class="kpi-card" onclick="window.navGo('bills','all')">
          <div class="kpi-top">
            <span class="kpi-label">已核定有效净收益</span>
            <span class="kpi-icon-box emerald">${SVG.wallet}</span>
          </div>
          <div class="kpi-num emerald">¥${confirmedPay.toFixed(2)}</div>
          <div class="kpi-foot"><span>总计上报 ${logs.length} 批次</span><span>查看账单</span></div>
        </div>
      </div>

      <div class="overview-split">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">当前交付执行进度</div>
            <button class="btn btn-sm btn-ghost" onclick="window.navGo('delivery','batch')">进入交付台</button>
          </div>
          ${asgs.length ? `
            <div class="queue-list">
              ${asgs.map((a) => `
                <div class="queue-row">
                  <div style="min-width:0;">
                    <div class="row-gap" style="margin-bottom:4px;">
                      <span class="queue-title">${esc(a.task_title)}</span>
                      ${pillHtml(LABELS.asg_status, a.status)}
                    </div>
                    <div class="mini-steps">
                      <span class="m-step done">1. 审批锁单</span>
                      <span class="m-step ${a.first_piece_status === 'APPROVED' ? 'done' : 'active'}">2. 首件试采 (1–2h)</span>
                      <span class="m-step ${a.status === 'BATCH_GREEN_LIGHT' ? 'done' : ''}">3. 绿灯批量放量</span>
                    </div>
                  </div>
                  ${a.status === 'FIRST_PIECE_TRIAL'
                    ? `<button class="btn btn-sm btn-primary" onclick="window.openSubmitLogDrawer(${a.id}, 'FIRST_PIECE')">提交首件</button>`
                    : (a.status === 'BATCH_GREEN_LIGHT'
                      ? `<button class="btn btn-sm btn-primary" onclick="window.openSubmitLogDrawer(${a.id}, 'BATCH')">提交日报</button>`
                      : `<span class="small muted">待总控审核</span>`)}
                </div>
              `).join('')}
            </div>
          ` : '<div class="panel-body muted small">暂无进行中派单，点击右上角前往资源大厅认领任务包。</div>'}
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">准入档案与结算条款</div>
            ${pillHtml(LABELS.deposit_status, u.deposit_status)}
          </div>
          <div class="panel-body">
            <div class="kv-list">
              <div class="kv-row"><span class="kv-label">所在服务城市</span><span class="kv-val">${esc(u.city || '未填')}</span></div>
              <div class="kv-row"><span class="kv-label">主体开票性质</span><span class="kv-val">${LABELS.entity_type[u.entity_type] || u.entity_type}</span></div>
              <div class="kv-row"><span class="kv-label">适用代征税点</span><span class="kv-val">${(Number(u.tax_deduction_rate || 0) * 100).toFixed(1)}%</span></div>
              <div class="kv-row"><span class="kv-label">首件放量硬锁</span><span class="kv-val emerald">未过绿灯禁止报批量</span></div>
            </div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (state.module === 'hall' && state.subtab === 'tasks') {
    $('#wsTitle').textContent = '开放合规任务包';
    $('#wsSub').textContent = '均已核验合规路径；以下展示您的净到手单价，按甲方确认有效小时背靠背结算';
    const tasks = state.agent.tasks;
    $('#wsContent').innerHTML = tasks.length ? `
      <div class="stack-md">
        ${tasks.map((t) => `
          <div class="task-market-card">
            <div class="row-between" style="align-items:flex-start;">
              <div class="stack-sm">
                <div class="row-gap">
                  <span class="status-pill pill-blue"><span class="dot dot-blue"></span>${esc(t.modality)}</span>
                  <span class="status-pill pill-gray"><span class="dot dot-slate"></span>${esc(t.scene_category)}</span>
                  <span class="small muted">${esc(t.city_scope)}</span>
                </div>
                <div class="task-title">${esc(t.title)}</div>
                <div class="small muted">${esc(t.sop_summary)}</div>
              </div>
              <div class="price-box">
                <div class="price-main">¥${t.agent_rate_own_scene_cny} <span style="font-size:12.5px;font-weight:500;">/有效h</span></div>
                <div class="price-sub">自带场景净价 ｜ 用平台场景 ¥${t.agent_rate_platform_scene_cny}/h</div>
              </div>
            </div>

            <div class="spec-grid">
              <div class="spec-cell"><div class="spec-k">采集模态</div><div class="spec-v">${esc(t.modality)}</div></div>
              <div class="spec-cell"><div class="spec-k">首件试采上限</div><div class="spec-v num">${t.first_piece_min_hours}–${t.first_piece_max_hours} 小时</div></div>
              <div class="spec-cell"><div class="spec-k">结算账期</div><div class="spec-v">甲方回款后 ${t.settlement_days_after_client_pay} 个工作日</div></div>
              <div class="spec-cell"><div class="spec-k">任务编号</div><div class="spec-v mono">${esc(t.code)}</div></div>
            </div>

            <div class="redline-strip">
              ${SVG.alert}
              <div><strong>QA 合规红线：</strong>${esc(t.qa_red_lines)}</div>
            </div>

            <div class="row-between">
              <span class="small muted row-gap" style="gap:6px;">${SVG.lock} <span>审批锁单后自动解锁完整内部 V3 执行 SOP</span></span>
              <button class="btn btn-primary" onclick="window.openClaimDrawer(${t.id})">申请承接此任务</button>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '<div class="empty-box">当前暂无开放合规任务包</div>';
    return;
  }

  if (state.module === 'hall' && state.subtab === 'scenes') {
    $('#wsTitle').textContent = '全国脱敏场景池';
    $('#wsSub').textContent = '锁单审批通过后，系统自动向该派单解锁对应门店名称、详细地址与负责人联系方式';
    const q = state.searchQuery.trim();
    const list = q ? state.agent.scenes.filter((s) => `${s.province}${s.city}${s.district}${s.category}${s.daily_work_desc}`.includes(q)) : state.agent.scenes;

    $('#wsContent').innerHTML = `
      <div class="filter-toolbar">
        <div class="search-box">
          ${SVG.search}
          <input id="citySearchInput" value="${esc(state.searchQuery)}" placeholder="按城市、区县或行业筛选（如：平顶山）" />
        </div>
        <span class="small muted">共 ${list.length} 个可用脱敏场景</span>
      </div>
      ${list.length ? `
        <div class="grid-2">
          ${list.map((s) => `
            <div class="entity-card">
              <div class="row-between">
                <span class="entity-title">${esc(s.province)} ${esc(s.city)} ${esc(s.district)}</span>
                <span class="status-pill pill-green"><span class="dot dot-emerald"></span>${esc(s.category)} · ${s.estimated_device_capacity} 机位</span>
              </div>
              <div style="font-size:13.5px;color:var(--text-secondary);">${esc(s.daily_work_desc)}</div>
              <div class="small muted">可配合时段：${esc(s.open_hours_desc || '锁单后确认')}</div>
              <div class="lock-bar">${SVG.lock} 店名与联系方式已脱敏，请在「开放合规任务包」中组合认领解锁</div>
            </div>
          `).join('')}
        </div>
      ` : '<div class="empty-box">暂无匹配的脱敏场景</div>'}
    `;
    const inp = $('#citySearchInput');
    if (inp) {
      inp.oninput = () => {
        state.searchQuery = inp.value;
        renderAgentPage();
        const el = $('#citySearchInput');
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      };
    }
    return;
  }

  if (state.module === 'delivery') {
    $('#wsTitle').textContent = '我的交付执行';
    $('#wsSub').textContent = '新单必须先通过 1–2 小时首件试采点亮绿灯，才解锁批量日报提交权限';
    let list = state.agent.assignments;
    if (state.subtab === 'trial') list = list.filter((a) => a.status === 'PENDING_APPROVAL' || a.status === 'FIRST_PIECE_TRIAL');
    if (state.subtab === 'batch') list = list.filter((a) => a.status === 'BATCH_GREEN_LIGHT');

    $('#wsContent').innerHTML = list.length ? `
      <div class="stack-md">
        ${list.map((a) => `
          <div class="entity-card">
            <div class="row-between">
              <div class="row-gap">
                <span class="mono muted">${esc(a.code)}</span>
                <span class="entity-title">${esc(a.task_title)}</span>
                ${pillHtml(LABELS.asg_status, a.status)}
                <span class="status-pill pill-gray"><span class="dot dot-slate"></span>${LABELS.fp_status[a.first_piece_status] || a.first_piece_status}</span>
              </div>
              <strong class="num" style="color:var(--primary);font-size:17px;">¥${a.applied_agent_rate_cny}/有效h</strong>
            </div>

            ${a.scene_info ? (a.scene_info.unlocked
              ? `<div class="unlock-bar">${SVG.unlock} <div><strong>已解锁进场对接：</strong>${esc(a.scene_info.real_store_name)} ｜ ${esc(a.scene_info.real_contact_name)} ${esc(a.scene_info.real_contact_phone)} ｜ ${esc(a.scene_info.real_address)}</div></div>`
              : `<div class="lock-bar">${SVG.lock} 匹配场景 ${esc(a.scene_info.code)}（待凌矩审批锁单后解锁真联系）</div>`
            ) : `<div class="small muted">自有场景：${esc(a.own_scene_desc)}</div>`}

            <div class="row-between">
              <span class="small muted">${a.first_piece_review_note ? `首件审校反馈：${esc(a.first_piece_review_note)}` : '请严格遵守 QA 红线及循环复用物料要求'}</span>
              <div class="row-gap">
                ${a.sop_full_internal ? `<button class="btn btn-sm btn-secondary" onclick="window.openSopDrawer(${a.id})">查看完整 SOP</button>` : ''}
                ${a.status === 'FIRST_PIECE_TRIAL' ? `<button class="btn btn-sm btn-primary" onclick="window.openSubmitLogDrawer(${a.id}, 'FIRST_PIECE')">提交首件样本 (1–2h)</button>` : ''}
                ${a.status === 'BATCH_GREEN_LIGHT' ? `<button class="btn btn-sm btn-primary" onclick="window.openSubmitLogDrawer(${a.id}, 'BATCH')">${SVG.plus}提交今日批量日报</button>` : ''}
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
    $('#wsSub').textContent = '清晰展示甲方 QA 有效小时、代征扣税与已打款银行回单号';
    let list = state.agent.logs;
    if (state.subtab === 'unpaid') list = list.filter((l) => l.settlement_stage !== 'SETTLED_PAID');

    $('#wsContent').innerHTML = list.length ? `
      <div class="table-card">
        <table>
          <thead>
            <tr>
              <th>上报日期 / 类型</th>
              <th>派单与任务名称</th>
              <th>上传 / 确认有效</th>
              <th>QA 与回款进度</th>
              <th style="text-align:right;">净到手金额</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((l) => `<tr>
              <td>
                <strong>${esc(l.log_date)}</strong>
                <div class="small muted">${LABELS.log_type[l.log_type] || l.log_type}</div>
              </td>
              <td>
                <div style="font-weight:600;">${esc(l.task_title)}</div>
                <div class="small muted mono">${esc(l.assignment_code)}</div>
              </td>
              <td class="num">上传 ${l.uploaded_hours}h<br/><strong>有效 ${l.qa_valid_hours}h</strong></td>
              <td>
                ${pillHtml(LABELS.qa_status, l.qa_status)}
                <div style="margin-top:6px;">${pillHtml(LABELS.settlement_stage, l.settlement_stage)}</div>
                ${l.payout_receipt_ref ? `<div class="small muted mono" style="margin-top:4px;">回单：${esc(l.payout_receipt_ref)}</div>` : ''}
                ${l.qa_reject_reason ? `<div class="small" style="color:var(--danger);margin-top:4px;">${esc(l.qa_reject_reason)}</div>` : ''}
              </td>
              <td style="text-align:right;" class="num">
                <strong style="font-size:16px;color:var(--primary);">¥${l.agent_net_payable_cny}</strong>
                <div class="small muted">毛 ¥${l.agent_gross_cny} - 税 ¥${l.agent_tax_deduction_cny}</div>
              </td>
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
      <label>任务标题 <span class="req">*</span><input name="title" required placeholder="如：文具店补货理货第一视角采集" /></label>
      <div class="grid-2">
        <label>内部甲方名（保密） <span class="req">*</span><input name="upstream_name_internal" required /></label>
        <label>甲方含税底价(元/h) <span class="req">*</span><input type="number" step="0.01" name="upstream_base_rate_cny" required /></label>
      </div>
      <div class="grid-2">
        <label>设备模态 <span class="req">*</span>
          <select name="modality">
            <option value="EGO第一视角">EGO第一视角</option>
            <option value="双目/夹爪">双目/夹爪</option>
            <option value="夹爪">夹爪</option>
            <option value="双目">双目</option>
          </select>
        </label>
        <label>适配场景类别 <span class="req">*</span><input name="scene_category" required placeholder="如：零售购物空间" /></label>
      </div>
      <div class="grid-2">
        <label>代理净价-自带场景(元/h) <span class="req">*</span><input type="number" step="0.01" name="agent_rate_own_scene_cny" required /></label>
        <label>代理净价-平台场景(元/h) <span class="req">*</span><input type="number" step="0.01" name="agent_rate_platform_scene_cny" required /></label>
      </div>
      <label>合规路径锁 <span class="req">*</span>
        <select name="compliance_path">
          <option value="DRAFT_INTERNAL_ONLY">仅内部草稿（不对代理展示）</option>
          <option value="WRITTEN_SUBCONTRACT_APPROVED">已获甲方书面分包许可</option>
          <option value="LINGJU_UNIFIED_TEAM_ACCOUNT">纳入凌矩统一子账号项目管理</option>
        </select>
      </label>
      <div class="grid-2">
        <label>地域覆盖范围<input name="city_scope" value="全国适用" /></label>
        <label>甲方回款后结算(工作日)<input type="number" name="settlement_days_after_client_pay" value="5" /></label>
      </div>
      <label>场地费及税耗预留备注<input name="scene_owner_fee_note" placeholder="如：预留 2–3 元/h 用于场地费及税耗" /></label>
      <label>QA 合规红线（代理可见） <span class="req">*</span><input name="qa_red_lines" required placeholder="手出画超 3 秒作废；严禁空桌摆拍" /></label>
      <label>锁单后解锁的完整内部 SOP<textarea name="sop_full_internal" rows="4"></textarea></label>
      <div class="row-end"><button type="submit" class="btn btn-primary">确认创建</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerTaskForm').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/api/admin/tasks', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
        closeDrawer();
        toast('上游任务包已创建');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  }, '内部底价与甲方名仅管理员可见');
};

window.openTaskComplianceDrawer = (id) => {
  const t = state.admin.tasks.find((x) => x.id === id);
  if (!t) return;
  openDrawer(`调整合规路径 · ${t.code}`, `
    <form id="drawerPatchTask" class="stack-md">
      <div class="small muted">${esc(t.title)}</div>
      <label>合规路径锁
        <select name="compliance_path">
          <option value="DRAFT_INTERNAL_ONLY" ${t.compliance_path==='DRAFT_INTERNAL_ONLY'?'selected':''}>内部草稿（不对代理展示）</option>
          <option value="WRITTEN_SUBCONTRACT_APPROVED" ${t.compliance_path==='WRITTEN_SUBCONTRACT_APPROVED'?'selected':''}>已获甲方书面分包许可（开放）</option>
          <option value="LINGJU_UNIFIED_TEAM_ACCOUNT" ${t.compliance_path==='LINGJU_UNIFIED_TEAM_ACCOUNT'?'selected':''}>凌矩统一子账号托管（开放）</option>
        </select>
      </label>
      <div class="row-end"><button type="submit" class="btn btn-primary">保存状态变更</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerPatchTask').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(`/api/admin/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
        closeDrawer();
        toast('任务合规状态已更新');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  }, '控制任务是否对代理大厅可见');
};

window.openSceneTriageDrawer = (id) => {
  const s = state.admin.scenes.find((x) => x.id === id);
  if (!s) return;
  openDrawer(`场景分级与脱敏控制 · ${s.code}`, `
    <form id="drawerSceneForm" class="stack-md">
      <div class="unlock-bar">
        <div>
          <strong>保密实景联系人（不对外展示）：</strong><br/>
          ${esc(s.real_store_name)} ｜ ${esc(s.real_contact_name)} ${esc(s.real_contact_phone)}<br/>
          地址：${esc(s.real_address)}
        </div>
      </div>
      <label>场景分层判定 <span class="req">*</span>
        <select name="tier">
          <option value="S2_RESERVE" ${s.tier==='S2_RESERVE'?'selected':''}>S2 常规储备池（脱敏上架给代理）</option>
          <option value="S1_BENCHMARK" ${s.tier==='S1_BENCHMARK'?'selected':''}>S1 稀缺标杆池（仅总控可见，拓大甲方）</option>
          <option value="PENDING_REVIEW" ${s.tier==='PENDING_REVIEW'?'selected':''}>待初筛（暂不公开）</option>
          <option value="REJECTED" ${s.tier==='REJECTED'?'selected':''}>驳回不采用</option>
        </select>
      </label>
      <label>代理大厅可见状态（仅 S2 可开放）
        <select name="public_status">
          <option value="AVAILABLE" ${s.public_status==='AVAILABLE'?'selected':''}>脱敏上架可认领</option>
          <option value="HIDDEN" ${s.public_status==='HIDDEN'?'selected':''}>暂隐藏储备</option>
        </select>
      </label>
      <label>场地费与凭证口径<input name="venue_fee_model" value="${esc(s.venue_fee_model)}" /></label>
      <label>初筛核验备注<textarea name="review_note" rows="2">${esc(s.review_note)}</textarea></label>
      <div class="row-end"><button type="submit" class="btn btn-primary">保存分层结果</button></div>
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
  }, `${s.province}${s.city} · ${s.category}`);
};

window.openCreateAgentDrawer = () => {
  openDrawer('核验发放新代理账号', `
    <form id="drawerAgentForm" class="stack-md">
      <div class="grid-2">
        <label>登录账号 <span class="req">*</span><input name="username" required placeholder="如：agent_zz_01" /></label>
        <label>初始密码(>=6位) <span class="req">*</span><input name="password" required placeholder="如：Team@2026" /></label>
      </div>
      <label>团队 / 企业名称 <span class="req">*</span><input name="display_name" required placeholder="如：郑州星辰数采团队" /></label>
      <div class="grid-2">
        <label>开票主体类型 <span class="req">*</span>
          <select name="entity_type">
            <option value="enterprise_vat">企业主体（可开票）</option>
            <option value="sole_proprietor">个体工商户</option>
            <option value="personal_captain">个人团长（代征扣税）</option>
          </select>
        </label>
        <label>代征扣税比例（0 或 0.06）<input type="number" step="0.01" min="0" max="0.3" name="tax_deduction_rate" value="0" /></label>
      </div>
      <div class="grid-2">
        <label>押金 / 担保状态 <span class="req">*</span>
          <select name="deposit_status">
            <option value="PAID">已缴设备押金</option>
            <option value="CORPORATE_GUARANTEE">企业协议担保</option>
            <option value="ACQUAINTANCE_WAIVED">熟人特批免押（仍过首件）</option>
            <option value="UNPAID">未缴押金</option>
          </select>
        </label>
        <label>实缴押金金额(元)<input type="number" name="deposit_amount_cny" value="0" /></label>
      </div>
      <div class="grid-2">
        <label>所在城市<input name="city" placeholder="如：平顶山" /></label>
        <label>验真在岗人数<input type="number" name="verified_headcount" value="5" /></label>
      </div>
      <label>核验备注<input name="notes" placeholder="如：已视频验真场地与团队成员" /></label>
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
  }, '严禁 C 类二道贩子及未验真个人散户');
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
  openDrawer(`审批锁单 · ${a.code}`, `
    <form id="drawerApproveAsg" class="stack-md">
      <div class="small"><strong>申请代理：</strong>${esc(a.agent_name)}（${LABELS.deposit_status[a.deposit_status]?.[0] || a.deposit_status}）</div>
      <div class="small"><strong>目标任务：</strong>${esc(a.task_title)}</div>
      <label>设备配置方式
        <select name="device_arrangement">
          <option value="PLATFORM_ISSUED_DEPOSIT">平台配发设备（须已缴押金/担保）</option>
          <option value="AGENT_OWN_DEVICE">代理自带合规设备</option>
          <option value="PLATFORM_ISSUED_WAIVED">熟人特批免押发设备</option>
        </select>
      </label>
      <label>审批备注<input name="admin_note" placeholder="可选填写设备数量或注意事项" /></label>
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
        toast(decision === 'APPROVE' ? '已锁单并解锁 SOP，进入首件试采期' : '已拒绝申请');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
    body.querySelector('#drawerApproveAsg').onsubmit = (e) => { e.preventDefault(); submitDecision('APPROVE'); };
    body.querySelector('#btnRejectAsg').onclick = () => submitDecision('REJECT');
  }, '批准后自动解锁平台场景联系人与完整 SOP');
};

window.openReviewFPDrawer = (id) => {
  const a = state.admin.assignments.find((x) => x.id === id);
  openDrawer('审核 1–2h 首件试采样本', `
    <form id="drawerReviewFP" class="stack-md">
      ${a ? `<div class="small muted">${esc(a.code)} · ${esc(a.agent_name)} · ${esc(a.task_title)}</div>` : ''}
      <label>审校结论说明<textarea name="review_note" rows="3" placeholder="填写首件过审备注，或明确打回整改原因"></textarea></label>
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
  }, '点亮绿灯后系统解除批量上报拦截');
};

window.openAdminLogDrawer = (id) => {
  const l = state.admin.logs.find((x) => x.id === id);
  if (!l) return;
  openDrawer(`QA 核销与背靠背结算 · #${l.id}`, `
    <form id="drawerLogForm" class="stack-md">
      <div class="small muted">${esc(l.agent_name)} · 上传 ${l.uploaded_hours}h（原始 ${l.raw_hours}h）· 批次 ${esc(l.batch_ref || '无')}</div>
      <div class="grid-2">
        <label>甲方 QA 判定
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
          <option value="PENDING_QA" ${l.settlement_stage==='PENDING_QA'?'selected':''}>待甲方 QA 核定</option>
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
        toast('QA 与三方账期已更新');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  }, '实时联动计算甲方营收、代理净付及凌矩留存');
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
        <div>
          <strong>${esc(t.title)}</strong><br/>
          自带场景净价 ¥${t.agent_rate_own_scene_cny}/有效h ｜ 使用平台场景净价 ¥${t.agent_rate_platform_scene_cny}/有效h
        </div>
      </div>
      <label>选择承接场景模式 <span class="req">*</span>
        <select name="mode" id="dClaimMode">
          <option value="OWN_SCENE">模式 A：自带当地自有场景（¥${t.agent_rate_own_scene_cny}/h）</option>
          <option value="PLATFORM_SCENE">模式 B：匹配同城平台场景（¥${t.agent_rate_platform_scene_cny}/h）</option>
        </select>
      </label>
      <label id="dOwnField">自有场地城市、类型与人员说明 <span class="req">*</span>
        <textarea name="own_scene_desc" rows="2" placeholder="如：平顶山自有轻型装配工位，已有 5 名熟练采集员"></textarea>
      </label>
      <label id="dPlatField" class="hidden">选择平台可用脱敏场景 <span class="req">*</span>
        <select name="scene_id">${sceneOptions}</select>
      </label>
      <label class="ack-box">
        <input type="checkbox" name="agreement_signed" required />
        <span><strong>合作铁律确认：</strong>绝不跳单私联甲方或平台场景老板、绝不二次转包、严格先过 1–2 小时首件绿灯再放量（未过绿灯猛采及违规废片自担）、认可背靠背有效小时结算。</span>
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
  }, `${t.code} · 审批后解锁 SOP`);
};

window.openSopDrawer = (asgId) => {
  const a = state.agent.assignments.find((x) => x.id === asgId);
  if (!a) return;
  openDrawer(`已解锁内部 SOP · ${a.code}`, `
    <div class="stack-md">
      <div class="redline-strip">${SVG.alert}<div><strong>QA 红线：</strong>${esc(a.qa_red_lines)}</div></div>
      <pre class="sop-pre">${esc(a.sop_full_internal)}</pre>
    </div>
  `, null, a.task_title);
};

window.openSubmitLogDrawer = (asgId, logType) => {
  const a = state.agent.assignments.find((x) => x.id === asgId);
  if (!a) return;
  const isFp = logType === 'FIRST_PIECE';
  openDrawer(isFp ? `提交首件试采样本（上限 ${a.first_piece_max_hours}h）` : `提交今日批量日报 · ${a.code}`, `
    <form id="drawerSubmitLog" class="stack-md">
      <div class="grid-2">
        <label>采集日期 <span class="req">*</span><input type="date" name="log_date" value="${new Date().toISOString().slice(0,10)}" required /></label>
        <label>开工设备数 <span class="req">*</span><input type="number" min="1" name="devices_used" value="${isFp ? 1 : 3}" required /></label>
      </div>
      <div class="grid-2">
        <label>原始录制小时 <span class="req">*</span><input type="number" step="0.1" ${isFp ? `max="${a.first_piece_max_hours}"` : ''} name="raw_hours" value="${isFp ? 1.5 : ''}" required /></label>
        <label>已上传小时 <span class="req">*</span><input type="number" step="0.1" name="uploaded_hours" value="${isFp ? 1.5 : ''}" required /></label>
      </div>
      <label>上传批次号 / 凭证备注<input name="batch_ref" placeholder="${isFp ? '如：FP-001' : '如：B-1126-01'}" /></label>
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
  }, a.task_title);
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
