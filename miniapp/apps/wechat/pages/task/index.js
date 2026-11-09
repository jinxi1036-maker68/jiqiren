const store = require('../../lib/storage');
const { TASKS, dateOf, timeLabel } = require('../../lib/catalog');
const { validDate } = require('../../lib/model');
const booking = require('../../lib/booking');
const ui = require('../../lib/ui');

Page({
  data: { startIndex: 0, endIndex: 0, reason: '' },
  onLoad(options) {
    this.stationId = options.id;
    this.replaceId = options.replace || '';
    this.setData({ date: validDate(options.date) ? options.date : dateOf(store.read().now) });
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    const state = store.read();
    const station = state.stations.find(item => item.id === this.stationId);
    if (!station) {
      this.setData({ missing: true });
      return;
    }
    const today = dateOf(state.now);
    const date = this.data.date < today ? today : this.data.date;
    const slots = booking.availability(state, state.collector, this.stationId, date, this.replaceId);
    const startIndex = Math.min(this.data.startIndex, Math.max(0, slots.length - 1));
    const ends = slots.length ? slots[startIndex].ends : [];
    const task = TASKS[station.task];
    const previous = state.orders.find(order => order.id === this.replaceId && order.collectorId === state.collector);
    this.slots = slots;
    this.setData({ date, today, station, task, startIndex, endIndex: Math.min(this.data.endIndex, Math.max(0, ends.length - 1)),
      starts: slots.map(slot => timeLabel(slot.start)), ends: ends.map(timeLabel),
      card: ui.listing(state, station, date, state.collector, this.replaceId),
      replaceId: this.replaceId, lateChange: Boolean(previous && ui.presentOrder(state, previous).lateCancel),
      reserved: state.orders.filter(order => order.stationId === station.id && order.date === date && order.status !== 'cancelled')
        .sort((a, b) => a.start - b.start).map(order => ({ id: order.id, interval: timeLabel(order.start) + '–' + timeLabel(order.end) })) });
  },
  date(event) {
    this.setData({ date: event.detail.value, startIndex: 0, endIndex: 0 });
    this.refresh();
  },
  start(event) {
    this.setData({ startIndex: Number(event.detail.value), endIndex: 0 });
    this.refresh();
  },
  end(event) {
    this.setData({ endIndex: Number(event.detail.value) });
  },
  reason(event) {
    this.setData({ reason: event.detail.value });
  },
  submit() {
    if (this.submitting) return;
    const slot = this.slots[this.data.startIndex];
    if (!slot) return;
    const request = { stationId: this.stationId, date: this.data.date, start: slot.start,
      end: slot.ends[this.data.endIndex], replaceId: this.replaceId, reason: this.data.reason };
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
