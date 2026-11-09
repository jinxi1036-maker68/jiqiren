const { DAY, HOUR, MINUTE, at, dateOf } = require('./catalog');
const { requireThat, text, byId, nextId, record, notify, ownedOrder, credit } = require('./model');

const OPS = '凌矩模拟运营';
const LEAD = '凌矩模拟运营负责人';

function ledger(state, order, kind, cents, period, status) {
  state.earnings.push({ id: nextId(state, 'L'), party: order.collectorId, orderId: order.id,
    kind, cents, period, state: status, at: state.now });
}

function month(time) {
  return dateOf(time).slice(0, 7);
}

function nextMonth(period) {
  const [year, mon] = period.split('-').map(Number);
  return new Date(Date.UTC(year, mon, 1)).toISOString().slice(0, 7);
}

function qaReview(state, id, valid, reason) {
  const order = byId(state.orders, id);
  requireThat(order.uploadedAt && order.actual > 0 && !order.qa, '须有待审核的模拟采集记录');
  requireThat(Number.isInteger(valid) && valid >= 0 && valid <= order.actual, '有效分钟须介于0和实际采集分钟之间');
  const explanation = valid < order.actual ? text(reason, '请填写无效原因和整改建议') : '模拟样本通过';
  order.qa = { valid, reason: explanation, period: month(state.now), at: state.now, source: '凌矩模拟QA样例' };
  if (valid) ledger(state, order, 'capture', Math.round(valid * order.hourlyCents / 60), order.qa.period, '待结算');
  record(state, OPS, '登记模拟QA结果', id, valid + '分钟 · ' + explanation);
  notify(state, order.collectorId, id + ':qa', '模拟质检结果已更新', explanation, id);
}

function appealQA(state, actor, id, reason) {
  const order = ownedOrder(state, actor, id);
  requireThat(order.qa && order.qa.valid < order.actual && !order.qaAppeal, '当前质检结果无可复核的工时');
  order.qaAppeal = { reason: text(reason, '请填写质检异议和模拟凭证'), at: state.now, status: 'pending' };
  record(state, actor, '申请模拟QA复核', id, order.qaAppeal.reason);
}

function resolveQA(state, id, extra, reason) {
  const order = byId(state.orders, id);
  const appeal = requireThat(order.qaAppeal && order.qaAppeal.status === 'pending' && order.qaAppeal, '没有待复核质检');
  requireThat(Number.isInteger(extra) && extra >= 0 && extra <= order.actual - order.qa.valid, '复核新增分钟超过争议范围');
  const basis = text(reason, '请填写复核原因');
  const period = [nextMonth(order.qa.period), month(state.now)].sort()[1];
  appeal.result = { extra, reason: basis, at: state.now, period };
  appeal.status = extra ? 'approved' : 'rejected';
  if (extra) {
    const cents = Math.round((order.qa.valid + extra) * order.hourlyCents / 60) - Math.round(order.qa.valid * order.hourlyCents / 60);
    ledger(state, order, 'qaAdjustment', cents, period, '待结算');
  }
  record(state, OPS, '模拟QA复核', id, extra + '分钟 · ' + basis);
  notify(state, order.collectorId, id + ':qa-review', '模拟质检复核完成', basis, id);
}

function updateSubsidy(state, cents, actor) {
  requireThat(actor === LEAD, '仅模拟运营负责人可调整金额');
  requireThat(Number.isInteger(cents) && cents > 0 && cents <= 100000, '请填写有效的演示补贴金额');
  record(state, actor, '调整虚构补贴金额', 'subsidy', state.subsidy.cents + '分 → ' + cents + '分');
  state.subsidy = { cents, version: state.subsidy.version + 1, at: state.now };
}

function departedBeforeNotice(order) {
  const outage = order.cancellation && order.cancellation.outage;
  const departed = order.travelAt || order.arrivedAt;
  return Boolean(outage && departed && departed <= outage.noticeAt);
}

