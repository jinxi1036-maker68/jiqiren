const experience = require('../../lib/experience');
const reviews = require('../../lib/reviews');
const store = require('../../lib/storage');
const ui = require('../../lib/ui');

const TITLES = {
  login: '登录', benefits: '福利活动', coupons: '我的券', invite: '邀请好友',
  feedback: '投诉建议', guide: '服务指南', about: '关于我们', settings: '设置', credit: '信誉记录'
};
const COLLECTOR_VIEWS = ['benefits', 'coupons', 'invite', 'credit'];
const COLLECTOR_STEPS = [
  { title: '选站点和时间', detail: '先确认开放时段、任务要求和预计时长，再预约。' },
  { title: '到店自助取机', detail: '从订单查看导航、入口和设备箱位置，签到后按指引开始采集。' },
  { title: '提交归还与采集记录', detail: '设备放回原箱并锁好，再按订单提示提交。' },
  { title: '查核验、质检和收益', detail: '凌矩核验设备。采集有效时长经质检确认后计入个人账目。' }
];
const MERCHANT_STEPS = [
  { title: '提交门店申请', detail: '填写门店位置、入口和设备摆放说明，等待凌矩审核。' },
  { title: '确认设备到位', detail: '凌矩完成安装后，商家确认设备到位。' },
  { title: '设置开放时间', detail: '按门店经营安排开放时段，变更前可预览受影响的预约。' },
  { title: '查看排班和场地账目', detail: '采集员自助领还，凌矩负责核验。商家可在概览查看接下来的预约。' }
];

Page({
  data: { topics: experience.TOPICS, topicIndex: 0, message: '', code: '', canSend: false },
  onLoad(options) {
    this.role = options.role === 'merchant' ? 'merchant' : 'collector';
    const view = Object.prototype.hasOwnProperty.call(TITLES, options.view) && !(this.role === 'merchant' && COLLECTOR_VIEWS.includes(options.view))
      ? options.view : 'guide';
    const topic = Number(options.topic);
    const topicIndex = view === 'feedback' && experience.TOPICS[topic] ? topic : 0;
    const title = experience.TOPICS[topicIndex] === '门店推荐' ? '推荐门店' : TITLES[view];
    this.setData({ view, title, topicIndex, role: this.role, steps: this.role === 'merchant' ? MERCHANT_STEPS : COLLECTOR_STEPS });
    wx.setNavigationBarTitle({ title });
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    const state = store.read();
    const account = experience.accountView(state, this.role);
    this.setData({ account });
    if (this.data.view === 'benefits') this.setData({ offers: experience.campaignStatus(state, account.actor) });
    if (this.data.view === 'invite') this.setData({ invite: experience.invitationStatus(state, account.actor) });
    if (this.data.view === 'credit') this.setData({ credit: ui.profile(state, account.actor) });
  },
  openAccount(event) {
    const view = event.currentTarget.dataset.view;
    const replace = (this.data.view === 'benefits' && view === 'coupons') || (this.data.view === 'coupons' && view === 'benefits');
    experience.openAccount(event, replace);
  },
  login() {
    ui.commit(this, state => experience.updateProfile(state, this.role, { loggedIn: true }), () => wx.navigateBack());
  },
  logout() {
    ui.commit(this, state => experience.updateProfile(state, this.role, { loggedIn: false }),
      () => wx.showToast({ title: '已退出演示登录', icon: 'none' }));
  },
  campaignSetting(event) {
    ui.commit(this, state => experience.updateProfile(state, this.role, { showCampaign: event.detail.value }));
  },
  claimCoupon(event) {
    const id = event.currentTarget.dataset.id;
    ui.commit(this, state => experience.claimCoupon(state, id), () => wx.showToast({ title: '已放入我的券' }));
  },
  findTasks() {
    wx.reLaunch({ url: '/pages/collector/index' });
  },
  editCode(event) {
    this.setData({ code: event.detail.value });
  },
  copyCode() {
    wx.setClipboardData({ data: this.data.invite.code, fail: () => wx.showToast({ title: '复制失败，可手动输入', icon: 'none' }) });
  },
  bindInvite() {
    ui.commit(this, state => experience.bindInvite(state, this.data.code), () => {
      this.setData({ code: '' });
      wx.showToast({ title: '邀请码已记录' });
    });
  },
  claimInvite(event) {
    const id = event.currentTarget.dataset.id;
    ui.commit(this, state => experience.claimInvite(state, id), () => wx.showToast({ title: '已记录演示奖励' }));
  },
  topic(event) {
    this.setData({ topicIndex: Number(event.detail.value) });
  },
  message(event) {
    const message = event.detail.value;
    this.setData({ message, canSend: Boolean(message.trim()) });
  },
  sendFeedback() {
    ui.commit(this, state => experience.sendFeedback(state, this.role, this.data.topics[this.data.topicIndex], this.data.message), () => {
      this.setData({ message: '', canSend: false });
      wx.showToast({ title: '反馈已提交' });
    });
  },
  appeal(event) {
    const id = event.currentTarget.dataset.id;
    ui.inputPrompt('模拟信誉申诉', '填写模拟设备异常、归还记录等依据',
      reason => ui.commit(this, state => reviews.appealCredit(state, state.collector, id, reason)));
  }
});
