// ================= VECTOR SVG ICON SYSTEM =================
const SVG = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>',
  bot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 8V4H8"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
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
  portal_mode: {
    SUBACCOUNT_UPLOAD_ONLY: ['受限传片子账号（禁用看账/看QA）', 'pill-blue', 'dot-blue'],
    LINGJU_RELAY_SHIELDED: ['全隔离中转（完全屏蔽上游入口）', 'pill-green', 'dot-emerald'],
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
  verify_status: {
    AI_SYNCED_PENDING_CHECK: ['小优已回流·待总控核', 'pill-amber', 'dot-amber'],
    ADMIN_VERIFIED: ['总控已核定', 'pill-green', 'dot-emerald'],
    DISPUTED: ['争议复核中', 'pill-red', 'dot-red'],
  },
  esc_cat: {
    QA_DISPUTE: 'QA 无效扣减申诉',
    PRICE_OR_SETTLEMENT: '价格 / 税点 / 结算',
    DEVICE_OR_SCENE: '设备 / 场地异常',
    REPEAT_ERROR: '连续异常自动拦截',
    PORTAL_BLOCKED: '传片通道 / 登录受阻',
    OTHER: '其它人工督导事项',
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

// ================= STATE =================
const state = {
  user: null,
  publicView: 'scene',
  module: 'overview',
  subtab: '',
  searchQuery: '',
  admin: { stats: {}, projects: [], scenes: [], assignments: [], qaReports: [], logs: [], escalations: [], agents: [] },
  agent: { projects: [], scenes: [], assignments: [], qaReports: [], logs: [] },
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

function quotaProgressHtml(total, alloc, valid) {
  const t = Math.max(1, Number(total || 1));
  const vPct = Math.min(100, Math.round((Number(valid || 0) / t) * 100));
  const aPct = Math.min(100 - vPct, Math.max(0, Math.round(((Number(alloc || 0) - Number(valid || 0)) / t) * 100)));
  const rem = Math.max(0, Math.round((t - Number(alloc || 0)) * 10) / 10);
  return `
    <div class="progress-wrap">
      <div class="progress-track">
        <div class="progress-valid" style="width:${vPct}%"></div>
        <div class="progress-alloc" style="width:${aPct}%"></div>
      </div>
      <div class="progress-meta">
        <span>已有效 <strong>${valid}h</strong> · 已派 <strong>${alloc}h</strong></span>
        <span>剩余可接 <strong>${rem}h</strong> / 总池 ${total}h</span>
      </div>
    </div>
  `;
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
$('#drawerBackdrop').onclick = (e) => { if (e.target === $('#drawerBackdrop')) closeDrawer(); };

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
    ? '整包配额 · 小优回流隔离 · 首件硬锁'
    : `${LABELS.deposit_status[u.deposit_status]?.[0] || ''} · 仅在本平台看QA与预估收益`;
}

$('#pubNavScene').onclick = () => showPublic('scene');
$('#pubNavLogin').onclick = () => showPublic('login');
$('#btnSwitchPublic').onclick = () => showPublic('scene');
$('#btnChangePw').onclick = () => window.openChangePasswordDrawer();
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
    const [ov, prjs, scenes, asgs, qaReps, logs, escs, agents] = await Promise.all([
      api('/api/admin/overview'),
      api('/api/admin/projects'),
      api('/api/admin/scenes'),
      api('/api/admin/assignments'),
      api('/api/admin/xiaoyou/reports'),
      api('/api/admin/logs'),
      api('/api/admin/escalations'),
      api('/api/admin/agents'),
    ]);
    state.admin = {
      stats: ov.stats,
      projects: prjs.projects,
      scenes: scenes.scenes,
      assignments: asgs.assignments,
      qaReports: qaReps.reports,
      logs: logs.logs,
      escalations: escs.tickets,
      agents: agents.agents,
    };
  } else {
    const [prjs, scenes, asgs, qaReps, logs] = await Promise.all([
      api('/api/agent/projects'),
      api('/api/agent/scenes'),
      api('/api/agent/assignments'),
      api('/api/agent/qa-reports'),
      api('/api/agent/logs'),
    ]);
    state.agent = {
      projects: prjs.projects,
      scenes: scenes.scenes,
      assignments: asgs.assignments,
      qaReports: qaReps.reports,
      logs: logs.logs,
    };
  }
}

// ================= NAVIGATION =================
function getNavConfig() {
  if (state.user.role === 'admin') {
    const s = state.admin.stats;
    const pendingAsg = (s.assignments_pending || 0) + (s.first_piece_pending || 0);
    const pendingFinance = (s.xiaoyou_pending_check || 0) + (s.logs_pending_qa || 0) + (s.logs_ready_to_settle || 0);
    return [
      { id: 'overview', icon: SVG.dashboard, label: '经营总览', badge: 0, subtabs: [] },
      {
        id: 'resources', icon: SVG.layers, label: '项目与场景中心', badge: s.scenes_pending || 0,
        subtabs: [
          { id: 'projects', label: '整包项目池（配额/规则）', count: state.admin.projects.length },
          { id: 'scenes', label: '全国场景双层池', count: state.admin.scenes.length },
        ],
      },
      {
        id: 'dispatch', icon: SVG.activity, label: '派单与设备归因', badge: pendingAsg,
        subtabs: [
          { id: 'pending', label: '待审批认领', count: s.assignments_pending || 0 },
          { id: 'first_piece', label: '首件绿灯审核', count: s.first_piece_pending || 0 },
          { id: 'active', label: '全部配额与设备绑定', count: state.admin.assignments.length },
        ],
      },
      {
        id: 'finance', icon: SVG.wallet, label: '小优回流与对账', badge: pendingFinance,
        subtabs: [
          { id: 'xiaoyou_qa', label: '小优上游 QA 回流核对', count: state.admin.qaReports.length },
          { id: 'all_logs', label: '背靠背三方台账', count: state.admin.logs.length },
        ],
      },
      {
        id: 'agents', icon: SVG.users, label: '工单与代理库', badge: s.escalations_open || 0,
        subtabs: [
          { id: 'escalations', label: 'AI 升级人工工单', count: s.escalations_open || 0 },
          { id: 'list', label: '认证代理发号库', count: state.admin.agents.length },
        ],
      },
    ];
  }

  const myTrial = state.agent.assignments.filter((a) => a.status === 'PENDING_APPROVAL' || a.status === 'FIRST_PIECE_TRIAL').length;
  const myBatch = state.agent.assignments.filter((a) => a.status === 'BATCH_GREEN_LIGHT').length;
  return [
    { id: 'overview', icon: SVG.dashboard, label: '工作台首页', badge: 0, subtabs: [] },
    {
      id: 'hall', icon: SVG.compass, label: '项目大厅与场景', badge: 0,
      subtabs: [
        { id: 'projects', label: '开放整包项目池', count: state.agent.projects.length },
        { id: 'scenes', label: '全国脱敏场景池', count: state.agent.scenes.length },
      ],
    },
    {
      id: 'delivery', icon: SVG.clipboard, label: '交付与专属小优', badge: myTrial,
      subtabs: [
        { id: 'trial', label: '待审与首件试采', count: myTrial },
        { id: 'batch', label: '绿灯批量运行中', count: myBatch },
      ],
    },
    {
      id: 'bills', icon: SVG.wallet, label: 'QA 评估与账单', badge: state.agent.qaReports.length,
      subtabs: [
        { id: 'qa_eval', label: '小优同步评估与预估收益', count: state.agent.qaReports.length },
        { id: 'settled', label: '背靠背实结账单', count: state.agent.logs.length },
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

  const roleLabel = state.user.role === 'admin' ? '凌矩总控台' : '代理工作台';
  $('#topbarBreadcrumb').innerHTML = `${roleLabel} / <strong>${esc(current.label)}</strong>${activeSubObj ? ` / ${esc(activeSubObj.label)}` : ''}`;

  $('#sideNav').innerHTML = navConfig.map((n) => `
    <button class="nav-item ${n.id === state.module ? 'active' : ''}" data-mod="${n.id}">
      <span class="nav-left"><span class="nav-icon">${n.icon}</span><span>${n.label}</span></span>
      ${n.badge > 0 ? `<span class="nav-badge">${n.badge}</span>` : ''}
    </button>
  `).join('');
  $$('#sideNav .nav-item').forEach((btn) => { btn.onclick = () => go(btn.dataset.mod); });

  $('#topbarActions').innerHTML = state.user.role === 'admin'
    ? `<button class="btn btn-sm btn-primary" onclick="window.openCreateProjectDrawer()">${SVG.plus}新建整包项目</button>`
    : `<button class="btn btn-sm btn-secondary" onclick="window.navGo('hall','projects')">领项目配额 ${SVG.arrowRight}</button>`;

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
    $('#wsSub').textContent = '项目总配额进度、小优回流核对、异常升级工单与三方实时毛利';
    actions.innerHTML = `
      <button class="btn btn-secondary" onclick="window.openIngestQaDrawer()">${SVG.bot} 导入/同步小优抓数</button>
      <button class="btn btn-primary" onclick="window.openCreateProjectDrawer()">${SVG.plus}新建整包项目</button>
    `;

    const s = state.admin.stats;
    const prjs = state.admin.projects.filter((p) => p.compliance_path !== 'DRAFT_INTERNAL_ONLY');
    const logs = state.admin.logs;
    const confirmed = logs.filter((l) => l.qa_status === 'QA_CONFIRMED');
    const sumValidH = confirmed.reduce((a, b) => a + Number(b.qa_valid_hours || 0), 0);
    const sumUpGross = confirmed.reduce((a, b) => a + Number(b.financials.upstream_gross_cny || 0), 0);
    const sumAgentNet = confirmed.reduce((a, b) => a + Number(b.financials.agent_net_payable_cny || 0), 0);
    const sumVenue = confirmed.reduce((a, b) => a + Number(b.financials.venue_fee_cny || 0), 0);
    const sumMargin = confirmed.reduce((a, b) => a + Number(b.financials.lingju_pre_overhead_margin_cny || 0), 0);

    // Unified Action Queue
    const queue = [];
    state.admin.escalations.filter((e) => e.status !== 'RESOLVED').forEach((e) => {
      queue.push({
        badge: '人工异常工单', pillClass: 'pill-red', dotClass: 'dot-red',
        title: `${e.code} · ${e.agent_name}`,
        meta: e.summary,
        btnText: '处理答复', action: `window.openResolveEscalationDrawer(${e.id})`,
      });
    });
    state.admin.qaReports.filter((r) => r.verify_status === 'AI_SYNCED_PENDING_CHECK').forEach((r) => {
      queue.push({
        badge: '小优待核QA', pillClass: 'pill-blue', dotClass: 'dot-blue',
        title: `${r.code} · ${r.agent_name || '未归因待认领'}（有效 ${r.valid_hours}h / 预估 ¥${r.estimated_agent_net_cny}）`,
        meta: `${r.report_date} · ${r.xiaoyou_summary}`,
        btnText: '核对入账', action: `window.openVerifyQaDrawer(${r.id})`,
      });
    });
    state.admin.scenes.filter((x) => x.tier === 'PENDING_REVIEW').forEach((x) => {
      queue.push({
        badge: '待初筛场景', pillClass: 'pill-amber', dotClass: 'dot-amber',
        title: `${x.province}${x.city} · ${x.category}（约 ${x.estimated_device_capacity} 机位）`,
        meta: `${x.code} · ${x.real_store_name}`,
        btnText: '初筛分级', action: `window.openSceneTriageDrawer(${x.id})`,
      });
    });
    state.admin.assignments.filter((x) => x.status === 'PENDING_APPROVAL').forEach((x) => {
      queue.push({
        badge: '待审配额', pillClass: 'pill-amber', dotClass: 'dot-amber',
        title: `${x.agent_name} 申领 ${x.quota_hours_requested}h（${x.project_code}）`,
        meta: `${x.code} · 代理净价 ¥${x.applied_agent_rate_cny}/h`,
        btnText: '审批绑设备', action: `window.openApproveAsgDrawer(${x.id})`,
      });
    });
    state.admin.assignments.filter((x) => x.status === 'FIRST_PIECE_TRIAL' && x.first_piece_status === 'SUBMITTED').forEach((x) => {
      queue.push({
        badge: '待点绿灯', pillClass: 'pill-blue', dotClass: 'dot-blue',
        title: `${x.agent_name} · 已交 1–2h 首件样本`,
        meta: `${x.code} · ${x.project_title}`,
        btnText: '审核绿灯', action: `window.openReviewFPDrawer(${x.id})`,
      });
    });

    $('#wsContent').innerHTML = `
      <div class="kpi-row-4">
        <div class="kpi-card" onclick="window.navGo('resources','projects')">
          <div class="kpi-top"><span class="kpi-label">开放项目总时长池</span><span class="kpi-icon-box emerald">${SVG.layers}</span></div>
          <div class="kpi-num emerald">${Number(s.total_quota_pool || 0).toLocaleString()}h</div>
          <div class="kpi-foot"><span>在跑项目 ${s.open_compliant_projects || 0} 个</span><span>活跃代理 ${s.active_agents || 0} 家</span></div>
        </div>
        <div class="kpi-card" onclick="window.navGo('dispatch','first_piece')">
          <div class="kpi-top"><span class="kpi-label">待审配额 / 首件绿灯</span><span class="kpi-icon-box blue">${SVG.activity}</span></div>
          <div class="kpi-num ${(s.assignments_pending + s.first_piece_pending) ? 'amber' : ''}">${(s.assignments_pending || 0) + (s.first_piece_pending || 0)}</div>
          <div class="kpi-foot"><span>待审配额 ${s.assignments_pending || 0}</span><span>待点绿灯 ${s.first_piece_pending || 0}</span></div>
        </div>
        <div class="kpi-card" onclick="window.navGo('finance','xiaoyou_qa')">
          <div class="kpi-top"><span class="kpi-label">小优待核 QA / 待结批</span><span class="kpi-icon-box amber">${SVG.wallet}</span></div>
          <div class="kpi-num ${(s.xiaoyou_pending_check + s.logs_ready_to_settle) ? 'amber' : ''}">${(s.xiaoyou_pending_check || 0) + (s.logs_ready_to_settle || 0)}</div>
          <div class="kpi-foot"><span>小优待核 ${s.xiaoyou_pending_check || 0}</span><span>待打款 ${s.logs_ready_to_settle || 0}</span></div>
        </div>
        <div class="kpi-card" onclick="window.navGo('agents','escalations')">
          <div class="kpi-top"><span class="kpi-label">小优升级人工异常单</span><span class="kpi-icon-box amber">${SVG.bot}</span></div>
          <div class="kpi-num ${s.escalations_open ? 'amber' : 'emerald'}">${s.escalations_open || 0}</div>
          <div class="kpi-foot"><span>待初筛场景 ${s.scenes_pending || 0}</span><span>绿灯运行 ${s.green_light_active || 0} 单</span></div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">在跑整包项目配额消耗进度</div>
          <button class="btn btn-sm btn-ghost" onclick="window.navGo('resources','projects')">管理全部项目</button>
        </div>
        <div class="panel-body stack-md">
          ${prjs.map((p) => `
            <div class="row-between" style="gap:20px;">
              <div style="flex:1;min-width:260px;">
                <div class="row-gap" style="margin-bottom:4px;">
                  <span class="mono muted">${esc(p.code)}</span>
                  <strong style="font-size:13.5px;">${esc(p.title)}</strong>
                  <span class="status-pill pill-blue"><span class="dot dot-blue"></span>规则 ${esc(p.current_rule_version)}</span>
                </div>
                ${quotaProgressHtml(p.total_quota_hours, p.allocated_hours, p.delivered_valid_hours)}
              </div>
              <button class="btn btn-sm btn-secondary" onclick="window.openRulePublishDrawer(${p.id})">发布规则变更</button>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="overview-split">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">待您拍板事项队列 (${queue.length})</div>
            <span class="small muted">含异常工单 / 小优回流核对 / 首件点绿灯</span>
          </div>
          ${queue.length ? `
            <div class="queue-list">
              ${queue.slice(0, 7).map((q) => `
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
          ` : '<div class="panel-body muted small">当前所有待处理事项已全部清零。</div>'}
        </div>

        <div class="stack-md">
          <div class="panel">
            <div class="panel-header">
              <div class="panel-title">已确认批次三方分账核算</div>
              <span class="small muted">累计有效 ${sumValidH.toFixed(1)}h</span>
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
            <div class="panel-header"><div class="panel-title">平台风控硬锁状态</div><span class="small muted">系统级保护</span></div>
            <div class="panel-body stack-sm">
              <div class="guard-item"><span>小优回流剥离甲方名与底价</span><span class="status-pill pill-green"><span class="dot dot-emerald"></span>已隔离</span></div>
              <div class="guard-item"><span>未过首件绿灯 / 未签新规禁报批量</span><span class="status-pill pill-green"><span class="dot dot-emerald"></span>HTTP 403/409 硬锁</span></div>
              <div class="guard-item"><span>结算打款强制校验公户回单号</span><span class="status-pill pill-green"><span class="dot dot-emerald"></span>已强制</span></div>
            </div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (state.module === 'resources' && state.subtab === 'projects') {
    $('#wsTitle').textContent = '整包项目池（配额与规则）';
    $('#wsSub').textContent = '按 1,000–10,000h 项目池切分给代理；甲方临时改规则时可一键用 AI 提炼并广播';
    actions.innerHTML = `<button class="btn btn-primary" onclick="window.openCreateProjectDrawer()">${SVG.plus}新建整包项目</button>`;
    const projects = state.admin.projects;
    $('#wsContent').innerHTML = projects.length ? `
      <div class="stack-md">
        ${projects.map((p) => `
          <div class="entity-card">
            <div class="row-between">
              <div class="row-gap">
                <span class="mono muted">${esc(p.code)}</span>
                <span class="entity-title">${esc(p.title)}</span>
                ${pillHtml(LABELS.compliance_path, p.compliance_path)}
                <span class="status-pill pill-blue"><span class="dot dot-blue"></span>规则 ${esc(p.current_rule_version)}</span>
              </div>
              <div class="row-gap">
                <button class="btn btn-sm btn-secondary" onclick="window.openRulePublishDrawer(${p.id})">+ 发布规则变更</button>
                <button class="btn btn-sm btn-secondary" onclick="window.openProjectComplianceDrawer(${p.id})">调整隔离/合规</button>
              </div>
            </div>
            ${quotaProgressHtml(p.total_quota_hours, p.allocated_hours, p.delivered_valid_hours)}
            <div class="meta-strip">
              <span>内部甲方（保密）：<strong>${esc(p.upstream_name_internal)}</strong> · 底价 ¥${p.upstream_base_rate_cny}/h</span>
              <span>代理净价：<strong class="num">自带 ¥${p.agent_rate_own_scene_cny}/h ｜ 平台场景 ¥${p.agent_rate_platform_scene_cny}/h</strong></span>
              <span>后台模式：${LABELS.portal_mode[p.upstream_portal_mode]?.[0] || p.upstream_portal_mode}</span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '<div class="empty-box">暂无整包项目</div>';
    return;
  }

  if (state.module === 'resources' && state.subtab === 'scenes') {
    $('#wsTitle').textContent = '全国场景双层资源池';
    $('#wsSub').textContent = 'S2 常规储备脱敏上架供代理认领；S1 稀缺标杆仅总控可见';
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
              <button class="btn btn-sm btn-primary" onclick="window.openSceneTriageDrawer(${s.id})">初筛与分层</button>
            </div>
            <div class="small" style="color:var(--text-secondary);">${esc(s.daily_work_desc)}</div>
            <div class="meta-strip">
              <span>机位容量：<strong>${s.estimated_device_capacity}</strong> 台</span>
              <span>保密信息：${esc(s.real_store_name)}（${esc(s.real_contact_name)} ${esc(s.real_contact_phone)}）</span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '<div class="empty-box">暂无场景线索</div>';
    return;
  }

  if (state.module === 'dispatch') {
    $('#wsTitle').textContent = '项目配额派单与设备归因绑定';
    $('#wsSub').textContent = '审批锁单时必须绑定受限上传账号与设备编号，作为小优回流算账的归因钥匙';
    let list = state.admin.assignments;
    if (state.subtab === 'pending') list = list.filter((a) => a.status === 'PENDING_APPROVAL');
    if (state.subtab === 'first_piece') list = list.filter((a) => a.status === 'FIRST_PIECE_TRIAL' && a.first_piece_status === 'SUBMITTED');

    $('#wsContent').innerHTML = list.length ? `
      <div class="stack-md">
        ${list.map((a) => {
          const devs = JSON.parse(a.bound_device_ids_json || '[]');
          return `
            <div class="entity-card">
              <div class="row-between">
                <div class="row-gap">
                  <span class="mono muted">${esc(a.code)}</span>
                  <span class="entity-title">${esc(a.agent_name)}</span>
                  ${pillHtml(LABELS.asg_status, a.status)}
                  <span class="status-pill pill-gray"><span class="dot dot-slate"></span>${LABELS.fp_status[a.first_piece_status] || a.first_piece_status}</span>
                </div>
                <div class="row-gap">
                  ${a.status === 'PENDING_APPROVAL' ? `<button class="btn btn-sm btn-primary" onclick="window.openApproveAsgDrawer(${a.id})">审批绑设备锁单</button>` : ''}
                  ${a.status === 'FIRST_PIECE_TRIAL' && a.first_piece_status === 'SUBMITTED' ? `<button class="btn btn-sm btn-primary" onclick="window.openReviewFPDrawer(${a.id})">审核首件点绿灯</button>` : ''}
                </div>
              </div>
              <div class="meta-strip">
                <span>项目：<strong>${esc(a.project_title)}</strong></span>
                <span class="num">配额：<strong>${a.quota_hours_approved || a.quota_hours_requested}h</strong></span>
                <span class="num">代理净价：<strong>¥${a.applied_agent_rate_cny}/h</strong></span>
                <span>受限传片账号：<span class="mono">${esc(a.upstream_upload_account || '待配置')}</span></span>
              </div>
              <div class="row-gap">
                <span class="small muted">绑定归因设备：</span>
                ${devs.length ? devs.map((d) => `<span class="device-chip">${esc(d)}</span>`).join('') : '<span class="small muted">待审批时绑定</span>'}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '<div class="empty-box">当前分类下暂无派单</div>';
    return;
  }

  if (state.module === 'finance' && state.subtab === 'xiaoyou_qa') {
    $('#wsTitle').textContent = '小优上游 QA 回流核对台';
    $('#wsSub').textContent = '小优抓回甲方评估后自动按设备归因、翻译失格原因并预估净收益；总控 10 秒核对后可直推背靠背对账';
    actions.innerHTML = `<button class="btn btn-primary" onclick="window.openIngestQaDrawer()">${SVG.bot} 导入/模拟小优抓数</button>`;
    const reps = state.admin.qaReports;
    $('#wsContent').innerHTML = reps.length ? `
      <div class="stack-md">
        ${reps.map((r) => {
          const reasons = JSON.parse(r.invalid_reasons_json || '[]');
          return `
            <div class="entity-card">
              <div class="row-between">
                <div class="row-gap">
                  <span class="mono muted">${esc(r.code)}</span>
                  <span class="entity-title">${esc(r.agent_name || '未自动匹配归因（待指定）')}</span>
                  ${pillHtml(LABELS.verify_status, r.verify_status)}
                </div>
                <div class="row-gap">
                  <span class="num" style="font-weight:700;color:var(--primary);">预估代理净额 ¥${r.estimated_agent_net_cny}</span>
                  <button class="btn btn-sm btn-secondary" onclick="window.openVerifyQaDrawer(${r.id})">核对 / 转入结算</button>
                </div>
              </div>
              <div class="meta-strip">
                <span>日期：${esc(r.report_date)}</span>
                <span>项目：${esc(r.project_code)}</span>
                <span>归因关键字：<span class="mono">${esc(r.matched_key)}</span></span>
                <span class="num">收到 ${r.uploaded_hours}h ｜ <strong>有效 ${r.valid_hours}h</strong> ｜ 无效 ${r.invalid_hours}h</span>
              </div>
              ${reasons.length ? `
                <div class="bad-reason-list">
                  ${reasons.map((b) => `
                    <div class="bad-reason-item">
                      <div class="bad-reason-head"><span>[${esc(b.clip_ref)}] ${esc(b.category_zh)}</span><span class="mono small muted">${esc(b.raw_tag)}</span></div>
                      <div class="bad-reason-tip">小优白话建议：${esc(b.xiaoyou_plain_advice)}</div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    ` : '<div class="empty-box">暂无小优回流评估数据</div>';
    return;
  }

  if (state.module === 'finance' && state.subtab === 'all_logs') {
    $('#wsTitle').textContent = '背靠背三方对账台账';
    $('#wsSub').textContent = '严格按甲方确认有效小时核算；标记已打款必填公户回单号，支持一键导出对账单';
    actions.innerHTML = `<a class="btn btn-secondary" href="/api/admin/logs/export.csv" download="lingju-settlement-ledger.csv">${SVG.download}导出 CSV 对账单</a>`;
    const list = state.admin.logs;
    $('#wsContent').innerHTML = list.length ? `
      <div class="table-card">
        <table>
          <thead><tr><th>批次 / 代理团队</th><th>上传 / 有效</th><th>QA 与账期进度</th><th>三方金额拆解</th><th style="text-align:right;">操作</th></tr></thead>
          <tbody>
            ${list.map((l) => `<tr>
              <td><div style="font-weight:700;">#${l.id} · ${esc(l.agent_name)}</div><div class="small muted"><span class="mono">${esc(l.assignment_code)}</span> · ${esc(l.log_date)} · ${LABELS.log_type[l.log_type] || l.log_type}</div></td>
              <td class="num">上传 ${l.uploaded_hours}h<br/><strong>有效 ${l.qa_valid_hours}h</strong></td>
              <td>${pillHtml(LABELS.qa_status, l.qa_status)}<div style="margin-top:6px;">${pillHtml(LABELS.settlement_stage, l.settlement_stage)}</div>${l.payout_receipt_ref ? `<div class="small muted mono" style="margin-top:4px;">回单：${esc(l.payout_receipt_ref)}</div>` : ''}</td>
              <td class="small num">代理净付：<strong>¥${l.financials.agent_net_payable_cny}</strong> (税 ¥${l.financials.agent_tax_deduction_cny})<br/>场景费：¥${l.financials.venue_fee_cny} ｜ <strong style="color:var(--primary);">凌矩留存：¥${l.financials.lingju_pre_overhead_margin_cny}</strong></td>
              <td style="text-align:right;"><button class="btn btn-sm btn-secondary" onclick="window.openAdminLogDrawer(${l.id})">核销 / 结算</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="empty-box">暂无采集对账记录</div>';
    return;
  }

  if (state.module === 'agents' && state.subtab === 'escalations') {
    $('#wsTitle').textContent = 'AI 小优升级人工工单台';
    $('#wsSub').textContent = '日常问题由项目专属小优 7×24h 消化；涉改价、QA 申诉、损赔或连续异常集中在此由 1 名督导统一拍板';
    const tickets = state.admin.escalations;
    $('#wsContent').innerHTML = tickets.length ? `
      <div class="stack-md">
        ${tickets.map((t) => `
          <div class="entity-card">
            <div class="row-between">
              <div class="row-gap">
                <span class="mono muted">${esc(t.code)}</span>
                <span class="entity-title">${esc(t.agent_name)}</span>
                <span class="status-pill ${t.status === 'RESOLVED' ? 'pill-green' : 'pill-red'}"><span class="dot ${t.status === 'RESOLVED' ? 'dot-emerald' : 'dot-red'}"></span>${t.status === 'RESOLVED' ? '已人工解决' : '待督导处理'}</span>
                <span class="status-pill pill-gray"><span class="dot dot-slate"></span>${LABELS.esc_cat[t.category] || t.category}</span>
              </div>
              <button class="btn btn-sm btn-primary" onclick="window.openResolveEscalationDrawer(${t.id})">${t.status === 'RESOLVED' ? '查看记录' : '督导处理答复'}</button>
            </div>
            <div style="font-size:13.5px;color:var(--text);">${esc(t.summary)}</div>
            ${t.resolution_note ? `<div class="unlock-bar"><strong>督导处理结果：</strong>${esc(t.resolution_note)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    ` : '<div class="empty-box">暂无升级人工的异常工单</div>';
    return;
  }

  if (state.module === 'agents' && state.subtab === 'list') {
    $('#wsTitle').textContent = '认证代理发号库';
    $('#wsSub').textContent = '仅准入验真的小团队、企业与成熟团长；支持一键暂停与重置登录密码';
    actions.innerHTML = `<button class="btn btn-primary" onclick="window.openCreateAgentDrawer()">${SVG.plus}核验发代理号</button>`;
    const agents = state.admin.agents;
    $('#wsContent').innerHTML = agents.length ? `
      <div class="table-card">
        <table>
          <thead><tr><th>代理团队 / 账号</th><th>城市与人数</th><th>开票主体与代征税</th><th>押金 / 担保</th><th>账号状态</th><th style="text-align:right;">管理</th></tr></thead>
          <tbody>
            ${agents.map((a) => `<tr>
              <td><div style="font-weight:700;">${esc(a.display_name)}</div><div class="small muted mono">${esc(a.username)}</div></td>
              <td>${esc(a.city || '未填')} · 验真 <strong>${a.verified_headcount}</strong> 人</td>
              <td><div>${LABELS.entity_type[a.entity_type] || a.entity_type}</div><div class="small muted num">扣点 ${(a.tax_deduction_rate * 100).toFixed(1)}%</div></td>
              <td>${pillHtml(LABELS.deposit_status, a.deposit_status)} <span class="small muted num">¥${a.deposit_amount_cny}</span></td>
              <td>${a.status === 'ACTIVE' ? '<span class="status-pill pill-green"><span class="dot dot-emerald"></span>正常启用</span>' : '<span class="status-pill pill-gray"><span class="dot dot-slate"></span>已暂停</span>'}</td>
              <td style="text-align:right;" class="row-end">
                <button class="btn btn-sm btn-secondary" onclick="window.openResetAgentPwDrawer(${a.id})">改密</button>
                <button class="btn btn-sm btn-ghost" onclick="window.adminToggleAgent(${a.id}, '${a.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'}')">${a.status === 'ACTIVE' ? '暂停' : '启用'}</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="empty-box">暂无认证代理</div>';
  }
}

// ================= AGENT PAGES =================
function renderAgentPage() {
  $('#wsActions').innerHTML = '';
  const u = state.user;

  if (state.module === 'overview') {
    $('#wsTitle').textContent = `欢迎回来，${u.display_name}`;
    $('#wsSub').textContent = '在本工作台即可完成领项目配额、呼叫专属小优、并查看甲方 QA 有效/无效诊断与预估净收益';
    $('#wsActions').innerHTML = `<button class="btn btn-primary" onclick="window.navGo('hall','projects')">领整包项目配额 ${SVG.arrowRight}</button>`;

    const asgs = state.agent.assignments;
    const qaReps = state.agent.qaReports;
    const logs = state.agent.logs;
    const sumEstNet = qaReps.reduce((s, r) => s + Number(r.estimated_agent_net_cny || 0), 0);
    const sumSettled = logs.filter((l) => l.settlement_stage === 'SETTLED_PAID').reduce((s, l) => s + Number(l.agent_net_payable_cny || 0), 0);
    const unackedCount = asgs.filter((a) => a.latest_revision && !a.latest_revision.acked_by_me).length;

    $('#wsContent').innerHTML = `
      <div class="kpi-row-3">
        <div class="kpi-card" onclick="window.navGo('hall','projects')">
          <div class="kpi-top"><span class="kpi-label">开放合规整包项目</span><span class="kpi-icon-box emerald">${SVG.compass}</span></div>
          <div class="kpi-num emerald">${state.agent.projects.length}</div>
          <div class="kpi-foot"><span>可用脱敏场景 ${state.agent.scenes.length} 个</span><span>查看项目剩余配额</span></div>
        </div>
        <div class="kpi-card" onclick="window.navGo('delivery','batch')">
          <div class="kpi-top"><span class="kpi-label">已承接项目派单</span><span class="kpi-icon-box blue">${SVG.clipboard}</span></div>
          <div class="kpi-num ${unackedCount ? 'amber' : ''}">${asgs.length}</div>
          <div class="kpi-foot"><span>待签新规 ${unackedCount} 项</span><span>含专属项目小优</span></div>
        </div>
        <div class="kpi-card" onclick="window.navGo('bills','qa_eval')">
          <div class="kpi-top"><span class="kpi-label">小优 QA 预估净收益</span><span class="kpi-icon-box emerald">${SVG.wallet}</span></div>
          <div class="kpi-num emerald">¥${sumEstNet.toFixed(2)}</div>
          <div class="kpi-foot"><span>已实结到账 ¥${sumSettled.toFixed(2)}</span><span>查看失格原因明细</span></div>
        </div>
      </div>

      <div class="overview-split">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">我承接的项目与交付进度</div>
            <button class="btn btn-sm btn-ghost" onclick="window.navGo('delivery','batch')">打开交付工作台</button>
          </div>
          ${asgs.length ? `
            <div class="queue-list">
              ${asgs.map((a) => `
                <div class="queue-row">
                  <div style="min-width:0;">
                    <div class="row-gap" style="margin-bottom:4px;">
                      <span class="queue-title">${esc(a.project_title)}</span>
                      ${pillHtml(LABELS.asg_status, a.status)}
                    </div>
                    <div class="small muted">配额 <strong>${a.quota_hours_approved || a.quota_hours_requested}h</strong> · 绑定设备 ${a.bound_device_ids.length} 台 · 规则 ${esc(a.current_rule_version)}</div>
                  </div>
                  <button class="btn btn-sm btn-secondary" onclick="window.openXiaoYouChatDrawer(${a.project_id}, '${esc(a.project_title)}')">${SVG.bot} 问小优</button>
                </div>
              `).join('')}
            </div>
          ` : '<div class="panel-body muted small">暂无在跑项目派单，请点击右上角「领整包项目配额」挑选项目。</div>'}
        </div>

        <div class="panel">
          <div class="panel-header"><div class="panel-title">准入档案与结算铁律</div>${pillHtml(LABELS.deposit_status, u.deposit_status)}</div>
          <div class="panel-body">
            <div class="kv-list">
              <div class="kv-row"><span class="kv-label">服务城市</span><span class="kv-val">${esc(u.city || '未填')}</span></div>
              <div class="kv-row"><span class="kv-label">开票主体</span><span class="kv-val">${LABELS.entity_type[u.entity_type] || u.entity_type}</span></div>
              <div class="kv-row"><span class="kv-label">代征扣税率</span><span class="kv-val">${(Number(u.tax_deduction_rate || 0) * 100).toFixed(1)}%</span></div>
              <div class="kv-row"><span class="kv-label">数据隔离墙</span><span class="kv-val emerald">QA评估与预估统一回本平台查看</span></div>
            </div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (state.module === 'hall' && state.subtab === 'projects') {
    $('#wsTitle').textContent = '开放整包项目池';
    $('#wsSub').textContent = '以下展示已获合规分包路径的整包项目；请根据团队人手申领合适的小时配额切片';
    const projects = state.agent.projects;
    $('#wsContent').innerHTML = projects.length ? `
      <div class="stack-md">
        ${projects.map((p) => `
          <div class="task-market-card">
            <div class="row-between" style="align-items:flex-start;">
              <div class="stack-sm">
                <div class="row-gap">
                  <span class="status-pill pill-blue"><span class="dot dot-blue"></span>${esc(p.modality)}</span>
                  <span class="status-pill pill-gray"><span class="dot dot-slate"></span>${esc(p.scene_category)}</span>
                  <span class="status-pill pill-green"><span class="dot dot-emerald"></span>规则 ${esc(p.current_rule_version)}</span>
                  <span class="small muted">${esc(p.city_scope)}</span>
                </div>
                <div class="task-title">${esc(p.title)}</div>
                <div class="small muted">${esc(p.sop_summary)}</div>
              </div>
              <div class="price-box">
                <div class="price-main">¥${p.agent_rate_own_scene_cny} <span style="font-size:12.5px;font-weight:500;">/有效h</span></div>
                <div class="price-sub">自带场景净价 ｜ 用平台场景 ¥${p.agent_rate_platform_scene_cny}/h</div>
              </div>
            </div>

            ${quotaProgressHtml(p.total_quota_hours, p.allocated_hours, p.delivered_valid_hours)}

            <div class="spec-grid">
              <div class="spec-cell"><div class="spec-k">项目剩余可接</div><div class="spec-v num">${p.remaining_quota_hours} 小时</div></div>
              <div class="spec-cell"><div class="spec-k">首件试采门槛</div><div class="spec-v num">${p.first_piece_min_hours}–${p.first_piece_max_hours} 小时</div></div>
              <div class="spec-cell"><div class="spec-k">结算账期</div><div class="spec-v">甲方回款后 ${p.settlement_days_after_client_pay} 个工作日</div></div>
              <div class="spec-cell"><div class="spec-k">传片与隔离模式</div><div class="spec-v">${p.upstream_portal_mode === 'SUBACCOUNT_UPLOAD_ONLY' ? '受限子账号传片' : '全屏蔽中转通道'}</div></div>
            </div>

            <div class="redline-strip">${SVG.alert}<div><strong>QA 合规红线：</strong>${esc(p.qa_red_lines)}</div></div>

            <div class="row-between">
              <span class="small muted row-gap" style="gap:6px;">${SVG.lock} <span>审批锁单后分配绑定设备号、传片通道及完整 V3 SOP</span></span>
              <button class="btn btn-primary" onclick="window.openClaimProjectDrawer(${p.id})">申领项目配额</button>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '<div class="empty-box">当前暂无开放整包项目</div>';
    return;
  }

  if (state.module === 'hall' && state.subtab === 'scenes') {
    $('#wsTitle').textContent = '全国脱敏场景池';
    $('#wsSub').textContent = '锁单审批通过后自动向该派单解锁真实店名、地址与负责人联系方式';
    const q = state.searchQuery.trim();
    const list = q ? state.agent.scenes.filter((s) => `${s.province}${s.city}${s.district}${s.category}${s.daily_work_desc}`.includes(q)) : state.agent.scenes;
    $('#wsContent').innerHTML = `
      <div class="filter-toolbar">
        <div class="search-box">${SVG.search}<input id="citySearchInput" value="${esc(state.searchQuery)}" placeholder="按城市或行业筛选（如：平顶山）" /></div>
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
              <div class="lock-bar">${SVG.lock} 店名与联系方式已脱敏，请在「开放整包项目池」组合认领解锁</div>
            </div>
          `).join('')}
        </div>
      ` : '<div class="empty-box">暂无匹配的脱敏场景</div>'}
    `;
    const inp = $('#citySearchInput');
    if (inp) {
      inp.oninput = () => { state.searchQuery = inp.value; renderAgentPage(); const el = $('#citySearchInput'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } };
    }
    return;
  }

  if (state.module === 'delivery') {
    $('#wsTitle').textContent = '交付执行与本项目专属小优';
    $('#wsSub').textContent = '请使用已绑定的设备号与授权上传通道传片；如有规则疑问或需转人工督导，点击右侧「呼叫专属小优」';
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
                <span class="entity-title">${esc(a.project_title)}</span>
                ${pillHtml(LABELS.asg_status, a.status)}
                <span class="status-pill pill-gray"><span class="dot dot-slate"></span>${LABELS.fp_status[a.first_piece_status] || a.first_piece_status}</span>
              </div>
              <strong class="num" style="color:var(--primary);font-size:16px;">配额 ${a.quota_hours_approved || a.quota_hours_requested}h · ¥${a.applied_agent_rate_cny}/h</strong>
            </div>

            ${a.latest_revision && !a.latest_revision.acked_by_me ? `
              <div class="rule-alert-bar">
                <div><strong>新规必读（${esc(a.latest_revision.version_code)}）：</strong>${esc(a.latest_revision.change_summary)}</div>
                <button class="btn btn-sm btn-primary" onclick="window.ackRuleRevision(${a.latest_revision.id})">确认已读并按新规执行</button>
              </div>
            ` : ''}

            <div class="meta-strip">
              <span>传片子账号/通道：<strong class="mono">${esc(a.upstream_upload_account)}</strong></span>
              <span>${esc(a.upstream_upload_guide)}</span>
            </div>
            <div class="row-gap">
              <span class="small muted">绑定设备归因编号：</span>
              ${a.bound_device_ids.length ? a.bound_device_ids.map((d) => `<span class="device-chip">${esc(d)}</span>`).join('') : '<span class="small muted">审批锁单后下发</span>'}
            </div>

            ${a.scene_info ? (a.scene_info.unlocked
              ? `<div class="unlock-bar">${SVG.unlock} <div><strong>已解锁进场对接：</strong>${esc(a.scene_info.real_store_name)} ｜ ${esc(a.scene_info.real_contact_name)} ${esc(a.scene_info.real_contact_phone)} ｜ ${esc(a.scene_info.real_address)}</div></div>`
              : `<div class="lock-bar">${SVG.lock} 匹配场景 ${esc(a.scene_info.code)}（待凌矩审批锁单后解锁真联系）</div>`
            ) : `<div class="small muted">自有场景：${esc(a.own_scene_desc)}</div>`}

            <div class="row-between">
              <span class="small muted">${a.first_piece_review_note ? `审校反馈：${esc(a.first_piece_review_note)}` : `当前规则版本 ${esc(a.current_rule_version)}`}</span>
              <div class="row-gap">
                <button class="btn btn-sm btn-secondary" onclick="window.openXiaoYouChatDrawer(${a.project_id}, '${esc(a.project_title)}')">${SVG.bot} 专属小优 / 转人工</button>
                ${a.sop_full_internal ? `<button class="btn btn-sm btn-secondary" onclick="window.openSopDrawer(${a.id})">完整 SOP</button>` : ''}
                ${a.status === 'FIRST_PIECE_TRIAL' ? `<button class="btn btn-sm btn-primary" onclick="window.openSubmitLogDrawer(${a.id}, 'FIRST_PIECE')">提交首件样本 (1–2h)</button>` : ''}
                ${a.status === 'BATCH_GREEN_LIGHT' ? `<button class="btn btn-sm btn-primary" onclick="window.openSubmitLogDrawer(${a.id}, 'BATCH')">${SVG.plus}提交今日日报</button>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '<div class="empty-box">当前分类下暂无派单，可前往左侧「项目大厅与场景」申领配额</div>';
    return;
  }

  if (state.module === 'bills' && state.subtab === 'qa_eval') {
    $('#wsTitle').textContent = '小优同步 QA 评估与预估净收益';
    $('#wsSub').textContent = '小优已从上游后台拉取您的上传审核结果，并剥离敏感信息、翻译为逐条整改建议（提示：预估净收益仅供跟踪，以最终甲方回款实结为准）';
    const reps = state.agent.qaReports;
    $('#wsContent').innerHTML = reps.length ? `
      <div class="stack-md">
        ${reps.map((r) => {
          const reasons = JSON.parse(r.invalid_reasons_json || '[]');
          return `
            <div class="entity-card">
              <div class="row-between">
                <div class="row-gap">
                  <span class="mono muted">${esc(r.report_date)}</span>
                  <span class="entity-title">${esc(r.project_title)}</span>
                  ${pillHtml(LABELS.verify_status, r.verify_status)}
                </div>
                <div style="text-align:right;">
                  <div class="row-gap" style="justify-content:flex-end;">
                    <span class="est-pill">QA 预估 · 未决算</span>
                    <strong class="num" style="font-size:18px;color:var(--primary);">¥${r.estimated_agent_net_cny}</strong>
                  </div>
                  <div class="small muted num">毛 ¥${r.estimated_agent_gross_cny} - 代征税 ¥${r.estimated_agent_tax_cny}</div>
                </div>
              </div>
              <div class="meta-strip">
                <span class="num">上传收到 <strong>${r.uploaded_hours}h</strong></span>
                <span class="num" style="color:var(--primary);">有效时长 <strong>${r.valid_hours}h</strong></span>
                <span class="num" style="color:var(--danger);">无效扣减 <strong>${r.invalid_hours}h</strong></span>
                <span>批次 ${esc(r.code)}</span>
              </div>
              ${reasons.length ? `
                <div class="bad-reason-list">
                  ${reasons.map((b) => `
                    <div class="bad-reason-item">
                      <div class="bad-reason-head"><span>${esc(b.clip_ref)} · ${esc(b.category_zh)}</span>${b.hours ? `<span class="num">-${b.hours}h</span>` : ''}</div>
                      <div class="bad-reason-tip">整改建议：${esc(b.xiaoyou_plain_advice)}</div>
                    </div>
                  `).join('')}
                </div>
              ` : '<div class="unlock-bar">本批次上传全部合格，无无效扣减！</div>'}
            </div>
          `;
        }).join('')}
      </div>
    ` : '<div class="empty-box">暂无小优同步的上游 QA 评估记录</div>';
    return;
  }

  if (state.module === 'bills' && state.subtab === 'settled') {
    $('#wsTitle').textContent = '背靠背实结账单台账';
    $('#wsSub').textContent = '严格按甲方确认有效小时及实际回款进度结算，已打款均附公户回单号';
    const list = state.agent.logs;
    $('#wsContent').innerHTML = list.length ? `
      <div class="table-card">
        <table>
          <thead><tr><th>日期 / 类型</th><th>派单与项目</th><th>上传 / 有效</th><th>QA 与回款进度</th><th style="text-align:right;">实结净到手</th></tr></thead>
          <tbody>
            ${list.map((l) => `<tr>
              <td><strong>${esc(l.log_date)}</strong><div class="small muted">${LABELS.log_type[l.log_type] || l.log_type}</div></td>
              <td><div style="font-weight:600;">${esc(l.project_title)}</div><div class="small muted mono">${esc(l.assignment_code)}</div></td>
              <td class="num">上传 ${l.uploaded_hours}h<br/><strong>有效 ${l.qa_valid_hours}h</strong></td>
              <td>${pillHtml(LABELS.qa_status, l.qa_status)}<div style="margin-top:6px;">${pillHtml(LABELS.settlement_stage, l.settlement_stage)}</div>${l.payout_receipt_ref ? `<div class="small muted mono" style="margin-top:4px;">回单：${esc(l.payout_receipt_ref)}</div>` : ''}</td>
              <td style="text-align:right;" class="num"><strong style="font-size:16px;color:var(--primary);">¥${l.agent_net_payable_cny}</strong><div class="small muted">毛 ¥${l.agent_gross_cny} - 税 ¥${l.agent_tax_deduction_cny}</div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="empty-box">暂无实结账单记录</div>';
  }
}

// ================= DRAWERS & ACTIONS =================
window.navGo = go;

window.openChangePasswordDrawer = () => {
  openDrawer('修改登录密码', `
    <form id="drawerChangePw" class="stack-md">
      <label>当前密码 <span class="req">*</span><input type="password" name="old_password" required /></label>
      <label>新密码（至少 6 位） <span class="req">*</span><input type="password" name="new_password" minlength="6" required /></label>
      <div class="row-end"><button type="submit" class="btn btn-primary">确认修改密码</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerChangePw').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
        closeDrawer();
        toast('登录密码已修改，下次登录生效');
      } catch (err) { toast(err.message, true); }
    };
  });
};

window.openResetAgentPwDrawer = (id) => {
  const a = state.admin.agents.find((x) => x.id === id);
  openDrawer(`重置代理登录密码 · ${a?.display_name || ''}`, `
    <form id="drawerResetPw" class="stack-md">
      <label>设置新临时密码（至少 6 位） <span class="req">*</span><input name="new_password" value="Agent@2026!" minlength="6" required /></label>
      <div class="row-end"><button type="submit" class="btn btn-primary">立即重置</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerResetPw').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(`/api/admin/agents/${id}/reset-password`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
        closeDrawer();
        toast('代理密码已重置');
      } catch (err) { toast(err.message, true); }
    };
  });
};

window.openCreateProjectDrawer = () => {
  openDrawer('新建整包交付项目', `
    <form id="drawerProjectForm" class="stack-md">
      <label>项目名称 <span class="req">*</span><input name="title" required placeholder="如：华北商超第一视角理货 1,000h 项目" /></label>
      <div class="grid-2">
        <label>项目总小时配额池 <span class="req">*</span><input type="number" step="10" name="total_quota_hours" value="1000" required /></label>
        <label>目标截止日期<input type="date" name="deadline_date" value="2026-12-31" /></label>
      </div>
      <div class="grid-2">
        <label>内部甲方名（保密） <span class="req">*</span><input name="upstream_name_internal" required /></label>
        <label>甲方含税底价(元/h) <span class="req">*</span><input type="number" step="0.01" name="upstream_base_rate_cny" required /></label>
      </div>
      <div class="grid-2">
        <label>设备模态 <span class="req">*</span>
          <select name="modality"><option value="EGO第一视角">EGO第一视角</option><option value="双目/夹爪">双目/夹爪</option><option value="夹爪">夹爪</option><option value="双目">双目</option></select>
        </label>
        <label>适配场景类别 <span class="req">*</span><input name="scene_category" required placeholder="如：零售购物空间" /></label>
      </div>
      <div class="grid-2">
        <label>代理净价-自带场景(元/h) <span class="req">*</span><input type="number" step="0.01" name="agent_rate_own_scene_cny" required /></label>
        <label>代理净价-平台场景(元/h) <span class="req">*</span><input type="number" step="0.01" name="agent_rate_platform_scene_cny" required /></label>
      </div>
      <div class="grid-2">
        <label>甲方后台隔离模式
          <select name="upstream_portal_mode">
            <option value="LINGJU_RELAY_SHIELDED">全隔离中转（屏蔽上游）</option>
            <option value="SUBACCOUNT_UPLOAD_ONLY">受限传片子账号</option>
          </select>
        </label>
        <label>合规路径锁
          <select name="compliance_path">
            <option value="DRAFT_INTERNAL_ONLY">内部草稿（暂不开放）</option>
            <option value="WRITTEN_SUBCONTRACT_APPROVED">已获书面分包许可</option>
            <option value="LINGJU_UNIFIED_TEAM_ACCOUNT">凌矩统一子账号托管</option>
          </select>
        </label>
      </div>
      <label>QA 合规红线（代理可见） <span class="req">*</span><input name="qa_red_lines" required placeholder="手出画超 3 秒作废；严禁空桌摆拍" /></label>
      <label>内部 V3 执行 SOP<textarea name="sop_full_internal" rows="3"></textarea></label>
      <div class="row-end"><button type="submit" class="btn btn-primary">确认新建项目</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerProjectForm').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/api/admin/projects', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
        closeDrawer();
        toast('整包项目已创建');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  }, '支持 1,000–10,000h 总量配额管控');
};

window.openProjectComplianceDrawer = (id) => {
  const p = state.admin.projects.find((x) => x.id === id);
  if (!p) return;
  openDrawer(`项目隔离与合规设置 · ${p.code}`, `
    <form id="drawerPatchPrj" class="stack-md">
      <label>合规路径锁
        <select name="compliance_path">
          <option value="DRAFT_INTERNAL_ONLY" ${p.compliance_path==='DRAFT_INTERNAL_ONLY'?'selected':''}>内部草稿（不对代理展示）</option>
          <option value="WRITTEN_SUBCONTRACT_APPROVED" ${p.compliance_path==='WRITTEN_SUBCONTRACT_APPROVED'?'selected':''}>已获书面分包许可（开放）</option>
          <option value="LINGJU_UNIFIED_TEAM_ACCOUNT" ${p.compliance_path==='LINGJU_UNIFIED_TEAM_ACCOUNT'?'selected':''}>统一子账号托管（开放）</option>
        </select>
      </label>
      <label>甲方平台权限隔离模式
        <select name="upstream_portal_mode">
          <option value="SUBACCOUNT_UPLOAD_ONLY" ${p.upstream_portal_mode==='SUBACCOUNT_UPLOAD_ONLY'?'selected':''}>受限传片子账号（仅传片，QA回凌矩看）</option>
          <option value="LINGJU_RELAY_SHIELDED" ${p.upstream_portal_mode==='LINGJU_RELAY_SHIELDED'?'selected':''}>全隔离中转（完全屏蔽上游）</option>
        </select>
      </label>
      <div class="row-end"><button type="submit" class="btn btn-primary">保存变更</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerPatchPrj').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(`/api/admin/projects/${id}`, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
        closeDrawer();
        toast('项目配置已更新');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  });
};

window.openRulePublishDrawer = (projectId) => {
  const p = state.admin.projects.find((x) => x.id === projectId);
  if (!p) return;
  openDrawer(`发布规则变更广播 · ${p.code}`, `
    <form id="drawerRuleForm" class="stack-md">
      <label>粘贴甲方群原始改规通知
        <textarea name="raw_client_notice" id="rawClientNotice" rows="3" placeholder="例如：明天起相机统一下压5度，不能拍到货架外侧顾客正脸"></textarea>
      </label>
      <div><button type="button" class="btn btn-sm btn-secondary" id="btnAiDraftRule">${SVG.bot} 小优提炼变更要点</button></div>
      <div class="grid-2">
        <label>新版本号 <span class="req">*</span><input name="version_code" id="revVerInput" value="v1.${(p.revisions?.length || 0) + 1}" required /></label>
        <label>生效时间<input name="effective_at" value="立即生效" /></label>
      </div>
      <label>AI 提炼对比草稿（内部留档）<textarea name="ai_structured_diff" id="revDiffInput" rows="3"></textarea></label>
      <label>审核后的正式对外公告摘要 <span class="req">*</span><textarea name="change_summary" id="revSummaryInput" rows="2" required></textarea></label>
      <label class="ack-box"><input type="checkbox" name="append_to_red_lines" checked /><span>同步追加进本项目 QA 红线并强制全部执行中代理点「确认已读」</span></label>
      <div class="row-end"><button type="submit" class="btn btn-primary">人工确认并广播新规</button></div>
    </form>
  `, (body) => {
    body.querySelector('#btnAiDraftRule').onclick = async () => {
      try {
        const res = await api(`/api/admin/projects/${projectId}/rule-draft`, {
          method: 'POST', body: JSON.stringify({ raw_client_notice: body.querySelector('#rawClientNotice').value }),
        });
        body.querySelector('#revVerInput').value = res.version_code;
        body.querySelector('#revDiffInput').value = res.ai_structured_diff;
        body.querySelector('#revSummaryInput').value = res.suggested_summary;
        toast('小优已完成要点提炼，请人工复核后发布');
      } catch (err) { toast(err.message, true); }
    };
    body.querySelector('#drawerRuleForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      payload.append_to_red_lines = fd.get('append_to_red_lines') === 'on';
      try {
        await api(`/api/admin/projects/${projectId}/rules`, { method: 'POST', body: JSON.stringify(payload) });
        closeDrawer();
        toast('新规则已发布并通知全部代理签收');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  }, p.title);
};

window.openSceneTriageDrawer = (id) => {
  const s = state.admin.scenes.find((x) => x.id === id);
  if (!s) return;
  openDrawer(`场景分级管理 · ${s.code}`, `
    <form id="drawerSceneForm" class="stack-md">
      <div class="unlock-bar"><div><strong>保密联系人：</strong>${esc(s.real_store_name)} ｜ ${esc(s.real_contact_name)} ${esc(s.real_contact_phone)}<br/>地址：${esc(s.real_address)}</div></div>
      <label>场景分层 <span class="req">*</span>
        <select name="tier">
          <option value="S2_RESERVE" ${s.tier==='S2_RESERVE'?'selected':''}>S2 常规储备池（脱敏上架给代理）</option>
          <option value="S1_BENCHMARK" ${s.tier==='S1_BENCHMARK'?'selected':''}>S1 稀缺标杆池（仅总控可见）</option>
          <option value="PENDING_REVIEW" ${s.tier==='PENDING_REVIEW'?'selected':''}>待初筛</option>
          <option value="REJECTED" ${s.tier==='REJECTED'?'selected':''}>驳回</option>
        </select>
      </label>
      <label>代理大厅可见状态
        <select name="public_status">
          <option value="AVAILABLE" ${s.public_status==='AVAILABLE'?'selected':''}>脱敏上架可认领</option>
          <option value="HIDDEN" ${s.public_status==='HIDDEN'?'selected':''}>暂隐藏储备</option>
        </select>
      </label>
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

window.openApproveAsgDrawer = (id) => {
  const a = state.admin.assignments.find((x) => x.id === id);
  if (!a) return;
  openDrawer(`审批配额切分与绑定设备 · ${a.code}`, `
    <form id="drawerApproveAsg" class="stack-md">
      <div class="small"><strong>代理：</strong>${esc(a.agent_name)}（${LABELS.deposit_status[a.deposit_status]?.[0] || a.deposit_status}）</div>
      <div class="grid-2">
        <label>批准小时配额 <span class="req">*</span><input type="number" step="10" name="quota_hours_approved" value="${a.quota_hours_requested}" required /></label>
        <label>设备配置方式
          <select name="device_arrangement">
            <option value="PLATFORM_ISSUED_DEPOSIT">平台配发设备（已缴押金）</option>
            <option value="AGENT_OWN_DEVICE">代理自带合规设备</option>
            <option value="PLATFORM_ISSUED_WAIVED">熟人特批免押发设备</option>
          </select>
        </label>
      </div>
      <label>下发受限传片子账号 <span class="req">*</span><input name="upstream_upload_account" value="lj_sub_${a.code.toLowerCase()}" required /></label>
      <label>绑定归因设备编号清单（逗号分隔，小优据此认账） <span class="req">*</span><input name="bound_device_ids" placeholder="如：EGO-ZK-01, EGO-ZK-02" required /></label>
      <label>传片通道注意说明<input name="upload_channel_note" value="仅限传片，审核评估与预估收益均在凌矩平台查看" /></label>
      <div class="row-end">
        <button type="button" class="btn btn-danger" id="btnRejectAsg">拒绝</button>
        <button type="submit" class="btn btn-primary">批准锁单（进入首件期）</button>
      </div>
    </form>
  `, (body) => {
    const send = async (decision) => {
      try {
        await api(`/api/admin/assignments/${id}/decision`, {
          method: 'POST', body: JSON.stringify({ decision, ...Object.fromEntries(new FormData(body.querySelector('#drawerApproveAsg')).entries()) }),
        });
        closeDrawer();
        toast(decision === 'APPROVE' ? '已绑定设备并进入 1–2h 首件期' : '已拒绝申请');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
    body.querySelector('#drawerApproveAsg').onsubmit = (e) => { e.preventDefault(); send('APPROVE'); };
    body.querySelector('#btnRejectAsg').onclick = () => send('REJECT');
  }, a.project_title);
};

window.openReviewFPDrawer = (id) => {
  openDrawer('审核 1–2h 首件样本', `
    <form id="drawerReviewFP" class="stack-md">
      <label>审核结论备注<textarea name="review_note" rows="3" placeholder="填写首件过审备注或打回整改原因"></textarea></label>
      <div class="row-end">
        <button type="button" class="btn btn-danger" id="btnRejectFP">打回重提</button>
        <button type="submit" class="btn btn-primary">首件合格 · 点亮批量绿灯</button>
      </div>
    </form>
  `, (body) => {
    const send = async (decision) => {
      try {
        await api(`/api/admin/assignments/${id}/first-piece-review`, {
          method: 'POST', body: JSON.stringify({ decision, review_note: body.querySelector('[name=review_note]').value }),
        });
        closeDrawer();
        toast(decision === 'APPROVE_GREEN_LIGHT' ? '已点亮批量绿灯！' : '已打回整改');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
    body.querySelector('#drawerReviewFP').onsubmit = (e) => { e.preventDefault(); send('APPROVE_GREEN_LIGHT'); };
    body.querySelector('#btnRejectFP').onclick = () => send('REJECT_RETRY');
  });
};

window.openIngestQaDrawer = () => {
  const prjOpts = state.admin.projects.map((p) => `<option value="${p.id}">${esc(p.code)} · ${esc(p.title)}</option>`).join('');
  openDrawer('导入 / 模拟小优从上游抓取 QA 数据', `
    <form id="drawerIngestQa" class="stack-md">
      <label>选择所属项目 <span class="req">*</span><select name="project_id" required>${prjOpts}</select></label>
      <label>粘贴甲方导出行（格式：<code>上游批次, 设备号或子账号, 日期, 收到小时, 有效小时, 原始Bad标签</code>） <span class="req">*</span>
        <textarea name="csv_text" rows="5" required placeholder="UP-1126-A, EGO-PDS-01, 2026-11-26, 15.0, 13.0, HAND_OUT; BLUR"></textarea>
      </label>
      <div class="small muted">系统将按绑定设备号自动匹配代理团队，把原始标签翻译成大白话整改建议，并自动算出脱敏预估净收益回写代理端。</div>
      <div class="row-end"><button type="submit" class="btn btn-primary">解析并回流写入平台</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerIngestQa').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const res = await api('/api/admin/xiaoyou/ingest', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
        closeDrawer();
        toast(`小优已成功回流解析 ${res.imported.length} 批数据`);
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  });
};

window.openVerifyQaDrawer = (id) => {
  const r = state.admin.qaReports.find((x) => x.id === id);
  if (!r) return;
  const asgOpts = state.admin.assignments.filter((a) => a.project_id === r.project_id).map((a) => `<option value="${a.id}" ${a.id===r.assignment_id?'selected':''}>${esc(a.code)} · ${esc(a.agent_name)}</option>`).join('');
  openDrawer(`核对小优回流评估 · ${r.code}`, `
    <form id="drawerVerifyQa" class="stack-md">
      <label>归因派单（小优自动匹配，可改）<select name="assignment_id"><option value="">暂未归因</option>${asgOpts}</select></label>
      <div class="grid-2">
        <label>核定有效小时<input type="number" step="0.1" name="valid_hours" value="${r.valid_hours}" /></label>
        <label>核对状态
          <select name="verify_status">
            <option value="ADMIN_VERIFIED" ${r.verify_status==='ADMIN_VERIFIED'?'selected':''}>总控已核定</option>
            <option value="AI_SYNCED_PENDING_CHECK" ${r.verify_status==='AI_SYNCED_PENDING_CHECK'?'selected':''}>待核对</option>
            <option value="DISPUTED" ${r.verify_status==='DISPUTED'?'selected':''}>争议复核中</option>
          </select>
        </label>
      </div>
      ${!r.linked_daily_log_id ? '<label class="ack-box"><input type="checkbox" name="push_to_settlement" checked /><span>核定通过后自动生成一笔「待甲方回款」背靠背结算批次</span></label>' : '<div class="unlock-bar">该记录已关联进入财务背靠背台账</div>'}
      <div class="row-end"><button type="submit" class="btn btn-primary">确认保存</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerVerifyQa').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      payload.push_to_settlement = fd.get('push_to_settlement') === 'on';
      try {
        await api(`/api/admin/xiaoyou/reports/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        closeDrawer();
        toast('小优 QA 评估已核定');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  });
};

window.openAdminLogDrawer = (id) => {
  const l = state.admin.logs.find((x) => x.id === id);
  if (!l) return;
  openDrawer(`QA 核销与背靠背结算 · #${l.id}`, `
    <form id="drawerLogForm" class="stack-md">
      <div class="small muted">${esc(l.agent_name)} · 上传 ${l.uploaded_hours}h · 批次 ${esc(l.batch_ref || '无')}</div>
      <div class="grid-2">
        <label>甲方 QA 判定
          <select name="qa_status"><option value="PENDING_QA" ${l.qa_status==='PENDING_QA'?'selected':''}>待审核</option><option value="QA_CONFIRMED" ${l.qa_status==='QA_CONFIRMED'?'selected':''}>已确认有效</option><option value="QA_REJECTED" ${l.qa_status==='QA_REJECTED'?'selected':''}>整批无效</option></select>
        </label>
        <label>甲方确认有效小时<input type="number" step="0.1" name="qa_valid_hours" value="${l.qa_valid_hours}" /></label>
      </div>
      <label>背靠背账期推进
        <select name="settlement_stage">
          <option value="PENDING_QA" ${l.settlement_stage==='PENDING_QA'?'selected':''}>待甲方 QA 核定</option>
          <option value="PENDING_CLIENT_PAYMENT" ${l.settlement_stage==='PENDING_CLIENT_PAYMENT'?'selected':''}>待甲方回款</option>
          <option value="CLIENT_PAID_READY_TO_SETTLE" ${l.settlement_stage==='CLIENT_PAID_READY_TO_SETTLE'?'selected':''}>甲方已回款·待结代理</option>
          <option value="SETTLED_PAID" ${l.settlement_stage==='SETTLED_PAID'?'selected':''}>已打款（必填回单号）</option>
        </select>
      </label>
      <div class="grid-2">
        <label>场景方场地费(元)<input type="number" step="0.01" name="venue_fee_cny" value="${l.venue_fee_cny}" /></label>
        <label>公户转账回单号<input name="payout_receipt_ref" value="${esc(l.payout_receipt_ref)}" placeholder="标记已打款必填" /></label>
      </div>
      <label>QA 扣减原因备注<input name="qa_reject_reason" value="${esc(l.qa_reject_reason)}" /></label>
      <div class="row-end"><button type="submit" class="btn btn-primary">保存核销</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerLogForm').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(`/api/admin/logs/${id}`, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
        closeDrawer();
        toast('台账已保存');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  });
};

window.openResolveEscalationDrawer = (id) => {
  const t = state.admin.escalations.find((x) => x.id === id);
  if (!t) return;
  openDrawer(`督导处理升级工单 · ${t.code}`, `
    <form id="drawerResolveEsc" class="stack-md">
      <div class="redline-strip">${SVG.alert}<div>${esc(t.summary)}</div></div>
      <label>工单状态
        <select name="status"><option value="RESOLVED" ${t.status==='RESOLVED'?'selected':''}>已解决并回复代理</option><option value="IN_PROGRESS" ${t.status==='IN_PROGRESS'?'selected':''}>与甲方沟通跟进中</option></select>
      </label>
      <label>人工督导答复结论（将直接推回代理的专属小优窗口） <span class="req">*</span>
        <textarea name="resolution_note" rows="3" required>${esc(t.resolution_note)}</textarea>
      </label>
      <div class="row-end"><button type="submit" class="btn btn-primary">提交处理结果</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerResolveEsc').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(`/api/admin/escalations/${id}`, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
        closeDrawer();
        toast('已答复并更新工单状态');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  }, `${t.agent_name} · ${t.project_title}`);
};

window.openCreateAgentDrawer = () => {
  openDrawer('核验发放新代理账号', `
    <form id="drawerAgentForm" class="stack-md">
      <div class="grid-2">
        <label>登录账号 <span class="req">*</span><input name="username" required /></label>
        <label>初始密码(>=6位) <span class="req">*</span><input name="password" required /></label>
      </div>
      <label>团队名称 <span class="req">*</span><input name="display_name" required /></label>
      <div class="grid-2">
        <label>开票主体<select name="entity_type"><option value="enterprise_vat">企业主体（可开票）</option><option value="sole_proprietor">个体工商户</option><option value="personal_captain">个人团长（代征扣税）</option></select></label>
        <label>代征扣税率<input type="number" step="0.01" name="tax_deduction_rate" value="0" /></label>
      </div>
      <div class="grid-2">
        <label>押金状态<select name="deposit_status"><option value="PAID">已缴设备押金</option><option value="CORPORATE_GUARANTEE">企业担保</option><option value="ACQUAINTANCE_WAIVED">熟人特批免押</option><option value="UNPAID">未缴押金</option></select></label>
        <label>押金金额(元)<input type="number" name="deposit_amount_cny" value="0" /></label>
      </div>
      <div class="grid-2">
        <label>城市<input name="city" /></label>
        <label>验真人数<input type="number" name="verified_headcount" value="5" /></label>
      </div>
      <div class="row-end"><button type="submit" class="btn btn-primary">确认发号</button></div>
    </form>
  `, (body) => {
    body.querySelector('#drawerAgentForm').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/api/admin/agents', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target).entries())) });
        closeDrawer();
        toast('新代理已发放');
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

window.openClaimProjectDrawer = (projectId) => {
  const p = state.agent.projects.find((x) => x.id === projectId);
  if (!p) return;
  const sceneOptions = state.agent.scenes.map((s) => `<option value="${s.id}">${esc(s.code)} · ${esc(s.city)} ${esc(s.category)}</option>`).join('') || '<option value="">当前暂无可用平台脱敏场景</option>';
  openDrawer('申领整包项目配额切片', `
    <form id="drawerClaimForm" class="stack-md">
      <div class="unlock-bar"><div><strong>${esc(p.title)}</strong><br/>当前可切分剩余配额：<strong>${p.remaining_quota_hours}h</strong> ｜ 自带 ¥${p.agent_rate_own_scene_cny}/h ｜ 平台 ¥${p.agent_rate_platform_scene_cny}/h</div></div>
      <div class="grid-2">
        <label>拟申领配额小时数 <span class="req">*</span><input type="number" min="10" max="${p.remaining_quota_hours}" name="quota_hours_requested" value="${Math.min(200, p.remaining_quota_hours)}" required /></label>
        <label>承接场景模式 <span class="req">*</span>
          <select name="mode" id="dClaimMode"><option value="OWN_SCENE">自有当地场景（¥${p.agent_rate_own_scene_cny}/h）</option><option value="PLATFORM_SCENE">匹配同城平台场景（¥${p.agent_rate_platform_scene_cny}/h）</option></select>
        </label>
      </div>
      <label id="dOwnField">自有场地城市与团队人员说明 <span class="req">*</span><textarea name="own_scene_desc" rows="2"></textarea></label>
      <label id="dPlatField" class="hidden">选择平台可用脱敏场景 <span class="req">*</span><select name="scene_id">${sceneOptions}</select></label>
      <label class="ack-box"><input type="checkbox" name="agreement_signed" required /><span><strong>铁律确认：</strong>绝不跳单或二道转包、严格绑定分配设备传片、严格先过 1–2h 首件绿灯再放量、仅在凌矩平台查看评估并认可背靠背结算。</span></label>
      <div class="row-end"><button type="submit" class="btn btn-primary">提交配额申请</button></div>
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
      payload.project_id = projectId;
      payload.agreement_signed = fd.get('agreement_signed') === 'on';
      try {
        await api('/api/agent/assignments', { method: 'POST', body: JSON.stringify(payload) });
        closeDrawer();
        toast('配额申请已提交，等待总控审批并绑定设备号');
        await refreshWorkspaceData();
        go('delivery', 'trial');
      } catch (err) { toast(err.message, true); }
    };
  });
};

window.ackRuleRevision = async (revId) => {
  try {
    await api(`/api/agent/revisions/${revId}/ack`, { method: 'POST' });
    toast('已签收最新规则版本');
    await refreshWorkspaceData();
    renderWorkspace();
  } catch (e) { toast(e.message, true); }
};

window.openXiaoYouChatDrawer = async (projectId, projectTitle) => {
  openDrawer('本项目专属小优助手', '<div class="small muted">加载会话中...</div>', async (body) => {
    const loadThread = async () => {
      const res = await api(`/api/agent/ai-chat?project_id=${projectId}`);
      const msgsHtml = res.messages.length ? res.messages.map((m) => `
        <div class="chat-msg ${m.sender}">
          <div class="chat-sender">${m.sender === 'agent' ? '我方团队' : (m.sender === 'human_cs' ? '凌矩人工督导' : '专属项目小优')}</div>
          <div>${esc(m.content)}</div>
        </div>
      `).join('') : '<div class="small muted">您可以问我：最新规则红线、传片账号与绑定设备号、最近无效原因和预估收益；也可随时输入“转人工”。</div>';

      body.innerHTML = `
        <div class="chat-box">
          <div class="chat-thread" id="chatThreadBox">${msgsHtml}</div>
          <form id="drawerAiForm" class="stack-sm">
            <div class="row-gap" style="flex-wrap:nowrap;">
              <input name="content" id="aiChatInput" placeholder="输入动作疑问、传片报错或“申诉/转人工”..." required />
              <button type="submit" class="btn btn-primary">发送</button>
            </div>
            <div class="row-gap">
              <button type="button" class="btn btn-sm btn-secondary" data-q="请告诉我怎么上传以及绑定了哪些设备号？">查传片与设备</button>
              <button type="button" class="btn btn-sm btn-secondary" data-q="最近批次无效原因和预估收益是多少？">查最近QA评估</button>
              <button type="button" class="btn btn-sm btn-danger" data-q="这个问题需要转人工督导协助核查处理">一键转人工督导</button>
            </div>
          </form>
        </div>
      `;
      const thr = body.querySelector('#chatThreadBox');
      thr.scrollTop = thr.scrollHeight;
      body.querySelectorAll('[data-q]').forEach((b) => {
        b.onclick = () => { body.querySelector('#aiChatInput').value = b.dataset.q; body.querySelector('#drawerAiForm').requestSubmit(); };
      });
      body.querySelector('#drawerAiForm').onsubmit = async (e) => {
        e.preventDefault();
        const content = body.querySelector('#aiChatInput').value.trim();
        if (!content) return;
        try {
          const out = await api('/api/agent/ai-chat', { method: 'POST', body: JSON.stringify({ project_id: projectId, content }) });
          if (out.escalated) toast(`已触发人工升级工单 ${out.ticket_code}`);
          await loadThread();
        } catch (err) { toast(err.message, true); }
      };
    };
    await loadThread();
  }, projectTitle);
};

window.openSopDrawer = (asgId) => {
  const a = state.agent.assignments.find((x) => x.id === asgId);
  if (!a) return;
  openDrawer(`已解锁内部 SOP · ${a.code}`, `<div class="stack-md"><div class="redline-strip">${SVG.alert}<div><strong>QA 红线：</strong>${esc(a.qa_red_lines)}</div></div><pre class="sop-pre">${esc(a.sop_full_internal)}</pre></div>`, null, a.project_title);
};

window.openSubmitLogDrawer = (asgId, logType) => {
  const a = state.agent.assignments.find((x) => x.id === asgId);
  if (!a) return;
  const isFp = logType === 'FIRST_PIECE';
  openDrawer(isFp ? `提交首件样本（上限 ${a.first_piece_max_hours}h）` : `提交今日批量日报 · ${a.code}`, `
    <form id="drawerSubmitLog" class="stack-md">
      <div class="grid-2">
        <label>采集日期 <span class="req">*</span><input type="date" name="log_date" value="${new Date().toISOString().slice(0,10)}" required /></label>
        <label>开工设备数 <span class="req">*</span><input type="number" min="1" name="devices_used" value="${isFp ? 1 : 3}" required /></label>
      </div>
      <div class="grid-2">
        <label>原始录制小时 <span class="req">*</span><input type="number" step="0.1" ${isFp ? `max="${a.first_piece_max_hours}"` : ''} name="raw_hours" value="${isFp ? 1.5 : ''}" required /></label>
        <label>已上传小时 <span class="req">*</span><input type="number" step="0.1" name="uploaded_hours" value="${isFp ? 1.5 : ''}" required /></label>
      </div>
      <label>上传批次/设备前缀<input name="batch_ref" placeholder="${a.bound_device_ids[0] || '如：EGO-PDS-01-1126'}" /></label>
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
        toast(isFp ? '首件已提交，等待点亮绿灯' : '今日批量日报已提交');
        await refreshWorkspaceData();
        renderWorkspace();
      } catch (err) { toast(err.message, true); }
    };
  }, a.project_title);
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
