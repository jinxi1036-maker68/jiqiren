const store = require('../../lib/storage');
const merchant = require('../../lib/merchant');
const experience = require('../../lib/experience');
const { TASKS, CITY, DISTRICTS, DEVICE_BUFFER, CLOSING_BUFFER, dateOf, clock, timeLabel, minutes } = require('../../lib/catalog');
const { stationFor, windows, preStart, holding, requireThat } = require('../../lib/model');
const ui = require('../../lib/ui');

const TASK_KEYS = Object.keys(TASKS);
const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const FIELDS = [
  { key: 'name', label: '店铺名称' }, { key: 'address', label: '详细地址（街道、门牌）' },
  { key: 'entrance', label: '门头与入口' }, { key: 'locker', label: '设备箱位置' }, { key: 'area', label: '采集区域' },
  { key: 'contact', label: '虚构联系人' }, { key: 'phone', label: '演示联系电话' }
];
const STEPS = ['申请', '审核', '部署', '到位确认', '开放'];
const PROGRESS = {
  draft: [0, '提交场地申请', '准备门头、室内和设备摆放位置的示例照片。'],
  review: [1, '等待凌矩审核', '审核通过后，凌矩将安排模拟设备安装。'],
  supplement: [0, '补充场地资料', '根据审核意见完善资料，再提交一次。'],
  rejected: [0, '查看审核意见', '调整场地资料后，可重新申请。'],
  approved: [2, '等待设备部署', '凌矩登记安装完成后，商家可确认设备到位。'],
  installed: [3, '确认设备已安装', '确认到位后，再设置允许采集的开放时间。'],
  schedule: [4, '设置开放时间', '保存开放时段后，采集员可查看并预约。'],
  open: [4, '查看门店运营', '管理开放时段与现场异常。']
};
const NAV_ITEMS = [
  { section: 'home', label: '概览', icon: '/assets/icons/store.svg' },
  { section: 'schedule', label: '开放时间', icon: '/assets/icons/calendar.svg' },
  { section: 'income', label: '场地收益', icon: '/assets/icons/wallet.svg' },
  { section: 'profile', label: '我的', icon: '/assets/icons/person.svg' }
];
const SAMPLE = { name: '木尺文具（虚构）', address: '样例街 D-04', contact: '演示店主', phone: '示例-0000',
  entrance: '从木色门头下的正门进入。', locker: '进门后收纳柜旁的 D-04 演示箱。', area: '演示区内的文具整理台。' };

function rangeFields(ranges) {
  return ranges.map(([from, to], id) => ({ id, from: timeLabel(from), to: timeLabel(to) }));
}

function affectedKey(orders) {
  return orders.map(order => order.id + ':' + order.status).join('|');
}

function deviceStatus(station, orders) {
  if (station.device.fault) return { label: '暂停接单', tone: 'risk', note: station.device.fault.reason };
  if (station.device.overdue.length) return { label: '逾期暂停', tone: 'risk', note: '凌矩核验设备后恢复。' };
  const current = orders.find(holding);
  if (current?.status === 'submitted') return { label: '待凌矩核验', tone: 'wait' };
  if (current?.status === 'stopped') return { label: '待采集员归还', tone: 'wait' };
  if (current) return { label: '采集中', tone: 'active' };
  if (!station.taskEnabled) return { label: '暂停新预约', tone: 'quiet' };
  return { label: '设备可用', tone: 'ready' };
}

function todayOverview(state, station, orders, today) {
  const minute = minutes(clock(state.now));
  const hours = windows(station, today);
  const current = hours.find(([open, close]) => minute >= open && minute < close);
  const upcoming = hours.find(([open]) => open > minute);
  const next = orders.find(order => order.date === today && preStart(order) && order.endAt > state.now);
  const nextLabel = !next ? '今日暂无后续预约' : next.impact || next.closed ? '下一笔预约受影响'
    : next.status === 'arrived' ? '采集员已到店' : next.startAt <= state.now ? '本时段待到店' : '下一位到店';
  return {
    next, nextLabel,
    device: deviceStatus(station, orders),
    hours: ui.rangeText(hours),
    opening: current ? { label: '开放至 ' + timeLabel(current[1]), tone: 'ready' }
      : upcoming ? { label: timeLabel(upcoming[0]) + ' 开放', tone: 'quiet' }
        : { label: hours.length ? '今日开放已结束' : '今日未开放', tone: 'quiet' },
    affected: orders.filter(order => order.date === today && preStart(order)
      && order.endAt > state.now && (order.impact || order.closed)).length
  };
}

