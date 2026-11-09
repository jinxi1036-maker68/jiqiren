const store = require('../../lib/storage');
const { stamp, dateOf } = require('../../lib/catalog');
const { preStart } = require('../../lib/model');
const reviews = require('../../lib/reviews');
const ui = require('../../lib/ui');

const REGIONS = ['全城', '新华区', '卫东区', '湛河区'];
const SORTS = ['最早可开工', '区域顺序'];
const NAV_ITEMS = [
  { section: 'tasks', label: '找任务', icon: '/assets/icons/radar.svg' },
  { section: 'orders', label: '预约', icon: '/assets/icons/orders.svg' },
  { section: 'income', label: '收益', icon: '/assets/icons/wallet.svg' },
  { section: 'messages', label: '消息', icon: '/assets/icons/bell.svg' },
  { section: 'credit', label: '我的', icon: '/assets/icons/person.svg' }
];

Page({
  data: { section: 'tasks', navItems: NAV_ITEMS, regions: REGIONS, region: 0, sorts: SORTS, sort: 0, search: '' },
  onLoad(options) {
    this.replaceId = options.replace || '';
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    const state = store.read();
    const actor = state.collector;
    const today = dateOf(state.now);
    const date = this.data.date && this.data.date >= today ? this.data.date : today;
    const period = this.data.period || today.slice(0, 7);
    const messages = ui.inbox(state, actor);
    const oldOrder = state.orders.find(order => order.id === this.replaceId && order.collectorId === actor);
    if (this.replaceId && (!oldOrder || oldOrder.replacedBy || (!preStart(oldOrder) && oldOrder.status !== 'cancelled'))) this.replaceId = '';
    const candidates = state.stations.filter(station => station.stage === 'open' && station.taskEnabled);
    const cards = candidates.filter(station => !this.data.region || station.district === REGIONS[this.data.region])
      .map(station => ui.listing(state, station, date, actor, this.replaceId))
      .filter(card => (card.name + card.title + card.category).includes(this.data.search));
    if (this.data.sort === 0) cards.sort((a, b) => (a.openCount ? a.earliest : '99:99').localeCompare(b.openCount ? b.earliest : '99:99'));
    this.setData({ today, date, dateLabel: date === today ? '今天 ' + date.slice(5).replace('-', '/') : date.slice(5).replace('-', '/'),
      availableCount: cards.filter(card => card.openCount).length, period, clock: stamp(state.now), cards, messages,
      replaceId: this.replaceId, personas: state.collectors.map(person => person.name),
      persona: state.collectors.findIndex(person => person.id === actor),
      unread: messages.filter(message => !message.read).length,
      orders: state.orders.filter(order => order.collectorId === actor).map(order => ui.presentOrder(state, order)),
      income: ui.income(state, actor, period), profile: ui.profile(state, actor) });
  },
  persona(event) {
    this.replaceId = '';
    ui.commit(this, state => { state.collector = state.collectors[Number(event.detail.value)].id; });
  },
  section(event) {
    this.setData({ section: event.currentTarget.dataset.section }, () => wx.pageScrollTo({ scrollTop: 0, duration: 0 }));
  },
  exitReschedule() {
    this.replaceId = '';
    this.refresh();
  },
  date(event) {
    this.setData({ date: event.detail.value });
    this.refresh();
  },
  region(event) {
    this.setData({ region: Number(event.detail.value) });
    this.refresh();
  },
  sort(event) {
    this.setData({ sort: Number(event.detail.value) });
    this.refresh();
  },
  search(event) {
    this.setData({ search: event.detail.value.trim() });
    this.refresh();
  },
  period(event) {
    this.setData({ period: event.detail.value });
    this.refresh();
  },
  task(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/task/index?id=' + id + '&date=' + this.data.date + '&replace=' + this.replaceId });
  },
  order(event) {
    const id = event.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/order/index?id=' + id });
  },
  readAll() {
    ui.commit(this, state => {
      for (const item of state.messages.filter(item => item.recipient === state.collector)) item.read = true;
    });
  },
  openMessage(event) {
    const { key, id } = event.currentTarget.dataset;
    ui.commit(this, state => {
      const item = state.messages.find(message => message.key === key && message.recipient === state.collector);
      if (item) item.read = true;
    }, () => {
      if (id) wx.navigateTo({ url: '/pages/order/index?id=' + id });
    });
  },
  appeal(event) {
    const id = event.currentTarget.dataset.id;
    ui.inputPrompt('模拟信誉申诉', '填写模拟设备异常、归还记录等依据',
      reason => ui.commit(this, state => reviews.appealCredit(state, state.collector, id, reason)));
  },
  messageSettings() {
    wx.showModal({ title: '消息设置', content: '当前模拟体验使用站内消息。微信订阅授权与推送尚未接入。',
      showCancel: false });
  },
  jump: ui.jump,
  switchRole: ui.switchRole
});
