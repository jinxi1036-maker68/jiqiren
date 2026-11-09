const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const { runtime, event } = require('./harness.cjs');
const store = require('../lib/storage');
const booking = require('../lib/booking');
const merchant = require('../lib/merchant');

const compiler = require(process.env.LINGJU_COMPILER || 'miniprogram-compiler');
const r = runtime();
const manifest = require('../app.json');
const wxml = compiler.wxmlToJs(r.root);
const wxss = compiler.wxssToJs(r.root);
assert.ok(typeof wxml === 'string' && wxml.length > 0, String(wxml));
assert.ok(typeof wxss === 'string' && wxss.length > 0, String(wxss));
assert.match(wxss, /merchant-visit/);
assert.match(wxss, /order-focus/);
assert.match(wxss, /hub-identity/);
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

const homePage = r.open('home');
const entryView = render('pages/home/index.wxml')(homePage.data);
assert.match(pageText(entryView), /我是商家/);
assert.match(pageText(entryView), /我是采集员/);
const collectorEntry = render('pages/collector/index.wxml')(r.open('collector').data);
assert.equal(findButton(collectorEntry, '切换身份').attr.bindtap, 'switchRole');
assert.match(pageText(collectorEntry), /新手采集计划/);
const profilePage = r.open('collector');
profilePage.section(event({ section: 'credit' }));
const profileView = render('pages/collector/index.wxml')(profilePage.data);
assert.equal(findButton(profileView, '我的订单').attr.bindtap, 'section');
assert.match(pageText(profileView), /点击登录/);
for (const label of ['我的券', '邀请好友', '投诉建议', '服务指南', '关于我们', '设置']) {
  assert.ok(pageText(profileView).includes(label));
}
const renderAccount = render('pages/account/index.wxml');
const benefits = r.open('account', { view: 'benefits' });
assert.match(pageText(renderAccount(benefits.data)), /登录后参与/);
const login = r.open('account', { view: 'login' });
assert.equal(findButton(renderAccount(login.data), '一键演示登录').attr.bindtap, 'login');
login.login();
benefits.onShow();
assert.equal(findButton(renderAccount(benefits.data), '领取演示券').attr.bindtap, 'claimCoupon');
assert.equal(findButton(renderAccount(benefits.data), '去预约采集').attr.bindtap, 'findTasks');
benefits.claimCoupon(event({ id: 'welcome' }));
assert.match(pageText(renderAccount(r.open('account', { view: 'coupons' }).data)), /新人体验券/);
const inviteView = renderAccount(r.open('account', { view: 'invite' }).data);
assert.equal(findButton(inviteView, '复制演示邀请码').attr.bindtap, 'copyCode');
const feedbackView = renderAccount(r.open('account', { view: 'feedback' }).data);
assert.equal(findButton(feedbackView, '提交模拟反馈').attr.disabled, true);
const merchantProfile = r.open('merchant');
merchantProfile.section(event({ section: 'profile' }));
const merchantProfileText = pageText(render('pages/merchant/index.wxml')(merchantProfile.data));
assert.match(merchantProfileText, /查看门店入驻进度/);
assert.match(merchantProfileText, /投诉建议/);
assert.doesNotMatch(merchantProfileText, /邀请好友/);

const task = r.open('task', { id: 's1' });
const renderTask = render('pages/task/index.wxml');
assert.ok(findButton(renderTask(task.data), '复制地址'));
assert.equal(findButton(renderTask(task.data), '地图导航').attr.bindtap, 'openMap');
assert.doesNotMatch(pageText(renderTask(task.data)), /设备箱位置/);
assert.equal(findButton(renderTask(task.data), '确认模拟预约').attr.disabled, true);
task.start(event({ minute: 540 }));
assert.equal(findButton(renderTask(task.data), '确认模拟预约').attr.disabled, true);
assert.match(pageText(renderTask(task.data)), /再选结束时间/);
task.end(event({ minute: 600 }));
assert.equal(Boolean(findButton(renderTask(task.data), '确认模拟预约').attr.disabled), false);
task.submit();

