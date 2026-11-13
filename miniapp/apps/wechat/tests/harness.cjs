const path = require('node:path');

function runtime(wallTime = Date.parse('2026-11-09T08:00:00+08:00')) {
  const state = new Map();
  const nav = [];
  const dialogs = [];
  const clipboard = [];
  const mapCalls = [];
  const timers = new Map();
  let timerId = 0;
  let app;
  // Keep page tests independent of the machine clock and drive foreground refreshes synchronously.
  Date.now = () => wallTime;
  global.setTimeout = (run, delay) => {
    timers.set(++timerId, { run, due: wallTime + delay });
    return timerId;
  };
  global.clearTimeout = id => timers.delete(id);
  global.App = options => { app = options; };
  global.getApp = () => app;
  global.wx = {
    getStorageSync(key) { return structuredClone(state.get(key)); },
    setStorageSync(key, value) { state.set(key, structuredClone(value)); },
    showToast() {},
    setNavigationBarTitle() {},
    pageScrollTo() {},
    setClipboardData({ data }) { clipboard.push(data); },
    openLocation(options) { mapCalls.push(options); },
    showModal(options) { dialogs.push(options); },
    showActionSheet(options) { dialogs.push(options); },
    navigateTo(options) { nav.push(options.url); },
    navigateBack() { nav.push('back'); },
    redirectTo(options) { nav.push(options.url); if (options.complete) options.complete(); },
    reLaunch(options) { nav.push(options.url); }
  };
  const root = path.resolve(__dirname, '..');
  function load(file) {
    const target = require.resolve(path.join(root, file));
    delete require.cache[target];
    require(target);
  }
  load('app.js');

  function open(name, query = {}) {
    let page;
    global.Page = options => { page = options; };
    load('pages/' + name + '/index.js');
    page.data = structuredClone(page.data || {});
    page.setData = (changes, done) => {
      for (const [key, value] of Object.entries(changes)) {
        const fields = key.split('.');
        const field = fields.pop();
        const target = fields.reduce((object, part) => object[part], page.data);
        target[field] = structuredClone(value);
      }
      if (done) done();
    };
    if (page.onLoad) page.onLoad(query);
    if (page.onShow) page.onShow();
    return page;
  }

  function answer(value) {
    dialogs.pop().success({ confirm: true, content: value, tapIndex: 0 });
  }

  function setWallTime(time, runTimers = true) {
    wallTime = time;
    if (!runTimers) return;
    for (const [id, timer] of [...timers]) {
      if (timer.due <= time && timers.delete(id)) timer.run();
    }
  }

  return { app, open, nav, dialogs, clipboard, mapCalls, answer, root, setWallTime };
}

function event(dataset = {}, value) {
  return { currentTarget: { dataset }, detail: { value } };
}

module.exports = { runtime, event };
