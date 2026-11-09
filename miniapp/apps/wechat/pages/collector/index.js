const store = require('../../lib/storage');
const { stamp, dateOf, HOUR, DISTRICTS } = require('../../lib/catalog');
const { preStart } = require('../../lib/model');
const experience = require('../../lib/experience');
const ui = require('../../lib/ui');

const REGIONS = ['全城', ...DISTRICTS];
const SORTS = ['最早可开工', '区域顺序'];
const NAV_ITEMS = [
  { section: 'tasks', label: '找任务', icon: '/assets/icons/radar.svg' },
  { section: 'orders', label: '预约', icon: '/assets/icons/orders.svg' },
  { section: 'income', label: '收益', icon: '/assets/icons/wallet.svg' },
  { section: 'messages', label: '消息', icon: '/assets/icons/bell.svg' },
  { section: 'credit', label: '我的', icon: '/assets/icons/person.svg' }
];

function priority(order, now) {
  if (order.status === 'stopped' || order.status === 'collecting') return 0;
  if (order.status === 'submitted') return 4;
  if (!preStart(order) || order.endAt <= now) return Infinity;
  if (order.impact || order.closed) return 1;
  if (order.status === 'travel' || order.status === 'arrived') return 2;
  return order.startAt - now <= 24 * HOUR ? 3 : Infinity;
}

function nextReservation(orders, now) {
  const candidate = orders.map(order => ({ order, priority: priority(order, now) }))
    .filter(item => Number.isFinite(item.priority))
    .sort((a, b) => a.priority - b.priority || a.order.startAt - b.order.startAt)[0];
  if (!candidate) return null;
  const { order } = candidate;
  const action = ui.nextAction(order);
  let hint = '按预约时间到店';
  if (action) hint = '下一步 · ' + action.label;
  else if (order.status === 'submitted') hint = '等待凌矩核验归还';
  else if (order.impact || order.closed) hint = '预约有变，请查看处理方式';
  else if (order.handoffBlock) hint = order.handoffBlock;
  return { id: order.id, stationName: order.stationName, taskName: order.taskName, interval: order.interval,
    stateLabel: order.stateLabel, stateTone: order.stateTone, hint, submitted: order.status === 'submitted' };
}

Page({
  data: { section: 'tasks', navItems: NAV_ITEMS, regions: REGIONS, sorts: SORTS, showDemo: false },
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
    const { date: savedDate, region = 0, sort = 0, search = '' } = (state.collectorFilters || {})[actor] || {};
    const date = savedDate && savedDate >= today ? savedDate : today;
    const period = this.data.period || today.slice(0, 7);
    const messages = ui.inbox(state, actor);
    const oldOrder = state.orders.find(order => order.id === this.replaceId && order.collectorId === actor);
    if (this.replaceId && (!oldOrder || oldOrder.replacedBy || (!preStart(oldOrder) && oldOrder.status !== 'cancelled'))) this.replaceId = '';
    const candidates = state.stations.filter(station => station.stage === 'open' && station.taskEnabled);
    const cards = candidates.filter(station => !region || station.district === REGIONS[region])
      .map(station => ui.listing(state, station, date, actor, this.replaceId))
      .filter(card => [card.name, card.title, card.category, card.district, card.address].join(' ').includes(search.trim()));
    if (sort === 0) cards.sort((a, b) => (a.openCount ? a.earliest : '99:99').localeCompare(b.openCount ? b.earliest : '99:99'));
    else cards.sort((a, b) => REGIONS.indexOf(a.district) - REGIONS.indexOf(b.district));
    const orders = state.orders.filter(order => order.collectorId === actor).map(order => ui.presentOrder(state, order));
    this.setData({ today, date, region, sort, search, dateLabel: date === today ? '今天 ' + date.slice(5).replace('-', '/') : date.slice(5).replace('-', '/'),
      availableCount: cards.filter(card => card.openCount).length, period, clock: stamp(state.now), cards, messages,
      replaceId: this.replaceId, personas: state.collectors.map(person => person.name),
      persona: state.collectors.findIndex(person => person.id === actor),
      unread: messages.filter(message => !message.read).length,
      orders, nextOrder: nextReservation(orders, state.now),
      income: ui.income(state, actor, period), profile: ui.profile(state, actor),
      account: experience.accountView(state, 'collector') });
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
    this.saveFilters({ date: event.detail.value });
  },
  region(event) {
    this.saveFilters({ region: Number(event.detail.value) });
  },
  sort(event) {
    this.saveFilters({ sort: Number(event.detail.value) });
  },
  search(event) {
    this.saveFilters({ search: event.detail.value });
  },
  clearFilters() {
    this.saveFilters({ search: '', region: 0, sort: 0, date: this.data.today });
  },
  saveFilters(changes) {
    ui.commit(this, state => {
      if (!state.collectorFilters) state.collectorFilters = {};
      state.collectorFilters[state.collector] = { ...state.collectorFilters[state.collector], ...changes };
    });
  },
  openAccount: experience.openAccount,
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
  messageSettings() {
    wx.showModal({ title: '消息设置', content: '当前模拟体验使用站内消息。微信订阅授权与推送尚未接入。',
      showCancel: false });
  },
  toggleDemo() {
    this.setData({ showDemo: !this.data.showDemo });
  },
  jump: ui.jump,
  switchRole: ui.switchRole
});