function scheduleTrack(ranges, orders) {
  const reserved = orders.filter(order => order.status !== 'cancelled');
  const ends = [...ranges.flat(), ...reserved.flatMap(order => [order.start, order.end])];
  if (!ends.length) return null;
  const first = Math.min(...ends);
  const last = Math.max(...ends);
  const buffers = [
    ...ranges.map(([, close]) => [close - CLOSING_BUFFER, close]),
    ...reserved.flatMap(order => [[order.start - DEVICE_BUFFER, order.start], [order.end, order.end + DEVICE_BUFFER]])
  ];
  const points = [...new Set([...ends, ...buffers.flat()])].filter(minute => minute >= first && minute <= last).sort((a, b) => a - b);
  const segments = [];
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1];
    const to = points[index];
    const appointment = reserved.find(order => order.start <= from && order.end >= to);
    let tone = 'closed';
    if (appointment) tone = appointment.closed || appointment.impact ? 'affected' : 'booked';
    else if (ranges.some(([open, close]) => open <= from && close >= to)) {
      tone = buffers.some(([start, end]) => start <= from && end >= to) ? 'buffer' : 'open';
    }
    const previous = segments[segments.length - 1];
    if (previous?.tone === tone) previous.minutes += to - from;
    else segments.push({ id: from, tone, minutes: to - from });
  }
  return { start: timeLabel(first), end: timeLabel(last), segments };
}

