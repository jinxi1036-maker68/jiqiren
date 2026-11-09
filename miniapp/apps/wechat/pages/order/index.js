const store = require('../../lib/storage');
const { stamp, MINUTE, TASKS } = require('../../lib/catalog');
const { ownedOrder } = require('../../lib/model');
const booking = require('../../lib/booking');
const reviews = require('../../lib/reviews');
const ui = require('../../lib/ui');

const STEPS = ['预约确认', '到店采集', '提交归还', '设备核验'];
const PROGRESS = { booked: 0, travel: 0, arrived: 1, collecting: 1, stopped: 2 };

const GUIDANCE = {
  travel: { title: '准备前往站点', detail: '核对上方地址和预约时间。到店后按订单指引签到、自助领机。' },
  arrive: { title: '到店签到', detail: '到达预约站点后签到。请在预约时间内领取设备。' },
  collect: { title: '自助领机并采集', detail: '打开本单密码箱，按采集 SOP 操作。只在门店授权的示范区采集。' },
  return: { title: '放回原箱并锁好', detail: '确认设备已放回，再提交归还和模拟上传。凌矩随后核验设备。' }
};

function instructions(order, mainAction) {
  if (order.uploadedAt || !order.active) return null;
  if (order.canCancel && (order.impact || order.closed)) {
    return { title: '处理预约变更', detail: '请查看上方影响说明，可在此改期或无责取消。' };
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
  if (!order.showCode) {
    return { title: '查看设备可用情况', detail: '当前尚不能领机。到店遇到问题，可向凌矩报告设备异常。' };
  }
  return order.status === 'arrived'
    ? { title: '等待预约开始', detail: '预约于 ' + order.startTime + ' 开始，届时可自助领机。' }
    : { title: '按预约时间到店', detail: '预约开始前15分钟可签到。请核对上方站点和时间。' };
}

function orderResult(state, order) {
  if (!order.uploadedAt) return null;
  const entries = state.earnings.filter(item => item.party === order.collectorId && item.orderId === order.id
    && ['capture', 'qaAdjustment'].includes(item.kind));
  const confirmed = entries.reduce((total, item) => total + item.cents, 0);
  const inReview = order.qaAppeal && order.qaAppeal.status === 'pending';
  let qaLabel = '待审核';
  if (order.qa) qaLabel = inReview ? '部分工时复核中' : '已审核';
  else if (!order.actual) qaLabel = '无采集时长';
  return {
    deviceLabel: order.status === 'done' ? '已核验归还' : '已提交 · 待核验',
    qaLabel,
    earningsLabel: entries.length ? '已确认 · 待结算' : order.actual && !order.qa ? '质检后确认' : '暂无确认报酬',
    amount: entries.length ? '¥' + ui.money(confirmed) + '（虚构）' : ''
  };
}

Page({
  data: { reportPhoto: false, steps: STEPS, mainAction: null, showDemo: false, showIssue: false, showSop: false },
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
    this.setData({ missing: false, order: view, now: stamp(state.now), mainAction,
      step: PROGRESS[order.status] ?? -1, guidance: instructions(view, mainAction), result: orderResult(state, order),
      taskSteps: TASKS[order.task].steps,
      canJumpStart: view.active && state.now < view.startAt,
      canJumpEnd: order.status === 'collecting',
      canJumpOverdue: ['stopped', 'submitted'].includes(order.status) && state.now < view.endAt + 30 * MINUTE,
      report: state.reports.find(item => item.orderId === order.id) || null });
  },
  perform(event) {
    const action = event.currentTarget.dataset.action;
    ui.commit(this, state => {
      const order = ownedOrder(state, state.collector, this.id);
      const next = ui.nextAction(ui.presentOrder(state, order));
      if (next && next.action === action && next.advanceTo) {
        ui.advanceClock(state, next.advanceTo);
        if (action === 'stop') return order;
      }
      return booking.perform(state, state.collector, this.id, action);
    });
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
  toggleIssue() {
    const showIssue = !this.data.showIssue;
    this.setData({ showIssue }, () => {
      if (showIssue) wx.pageScrollTo({ selector: '#order-issue', duration: 220 });
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
  reportIssue() {
    ui.inputPrompt('上报模拟设备异常', '如密码箱故障、设备无法使用',
      reason => ui.commit(this, state => booking.report(state, state.collector, this.id, reason, this.data.reportPhoto),
        () => this.setData({ showIssue: false, reportPhoto: false })));
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
