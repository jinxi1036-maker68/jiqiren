const { MINUTE, seed } = require('./catalog');
const booking = require('./booking');
const reviews = require('./reviews');

const KEY = 'lingju-station-demo-v1';

function currentMinute() {
  return Math.floor(Date.now() / MINUTE) * MINUTE;
}

function advanceClock(state, target) {
  booking.advance(state, target);
  reviews.deadlineAlerts(state);
}

function read() {
  const now = currentMinute();
  const snapshot = wx.getStorageSync(KEY);
  if (snapshot && snapshot.schema === 1) {
    if (snapshot.now < now) {
      advanceClock(snapshot, now);
      wx.setStorageSync(KEY, snapshot);
    }
    return snapshot;
  }
  const state = seed(now);
  wx.setStorageSync(KEY, state);
  return state;
}

// Synchronous read, validate and single write in the same mini-program logic thread.
// Every page commits against the latest snapshot, never its rendered copy.
function change(action) {
  const state = read();
  const result = action(state);
  wx.setStorageSync(KEY, state);
  return result;
}

function reset() {
  wx.setStorageSync(KEY, seed(currentMinute()));
}

module.exports = { read, change, reset, advanceClock };
