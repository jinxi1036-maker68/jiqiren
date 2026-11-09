const path = require('node:path');

function runtime() {
  const state = new Map();
  const nav = [];
  const dialogs = [];
  let app;
  global.App = options => { app = options; };
  global.getApp = () => app;
  global.wx = {
    getStorageSync(key) { return structuredClone(state.get(key)); },
    setStorageSync(key, value) { state.set(key, structuredClone(value)); },
    showToast() {},
    showModal(options) { dialogs.push(options); },
    showActionSheet(options) { dialogs.push(options); },
    navigateTo(options) { nav.push(options.url); },
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
    page.setData = changes => {
      for (const [key, value] of Object.entries(changes)) {
        const fields = key.split('.');
        const field = fields.pop();
        const target = fields.reduce((object, part) => object[part], page.data);
        target[field] = structuredClone(value);
      }
    };
    if (page.onLoad) page.onLoad(query);
    if (page.onShow) page.onShow();
    return page;
  }

  function answer(value) {
    dialogs.pop().success({ confirm: true, content: value, tapIndex: 0 });
  }

  return { app, open, nav, dialogs, answer, root };
}

function event(dataset = {}, value) {
  return { currentTarget: { dataset }, detail: { value } };
}

module.exports = { runtime, event };