const { id } = store.read().orders[0];
const previewShop = r.open('merchant');
previewShop.persona(event({}, '0'));
const renderMerchant = render('pages/merchant/index.wxml');
const board = renderMerchant(previewShop.data);
assert.match(pageText(board), /下一位到店/);
assert.match(pageText(board), /设备可用/);
assert.match(pageText(board), /缓冲/);
assert.equal(findButton(board, '查看今日排班').attr.bindtap, 'showTodaySchedule');
const collector = r.open('collector');
const homeText = pageText(render('pages/collector/index.wxml')(collector.data));
assert.match(homeText, /下一单/);
assert.match(homeText, /09:00–10:00/);
const order = r.open('order', { id });
const renderOrder = render('pages/order/index.wxml');
assert.match(pageText(renderOrder(order.data)), /准备前往站点/);
assert.match(pageText(renderOrder(order.data)), /设备箱位置/);
assert.equal(findButton(renderOrder(order.data), '地图导航').attr.bindtap, 'openMap');
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
previewShop.onShow();
assert.match(pageText(renderMerchant(previewShop.data)), /待凌矩核验/);
store.change(state => booking.verifyReturn(state, id, '模拟设备已放回原箱'));
order.onShow();
const resultText = pageText(renderOrder(order.data));
assert.match(resultText, /已核验归还/);
assert.match(resultText, /待审核/);
assert.match(resultText, /质检后确认/);
assert.match(resultText, /订单回执/);

const later = r.open('task', { id: 's1' });
later.start(event({ minute: 630 }));
later.end(event({ minute: 690 }));
later.submit();
const affectedId = store.read().orders[0].id;
store.change(state => merchant.schedule(state, 's1', '2026-11-09', []));
const affected = r.open('order', { id: affectedId });
assert.equal(affected.data.mainAction, null);
const affectedView = renderOrder(affected.data);
assert.match(pageText(affectedView), /处理预约变更/);
assert.equal(findButton(affectedView, '遇到问题').attr.bindtap, 'toggleIssue');
assert.equal(findButton(affectedView, '选择其他时段').attr.bindtap, 'reschedule');
affected.toggleIssue();
assert.equal(findButton(renderOrder(affected.data), '提交模拟求助').attr.disabled, true);
assert.ok(findButton(renderOrder(affected.data), '地图导航'));
assert.ok(findButton(renderOrder(affected.data), '选择其他时段'));
affected.issueDetails(event({}, '模拟箱子打不开'));
assert.equal(Boolean(findButton(renderOrder(affected.data), '提交模拟求助').attr.disabled), false);
affected.reportIssue();

r.app.onLaunch({ path: 'pages/ops/index', query: { mode: 'mock-ops' } });
const ops = r.open('ops', { mode: 'mock-ops' });
const renderOps = render('pages/ops/index.wxml');
assert.match(pageText(renderOps(ops.data)), /模拟箱子打不开/);
ops.openWork(event(ops.data.work[0]));
assert.ok(findButton(renderOps(ops.data), '回复并结案'));

const shop = r.open('merchant');
shop.persona(event({}, '0'));
shop.section(event({ section: 'schedule' }));
shop.scheduleMode(event({ mode: 'date' }));
shop.restoreDate();
const shopView = render('pages/merchant/index.wxml')(shop.data);
assert.ok(findButton(shopView, '确认变更'));
assert.match(pageText(shopView), /将新增影响 0 笔预约/);
shop.confirmSchedule();
const editor = renderMerchant(shop.data);
assert.equal(findButton(editor, '预览变更').attr.bindtap, 'previewCurrent');
assert.equal(findButton(editor, '暂停这一天').attr.bindtap, 'pauseDate');
shop.section(event({ section: 'income' }));
const ledger = renderMerchant(shop.data);
assert.match(pageText(ledger), /当月已确认/);
assert.match(pageText(ledger), /待结算.*待打款.*已到账/);
shop.showIncomeDetail(event({ id: shop.data.venue.entries[0].id }));
assert.match(pageText(renderMerchant(shop.data)), /场地收益明细.*关联订单.*归还核验时间/);
shop.section(event({ section: 'profile' }));
const shopProfile = renderMerchant(shop.data);
assert.equal(findButton(shopProfile, '查看设备记录').attr.bindtap, 'showStoreDetail');
assert.equal(findButton(shopProfile, '设备问题求助').attr.bindtap, 'openAccount');
console.log('WXML flow states rendered: booking, station guide, return receipt, independent help, ops queue and schedule review');
