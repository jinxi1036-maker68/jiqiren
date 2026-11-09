const store = require('../../lib/storage');
const merchant = require('../../lib/merchant');
const { TASKS, at, dateOf, stamp, timeLabel, minutes } = require('../../lib/catalog');
const { stationFor, windows } = require('../../lib/model');
const ui = require('../../lib/ui');

const TASK_KEYS = Object.keys(TASKS);
const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const FIELDS = [
  { key: 'name', label: '店铺名称' }, { key: 'address', label: '虚构地址' },
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
const SAMPLE = { name: '木尺文具（虚构）', address: '样例街 D-04', contact: '演示店主', phone: '示例-0000' };

function readRanges(input) {
  if (!input.trim()) return [];
  return input.split(/[，,]/).map(range => {
    const parts = range.trim().split(/\s*[-–]\s*/);
    if (parts.length !== 2 || !parts.every(value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value))) {
      throw new Error('请输入 09:00-12:00, 14:00-18:00 格式的时间');
    }
    return parts.map(minutes);
  });
}

Page({
  data: {
    fields: FIELDS, form: SAMPLE, taskIndex: 0, categories: TASK_KEYS.map(key => TASKS[key].category),
    photos: [{ id: 'front', title: '门头' }, { id: 'inside', title: '室内' }, { id: 'device', title: '设备位置' }],
    added: {}, days: DAYS, weekday: 0, ranges: '', section: 'home',
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
      windowLabel: ui.rangeText(windows(station, date)), currentEarnings, daily: daily.length });
    this.showWeek(this.data.weekday);
  },
  persona(event) {
    ui.commit(this, state => { state.merchant = state.stations[Number(event.detail.value)].id; });
    this.setData({ form: SAMPLE, added: {}, section: 'home', showApplication: false });
  },
  openApplication() {
    this.setData({ showApplication: true }, () => {
      wx.pageScrollTo({ selector: '#merchant-apply', duration: 250 });
    });
  },
  field(event) {
    this.setData({ ['form.' + event.currentTarget.dataset.key]: event.detail.value });
  },
  category(event) {
    this.setData({ taskIndex: Number(event.detail.value) });
  },
  photo(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ ['added.' + id]: !this.data.added[id] });
  },
  apply() {
    const form = { ...this.data.form, task: TASK_KEYS[this.data.taskIndex], photos: Object.keys(this.data.added).filter(id => this.data.added[id]) };
    ui.commit(this, state => merchant.apply(state, state.merchant, form));
  },
  confirm() {
    ui.commit(this, state => merchant.confirmInstallation(state, state.merchant),
      () => this.setData({ section: 'schedule' }));
  },
  showWeek(weekday) {
    const ranges = this.data.station.week[weekday].map(([open, close]) => timeLabel(open) + '-' + timeLabel(close)).join(', ');
    this.setData({ weekday, ranges });
  },
  weekday(event) {
    this.showWeek(Number(event.detail.value));
  },
  editRanges(event) {
    this.setData({ ranges: event.detail.value });
  },
  saveWeek() {
    ui.commit(this, state => merchant.schedule(state, state.merchant, this.data.weekday, readRanges(this.data.ranges)),
      () => wx.showToast({ title: '周计划已保存' }));
  },
  selectDate(event) {
    this.setData({ date: event.detail.value });
    this.refresh();
  },
  editDateRanges(event) {
    this.setData({ dateRanges: event.detail.value });
  },
  saveDate() {
    ui.commit(this, state => merchant.schedule(state, state.merchant, this.data.date, readRanges(this.data.dateRanges || '')),
      () => wx.showToast({ title: '当日时段已保存' }));
  },
  pauseDate() {
    wx.showModal({
      title: '暂停当日采集',
      content: '会停止该日的新预约并通知受影响的采集员。',
      success: result => {
        if (result.confirm) ui.commit(this, state => merchant.schedule(state, state.merchant, this.data.date, []));
      }
    });
  },
  restoreDate() {
    ui.commit(this, state => {
      const station = stationFor(state, state.merchant);
      const date = this.data.date;
      const weekday = (new Date(at(date)).getUTCDay() + 7) % 7;
      merchant.schedule(state, station.id, date, station.week[weekday]);
      delete station.exceptions[date];
    });
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
