const store = require('../../lib/storage');
const { stamp, MINUTE, TASKS } = require('../../lib/catalog');
const { ownedOrder, stationFor, requireThat } = require('../../lib/model');
const booking = require('../../lib/booking');
const reviews = require('../../lib/reviews');
const ui = require('../../lib/ui');

const STEPS = ['预约', '到店', '采集', '归还'];
const PROGRESS = { booked: 1, travel: 1, arrived: 2, collecting: 2, stopped: 3, submitted: 3, done: 4 };

const GUIDANCE = {
  travel: { title: '准备前往站点', detail: '点「地图导航」查看目的地。到店后按订单指引签到、自助领机。' },
  arrive: { title: '到店签到', detail: '到达预约站点后签到。请在预约时间内领取设备。' },
  collect: { title: '自助领机并采集', detail: '打开本单密码箱，按采集 SOP 操作。只在门店授权的示范区采集。' },
  return: { title: '放回原箱并锁好', detail: '确认设备已放回，再提交归还和模拟上传。凌矩随后核验设备。' }
};

function instructions(order, mainAction) {
  if (order.submittedAt || !order.active) return null;
  if (order.canCancel && (order.impact || order.closed)) {
    return { title: '处理预约变更', detail: '可以从底部选择其他时段，也可以无责取消或提交求助。' };
  }
  if (order.status === 'collecting') {
    const detail = mainAction.advanceTo
      ? '点「模拟完成采集」会推进至 ' + order.endTime + '，记录模拟采集时长。随后可提交归还。'
      : '请于 ' + order.endTime + ' 前停止采集，再将设备放回原箱。';
    return { title: '按 SOP 完成采集', detail };
  }
  if (mainAction) {
    const guidance = GUIDANCE[mainAction.action];
    return mainAction.advanceTo
      ? { ...guidance, detail: '本次模拟操作会把时钟推进到预约开始 ' + order.startTime + '。' }
      : guidance;
  }
  if (order.handoffBlock) {
    return { title: '等待设备可用', detail: order.handoffBlock + ' 可以刷新订单查看进展，也可以改约或联系凌矩。' };
  }
  return order.status === 'arrived'
    ? { title: '等待预约开始', detail: '预约于 ' + order.startTime + ' 开始，届时可自助领机。' }
    : { title: '按预约时间到店', detail: '预约开始前15分钟可签到。请核对上方站点和时间。' };
}

function orderResult(state, order) {
  if (!order.submittedAt) return null;
  const entries = state.earnings.filter(item => item.party === order.collectorId && item.orderId === order.id
    && ['capture', 'qaAdjustment'].includes(item.kind));
  const confirmed = entries.reduce((total, item) => total + item.cents, 0);
  const inReview = order.qaAppeal && order.qaAppeal.status === 'pending';
  let qaLabel = order.uploadedAt ? '待审核' : '等待上传';
  if (order.qa) qaLabel = inReview ? '部分工时复核中' : '已审核';
  else if (!order.actual) qaLabel = '无采集时长';
  return {
    deviceLabel: order.status === 'done' ? '已核验归还' : '已提交 · 待核验',
    uploadLabel: order.uploadedAt ? '已模拟上传' : '模拟上传失败',
    qaLabel,
    earningsLabel: entries.length ? '已确认 · 待结算' : order.uploadFailed ? '上传后进入质检'
      : order.actual && !order.qa ? '质检后确认' : '暂无确认报酬',
    amount: entries.length ? '¥' + ui.money(confirmed) + '（虚构）' : ''
  };
}

function orderTimeline(order) {
  return [
    ['预约确认', order.createdAt], ['到店签到', order.arrivedAt],
    ['提交归还', order.submittedAt], ['采集记录上传', order.uploadedAt],
    ['凌矩核验归还', order.verifiedAt], ['凌矩质检', order.qa && order.qa.at]
  ].filter(([, at]) => at).sort((a, b) => a[1] - b[1])
    .map(([label, at]) => ({ label, at: stamp(at) }));
}

