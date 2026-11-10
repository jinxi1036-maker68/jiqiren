const test = require('node:test');
const assert = require('node:assert/strict');
const { seed, at, DAY, HOUR, MINUTE } = require('../lib/catalog');
const { credit, stationFor } = require('../lib/model');
const booking = require('../lib/booking');
const merchant = require('../lib/merchant');
const reviews = require('../lib/reviews');
const ui = require('../lib/ui');

const DATE = '2026-11-09';
const FORM = { name: '测试文具（虚构）', address: '样例地址', district: '新华区', contact: '演示店主', phone: '示例-0000',
  entrance: '正门', locker: '演示箱 A', area: '文具示范台',
  task: 'stationery', photos: ['front', 'inside', 'device'] };

function reserve(state, collector = 'c1', stationId = 's1', start = 540, end = 660, date = DATE) {
  return booking.create(state, collector, { stationId, date, start, end });
}

function tick(state, time) {
  booking.advance(state, time);
  reviews.deadlineAlerts(state);
}

function start(state, order, delay = 0) {
  tick(state, at(order.date, order.start + delay));
  booking.perform(state, order.collectorId, order.id, 'arrive');
  booking.perform(state, order.collectorId, order.id, 'collect');
}

function submit(state, order, late = 0) {
  tick(state, at(order.date, order.end + late));
  booking.perform(state, order.collectorId, order.id, 'return');
}

function outage(state, depart = true) {
  const order = reserve(state);
  if (depart) booking.perform(state, 'c1', order.id, 'travel');
  const report = booking.report(state, 'c1', order.id, '模拟密码箱故障', true);
  booking.pause(state, 's1', '模拟核实锁箱不可用', report.id);
  booking.cancel(state, 'c1', order.id);
  return order;
}

test('双人争同一设备时段只有一笔成功，重复提交不生成第二单', () => {
  const state = seed();
  const first = reserve(state);
  assert.equal(reserve(state).id, first.id);
  assert.throws(() => reserve(state, 'c2'), /时段冲突/);
  assert.equal(state.orders.length, 1);
});

test('同设备前后缓冲严格30分钟，个人跨设备也不能重叠', () => {
  const state = seed();
  reserve(state, 'c1', 's1', 690, 810);
  assert.throws(() => reserve(state, 'c2', 's1', 570, 690), /30分钟/);
  assert.throws(() => reserve(state, 'c2', 's1', 810, 930), /30分钟/);
  assert.throws(() => reserve(state, 'c1', 's2', 690, 810), /时间重叠/);
  reserve(state, 'c2', 's1', 540, 660);
  reserve(state, 'c2', 's1', 840, 960);
});

test('同日结束，恰好提前15分钟可约，晚于该边界拒绝', () => {
  const state = seed();
  merchant.schedule(state, 's1', DATE, [[540, 1095]]);
  assert.throws(() => reserve(state, 'c1', 's1', 1350, 1440), /自然日/);
  assert.throws(() => reserve(state, 'c1', 's1', 990, 1110), /提前15分钟/);
  assert.throws(() => reserve(state, 'c1', 's1', 960, 1081), /提前15分钟/);
  assert.throws(() => reserve(state, 'c1', 's1', 540, 660, '2026-02-30'), /自然日/);
  assert.equal(reserve(state, 'c1', 's1', 960, 1080).end, 1080);
});

test('任务最小、最大、设备日上限生效', () => {
  const state = seed();
  assert.throws(() => reserve(state, 'c1', 's2', 600, 660), /至少 2 小时/);
  assert.throws(() => reserve(state, 'c1', 's3', 600, 750), /任务时长/);
  merchant.schedule(state, 's2', DATE, [[600, 1200]]);
  reserve(state, 'c1', 's2', 600, 780);
  reserve(state, 'c2', 's2', 810, 990);
  assert.throws(() => reserve(state, 'c1', 's2', 1020, 1140), /日采集时长/);
});

