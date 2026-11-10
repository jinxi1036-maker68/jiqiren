const store = require('../../lib/storage');
const { DAY, TASKS, at, dateOf, timeLabel } = require('../../lib/catalog');
const { validDate } = require('../../lib/model');
const booking = require('../../lib/booking');
const ui = require('../../lib/ui');

function option(minute) {
  return { minute, label: timeLabel(minute) };
}

const SHORT_REASONS = {
  '站点或任务尚未开放': '暂停接单',
  '设备暂停检修': '设备暂停',
  '设备待核验归还': '待归还核验',
  '门店当天未开放': '门店休息',
  '当前采集员暂不可预约': '暂不可预约'
};

function dateOptions(state, station, today, date, slots, replaceId) {
  const byDate = new Map([[date, slots]]);
  const availability = day => {
    if (!byDate.has(day)) byDate.set(day, booking.availability(state, state.collector, station.id, day, replaceId));
    return byDate.get(day);
  };
  const option = (day, label) => {
    const daySlots = availability(day);
    const reason = daySlots.length ? '' : ui.listing(state, station, day, state.collector, replaceId, daySlots).availabilityReason;
    return { date: day, label, shortDate: day.slice(5).replace('-', '/'), available: daySlots.length > 0,
      status: daySlots.length ? '可预约' : SHORT_REASONS[reason] || '暂无空档' };
  };
  const quickDates = ['今天', '明天', '后天'].map((label, offset) => option(dateOf(at(today) + offset * DAY), label));
  if (!quickDates.some(item => item.date === date)) quickDates.push(option(date, '所选'));
  if (slots.length) return { quickDates, nextAvailable: null };
  const next = booking.nextAvailability(state, state.collector, station.id, date, replaceId);
  const label = next && (quickDates.find(item => item.date === next.date)?.label || next.date.slice(5).replace('-', '/'));
  return { quickDates, nextAvailable: next ? { date: next.date, label, time: timeLabel(next.start) } : null };
}

Page({
  data: { selectedStart: null, selectedEnd: null, selectionLost: false, canConfirm: false, reason: '',
    showGuide: false, showSop: false, showStarts: true },
  onLoad(options) {
    this.stationId = options.id;
    this.replaceId = options.replace || '';
    this.setData({ date: validDate(options.date) ? options.date : dateOf(store.read().now) });
  },
  onShow: ui.watchBookingClock,
  onHide: ui.stopBookingClock,
  onUnload: ui.stopBookingClock,
  toggleGuide() {
    this.setData({ showGuide: !this.data.showGuide });
  },
  toggleSop() {
    this.setData({ showSop: !this.data.showSop });
  },
  refresh() {
    const state = store.read();
    const station = state.stations.find(item => item.id === this.stationId);
    if (!station) {
      this.setData({ missing: true, canConfirm: false });
      return;
    }
    const today = dateOf(state.now);
    const date = this.data.date < today ? today : this.data.date;
    const slots = booking.availability(state, state.collector, this.stationId, date, this.replaceId);
    const slot = date === this.data.date ? slots.find(item => item.start === this.data.selectedStart) : null;
    const selectedStart = slot ? slot.start : null;
    const selectedEnd = slot && slot.ends.includes(this.data.selectedEnd) ? this.data.selectedEnd : null;
    const selectionLost = (this.data.selectedStart !== null && selectedStart === null)
      || (this.data.selectedEnd !== null && selectedEnd === null);
    const task = TASKS[station.task];
    const previous = state.orders.find(order => order.id === this.replaceId && order.collectorId === state.collector);
    const card = ui.listing(state, station, date, state.collector, this.replaceId, slots);
    const stationBlocked = ['站点或任务尚未开放', '设备暂停检修', '设备待核验归还'].includes(card.availabilityReason);
    const collectorBlocked = card.availabilityReason === '当前采集员暂不可预约';
    const { quickDates, nextAvailable } = stationBlocked || collectorBlocked
      ? { quickDates: [], nextAvailable: null }
      : dateOptions(state, station, today, date, slots, this.replaceId);
    this.setData({ missing: false, date, today, station, task, selectedStart, selectedEnd, guide: ui.siteGuide(station, date),
      quickDates, nextAvailable, stationBlocked, collectorBlocked,
      showStarts: selectedStart === null || this.data.showStarts,
      selectedStartLabel: selectedStart === null ? '' : timeLabel(selectedStart),
      clockLabel: ui.bookingClockLabel(state),
      selectionLost: selectionLost || this.data.selectionLost, canConfirm: selectedEnd !== null,
      selectionText: !slots.length ? (nextAvailable ? nextAvailable.label + ' ' + nextAvailable.time + ' 起' : '暂无可约时段')
        : selectedStart === null ? '先选开始时间'
          : selectedEnd === null ? '再选结束时间' : timeLabel(selectedStart) + '–' + timeLabel(selectedEnd),
      starts: slots.map(item => option(item.start)), ends: slot ? slot.ends.map(option) : [],
      card,
      replaceId: this.replaceId, lateChange: Boolean(previous && ui.presentOrder(state, previous).lateCancel),
      reserved: state.orders.filter(order => order.stationId === station.id && order.date === date && order.status !== 'cancelled')
        .sort((a, b) => a.start - b.start).map(order => ({ id: order.id, interval: timeLabel(order.start) + '–' + timeLabel(order.end) })) });
  },
  copyAddress: ui.copyAddress,
  openMap: ui.openMap,
  date(event) {
    const date = event.currentTarget.dataset.date || event.detail.value;
    if (!validDate(date) || date === this.data.date) return;
    this.setData({ date, selectedStart: null, selectedEnd: null, selectionLost: false });
    this.refresh();
  },
  goTasks() {
    wx.redirectTo({ url: '/pages/collector/index' });
  },
  toggleStarts() {
    this.setData({ showStarts: !this.data.showStarts });
  },
  start(event) {
    const minute = Number(event.currentTarget.dataset.minute);
    if (!this.data.starts.some(item => item.minute === minute)) return;
    if (minute === this.data.selectedStart) {
      this.setData({ showStarts: false });
      return;
    }
    this.setData({ selectedStart: minute, selectedEnd: null, selectionLost: false, showStarts: false });
    this.refresh();
  },
  end(event) {
    const minute = Number(event.currentTarget.dataset.minute);
    if (!this.data.ends.some(item => item.minute === minute)) return;
    this.setData({ selectedEnd: minute, selectionLost: false });
    this.refresh();
  },
  reason(event) {
    this.setData({ reason: event.detail.value });
  },
  submit() {
    if (this.submitting || !this.data.canConfirm) return;
    const request = { stationId: this.stationId, date: this.data.date, start: this.data.selectedStart,
      end: this.data.selectedEnd, replaceId: this.replaceId, reason: this.data.reason };
    this.submitting = true;
    const saved = ui.commit(this, state => booking.create(state, state.collector, request), order => {
      wx.redirectTo({ url: '/pages/order/index?id=' + order.id, complete: () => { this.submitting = false; } });
    });
    if (!saved) {
      this.submitting = false;
      this.refresh();
    }
  }
});
