const { DAY, HOUR, CLOSING_BUFFER, at, dateOf } = require('./catalog');

function requireThat(value, message) {
  if (!value) throw new Error(message);
  return value;
}

function byId(items, id) {
  return requireThat(items.find(item => item.id === id), '记录不存在或已重置');
}

function nextId(state, prefix) {
  return prefix + '-' + String(++state.sequence).padStart(4, '0');
}

function record(state, actor, action, id, detail) {
  state.audit.unshift({ id: nextId(state, 'E'), actor, action, target: id, detail, at: state.now });
}

function notify(state, recipient, key, title, text, orderId = '', at = state.now) {
  if (!state.messages.some(message => message.key === key && message.recipient === recipient)) {
    state.messages.unshift({ recipient, key, title, text, orderId, at, read: false });
  }
}

function text(value, message) {
  return requireThat(typeof value === 'string' && value.trim().slice(0, 200), message);
}

function stationFor(state, id) {
  return byId(state.stations, id);
}

function ownedOrder(state, actor, id) {
  const order = byId(state.orders, id);
  requireThat(order.collectorId === actor, '只能操作自己的预约');
  return order;
}

function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(at(date)) && dateOf(at(date)) === date;
}

function windows(station, date) {
  return station.exceptions[date] || station.week[(new Date(at(date) + 8 * HOUR).getUTCDay() + 6) % 7];
}

function fits(station, order) {
  return windows(station, order.date).some(([open, close]) => order.start >= open && order.end <= close - CLOSING_BUFFER);
}

function preStart(order) {
  return ['booked', 'travel', 'arrived'].includes(order.status);
}

function holding(order) {
  return ['collecting', 'stopped', 'submitted'].includes(order.status);
}

function credit(state, collectorId) {
  const collector = byId(state.collectors, collectorId);
  const events = state.violations.filter(item => item.collectorId === collectorId && item.fault && !item.reversed)
    .sort((a, b) => a.at - b.at);
  let score = 100;
  let previous = state.now;
  for (const event of events) {
    score = Math.min(100, score + Math.max(0, Math.floor((event.at - previous) / (30 * DAY))));
    score = Math.max(0, score - event.points);
    previous = event.at;
  }
  score = Math.min(100, score + Math.max(0, Math.floor((state.now - previous) / (30 * DAY))));
  const review = collector.eligibility[collector.eligibility.length - 1];
  return { score: Math.max(0, score), review, allowed: score >= 60 || Boolean(review && review.status === 'approved') };
}

module.exports = { requireThat, byId, nextId, record, notify, text, stationFor, ownedOrder, validDate, windows, fits,
  preStart, holding, credit };
