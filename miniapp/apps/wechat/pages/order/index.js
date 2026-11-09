const store = require('../../lib/storage');
const { stamp, MINUTE } = require('../../lib/catalog');
const booking = require('../../lib/booking');
const reviews = require('../../lib/reviews');
const ui = require('../../lib/ui');

const STEPS = ['已确认', '到店采集', '归还核验', '已完成'];
const PROGRESS = { booked: 0, travel: 0, arrived: 1, collecting: 1, stopped: 2, submitted: 2, done: 3 };

function nextAction(order) {
  if (order.startCollect) return { action: 'collect', label: '模拟自助领机并开始采集' };
  if (order.arrive) return { action: 'arrive', label: '模拟到店签到' };
  if (order.firstStep) return { action: 'travel', label: '模拟开始前往' };
  if (order.status === 'collecting') return { action: 'stop', label: '停止采集' };
  if (order.status === 'stopped') return { action: 'return', label: '提交归还并模拟上传' };
  return null;
}

Page({
  data: { reportPhoto: false, steps: STEPS, mainAction: null },
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
    this.setData({ missing: false, order: view, now: stamp(state.now),
      step: PROGRESS[order.status] ?? -1, mainAction: nextAction(view),
      canJumpStart: view.active && state.now < view.startAt,
      canJumpEnd: order.status === 'collecting',
      canJumpOverdue: ['stopped', 'submitted'].includes(order.status) && state.now < view.endAt + 30 * MINUTE,
      report: state.reports.find(item => item.orderId === order.id) || null });
  },
  perform(event) {
    const action = event.currentTarget.dataset.action;
    ui.commit(this, state => booking.perform(state, state.collector, this.id, action));
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
      reason => ui.commit(this, state => booking.report(state, state.collector, this.id, reason, this.data.reportPhoto)));
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
