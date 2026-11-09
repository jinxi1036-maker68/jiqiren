const store = require('../../lib/storage');
const merchant = require('../../lib/merchant');
const { TASKS, CITY, DISTRICTS, dateOf, stamp, timeLabel, minutes } = require('../../lib/catalog');
const { stationFor, windows, holding, requireThat } = require('../../lib/model');
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
  { section: 'income', label: '场地收益', icon: '/assets/icons/wallet.svg' }
];
const SAMPLE = { name: '木尺文具（虚构）', address: '样例街 D-04', contact: '演示店主', phone: '示例-0000',
  entrance: '从木色门头下的正门进入。', locker: '进门后收纳柜旁的 D-04 演示箱。', area: '演示区内的文具整理台。' };

function rangeFields(ranges) {
  return ranges.map(([from, to], id) => ({ id, from: timeLabel(from), to: timeLabel(to) }));
}

function affectedKey(orders) {
  return orders.map(order => order.id + ':' + order.status).join('|');
}

Page({
  data: {
    fields: FIELDS, city: CITY, districts: DISTRICTS, form: SAMPLE, districtIndex: 0,
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
    const orders = state.orders.filter(order => order.stationId === station.id && order.date === date)
      .sort((a, b) => a.start - b.start).map(order => ui.presentOrder(state, order));
    const [step, nextTitle, nextHint] = PROGRESS[station.stage];
    this.setData({ station, today, date, period, now: stamp(state.now), orders, step, nextTitle, nextHint,
      sites: state.stations.map(item => item.name), siteIndex: state.stations.indexOf(station),
      stage: ui.STAGES[station.stage], canApply: ['draft', 'supplement', 'rejected'].includes(station.stage),
      deployed: ['schedule', 'open'].includes(station.stage),
      todayOrders: state.orders.filter(order => order.stationId === station.id && order.date === today && order.status !== 'cancelled').length,
      deviceLabel: station.device && (station.device.fault || station.device.overdue.length) ? '暂停接单' : '已登记',
      windowLabel: ui.rangeText(windows(station, date)), dayRanges: rangeFields(windows(station, date)),
      currentEarnings, daily: daily.length });
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
  switchRole: ui.switchRole
});