test('已有一小时预约可按原时段履行，改约不足两小时被拒绝', () => {
  const state = seed();
  const order = reserve(state);
  // Simulate an existing reservation saved before the minimum changed.
  order.end = 600;
  order.requestKey = ['c1', 's1', DATE, 540, 600, ''].join('|');
  assert.equal(reserve(state, 'c1', 's1', 540, 600).id, order.id);
  assert.throws(() => booking.create(state, 'c1', { replaceId: order.id, stationId: 's1', date: DATE,
    start: 660, end: 750, reason: '模拟改期' }), /至少 2 小时/);
  start(state, order);
  submit(state, order);
  assert.equal(order.actual, 60);
  assert.equal(order.status, 'submitted');
});

test('商家审核、安装和到位确认均不能提前开启预约', () => {
  const state = seed();
  merchant.apply(state, 'new', FORM);
  merchant.reviewSite(state, 'new', 'supplement', '补充模拟场地资料');
  merchant.apply(state, 'new', FORM);
  merchant.reviewSite(state, 'new', 'approved', '场地符合演示部署条件');
  assert.throws(() => reserve(state, 'c1', 'new'), /尚未开放/);
  merchant.install(state, 'new');
  assert.throws(() => reserve(state, 'c1', 'new'), /尚未开放/);
  merchant.confirmInstallation(state, 'new');
  assert.throws(() => reserve(state, 'c1', 'new'), /尚未开放/);
  merchant.schedule(state, 'new', 0, [[540, 720], [840, 1080]]);
  assert.throws(() => reserve(state, 'c1', 'new', 720, 840), /开放时间/);
  assert.throws(() => reserve(state, 'c1', 'new', 540, 660, '2026-11-10'), /开放时间/);
  assert.equal(reserve(state, 'c1', 'new').stationId, 'new');
});

test('暂停指定日期保留原单，只影响对应设备，可无责改约', () => {
  const state = seed();
  const old = reserve(state);
  const unaffected = reserve(state, 'c2', 's2', 600, 720);
  merchant.schedule(state, 's1', DATE, []);
  assert.equal(old.status, 'booked');
  assert.equal(old.closed, true);
  assert.equal(unaffected.closed, undefined);
  assert.throws(() => reserve(state, 'c2', 's1', 660, 780), /开放时间/);
  const moved = booking.create(state, 'c1', { replaceId: old.id, stationId: 's3', date: DATE, start: 540, end: 660 });
  assert.equal(old.status, 'cancelled');
  assert.equal(old.cancellation.exempt, true);
  assert.equal(moved.replacedFrom, old.id);
  assert.equal(state.messages.filter(item => item.title === '门店开放时间有变').length, 1);
});

test('改约校验失败保留原预约，成功后旧提醒失效且新单防重', () => {
  const state = seed();
  const date = '2026-11-10';
  const old = reserve(state, 'c1', 's1', 540, 660, date);
  reserve(state, 'c2', 's1', 690, 810, date);
  const request = { replaceId: old.id, stationId: 's1', date, start: 690, end: 810 };
  assert.throws(() => booking.create(state, 'c1', request), /时段冲突/);
  assert.equal(old.status, 'booked');
  const revised = { ...request, start: 840, end: 960 };
  const next = booking.create(state, 'c1', revised);
  assert.equal(booking.create(state, 'c1', revised).id, next.id);
  tick(state, at(date, 839));
  const reminders = state.messages.filter(item => item.key.includes(':pre'));
  assert.equal(reminders.filter(item => item.orderId === old.id).length, 0);
  assert.equal(reminders.filter(item => item.orderId === next.id).length, 3);
});

test('取消释放资源并撤销将来提醒，开始不足两小时要求理由且不自动扣分', () => {
  const state = seed();
  const first = reserve(state);
  assert.throws(() => booking.cancel(state, 'c1', first.id), /填写原因/);
  booking.cancel(state, 'c1', first.id, '无法按时到店');
  reserve(state, 'c2');
  tick(state, at(DATE, 540));
  assert.ok(!state.messages.some(item => item.orderId === first.id && item.key.includes(':pre')));
  assert.equal(credit(state, 'c1').score, 100);
});