function eligibleSubsidy(state, order) {
  const cancel = order.cancellation;
  return Boolean(cancel && departedBeforeNotice(order) && state.now <= cancel.at + 48 * HOUR);
}

function applySubsidy(state, actor, id, proof) {
  const order = ownedOrder(state, actor, id);
  requireThat(order.status === 'cancelled' && !order.subsidy && eligibleSubsidy(state, order),
    '须为已出发且因核实设备异常取消的预约，取消后48小时内可申请一次');
  requireThat(['route', 'arrival'].includes(proof) && (proof !== 'arrival' || order.arrivedAt), '请选择可核查的模拟行程或签到凭证');
  order.subsidy = { at: state.now, status: 'pending', rule: { ...state.subsidy }, proof };
  record(state, actor, '提交模拟交通补贴申请', id, proof);
}

function reviewSubsidy(state, id, passed, reason) {
  const order = byId(state.orders, id);
  const application = requireThat(order.subsidy && ['pending', 'appealed'].includes(order.subsidy.status) && order.subsidy,
    '该申请无待办');
  const appeal = application.status === 'appealed';
  const decision = { passed, reason: text(reason, '请记录核查依据或拒绝原因'), at: state.now };
  if (passed) {
    requireThat(departedBeforeNotice(order)
      && (application.proof || (application.appeal && application.appeal.proof)), '缺少可核查的故障或出行证据');
    ledger(state, order, 'subsidy', application.rule.cents, month(state.now), '待发放补贴');
  }
  if (appeal) application.appeal.decision = decision;
  else application.decision = decision;
  application.status = passed ? 'approved' : appeal ? 'final' : 'rejected';
  record(state, OPS, appeal ? '模拟补贴复核' : '模拟补贴初审', id, decision.reason);
  notify(state, order.collectorId, id + (appeal ? ':subsidy-appeal' : ':subsidy'), passed ? '待发放补贴' : '补贴审核未通过', decision.reason, id);
}

function appealSubsidy(state, actor, id, reason) {
  const order = ownedOrder(state, actor, id);
  const application = requireThat(order.subsidy && order.subsidy.status === 'rejected' && order.subsidy, '补贴当前不可申诉');
  requireThat(state.now <= application.decision.at + 72 * HOUR, '已超过72小时申诉窗口');
  application.appeal = { at: state.now, proof: text(reason, '请填写补充的模拟行程依据') };
  application.status = 'appealed';
  record(state, actor, '提交模拟补贴申诉', id, application.appeal.proof);
}

function refreshEligibility(state) {
  for (const collector of state.collectors) {
    const { score, review } = credit(state, collector.id);
    if (score < 60 && (!review || review.status === 'recovered')) {
      collector.eligibility.push({ at: state.now, status: 'pending' });
      notify(state, collector.id, 'restricted:' + collector.id + ':' + state.now, '新预约资格待审核', '已有预约可按原安排履行。');
    }
    if (score >= 60 && review && review.status !== 'recovered') {
      review.recovery = { status: review.status, at: state.now };
      review.status = 'recovered';
    }
  }
}

function evaluateViolation(state, id, { fault, delay, impact, reason }) {
  const order = byId(state.orders, id);
  requireThat(['submitted', 'done', 'stopped'].includes(order.status) && order.startedAt, '缺少可核实的领机归还记录');
  requireThat(!state.violations.some(item => item.orderId === id), '同一事件已核实');
  const possibleDelay = Math.floor(((order.verifiedAt || state.now) - at(order.date, order.end)) / MINUTE);
  requireThat(Number.isInteger(delay) && delay > 0 && delay <= possibleDelay, '逾期分钟数须符合订单的核实时间');
  const basis = text(reason, '请说明模拟责任核实依据');
  const downstream = state.orders.find(next => next.status === 'cancelled' && next.cancellation.outage
    && next.cancellation.outage.sourceId === id);
  requireThat(!impact || (fault && downstream), '须有关联的下位采集员受影响订单');
  const repeat = state.violations.some(item => item.collectorId === order.collectorId && item.fault && !item.reversed
    && state.now - item.at < 90 * DAY);
  const points = !fault ? 0 : impact ? 5 : repeat || delay > 15 ? 2 : 0;
  const item = { id: nextId(state, 'V'), orderId: id, collectorId: order.collectorId, at: state.now,
    points, reason: basis, fault, delay, impact };
  state.violations.push(item);
  record(state, OPS, '模拟信誉核实', id, points + '分 · ' + basis);
  notify(state, order.collectorId, id + ':credit', fault ? (points ? '信誉扣' + points + '分' : '轻微逾期警告') : '设备异常免责', basis, id);
  refreshEligibility(state);
}

