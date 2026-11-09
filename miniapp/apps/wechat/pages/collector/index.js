const store = require('../../lib/storage');
const { stamp, dateOf, HOUR, DISTRICTS } = require('../../lib/catalog');
const { preStart } = require('../../lib/model');
const experience = require('../../lib/experience');
const ui = require('../../lib/ui');

const REGIONS = ['全城', ...DISTRICTS];
const SORTS = ['最早可开工', '区域顺序'];
const NAV_ITEMS = [
  { section: 'tasks', label: '找任务', icon: '/assets/icons/radar.svg' },
  { section: 'orders', label: '订单', icon: '/assets/icons/orders.svg' },
  { section: 'income', label: '收益', icon: '/assets/icons/wallet.svg' },
  { section: 'messages', label: '消息', icon: '/assets/icons/bell.svg' },
  { section: 'credit', label: '我的', icon: '/assets/icons/person.svg' }
];
const STORIES = [
  { id: 'story', tab: '采集故事', label: '采集故事 · 模拟', title: '小林的第一笔采集', amount: '¥60.00',
    detail: '文具分拣 2 小时 · 已确认', action: '查看故事', art: '/assets/story-collection.svg' },
  { id: 'benefits', tab: '福利活动', label: '福利活动 · 模拟', title: '新手采集计划',
    detail: '新人券与首单礼', action: '查看参与条件', art: '/assets/story-benefits.svg' },
  { id: 'promotion', tab: '站点推广', label: '推广 · 示意', title: '门店合作推广位',
    detail: '合作门店与招募活动', action: '查看示例', art: '/assets/story-promotion.svg' }
];
const ORDER_TABS = [
  { id: 'arrival', label: '待到店', icon: '/assets/icons/pin.svg' },
  { id: 'active', label: '进行中', icon: '/assets/icons/radar.svg' },
  { id: 'return', label: '待归还', icon: '/assets/icons/store.svg' },
  { id: 'verify', label: '待核验', icon: '/assets/icons/guide.svg' },
  { id: 'attention', label: '待处理', icon: '/assets/icons/feedback.svg' }
];
const PROFILE_GROUPS = [
  { id: 'earnings', items: [{ label: '我的收益', section: 'income' }, { label: '我的券', view: 'coupons' },
    { label: '福利活动', view: 'benefits' }, { label: '邀请好友', view: 'invite' }] },
  { id: 'support', items: [{ label: '服务指南', view: 'guide' }, { label: '投诉建议', view: 'feedback' },
    { label: '关于我们', view: 'about' }, { label: '设置', view: 'settings' }] }
];

function orderGroup(order) {
  if (preStart(order) && (order.impact || order.closed || order.suspected || order.handoffBlock)) return 'attention';
  if (order.status === 'booked' || order.status === 'travel') return 'arrival';
  if (order.status === 'arrived' || order.status === 'collecting') return 'active';
  if (order.status === 'stopped') return 'return';
  if (order.status === 'submitted') return 'verify';
  return '';
}

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
    date: order.date, time: order.startTime + '–' + order.endTime,
    stateLabel: order.stateLabel === '已确认' ? '待到店' : order.stateLabel,
    stateTone: order.stateLabel === '已确认' ? 'wait' : order.stateTone,
    link: order.status === 'submitted' ? '查看结果' : order.impact || order.closed ? '处理预约'
      : order.handoffBlock ? '查看进度' : order.status === 'stopped' ? '提交归还'
        : order.status === 'collecting' || order.status === 'arrived' ? '继续采集' : '到店流程',
    hint, submitted: order.status === 'submitted' };
}

Page({
  data: { section: 'tasks', navItems: NAV_ITEMS, regions: REGIONS, sorts: SORTS, showDemo: false,
    storyIndex: 0, orderFilter: '', profileGroups: PROFILE_GROUPS },
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
    const orders = state.orders.filter(order => order.collectorId === actor).map(order => {
      const view = ui.presentOrder(state, order);
      return { ...view, group: orderGroup(view) };
    });
    const account = experience.accountView(state, 'collector');
    const stories = STORIES.filter(item => item.id !== 'benefits' || account.showCampaign);
    const activeStory = this.data.stories?.[this.data.storyIndex]?.id;
    this.setData({ today, date, region, sort, search, dateLabel: date === today ? '今天 ' + date.slice(5).replace('-', '/') : date.slice(5).replace('-', '/'),
      availableCount: cards.filter(card => card.openCount).length, period, clock: stamp(state.now), cards, messages,
      replaceId: this.replaceId, personas: state.collectors.map(person => person.name),
      persona: state.collectors.findIndex(person => person.id === actor),
      unread: messages.filter(message => !message.read).length,
      orders, nextOrder: nextReservation(orders, state.now),
      shownOrders: orders.filter(order => !this.data.orderFilter || order.group === this.data.orderFilter),
      orderTabs: ORDER_TABS.map(tab => ({ ...tab, count: orders.filter(order => order.group === tab.id).length })),
      stories, storyIndex: Math.max(0, stories.findIndex(item => item.id === activeStory)),
      income: ui.income(state, actor, period), profile: ui.profile(state, actor),
      account });
  },
  persona(event) {
    this.replaceId = '';
    ui.commit(this, state => { state.collector = state.collectors[Number(event.detail.value)].id; });
  },
  section(event) {
    const { section, filter = '' } = event.currentTarget.dataset;
    this.setData({
      section, orderFilter: filter, orderFilterLabel: ORDER_TABS.find(tab => tab.id === filter)?.label || '',
      shownOrders: this.data.orders.filter(order => !filter || order.group === filter)
    }, () => wx.pageScrollTo({ scrollTop: 0, duration: 0 }));
  },
  finishStory(event) {
    const { current } = event.detail;
    if (this.data.stories[current] && current !== this.data.storyIndex) this.setData({ storyIndex: current });
  },
  selectStory(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (this.data.stories[index]) this.setData({ storyIndex: index });
  },
  openStory(event) {
    const { id } = event.currentTarget.dataset;
    if (id === 'benefits') {
      this.openAccount(event);
    } else if (id === 'story') {
      wx.showModal({ title: '小林的第一笔采集',
        content: '在松墨文具完成 2 小时有效文具分拣，按示例 ¥30/有效小时计算，确认报酬 ¥60。这是一笔模拟记录。',
        showCancel: false });
    } else if (id === 'promotion') {
      wx.showModal({ title: '门店合作推广位', content: '这里示意合作门店、采集场景和招募活动的展示位置。当前内容为演示。',
        showCancel: false });
    }
  },
  profileEntry(event) {
    if (event.currentTarget.dataset.section) this.section(event);
    else this.openAccount(event);
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
