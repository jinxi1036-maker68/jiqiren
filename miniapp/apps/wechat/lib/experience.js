const { stamp } = require('./catalog');
const { byId, nextId, notify, record, requireThat, text } = require('./model');

const CAMPAIGNS = [
  { id: 'welcome', title: '新人体验券', detail: '完成演示登录，即可领取一张体验券。', label: '新手福利' },
  { id: 'first-order', title: '首单完成礼', detail: '首笔采集归还经凌矩核验，且质检有有效时长后可领取。', label: '完成采集' }
];
const TOPICS = ['体验建议', '投诉反馈', '功能问题', '门店推荐'];
const EMPTY = { profiles: {}, coupons: [], invites: [], feedback: [] };

function data(state) {
  return state.experience || EMPTY;
}

function edit(state) {
  if (!state.experience) state.experience = { profiles: {}, coupons: [], invites: [], feedback: [] };
  return state.experience;
}

function identity(state, role) {
  const merchant = role === 'merchant';
  const actor = merchant ? state.merchant : state.collector;
  const member = byId(merchant ? state.stations : state.collectors, actor);
  const key = (merchant ? 'merchant:' : 'collector:') + actor;
  const saved = data(state).profiles[key] || {};
  return { actor, key, name: member.name, loggedIn: Boolean(saved.loggedIn), showCampaign: saved.showCampaign !== false };
}

function updateProfile(state, role, changes) {
  const { key } = identity(state, role);
  const profiles = edit(state).profiles;
  profiles[key] = { ...profiles[key], ...changes };
}

function signedIn(state, role) {
  const account = identity(state, role);
  requireThat(account.loggedIn, '请先完成演示登录');
  return account;
}

function firstQualifiedOrder(state, actor) {
  return state.orders.find(order => order.collectorId === actor && order.status === 'done' && order.qa
    && order.qa.valid + (order.qaAppeal?.result?.extra || 0) > 0);
}

function campaignStatus(state, actor) {
  const coupons = data(state).coupons.filter(item => item.actor === actor);
  const qualified = Boolean(firstQualifiedOrder(state, actor));
  return CAMPAIGNS.map(item => ({
    ...item,
    claimed: coupons.some(coupon => coupon.campaign === item.id),
    eligible: item.id === 'welcome' || qualified
  }));
}

function claimCoupon(state, id) {
  const { actor } = signedIn(state, 'collector');
  const offer = byId(campaignStatus(state, actor), id);
  requireThat(!offer.claimed, '该体验券已领取');
  requireThat(offer.eligible, '完成有效采集和归还核验后可领取');
  edit(state).coupons.unshift({ id: nextId(state, 'CO'), actor, campaign: id, title: offer.title, at: state.now });
}

function inviteCode(actor) {
  return 'LJ-' + actor.toUpperCase();
}

function bindInvite(state, code) {
  const { actor } = signedIn(state, 'collector');
  const inviter = state.collectors.find(item => inviteCode(item.id) === code.trim().toUpperCase());
  requireThat(inviter, '邀请码有误，请核对后重试');
  requireThat(inviter.id !== actor, '请填写好友的邀请码');
  const invites = data(state).invites;
  requireThat(!invites.some(item => item.invitee === actor), '已经填写过邀请码');
  requireThat(!invites.some(item => item.inviter === actor), '当前账号已发起过邀请');
  requireThat(!state.orders.some(order => order.collectorId === actor), '请在首次预约前填写邀请码');
  edit(state).invites.push({ id: nextId(state, 'IV'), inviter: inviter.id, invitee: actor });
}

function invitationStatus(state, actor) {
  const invitations = data(state).invites;
  const incoming = invitations.find(item => item.invitee === actor);
  const canBind = !incoming && !invitations.some(item => item.inviter === actor) && !state.orders.some(order => order.collectorId === actor);
  const outgoing = invitations.filter(item => item.inviter === actor).map(item => {
    const qualifying = Boolean(firstQualifiedOrder(state, item.invitee));
    const hasActive = state.orders.some(order => order.collectorId === item.invitee && order.status !== 'cancelled' && order.status !== 'missed');
    return { ...item, name: byId(state.collectors, item.invitee).name, canClaim: qualifying && !item.rewardedAt,
      label: item.rewardedAt ? '已记录演示奖励' : qualifying ? '可记录奖励' : hasActive ? '等待完成有效采集' : '等待好友预约' };
  });
  return { code: inviteCode(actor), incoming: incoming ? byId(state.collectors, incoming.inviter).name : '', canBind, outgoing };
}

function claimInvite(state, id) {
  const { actor } = signedIn(state, 'collector');
  const item = byId(data(state).invites, id);
  requireThat(item.inviter === actor && !item.rewardedAt && firstQualifiedOrder(state, item.invitee), '当前邀请无可领取的演示奖励');
  item.rewardedAt = state.now;
}

function sendFeedback(state, role, topic, value) {
  requireThat(TOPICS.includes(topic), '请选择反馈类型');
  const message = text(value, '请填写反馈内容');
  const { actor, key, name } = identity(state, role);
  const id = nextId(state, 'FB');
  edit(state).feedback.unshift({ id, actor, key, role, name, topic, message, at: state.now });
  record(state, actor, '提交模拟反馈', id, topic);
}

function replyFeedback(state, id, value) {
  const item = byId(data(state).feedback, id);
  requireThat(!item.reply, '该反馈已有回复');
  item.reply = text(value, '请填写处理结果');
  item.repliedAt = state.now;
  record(state, 'ops', '回复模拟反馈', id, item.topic);
  if (item.role === 'collector') notify(state, item.actor, id, '反馈已回复', '在「我的 → 投诉建议」查看处理结果。');
}

function feedbackList(state) {
  return data(state).feedback.map(item => ({ ...item, time: stamp(item.at) }));
}

function accountView(state, role) {
  const profile = identity(state, role);
  const coupons = role === 'merchant' ? [] : data(state).coupons.filter(item => item.actor === profile.actor)
    .map(item => ({ ...item, time: stamp(item.at) }));
  const feedback = feedbackList(state).filter(item => item.key === profile.key);
  return { ...profile, role, merchant: role === 'merchant', coupons, feedback };
}

function openAccount(event, replace = false) {
  const { role = 'collector', view, topic } = event.currentTarget.dataset;
  const topicIndex = TOPICS.indexOf(topic);
  const url = '/pages/account/index?role=' + role + '&view=' + view
    + (view === 'feedback' && topicIndex >= 0 ? '&topic=' + topicIndex : '');
  if (replace) wx.redirectTo({ url });
  else wx.navigateTo({ url });
}

module.exports = { TOPICS, accountView, updateProfile, campaignStatus, claimCoupon, invitationStatus, bindInvite, claimInvite,
  sendFeedback, replyFeedback, feedbackList, openAccount };
