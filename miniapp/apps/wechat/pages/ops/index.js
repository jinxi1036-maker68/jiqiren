const store = require('../../lib/storage');
const merchant = require('../../lib/merchant');
const experience = require('../../lib/experience');
const booking = require('../../lib/booking');
const reviews = require('../../lib/reviews');
const { TASKS, stamp, HOUR, MINUTE } = require('../../lib/catalog');
const { preStart, holding, byId, record } = require('../../lib/model');
const ui = require('../../lib/ui');

function quantity(value) {
  if (!/^\d+$/.test(value)) throw new Error('请填写整数分钟');
  return Number(value);
}

function pair(value) {
  const boundary = value.indexOf('/');
  if (boundary < 0) throw new Error('请以「分钟数 / 依据」的格式填写');
  return [quantity(value.slice(0, boundary).trim()), value.slice(boundary + 1).trim()];
}

const ACTIONS = {
  site: ['模拟场地审核', '填写审核结论及依据', (s, d, v) => merchant.reviewSite(s, d.id, d.result, v)],
  install: ['登记模拟安装', '', (s, d) => merchant.install(s, d.id)],
  task: ['修改模拟任务状态', '', (s, d) => {
    const station = byId(s.stations, d.id);
    station.taskEnabled = !station.taskEnabled;
    record(s, '凌矩模拟运营', '修改模拟任务状态', d.id, station.taskEnabled ? '开放任务' : '暂停新预约');
  }],
  pause: ['核实故障并暂停设备', '填写虚构的设备故障核查依据', (s, d, v) => booking.pause(s, d.id, v, d.report)],
  resolve: ['回复并结案', '填写核查结论、处理建议或无故障依据', (s, d, v) => booking.resolveReport(s, d.id, v)],
  feedback: ['回复模拟反馈', '填写给用户的处理结果', (s, d, v) => experience.replyFeedback(s, d.id, v)],
  reopen: ['模拟核验设备可用', '填写修复或在箱且可用的模拟依据', (s, d, v) => booking.reopen(s, d.id, v)],
  return: ['模拟核验归还', '填写设备在箱且可用的模拟核验记录', (s, d, v) => booking.verifyReturn(s, d.id, v)],
  cancel: ['运营逐单无责取消', '填写已核查的设备安全或恶意违规依据', (s, d, v) => {
    if (!v.trim()) throw new Error('请提供逐单核查依据');
    booking.cancel(s, '凌矩模拟运营', d.id, v.trim(), true);
  }],
  qa: ['录入模拟QA', '格式：有效分钟 / 无效原因和改进建议', (s, d, v) => reviews.qaReview(s, d.id, ...pair(v))],
  qaAppeal: ['模拟QA复核', '格式：新增有效分钟 / 复核依据。拒绝填0', (s, d, v) => reviews.resolveQA(s, d.id, ...pair(v))],
  subsidy: ['审核模拟补贴', '记录故障和出行证据核查结果', (s, d, v) => reviews.reviewSubsidy(s, d.id, d.result === 'yes', v)],
  price: ['配置虚构补贴金额', '填写人民币元，如 12.50', (s, d, v) => {
    if (!/^\d+(\.\d{1,2})?$/.test(v.trim())) throw new Error('金额最多两位小数');
    reviews.updateSubsidy(s, Math.round(Number(v) * 100), reviews.LEAD);
  }],
  credit: ['核实模拟逾期责任', '格式：逾期分钟 / 模拟核实依据', (s, d, v) => {
    const [delay, reason] = pair(v);
    reviews.evaluateViolation(s, d.id, { delay, reason, fault: d.result !== 'exempt', impact: d.result === 'impact' });
  }],
  creditAppeal: ['复核模拟信誉申诉', '填写凭证与复核结论', (s, d, v) => reviews.resolveCredit(s, d.id, d.result === 'yes', v)],
  eligibility: ['模拟接单资格审核', '填写决定依据及恢复条件', (s, d, v) => reviews.reviewEligibility(s, d.id, d.result === 'yes', v)]
};

function workItem(section, target, label, detail) {
  return { section, target, label, detail };
}