Page({
  data: {
    fields: FIELDS, city: CITY, districts: DISTRICTS, form: SAMPLE, districtIndex: 0,
    deviceBuffer: DEVICE_BUFFER, closingBuffer: CLOSING_BUFFER,
    taskIndex: 0, categories: TASK_KEYS.map(key => TASKS[key].category),
    photos: [{ id: 'front', title: '门头' }, { id: 'inside', title: '室内' }, { id: 'device', title: '设备位置' }],
    added: {}, days: DAYS, weekday: 0, weekRanges: [], dayRanges: [], section: 'home',
    steps: STEPS, navItems: NAV_ITEMS, showApplication: false
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    const state = store.read();
    const station = stationFor(state, state.merchant);
    const today = dateOf(state.now);
    const date = this.data.date && this.data.date >= today ? this.data.date : today;
    const period = this.data.period || today.slice(0, 7);
    const currentEarnings = ui.ledger(state, station.id, period);
    const daily = state.earnings.filter(item => item.party === station.id && dateOf(item.at) === today);
    const stationOrders = state.orders.filter(order => order.stationId === station.id)
      .map(order => ui.presentOrder(state, order)).sort((a, b) => a.startAt - b.startAt);
    const orders = stationOrders.filter(order => order.date === date);
    const ranges = windows(station, date);
    const [step, nextTitle, nextHint] = PROGRESS[station.stage];
    const deployed = ['schedule', 'open'].includes(station.stage);
    this.setData({ station, today, date, period, orders, step, nextTitle, nextHint,
      sites: state.stations.map(item => item.name), siteIndex: state.stations.indexOf(station),
      stage: ui.STAGES[station.stage], canApply: ['draft', 'supplement', 'rejected'].includes(station.stage),
      deployed, overview: deployed ? todayOverview(state, station, stationOrders, today) : null,
      todayOrders: stationOrders.filter(order => order.date === today && order.status !== 'cancelled').length,
      track: scheduleTrack(ranges, orders), windowLabel: ui.rangeText(ranges), dayRanges: rangeFields(ranges),
      currentEarnings, daily: daily.length, account: experience.accountView(state, 'merchant') });
    this.showWeek(this.data.weekday);
  },
  persona(event) {
    ui.commit(this, state => { state.merchant = state.stations[Number(event.detail.value)].id; });
    this.setData({ section: 'home', showApplication: false, scheduleReview: null });
  },
  openApplication() {
    const { application, district, guide, task } = this.data.station;
    const added = Object.fromEntries(((application && application.photos) || []).map(id => [id, true]));
    this.setData({ showApplication: true, form: { ...SAMPLE, ...application, ...guide }, added,
      districtIndex: Math.max(0, DISTRICTS.indexOf(district)), taskIndex: TASK_KEYS.indexOf(task) }, () => {
      wx.pageScrollTo({ selector: '#merchant-apply', duration: 250 });
    });
  },
  field(event) {
    this.setData({ ['form.' + event.currentTarget.dataset.key]: event.detail.value });
  },
  category(event) {
    this.setData({ taskIndex: Number(event.detail.value) });
  },
  district(event) {
    this.setData({ districtIndex: Number(event.detail.value) });
  },
  photo(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ ['added.' + id]: !this.data.added[id] });
  },
  apply() {
    const form = { ...this.data.form, district: DISTRICTS[this.data.districtIndex], task: TASK_KEYS[this.data.taskIndex],
      photos: Object.keys(this.data.added).filter(id => this.data.added[id]) };
    ui.commit(this, state => merchant.apply(state, state.merchant, form), () => this.setData({ showApplication: false }));
  },
  confirm() {
    ui.commit(this, state => merchant.confirmInstallation(state, state.merchant),
      () => this.setData({ section: 'schedule' }));
  },
  showWeek(weekday) {
    this.setData({ weekday, weekRanges: rangeFields(this.data.station.week[weekday]), scheduleReview: null });
  },
  weekday(event) {
    this.showWeek(Number(event.detail.value));
  },
  editRange(event) {
    const { field, index, side } = event.currentTarget.dataset;
    const ranges = this.data[field].map((range, i) => i === Number(index) ? { ...range, [side]: event.detail.value } : range);
    this.setData({ [field]: ranges, scheduleReview: null });
  },
  addRange(event) {
    const { field } = event.currentTarget.dataset;
    const ranges = this.data[field];
    const id = ranges.length ? ranges[ranges.length - 1].id + 1 : 0;
    if (ranges.length < 4) this.setData({ [field]: [...ranges, { id, from: '09:00', to: '12:00' }], scheduleReview: null });
  },
  removeRange(event) {
    const { field, index } = event.currentTarget.dataset;
    this.setData({ [field]: this.data[field].filter((_, i) => i !== index), scheduleReview: null });
  },
  saveWeek() {
    this.previewSchedule(this.data.weekday, this.data.weekRanges.map(item => [minutes(item.from), minutes(item.to)]), '更新' + DAYS[this.data.weekday] + '开放计划');
  },
  selectDate(event) {
    this.setData({ date: event.detail.value });
    this.refresh();
  },
  showTodaySchedule() {
    this.setData({ date: this.data.today }, () => {
      this.refresh();
      wx.pageScrollTo({ selector: '#merchant-schedule', duration: 180 });
    });
  },
  saveDate() {
    this.previewSchedule(this.data.date, this.data.dayRanges.map(item => [minutes(item.from), minutes(item.to)]), '更新 ' + this.data.date + ' 开放时段');
  },
  pauseDate() {
    this.previewSchedule(this.data.date, [], '暂停 ' + this.data.date + ' 采集');
  },
  restoreDate() {
    this.previewSchedule(this.data.date, null, '恢复 ' + this.data.date + ' 周计划');
  },
  previewSchedule(day, ranges, title) {
    try {
      const state = store.read();
      const id = state.merchant;
      const affected = merchant.previewSchedule(state, id, day, ranges);
      this.setData({ scheduleReview: { day, ranges, title, id, key: affectedKey(affected),
        site: this.data.station.name, hours: ranges === null ? '沿用每周开放计划' : ui.rangeText(ranges),
        orders: affected.map(order => ({
          ...ui.presentOrder(state, order),
          impactText: order.status === 'submitted' ? '已提交归还，凌矩继续核验'
            : holding(order) ? '已领机，由凌矩协调归还' : order.status === 'booked' ? '未出发，可无责取消或改约' : '已出发或到店，可无责取消或改约'
        })) } }, () => wx.pageScrollTo({ selector: '#schedule-review', duration: 200 }));
    } catch (error) {
      ui.errorToast(error);
    }
  },
  confirmSchedule() {
    const review = this.data.scheduleReview;
    if (!review) return;
    ui.commit(this, state => {
      requireThat(state.merchant === review.id, '当前门店已变化，请重新预览');
      requireThat(affectedKey(merchant.previewSchedule(state, review.id, review.day, review.ranges)) === review.key,
        '受影响订单已变化，请重新预览');
      merchant.schedule(state, review.id, review.day, review.ranges);
    }, () => wx.showToast({ title: '开放时段已更新' }));
  },
  cancelSchedule() {
    this.setData({ scheduleReview: null });
  },
  selectPeriod(event) {
    this.setData({ period: event.detail.value });
    this.refresh();
  },
  section(event) {
    this.setData({ section: event.currentTarget.dataset.section }, () => wx.pageScrollTo({ scrollTop: 0, duration: 0 }));
  },
  openAccount: experience.openAccount,
  switchRole: ui.switchRole
});
