const { seed } = require('./catalog');

const KEY = 'lingju-station-demo-v1';

function read() {
  const snapshot = wx.getStorageSync(KEY);
  if (snapshot && snapshot.schema === 1) return snapshot;
  const state = seed();
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
  wx.setStorageSync(KEY, seed());
}

module.exports = { read, change, reset };