test('隔离采集员订单，迟到仍可在剩余时间采集且到期截断', () => {
  const state = seed();
  const order = reserve(state);
  assert.throws(() => booking.perform(state, 'c2', order.id, 'travel'), /自己的预约/);
  start(state, order, 95);
  assert.ok(order.suspected);
  assert.equal(order.end, 660);
  tick(state, at(DATE, 680));
  assert.equal(order.status, 'stopped');
  assert.equal(order.actual, 25);
  assert.throws(() => booking.perform(state, 'c1', order.id, 'collect'), /预约时段/);
  assert.equal(credit(state, 'c1').score, 100);
});

test('自报归还不能产生场地收益，核验后独立于个人QA', () => {
  const state = seed();
  const order = reserve(state);
  start(state, order);
  assert.throws(() => booking.verifyReturn(state, order.id, '核验记录'), /先提交/);
  submit(state, order);
  assert.equal(order.status, 'submitted');
  assert.equal(state.earnings.length, 0);
  assert.equal(ui.income(state, 'c1', '2026-11').pending, '60.00');
  booking.verifyReturn(state, order.id, '模拟设备在箱且可用');
  booking.verifyReturn(state, order.id, '重复调用');
  reviews.qaReview(state, order.id, 0, '样例遮挡，请保持操作台可见');
  assert.equal(order.status, 'done');
  assert.equal(ui.ledger(state, 's1', '2026-11').length, 1);
  assert.equal(ui.income(state, 'c1', '2026-11').confirmed, '0.00');
});

test('跨月待审保留，部分复核只在下一期补差额', () => {
  const state = seed();
  const date = '2026-11-30';
  const order = reserve(state, 'c1', 's1', 540, 660, date);
  start(state, order);
  submit(state, order);
  booking.verifyReturn(state, order.id, '模拟设备在箱可用');
  tick(state, at('2026-12-01', 540));
  assert.equal(ui.income(state, 'c1', '2026-12').pending, '60.00');
  assert.equal(ui.income(state, 'c1', '2026-11').confirmed, '0.00');
  reviews.qaReview(state, order.id, 30, '后段遮挡，请调整视角');
  reviews.appealQA(state, 'c1', order.id, '复查后半段样例');
  assert.equal(ui.income(state, 'c1', '2026-12').confirmed, '15.00');
  assert.throws(() => reviews.resolveQA(state, order.id, 91, '模拟复核'), /超过争议范围/);
  reviews.resolveQA(state, order.id, 15, '补充确认15分钟');
  assert.equal(order.qa.valid, 30);
  assert.equal(ui.income(state, 'c1', '2027-01').confirmed, '7.50');
  assert.equal(ui.income(state, 'c1', '2026-12').pending, '0.00');
  assert.throws(() => reviews.resolveQA(state, order.id, 15, '重复复核'), /没有待复核/);
});

test('逾期5/15/30分钟分别提醒，后序订单受保护并需运营复开', () => {
  const state = seed();
  const first = reserve(state);
  const next = reserve(state, 'c2', 's1', 690, 810);
  start(state, first);
  submit(state, first, 30);
  assert.ok(next.impact);
  assert.equal(next.status, 'booked');
  assert.ok(state.messages.some(item => item.key.endsWith(':late-return5')));
  assert.ok(state.messages.some(item => item.recipient === 'ops' && item.key.endsWith(':late-return15')));
  assert.ok(state.messages.some(item => item.recipient === 'ops' && item.key.endsWith(':late-return30')));
  assert.throws(() => reserve(state, 'c1', 's1', 840, 960), /暂停/);
  assert.throws(() => booking.reopen(state, 's1', '待查'), /待核验归还/);
  assert.throws(() => booking.perform(state, 'c2', next.id, 'arrive'), /设备可用/);
  booking.verifyReturn(state, first.id, '设备在箱且可用（模拟）');
  assert.throws(() => reserve(state, 'c1', 's1', 840, 960), /暂停/);
  booking.reopen(state, 's1', '模拟修复检查通过');
  assert.equal(next.impact, null);
  booking.perform(state, 'c2', next.id, 'arrive');
  assert.equal(credit(state, 'c1').score, 100);
});

