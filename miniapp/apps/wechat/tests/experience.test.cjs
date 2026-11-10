const assert = require('node:assert/strict');
const test = require('node:test');
const { runtime, event } = require('./harness.cjs');
const store = require('../lib/storage');
const booking = require('../lib/booking');
const reviews = require('../lib/reviews');
const experience = require('../lib/experience');
const { at } = require('../lib/catalog');

const DATE = '2026-11-09';

test('从个人中心登录，领取新人券后可查看，重复领取或切换人员不会共用券', () => {
  const r = runtime();
  const collector = r.open('collector');
  collector.section(event({ section: 'credit' }));
  assert.equal(collector.data.account.loggedIn, false);
  collector.openAccount(event({ view: 'login' }));
  assert.equal(r.nav.pop(), '/pages/account/index?role=collector&view=login');

  const benefits = r.open('account', { view: 'benefits' });
  benefits.claimCoupon(event({ id: 'welcome' }));
  assert.match(r.dialogs.pop().content, /先完成演示登录/);
  r.open('account', { view: 'login' }).login();
  assert.equal(r.nav.pop(), 'back');
  benefits.onShow();
  benefits.claimCoupon(event({ id: 'welcome' }));
  benefits.claimCoupon(event({ id: 'welcome' }));
  assert.match(r.dialogs.pop().content, /已领取/);
  assert.equal(r.open('account', { view: 'coupons' }).data.account.coupons.length, 1);
  assert.equal(benefits.data.offers.find(offer => offer.id === 'first-order').eligible, false);

  const settings = r.open('account', { view: 'settings' });
  settings.campaignSetting(event({}, false));
  collector.onShow();
  assert.equal(collector.data.account.showCampaign, false);
  collector.persona(event({}, '1'));
  assert.equal(collector.data.account.loggedIn, false);
  assert.equal(collector.data.account.coupons.length, 0);
  assert.equal(collector.data.account.showCampaign, true);
});

test('邀请和首单礼在归还核验及有效质检后才可记录，重复操作不产生第二笔', () => {
  const r = runtime();
  const collector = r.open('collector');
  r.open('account', { view: 'login' }).login();
  const inviter = r.open('account', { view: 'invite' });
  inviter.copyCode();
  assert.deepEqual(r.clipboard, ['LJ-C1']);
  inviter.editCode(event({}, 'LJ-C1'));
  inviter.bindInvite();
  assert.match(r.dialogs.pop().content, /好友的邀请码/);

  collector.persona(event({}, '1'));
  r.open('account', { view: 'login' }).login();
  const invited = r.open('account', { view: 'invite' });
  invited.editCode(event({}, 'LJ-C1'));
  invited.bindInvite();
  assert.equal(invited.data.invite.incoming, '采集员 A');

  const order = store.change(state => {
    const reservation = booking.create(state, 'c2', { stationId: 's1', date: DATE, start: 540, end: 660 });
    booking.advance(state, at(DATE, 540));
    booking.perform(state, 'c2', reservation.id, 'arrive');
    booking.perform(state, 'c2', reservation.id, 'collect');
    booking.advance(state, at(DATE, reservation.end));
    booking.perform(state, 'c2', reservation.id, 'return');
    return reservation;
  });
  assert.equal(experience.invitationStatus(store.read(), 'c1').outgoing[0].canClaim, false);
  store.change(state => reviews.qaReview(state, order.id, 45, '模拟有效45分钟'));
  assert.equal(experience.invitationStatus(store.read(), 'c1').outgoing[0].canClaim, false);
  const benefits = r.open('account', { view: 'benefits' });
  assert.equal(benefits.data.offers[1].eligible, false);
  store.change(state => booking.verifyReturn(state, order.id, '模拟设备在箱'));
  benefits.onShow();
  assert.equal(benefits.data.offers[1].eligible, true);
  benefits.claimCoupon(event({ id: 'first-order' }));
  assert.equal(r.open('account', { view: 'coupons' }).data.account.coupons[0].title, '首单完成礼');

  collector.persona(event({}, '0'));
  inviter.onShow();
  const invite = inviter.data.invite.outgoing[0];
  assert.equal(invite.canClaim, true);
  const earningsCount = store.read().earnings.length;
  inviter.claimInvite(event({ id: invite.id }));
  assert.equal(inviter.data.invite.outgoing[0].label, '已记录演示奖励');
  inviter.claimInvite(event({ id: invite.id }));
  assert.match(r.dialogs.pop().content, /无可领取/);
  assert.equal(store.read().earnings.length, earningsCount);
});

test('反馈进入模拟运营待办，回复回到原账号，两端服务指南内容不同', () => {
  const r = runtime();
  const collectorGuide = r.open('account', { view: 'guide' });
  const merchantGuide = r.open('account', { view: 'guide', role: 'merchant' });
  assert.equal(collectorGuide.data.steps[0].title, '选站点和时间');
  assert.equal(merchantGuide.data.steps[0].title, '提交门店申请');
  const page = r.open('account', { view: 'feedback', role: 'merchant' });
  page.topic(event({}, '1'));
  page.message(event({}, '暂停营业后，希望在门店概览提醒受影响的预约。'));
  page.sendFeedback();
  assert.equal(page.data.account.feedback[0].topic, '投诉反馈');
  assert.equal(r.open('account', { view: 'feedback' }).data.account.feedback.length, 0);

  r.app.onLaunch({ path: 'pages/ops/index', query: { mode: 'mock-ops' } });
  const ops = r.open('ops', { mode: 'mock-ops' });
  const task = ops.data.work.find(item => item.section === 'feedback');
  assert.equal(task.label, '投诉反馈');
  ops.openWork(event(task));
  assert.equal(ops.data.section, 'feedback');
  ops.act(event({ action: 'feedback', id: ops.data.feedback[0].id }));
  r.answer('凌矩已记录，暂停时可在概览查到影响订单。');
  page.onShow();
  assert.match(page.data.account.feedback[0].reply, /已记录/);
  assert.equal(ops.data.work.some(item => item.section === 'feedback'), false);
});
