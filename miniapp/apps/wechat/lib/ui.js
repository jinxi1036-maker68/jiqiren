const { TASKS, CITY, DEMO_MAP_POINTS, DEMO_GUIDES, stamp, timeLabel, HOUR, MINUTE, at } = require('./catalog');
const { stationFor, preStart, holding, credit, windows } = require('./model');
const booking = require('./booking');
const reviews = require('./reviews');
const store = require('./storage');

const STAGES = { draft: '尚未申请', review: '待审核', supplement: '需要补充资料', rejected: '暂不通过',
  approved: '审核通过 · 待安装', installed: '待商家确认设备到位', schedule: '待设置开放时间', open: '已部署' };
const STATUSES = { booked: '已确认', travel: '前往中', arrived: '已到店', collecting: '采集中', stopped: '已停采 · 待归还',
  submitted: '已提交归还', done: '归还完成', cancelled: '已取消', missed: '到期未采集' };
const ORDER_TONES = { booked: 'ready', travel: 'active', arrived: 'active', collecting: 'active',
  stopped: 'wait', submitted: 'wait', done: 'ready', cancelled: 'quiet', missed: 'quiet' };
const KINDS = { venue: '场地收益', capture: '采集报酬', qaAdjustment: '质检复核补充', subsidy: '交通补贴' };
const PROGRESS = { pending: '待审核', approved: '待发放补贴', rejected: '已拒绝 · 可申诉', appealed: '申诉待复核', final: '复核未通过' };

function money(cents) {
  return (cents / 100).toFixed(2);
}

function listing(state, station, date, actor, replaceId, slots = booking.availability(state, actor, station.id, date, replaceId)) {
  const task = TASKS[station.task];
  const ranges = windows(station, date);
  let availabilityReason = '';
  if (!slots.length) {
    if (station.stage !== 'open' || !station.taskEnabled || !station.device) availabilityReason = '站点或任务尚未开放';
    else if (station.device.fault) availabilityReason = '设备暂停检修';
    else if (station.device.overdue.length) availabilityReason = '设备待核验归还';
    else if (!ranges.length) availabilityReason = '门店当天未开放';
    else if (!credit(state, actor).allowed) availabilityReason = '当前采集员暂不可预约';
    else availabilityReason = '当天暂无合规空档';
  }
  return { ...station, ...task, rate: money(task.hourlyCents), opening: rangeText(ranges),
    openCount: slots.length, earliest: slots.length ? timeLabel(slots[0].start) : '—', availabilityReason };
}

function rangeText(ranges) {
  return ranges.map(([from, to]) => timeLabel(from) + '–' + timeLabel(to)).join(' / ') || '暂停开放';
}

function siteGuide(station, date, booked = false) {
  const details = station.guide || DEMO_GUIDES[station.id] || {};
  const pin = DEMO_MAP_POINTS[station.district];
  return {
    name: station.name, address: [CITY, station.district, station.address].filter(Boolean).join(' · '),
    opening: rangeText(windows(station, date)),
    entrance: details.entrance || '入口说明待凌矩补充。',
    area: details.area || '采集区域待凌矩补充。',
    mapPoint: pin ? { ...pin, name: station.name + ' · 导航示例点', address: '平顶山地图演示坐标，请勿据此实际到店' } : null,
    locker: booked ? details.locker || '箱位待凌矩补充，请从本单求助。' : ''
  };
}

function copyAddress() {
  wx.setClipboardData({ data: this.data.guide.address,
    fail: () => wx.showToast({ title: '复制失败，请查看上方地址', icon: 'none' }) });
}

function openMap() {
  const { mapPoint } = this.data.guide;
  if (!mapPoint) return;
  const fail = () => wx.showModal({
    title: '无法打开地图', content: '请在手机微信的预览中重试。到店指引仍可查看。', showCancel: false
  });
  if (typeof wx.openLocation !== 'function') {
    fail();
    return;
  }
  wx.openLocation({ ...mapPoint, scale: 17, fail });
}

function presentOrder(state, order) {
  const station = stationFor(state, order.stationId);
  const startAt = at(order.date, order.start);
  const endAt = at(order.date, order.end);
  const before = preStart(order);
  const active = before || holding(order);
  const handoffBlock = before || order.status === 'collecting' ? booking.handoffBlock(state, order) : '';
  const affected = before && Boolean(order.impact || order.closed);
  const canUse = !handoffBlock;
  const cancelled = order.cancellation;
  const subsidy = order.subsidy;
  const valid = order.qa ? order.qa.valid + (order.qaAppeal && order.qaAppeal.result ? order.qaAppeal.result.extra : 0) : null;
  return { ...order, stationName: station.name, device: station.device.id, taskName: TASKS[order.task].title,
    interval: order.date + ' ' + timeLabel(order.start) + '–' + timeLabel(order.end), startAt, endAt,
    stationAddress: station.district + ' · ' + station.address, startTime: timeLabel(order.start), endTime: timeLabel(order.end),
    stateLabel: affected ? '待处理' : order.suspected && before && !order.arrivedAt ? '疑似爽约' : STATUSES[order.status],
    stateTone: affected || (order.overdue && holding(order)) ? 'risk' : before && (handoffBlock || order.suspected)
      ? 'wait' : ORDER_TONES[order.status],
    handoffBlock, firstStep: order.status === 'booked' && canUse && state.now < endAt,
    arrive: ['booked', 'travel'].includes(order.status) && canUse && state.now >= startAt - 15 * MINUTE && state.now < endAt,
    startCollect: order.status === 'arrived' && canUse && state.now >= startAt && state.now < endAt,
    canSimulateStart: canUse && state.now < startAt,
    canSimulateEnd: order.status === 'collecting' && state.now - order.startedAt < MINUTE && state.now < endAt,
    canCancel: before, canReschedule: !order.replacedBy && (before || order.status === 'cancelled'),
    canReport: active, active, canApply: !subsidy && reviews.eligibleSubsidy(state, order),
    showCode: (before || order.status === 'collecting') && canUse && state.now < endAt,
    cancelText: cancelled ? cancelled.reason : '',
    lateCancel: before && !order.closed && !order.impact && startAt - state.now < 2 * HOUR,
    qaRate: valid === null ? '' : Math.round(valid * 100 / order.actual) + '%', valid,
    subsidyStatus: subsidy ? PROGRESS[subsidy.status] : '', subsidyAmount: subsidy ? money(subsidy.rule.cents) : '',
    subsidyReason: subsidy && subsidy.appeal && subsidy.appeal.decision ? subsidy.appeal.decision.reason
      : subsidy && subsidy.decision ? subsidy.decision.reason : '',
    canAppealSubsidy: subsidy && subsidy.status === 'rejected' && state.now <= subsidy.decision.at + 72 * HOUR };
}