Page({
  data: { reportPhoto: false, steps: STEPS, mainAction: null, showDemo: false, showIssue: false, showSop: false, showGuide: false,
    issueKind: 'device', issueDetails: '', canSendIssue: false, failUpload: false },
  onLoad(options) {
    this.id = options.id;
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    const state = store.read();
    const order = state.orders.find(item => item.id === this.id && item.collectorId === state.collector);
    if (!order) {
      this.setData({ missing: true, order: null, mainAction: null });
      return;
    }
    const view = ui.presentOrder(state, order);
    const mainAction = ui.nextAction(view);
    const issueTypes = booking.ISSUE_TYPES.filter(type => !type.device || view.canReport);
    const issueIndex = Math.max(0, issueTypes.findIndex(type => type.id === this.data.issueKind));
    const reports = state.reports.filter(item => item.orderId === order.id).map(item => ({
      ...item, label: booking.issueType(item).label, time: stamp(item.at),
      statusLabel: item.status === 'pending' ? '待凌矩处理' : item.status === 'verified' ? '已核实设备异常' : '已回复'
    }));
    this.setData({ missing: false, order: view, now: stamp(state.now), mainAction,
      step: PROGRESS[order.status] ?? -1, guidance: instructions(view, mainAction), result: orderResult(state, order),
      guide: ui.siteGuide(stationFor(state, order.stationId), order.date, view.active),
      timeline: orderTimeline(order), issueTypes, issueIndex, reports,
      pendingReport: reports.some(item => item.status === 'pending'),
      taskSteps: TASKS[order.task].steps,
      canJumpStart: view.active && state.now < view.startAt,
      canJumpEnd: order.status === 'collecting',
      canJumpOverdue: ['stopped', 'submitted'].includes(order.status) && state.now < view.endAt + 30 * MINUTE });
  },
  copyAddress: ui.copyAddress,
  openMap: ui.openMap,
  perform(event) {
    const action = event.currentTarget.dataset.action;
    const saved = ui.commit(this, state => {
      const order = ownedOrder(state, state.collector, this.id);
      const view = ui.presentOrder(state, order);
      const next = ui.nextAction(view);
      if (action !== 'upload') requireThat(next && next.action === action,
        view.handoffBlock || '订单状态已更新，请按页面显示的步骤继续。');
      if (next && next.action === action && next.advanceTo) {
        ui.advanceClock(state, next.advanceTo);
        if (action === 'stop') return order;
      }
      return booking.perform(state, state.collector, this.id, action, action === 'return' && this.data.failUpload);
    });
    if (!saved) this.refresh();
  },
  refreshOrder() {
    this.refresh();
    wx.showToast({ title: '订单状态已刷新', icon: 'none' });
  },
  openReplacement() {
    wx.redirectTo({ url: '/pages/order/index?id=' + this.data.order.replacedBy });
  },
  failUpload(event) {
    this.setData({ failUpload: event.detail.value });
  },
  cancel() {
    if (this.data.order.lateCancel) {
      ui.inputPrompt('取消预约', '距离开始不足2小时，请填写原因', reason => {
        ui.commit(this, state => booking.cancel(state, state.collector, this.id, reason));
      });
      return;
    }
    wx.showModal({
      title: '取消模拟预约', content: '释放所选时间，停止后续预约提醒。',
      success: result => {
        if (result.confirm) ui.commit(this, state => booking.cancel(state, state.collector, this.id, '采集员取消预约'));
      }
    });
  },
  reschedule() {
    wx.redirectTo({ url: '/pages/collector/index?replace=' + this.id });
  },
  toggleDemo() {
    this.setData({ showDemo: !this.data.showDemo });
  },
  toggleSop() {
    this.setData({ showSop: !this.data.showSop });
  },
  toggleGuide() {
    this.setData({ showGuide: !this.data.showGuide });
  },
  toggleIssue() {
    if (this.data.pendingReport) {
      wx.pageScrollTo({ selector: '#order-issue', duration: 220 });
      return;
    }
    const showIssue = !this.data.showIssue;
    this.setData({ showIssue }, () => {
      if (showIssue || this.data.reports.length) wx.pageScrollTo({ selector: '#order-issue', duration: 220 });
    });
  },
  jumpTo(event) {
    const { startAt, endAt } = this.data.order;
    const target = event.currentTarget.dataset.target;
    ui.advance(this, target === 'start' ? startAt : target === 'end' ? endAt : endAt + 30 * MINUTE);
  },
  reportPhoto(event) {
    this.setData({ reportPhoto: event.detail.value });
  },
  issueType(event) {
    const type = this.data.issueTypes[Number(event.detail.value)];
    if (type) this.setData({ issueKind: type.id, issueIndex: Number(event.detail.value) });
  },
  issueDetails(event) {
    const issueDetails = event.detail.value;
    this.setData({ issueDetails, canSendIssue: Boolean(issueDetails.trim()) });
  },
  reportIssue() {
    const type = this.data.issueTypes[this.data.issueIndex];
    ui.commit(this, state => booking.report(state, state.collector, this.id, this.data.issueDetails, this.data.reportPhoto, type.id), () => {
      this.setData({ showIssue: false, reportPhoto: false, issueDetails: '', canSendIssue: false });
      wx.showToast({ title: '求助已提交', icon: 'success' });
    });
  },
  applySubsidy() {
    const options = ['模拟行程凭证'];
    if (this.data.order.arrivedAt) options.push('模拟到店凭证');
    wx.showActionSheet({
      itemList: options,
      success: result => ui.commit(this, state => reviews.applySubsidy(state, state.collector, this.id, result.tapIndex ? 'arrival' : 'route'))
    });
  },
  appealSubsidy() {
    ui.inputPrompt('模拟补贴申诉', '补充模拟行程或现场证据',
      reason => ui.commit(this, state => reviews.appealSubsidy(state, state.collector, this.id, reason)));
  },
  appealQA() {
    ui.inputPrompt('申请模拟质检复核', '填写异议及对应模拟工时线索',
      reason => ui.commit(this, state => reviews.appealQA(state, state.collector, this.id, reason)));
  },
  home() {
    wx.reLaunch({ url: '/pages/collector/index' });
  }
});