Page({
  data: { section: 'work', lead: false },
  onLoad(options) {
    this.allowed = getApp().opsMode && options.mode === 'mock-ops';
    this.setData({ allowed: this.allowed });
  },
  onShow() {
    if (this.allowed) this.refresh();
  },
  refresh() {
    if (!this.allowed) return;
    const state = store.read();
    const orders = state.orders.map(order => {
      const view = ui.presentOrder(state, order);
      return { ...view, canOpsCancel: preStart(order) || order.status === 'missed',
        qaPending: order.uploadedAt && order.actual > 0 && !order.qa,
        creditPending: order.startedAt && state.now > view.endAt && (order.overdue || order.verifiedAt > view.endAt)
          && !state.violations.some(item => item.orderId === order.id),
        creditImpact: state.orders.some(item => item.cancellation && item.cancellation.outage
          && item.cancellation.outage.sourceId === order.id),
        subsidyPending: order.subsidy && ['pending', 'appealed'].includes(order.subsidy.status),
        subsidyDue: order.subsidy ? stamp(order.subsidy.status === 'appealed' ? order.subsidy.appeal.at + 72 * HOUR : order.subsidy.at + 48 * HOUR) : '' };
    });
    const credits = state.violations.filter(item => item.appeal && item.appeal.status === 'pending')
      .map(item => ({ ...item, due: stamp(item.appeal.at + 72 * HOUR) }));
    const qa = orders.filter(order => order.qaPending || (order.qaAppeal && order.qaAppeal.status === 'pending'));
    const subsidies = orders.filter(order => order.subsidyPending);
    const sites = state.stations.map(station => ({ ...station, label: ui.STAGES[station.stage], taskName: TASKS[station.task].title,
      paused: station.device && Boolean(station.device.fault || station.device.overdue.length) }));
    const reports = state.reports.filter(item => item.status === 'pending').map(item => {
      const type = booking.issueType(item);
      return { ...item, type: type.label, deviceIssue: Boolean(type.device), time: stamp(item.at) };
    }).sort((a, b) => a.at - b.at);
    const late = orders.filter(order => holding(order) && state.now >= order.endAt + 15 * MINUTE)
      .sort((a, b) => a.endAt - b.endAt);
    const feedback = experience.feedbackList(state);
    const work = [
      ...late.map(order => workItem('orders', 'order-' + order.id, '归还逾期',
        order.id + ' · ' + order.stationName + ' · ' + order.stateLabel)),
      ...sites.filter(site => site.paused).map(site => {
        const affected = orders.filter(order => order.stationId === site.id && preStart(order) && order.impact);
        return workItem('orders', 'device-' + site.id, '设备暂停接单', site.name + ' · ' + affected.length + ' 笔预约受影响');
      }),
      ...reports.map(item => workItem('orders', 'report-' + item.id, item.type, item.orderId + ' · ' + item.time + ' · ' + item.details)),
      ...orders.filter(order => order.status === 'submitted' && !late.includes(order))
        .sort((a, b) => a.submittedAt - b.submittedAt)
        .map(order => workItem('orders', 'order-' + order.id, '待核验归还', order.id + ' · ' + order.stationName)),
      ...sites.filter(site => ['review', 'supplement', 'approved'].includes(site.stage))
        .map(site => workItem('sites', 'site-' + site.id, site.label, site.name)),
      ...qa.map(order => workItem('reviews', 'qa-' + order.id, order.qaPending ? '待质检' : '质检待复核', order.id)),
      ...subsidies.map(order => workItem('reviews', 'subsidy-' + order.id, order.subsidyStatus, order.id + ' · ' + order.subsidyDue)),
      ...feedback.filter(item => !item.reply).map(item => workItem('feedback', 'feedback-' + item.id, item.topic, item.name + ' · ' + item.time))
    ];
    this.setData({ now: stamp(state.now), orders, credits, qa, subsidies, sites, work, feedback,
      penalties: orders.filter(order => order.creditPending),
      price: ui.money(state.subsidy.cents), priceVersion: state.subsidy.version,
      people: state.collectors.map(item => {
        const profile = ui.profile(state, item.id);
        return { ...profile, id: item.id, name: item.name, due: profile.review ? stamp(profile.review.at + 48 * HOUR) : '' };
      }),
      reports,
      messages: ui.inbox(state, 'ops').slice(0, 30),
      audit: state.audit.slice(0, 50).map(event => ({ ...event, time: stamp(event.at) })) });
  },
  section(event) {
    this.setData({ section: event.currentTarget.dataset.section });
  },
  openWork(event) {
    const { section, target } = event.currentTarget.dataset;
    this.setData({ section }, () => wx.pageScrollTo({ selector: '#' + target, duration: 200 }));
  },
  lead(event) {
    this.setData({ lead: event.detail.value });
  },
  act(event) {
    if (!this.allowed) return;
    const data = event.currentTarget.dataset;
    if (data.action === 'price' && !this.data.lead) return;
    const [title, placeholder, action] = ACTIONS[data.action];
    if (placeholder) ui.inputPrompt(title, placeholder, value => ui.commit(this, state => action(state, data, value)));
    else ui.commit(this, state => action(state, data));
  },
  jump(event) {
    if (this.allowed) ui.jump.call(this, event);
  },
  viewRole(event) {
    wx.navigateTo({ url: '/pages/' + event.currentTarget.dataset.role + '/index' });
  },
  home: ui.switchRole
});
