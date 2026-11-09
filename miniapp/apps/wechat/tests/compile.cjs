const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const { runtime, event } = require('./harness.cjs');
const store = require('../lib/storage');
const booking = require('../lib/booking');

const compiler = require(process.env.LINGJU_COMPILER || 'miniprogram-compiler');
const r = runtime();
const manifest = require('../app.json');
const wxml = compiler.wxmlToJs(r.root);
const wxss = compiler.wxssToJs(r.root);
assert.ok(typeof wxml === 'string' && wxml.length > 0, String(wxml));
assert.ok(typeof wxss === 'string' && wxss.length > 0, String(wxss));
const render = new Function('window', 'global', wxml)({}, {});

for (const route of manifest.pages) {
  for (const ext of ['js', 'json', 'wxml']) assert.ok(existsSync(path.join(r.root, route + '.' + ext)));
  const pageName = route.split('/')[1];
  const page = r.open(pageName, pageName === 'task' ? { id: 's1' } : {});
  const view = render(route + '.wxml')(page.data);
  assert.equal(view.tag, 'wx-page');
  assert.ok(view.children.length);
  const template = readFileSync(path.join(r.root, route + '.wxml'), 'utf8');
  for (const [, handler] of template.matchAll(/\b(?:bind|catch)[a-z]+="([\w]+)"/g)) {
    assert.equal(typeof page[handler], 'function', route + ' missing handler ' + handler);
  }
  console.log('WXML compiled and rendered:', route);
}
console.log('WXSS compiled:', wxss.length, 'characters');

function pageText(node) {
  if (typeof node === 'string') return node;
  return (node.children || []).map(pageText).join(' ');
}

function findButton(node, label) {
  if (node.tag === 'wx-button' && pageText(node).trim() === label) return node;
  for (const child of node.children || []) {
    const button = findButton(child, label);
    if (button) return button;
  }
  return null;
}

const task = r.open('task', { id: 's1' });
const renderTask = render('pages/task/index.wxml');
assert.equal(findButton(renderTask(task.data), '确认模拟预约').attr.disabled, true);
task.start(event({ minute: 540 }));
assert.equal(findButton(renderTask(task.data), '确认模拟预约').attr.disabled, true);
task.end(event({ minute: 600 }));
assert.equal(Boolean(findButton(renderTask(task.data), '确认模拟预约').attr.disabled), false);
task.submit();

const { id } = store.read().orders[0];
const collector = r.open('collector');
const homeText = pageText(render('pages/collector/index.wxml')(collector.data));
assert.match(homeText, /下一单/);
assert.match(homeText, /09:00–10:00/);
const order = r.open('order', { id });
const renderOrder = render('pages/order/index.wxml');
assert.match(pageText(renderOrder(order.data)), /准备前往站点/);
assert.doesNotMatch(pageText(renderOrder(order.data)), /时钟到预约开始/);
order.toggleDemo();
assert.match(pageText(renderOrder(order.data)), /时钟到预约开始/);
order.toggleDemo();
for (const [label, action] of [
  ['模拟开始前往', 'travel'], ['模拟到店签到', 'arrive'], ['模拟自助领机并开始采集', 'collect'],
  ['模拟完成采集', 'stop'], ['提交归还并模拟上传', 'return']
]) {
  const button = findButton(renderOrder(order.data), label);
  assert.equal(button.attr['data-action'], action);
  assert.equal(button.attr.bindtap, 'perform');
  order.perform(event({ action }));
}
assert.match(pageText(renderOrder(order.data)), /已提交 · 待核验/);
store.change(state => booking.verifyReturn(state, id, '模拟设备已放回原箱'));
order.onShow();
const resultText = pageText(renderOrder(order.data));
assert.match(resultText, /已核验归还/);
assert.match(resultText, /待审核/);
assert.match(resultText, /质检后确认/);
console.log('WXML flow states rendered: explicit booking, next order, arrival guidance and independent results');