function appealCredit(state, actor, id, reason) {
  const item = byId(state.violations, id);
  requireThat(item.collectorId === actor && item.fault && !item.appeal && state.now <= item.at + 72 * HOUR,
    '只能在72小时内申诉本人责任事件一次');
  item.appeal = { at: state.now, reason: text(reason, '请提供模拟申诉依据'), status: 'pending' };
  record(state, actor, '提交模拟信誉申诉', item.orderId, item.appeal.reason);
}

function resolveCredit(state, id, passed, reason) {
  const item = byId(state.violations, id);
  requireThat(item.appeal && item.appeal.status === 'pending', '该信誉申诉已处理或不存在');
  item.appeal.decision = { at: state.now, reason: text(reason, '请填写核实结论') };
  item.appeal.status = passed ? 'approved' : 'rejected';
  if (passed) item.reversed = true;
  record(state, OPS, '模拟信誉申诉复核', item.orderId, item.appeal.decision.reason);
  notify(state, item.collectorId, id + ':credit-appeal', passed ? '申诉成立，已纠正信誉' : '信誉申诉未通过',
    item.appeal.decision.reason, item.orderId);
  refreshEligibility(state);
}

function reviewEligibility(state, actor, passed, reason) {
  const { review, score } = credit(state, actor);
  requireThat(score < 60 && review && review.status === 'pending', '没有待审核的低分接单资格');
  review.decision = { at: state.now, reason: text(reason, '请填写决定依据及恢复条件') };
  review.status = passed ? 'approved' : 'rejected';
  record(state, OPS, '模拟接单资格审核', actor, review.decision.reason);
  notify(state, actor, 'eligibility:' + actor + ':' + review.at, passed ? '接单资格已恢复' : '接单资格暂未恢复', review.decision.reason);
}

function deadlineAlerts(state) {
  refreshEligibility(state);
  function remind(id, title, since, hours) {
    const due = since + hours * HOUR;
    if (state.now >= due) notify(state, 'ops', 'sla:' + id, title, '请模拟运营负责人跟进。', '', due);
  }
  for (const order of state.orders) {
    const s = order.subsidy;
    if (s && s.status === 'pending') remind('subsidy:' + order.id, '交通补贴首审逾期', s.at, 48);
    if (s && s.status === 'appealed') remind('subsidy-appeal:' + order.id, '交通补贴复核逾期', s.appeal.at, 72);
  }
  for (const item of state.violations) {
    if (item.appeal && item.appeal.status === 'pending') remind(item.id, '信誉申诉复核逾期', item.appeal.at, 72);
  }
  for (const collector of state.collectors) {
    const { review } = credit(state, collector.id);
    if (review && review.status === 'pending') remind('eligibility:' + collector.id + ':' + review.at, '接单资格审核逾期', review.at, 48);
  }
}

module.exports = { qaReview, appealQA, resolveQA, updateSubsidy, eligibleSubsidy, applySubsidy, reviewSubsidy, appealSubsidy,
  evaluateViolation, appealCredit, resolveCredit, reviewEligibility, refreshEligibility, deadlineAlerts, month, LEAD };