test('在预约结束后五分钟前核验归还，后续催还停止', () => {
  const state = seed();
  const order = reserve(state);
  start(state, order);
  submit(state, order);
  booking.verifyReturn(state, order.id, '演示核验通过');
  tick(state, at(DATE, order.end + 60));
  assert.equal(state.messages.filter(item => item.key.includes('late-return')).length, 0);
});

test('故障自报不暂停、运营核实才暂停，未响应的确认故障订单到点无责取消', () => {
  const state = seed();
  const first = reserve(state);
  const report = booking.report(state, 'c1', first.id, '模拟故障', false);
  const next = reserve(state, 'c2', 's1', 690, 810);
  booking.pause(state, 's1', '确认模拟异常', report.id);
  tick(state, at(DATE, 540));
  assert.equal(first.status, 'cancelled');
  assert.equal(first.cancellation.exempt, true);
  assert.equal(next.status, 'booked');
  assert.equal(credit(state, 'c1').score, 100);
  assert.equal(state.messages.filter(item => item.orderId === first.id && item.key.includes(':pre')).length, 0);
});

test('无核实故障、未出发或缺少模拟证据均不产生补贴', () => {
  const noFault = seed();
  const first = reserve(noFault);
  booking.perform(noFault, 'c1', first.id, 'travel');
  booking.cancel(noFault, 'c1', first.id, '自主取消');
  assert.throws(() => reviews.applySubsidy(noFault, 'c1', first.id, 'route'), /核实设备异常/);
  const noTravel = seed();
  const second = outage(noTravel, false);
  assert.throws(() => reviews.applySubsidy(noTravel, 'c1', second.id, 'route'), /已出发/);
  const state = seed();
  const order = outage(state);
  assert.throws(() => reviews.applySubsidy(state, 'c1', order.id, ''), /凭证/);
  assert.equal(state.earnings.length, 0);
});

test('补贴只记一次待发放，旧申请锁定金额，申诉与审核时限独立', () => {
  const state = seed();
  const order = outage(state);
  reviews.applySubsidy(state, 'c1', order.id, 'route');
  assert.throws(() => reviews.updateSubsidy(state, 1600, '普通运营'), /负责人/);
  reviews.updateSubsidy(state, 1600, reviews.LEAD);
  tick(state, state.now + 49 * HOUR);
  assert.ok(state.messages.some(item => item.title === '交通补贴首审逾期'));
  assert.equal(state.earnings.length, 0);
  reviews.reviewSubsidy(state, order.id, false, '演示行程需补充');
  reviews.appealSubsidy(state, 'c1', order.id, '补充模拟行程截图');
  tick(state, state.now + 73 * HOUR);
  assert.ok(state.messages.some(item => item.title === '交通补贴复核逾期'));
  reviews.reviewSubsidy(state, order.id, true, '核实故障和出行证据（模拟）');
  assert.equal(state.earnings[0].cents, 1200);
  assert.equal(state.earnings[0].state, '待发放补贴');
  assert.throws(() => reviews.reviewSubsidy(state, order.id, true, '重试'), /无待办/);
});

test('补贴申请超过48小时，拒绝后的申诉超过72小时分别关闭', () => {
  const state = seed();
  const order = outage(state);
  tick(state, state.now + 48 * HOUR + MINUTE);
  assert.throws(() => reviews.applySubsidy(state, 'c1', order.id, 'route'), /48小时/);
  const next = seed();
  const second = outage(next);
  reviews.applySubsidy(next, 'c1', second.id, 'route');
  reviews.reviewSubsidy(next, second.id, false, '证据不足');
  tick(next, next.now + 72 * HOUR + MINUTE);
  assert.throws(() => reviews.appealSubsidy(next, 'c1', second.id, '演示补充'), /72小时/);
});