function nextAction(order) {
  if (order.firstStep) return { action: 'travel', label: '模拟开始前往' };
  if (order.startCollect || (order.status === 'arrived' && order.canSimulateStart)) {
    return { action: 'collect', label: '模拟自助领机并开始采集', advanceTo: order.startCollect ? null : order.startAt };
  }
  if (order.arrive || (order.status === 'travel' && order.canSimulateStart)) {
    return { action: 'arrive', label: '模拟到店签到', advanceTo: order.arrive ? null : order.startAt };
  }
  if (order.status === 'collecting') {
    return { action: 'stop', label: order.canSimulateEnd ? '模拟完成采集' : '停止采集',
      advanceTo: order.canSimulateEnd ? order.endAt : null };
  }
  if (order.status === 'stopped') return { action: 'return', label: '提交归还并模拟上传' };
  return null;
}

function ledger(state, actor, period) {
  return state.earnings.filter(item => item.party === actor && item.period === period).map(item => ({
    ...item, kindLabel: KINDS[item.kind], amount: item.cents === null ? '金额待协议确认' : '¥' + money(item.cents) + '（虚构）'
  }));
}

function income(state, actor, period) {
  let estimated = 0;
  let pending = 0;
  let pendingCount = 0;
  const orders = state.orders.filter(order => order.collectorId === actor);
  for (const order of orders) {
    if (order.status === 'cancelled' || order.status === 'missed') continue;
    if (!order.uploadedAt && order.date.startsWith(period)) estimated += (order.end - order.start) * order.hourlyCents / 60;
    if (order.uploadedAt && order.actual > 0 && !order.qa && order.date.slice(0, 7) <= period && period <= reviews.month(state.now)) {
      pending += order.actual * order.hourlyCents / 60;
      pendingCount++;
    }
  }
  const entries = ledger(state, actor, period);
  const confirmed = entries.filter(item => item.kind !== 'subsidy').reduce((total, item) => total + item.cents, 0);
  return { estimated: money(Math.round(estimated)), pending: money(Math.round(pending)), confirmed: money(confirmed), pendingCount, entries };
}

function inbox(state, actor) {
  return state.messages.filter(item => item.recipient === actor).sort((a, b) => b.at - a.at)
    .map(item => ({ ...item, time: stamp(item.at) }));
}

function profile(state, actor) {
  const result = credit(state, actor);
  const events = state.violations.filter(item => item.collectorId === actor).slice().reverse().map(item => ({
    ...item, time: stamp(item.at), canAppeal: item.fault && !item.appeal && state.now <= item.at + 72 * HOUR
  }));
  return { ...result, events, label: result.score < 60 ? (result.allowed ? '人工审核通过' : '新预约受限') : result.score < 80 ? '信誉预警' : '正常预约' };
}

function errorToast(error) {
  wx.showModal({ title: '暂时无法执行', content: error.message || '请重试', showCancel: false });
}

function commit(page, action, success) {
  if (page.busy) return false;
  page.busy = true;
  try {
    const result = store.change(action);
    if (page.refresh) page.refresh();
    if (success) success(result);
    return true;
  } catch (error) {
    errorToast(error);
    return false;
  } finally {
    page.busy = false;
  }
}

function inputPrompt(title, placeholder, callback) {
  wx.showModal({
    title, editable: true, placeholderText: placeholder, confirmText: '提交',
    success(result) { if (result.confirm) callback(result.content || ''); }
  });
}

function switchRole() {
  wx.reLaunch({ url: '/pages/home/index?choose=1' });
}

function advanceClock(state, target) {
  booking.advance(state, target);
  reviews.deadlineAlerts(state);
}

function advance(page, target) {
  commit(page, state => advanceClock(state, target));
}

function jump(event) {
  advance(this, store.read().now + Number(event.currentTarget.dataset.delta) * MINUTE);
}

module.exports = { STAGES, money, rangeText, siteGuide, copyAddress, openMap, listing, presentOrder, nextAction, ledger, income, inbox, profile, errorToast, commit,
  inputPrompt, switchRole, advanceClock, advance, jump };
