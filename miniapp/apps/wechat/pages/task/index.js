const store = require('../../lib/storage');
const { TASKS, dateOf, timeLabel } = require('../../lib/catalog');
const { validDate } = require('../../lib/model');
const booking = require('../../lib/booking');
const ui = require('../../lib/ui');

function option(minute) {
  return { minute, label: timeLabel(minute) };
}

Page({
  data: { selectedStart: null, selectedEnd: null, selectionLost: false, canConfirm: false, reason: '',
    showGuide: false, showSop: false },
  onLoad(options) {
    this.stationId = options.id;
    this.replaceId = options.replace || '';
    this.setData({ date: validDate(options.date) ? options.date : dateOf(store.read().now) });
  },
  onShow() {
    this.refresh();
  },
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
    this.setData({ missing: false, date, today, station, task, selectedStart, selectedEnd, guide: ui.siteGuide(station, date),
      selectionLost: selectionLost || this.data.selectionLost, canConfirm: selectedEnd !== null,
      selectionText: selectedStart === null ? '先选开始时间'
        : selectedEnd === null ? '再选结束时间' : timeLabel(selectedStart) + '–' + timeLabel(selectedEnd),
      starts: slots.map(item => option(item.start)), ends: slot ? slot.ends.map(option) : [],
      card: ui.listing(state, station, date, state.collector, this.replaceId, slots),
      replaceId: this.replaceId, lateChange: Boolean(previous && ui.presentOrder(state, previous).lateCancel),
      reserved: state.orders.filter(order => order.stationId === station.id && order.date === date && order.status !== 'cancelled')
        .sort((a, b) => a.start - b.start).map(order => ({ id: order.id, interval: timeLabel(order.start) + '–' + timeLabel(order.end) })) });
  },
  copyAddress: ui.copyAddress,
  openMap: ui.openMap,
  date(event) {
    this.setData({ date: event.detail.value, selectedStart: null, selectedEnd: null, selectionLost: false });
    this.refresh();
  },
  start(event) {
    const minute = Number(event.currentTarget.dataset.minute);
    if (!this.data.starts.some(item => item.minute === minute) || minute === this.data.selectedStart) return;
    this.setData({ selectedStart: minute, selectedEnd: null, selectionLost: false });
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