test('首次轻微0分，再次2分，90天后轻微按首次，非本人原因不计', () => {
  const state = seed();
  function verify(date, fault, delay) {
    const order = reserve(state, 'c1', 's1', 540, 660, date);
    start(state, order);
    submit(state, order, delay);
    booking.verifyReturn(state, order.id, '演示核验通过');
    reviews.evaluateViolation(state, order.id, { fault, delay, impact: false, reason: '演示责任核实' });
    return order;
  }
  verify(DATE, true, 15);
  const second = verify('2026-11-10', true, 10);
  assert.equal(credit(state, 'c1').score, 98);
  assert.throws(() => reviews.evaluateViolation(state, second.id, { fault: true, delay: 10, reason: '重复' }), /同一事件/);
  verify('2026-11-11', false, 20);
  verify('2027-02-10', true, 5);
  assert.deepEqual(state.violations.map(item => item.points), [0, 2, 0, 0]);
  assert.equal(credit(state, 'c1').score, 100);
});

test('核实下位确实受阻时最高只扣5分，申诉纠错及恢复封顶100', () => {
  const state = seed();
  const first = reserve(state);
  const next = reserve(state, 'c2', 's1', 690, 810);
  start(state, first);
  submit(state, first, 31);
  booking.cancel(state, 'c2', next.id, '因前序设备未归还无法采集');
  booking.verifyReturn(state, first.id, '模拟归还核验');
  reviews.evaluateViolation(state, first.id, { fault: true, delay: 31, impact: true, reason: '已模拟核实后位无法履行' });
  assert.equal(credit(state, 'c1').score, 95);
  const event = state.violations[0];
  reviews.appealCredit(state, 'c1', event.id, '补充模拟设备记录');
  tick(state, state.now + 30 * DAY);
  assert.equal(credit(state, 'c1').score, 96);
  reviews.resolveCredit(state, event.id, true, '纠正模拟误认责任');
  assert.equal(credit(state, 'c1').score, 100);
  assert.equal(event.points, 5);
  assert.equal(event.reversed, true);
});

test('首次个人原因超过15分钟核实扣2分，核实时间不支持的分钟数拒绝', () => {
  const state = seed();
  const order = reserve(state);
  start(state, order);
  submit(state, order, 16);
  booking.verifyReturn(state, order.id, '模拟核验');
  assert.throws(() => reviews.evaluateViolation(state, order.id, { fault: true, delay: 17, reason: '演示' }), /核实时间/);
  reviews.evaluateViolation(state, order.id, { fault: true, delay: 16, reason: '模拟首次超过15分钟' });
  assert.equal(credit(state, 'c1').score, 98);
});

test('低于60分停新预约并开启48小时人工审核，既有订单仍可履行', () => {
  const state = seed();
  const old = reserve(state, 'c1', 's1', 540, 660, '2026-11-12');
  // Import a synthetic history fixture to cross the threshold without replaying nine incidents.
  state.violations = Array.from({ length: 9 }, (_, i) => ({
    id: 'fixture-' + i, collectorId: 'c1', points: 5, fault: true, at: state.now - i * MINUTE
  }));
  reviews.refreshEligibility(state);
  assert.equal(credit(state, 'c1').score, 55);
  assert.throws(() => reserve(state), /信誉低于60分/);
  assert.equal(old.status, 'booked');
  tick(state, state.now + 49 * HOUR);
  assert.ok(state.messages.some(item => item.title === '接单资格审核逾期'));
  assert.equal(credit(state, 'c1').allowed, false);
  start(state, old);
  assert.equal(old.status, 'collecting');
  reviews.reviewEligibility(state, 'c1', true, '模拟人工恢复资格');
  assert.equal(credit(state, 'c1').allowed, true);
});
