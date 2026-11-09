const { MINUTE, HOUR, TASKS, at, dateOf } = require('./catalog');
const { requireThat, text, nextId, record, notify, stationFor, ownedOrder, validDate, windows, fits,
  preStart, holding, credit, byId } = require('./model');

const ISSUE_TYPES = [
  { id: 'directions', label: '找不到门店' },
  { id: 'closed', label: '门店未开' },
  { id: 'box', label: '箱子打不开', device: true },
  { id: 'device', label: '设备故障', device: true },
  { id: 'return', label: '归还遇到问题' },
  { id: 'other', label: '其他订单问题' }
];

function conflicts(state, collectorId, stationId, date, start, end, ignoreId) {
  const station = stationFor(state, stationId);
  const task = TASKS[station.task];
  if (!validDate(date) || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end >= 1440 || end <= start) {
    return '预约须在同一自然日内';
  }
  if (station.stage !== 'open' || !station.taskEnabled || !station.device) return '站点或任务尚未开放';
  if (station.device.fault || station.device.overdue.length) return '设备暂停新预约';
  if (!credit(state, collectorId).allowed) return '信誉低于60分，暂停新预约';
  if (at(date, start) <= state.now) return '请选择尚未开始的时段';
  if (!fits(station, { date, start, end })) return '须在开放时间内采集，并至少提前15分钟结束';
  if (start % 30 || (end - start) % 30 || end - start < task.min || end - start > task.max) {
    return '请选择符合任务时长的半小时档位';
  }
  const orders = state.orders.filter(order => order.id !== ignoreId && order.date === date && order.status !== 'cancelled');
  const deviceOrders = orders.filter(order => order.stationId === stationId);
  if (deviceOrders.some(order => start < order.end + 30 && end + 30 > order.start)) {
    return '设备时段冲突，相邻预约至少间隔30分钟';
  }
  if (orders.some(order => order.collectorId === collectorId && start < order.end && end > order.start)) {
    return '与你已有的预约时间重叠';
  }
  if (deviceOrders.reduce((total, order) => total + order.end - order.start, end - start) > task.daily) {
    return '超出设备当日采集时长上限';
  }
  return '';
}

function availability(state, collectorId, stationId, date, ignoreId) {
  const station = stationFor(state, stationId);
  const task = TASKS[station.task];
  if (!validDate(date)) return [];
  const slots = [];
  for (const [open, close] of windows(station, date)) {
    for (let start = Math.ceil(open / 30) * 30; start + task.min <= close - 15; start += 30) {
      const ends = [];
      for (let end = start + task.min; end <= Math.min(start + task.max, close - 15); end += 30) {
        if (!conflicts(state, collectorId, stationId, date, start, end, ignoreId)) ends.push(end);
      }
      if (ends.length) slots.push({ start, ends });
    }
  }
  return slots;
}

function create(state, collectorId, request) {
  const { stationId, date, start, end, replaceId } = request;
  // Retries after a successful save return the same reservation, including after navigation.
  const key = [collectorId, stationId, date, start, end, replaceId || ''].join('|');
  const existing = state.orders.find(order => order.requestKey === key && order.status !== 'cancelled');
  if (existing) return existing;
  const previous = replaceId ? ownedOrder(state, collectorId, replaceId) : null;
  if (previous) {
    requireThat(preStart(previous) || previous.status === 'cancelled', '当前订单无法改期');
    requireThat(!previous.replacedBy, '原订单已改期');
    requireThat(previous.stationId !== stationId || previous.date !== date || previous.start !== start || previous.end !== end,
      '请选择不同的预约时段');
    if (preStart(previous) && !previous.impact && !previous.closed && at(previous.date, previous.start) - state.now < 2 * HOUR) {
      text(request.reason, '距离原预约不足2小时，改期须填写原因');
    }
  }
  const error = conflicts(state, collectorId, stationId, date, start, end, replaceId);
  requireThat(!error, error);
  const station = stationFor(state, stationId);
  const first = !state.orders.some(order => order.collectorId === collectorId);
  const order = { id: nextId(state, 'O'), stationId, collectorId, date, start, end, requestKey: key,
    status: 'booked', task: station.task, hourlyCents: TASKS[station.task].hourlyCents, createdAt: state.now,
    replacedFrom: replaceId || '', actual: 0 };
  if (previous) {
    if (previous.status !== 'cancelled') cancel(state, collectorId, previous.id, request.reason || '已选择其他时段');
    previous.replacedBy = order.id;
  }
  state.orders.unshift(order);
  record(state, collectorId, previous ? '确认改约' : '确认预约', order.id, previous ? previous.id : station.name);
  notify(state, collectorId, order.id + ':created', '预约已确认',
    first ? '可在消息设置查看提醒方式。当前体验使用站内提醒。' : '到店后按订单指引自助取机。', order.id);
  return order;
}

function cancel(state, actor, id, reason, operator = false) {
  const order = operator ? byId(state.orders, id) : ownedOrder(state, actor, id);
  if (order.status === 'cancelled') return order;
  requireThat(preStart(order) || (operator && order.status === 'missed'), '已领设备的订单须先归还并核验');
  const exempt = operator || order.impact || order.closed;
  if (!exempt && at(order.date, order.start) - state.now < 2 * HOUR) text(reason, '距离开始不足2小时，取消须填写原因');
  const outage = order.impact;
  order.cancellation = { at: state.now, reason: reason || '采集员主动取消', exempt: Boolean(exempt), outage };
  order.status = 'cancelled';
  record(state, actor, exempt ? '无责取消预约' : '主动取消预约', id, order.cancellation.reason);
  notify(state, order.collectorId, id + ':cancelled', exempt ? '预约已无责取消' : '预约已取消', order.cancellation.reason, id);
  return order;
}

function usable(state, order) {
  const device = stationFor(state, order.stationId).device;
  return !order.closed && !order.impact && !device.fault && !device.overdue.length
    && !state.orders.some(other => other.id !== order.id && other.stationId === order.stationId && holding(other));
}

function perform(state, actor, id, action, failUpload = false) {
  const order = ownedOrder(state, actor, id);
  const start = at(order.date, order.start);
  const end = at(order.date, order.end);
  switch (action) {
    case 'travel':
      requireThat(order.status === 'booked' && !order.impact && !order.closed && state.now < end, '当前订单不可出发');
      order.status = 'travel';
      order.travelAt = state.now;
      break;
    case 'arrive':
      requireThat(['booked', 'travel'].includes(order.status) && state.now >= start - 15 * MINUTE
        && state.now < end && usable(state, order), '请在预约开始前15分钟至结束前且设备可用时模拟签到');
      order.status = 'arrived';
      order.arrivedAt = state.now;
      break;
    case 'collect':
      requireThat(order.status === 'arrived' && state.now >= start && state.now < end && usable(state, order),
        '须在预约时段内签到且设备可用');
      order.status = 'collecting';
      order.startedAt = state.now;
      break;
    case 'stop':
      requireThat(order.status === 'collecting', '当前订单不在采集中');
      stop(state, order, state.now);
      break;
    case 'return':
      if (order.submittedAt) return order;
      requireThat(order.status === 'stopped', '请先结束采集');
      order.status = 'submitted';
      order.submittedAt = state.now;
      if (failUpload) order.uploadFailed = true;
      else order.uploadedAt = state.now;
      break;
    case 'upload':
      if (order.uploadedAt) return order;
      requireThat(order.submittedAt && order.uploadFailed, '该订单暂无待重试的上传');
      order.uploadedAt = state.now;
      delete order.uploadFailed;
      break;
    default:
      throw new Error('无效订单操作');
  }
  const actionNames = { travel: '模拟出发自报', arrive: '模拟签到自报', collect: '模拟领机并开始采集',
    stop: '结束模拟采集', return: failUpload ? '自报归还，模拟上传失败' : '自报归还与模拟上传',
    upload: '重试模拟上传成功' };
  record(state, actor, actionNames[action], id, order.status);
  return order;
}

function stop(state, order, time) {
  order.actual = Math.floor((Math.min(time, at(order.date, order.end)) - order.startedAt) / MINUTE);
  order.status = 'stopped';
}

function verifyReturn(state, id, evidence) {
  const order = byId(state.orders, id);
  if (order.status === 'done') return order;
  requireThat(order.status === 'submitted', '需要采集员先提交归还');
  order.returnEvidence = text(evidence, '请记录模拟在箱与设备可用的核验依据');
  order.verifiedAt = state.now;
  order.status = 'done';
  if (order.actual > 0) {
    state.earnings.push({ id: nextId(state, 'L'), party: order.stationId, orderId: id, kind: 'venue',
      period: order.date.slice(0, 7), cents: null, state: '待结算', at: state.now });
  }
  record(state, '凌矩模拟运营', '模拟核验归还', id, order.returnEvidence);
  notify(state, order.collectorId, id + ':return-verified', '归还完成', '凌矩已完成演示核验。', id);
  return order;
}

function report(state, actor, id, description, samplePhoto, kind = 'device') {
  const order = ownedOrder(state, actor, id);
  const type = requireThat(ISSUE_TYPES.find(item => item.id === kind), '请选择有效的求助类型');
  if (type.device) requireThat(preStart(order) || holding(order), '当前订单不可上报设备异常');
  const details = text(description, '请描述遇到的模拟问题');
  const existing = state.reports.find(item => item.orderId === id && item.status === 'pending');
  if (existing) return existing;
  const item = { id: nextId(state, 'R'), orderId: id, stationId: order.stationId, details, kind,
    samplePhoto: Boolean(samplePhoto), at: state.now, status: 'pending' };
  state.reports.unshift(item);
  record(state, actor, '提交模拟订单求助', id, type.label + ' · ' + details);
  return item;
}

function issueType(report) {
  return ISSUE_TYPES.find(type => type.id === (report.kind || 'device'));
}

function resolveReport(state, id, evidence) {
  const report = byId(state.reports, id);
  requireThat(report.status === 'pending', '该求助已处理');
  completeReport(state, report, 'resolved', text(evidence, '请填写核查结果和处理建议'));
}

function completeReport(state, report, status, reason) {
  const order = byId(state.orders, report.orderId);
  report.status = status;
  report.response = reason;
  report.resolvedAt = state.now;
  record(state, '凌矩模拟运营', '处理模拟订单求助', report.id, reason);
  notify(state, order.collectorId, report.id + ':response', '凌矩已处理订单求助', reason, order.id);
}

function impact(state, order, outage) {
  if (order.impact && order.impact.key === outage.key) return;
  order.impact = { ...outage, noticeAt: state.now };
  notify(state, order.collectorId, order.id + ':impact:' + outage.key, '预约受设备异常影响',
    '可无责取消或改期。确已出发或到店时，请保留演示行程凭证。', order.id);
}

function pause(state, stationId, evidence, reportId) {
  const station = stationFor(state, stationId);
  const device = requireThat(station.device, '站点尚无设备');
  const reason = text(evidence, '请填写已核实的模拟故障依据');
  if (reportId) {
    const report = byId(state.reports, reportId);
    requireThat(report.stationId === stationId && report.status === 'pending', '故障记录与设备不符或已处理');
    requireThat(issueType(report).device, '请通过求助回复处理非设备问题');
    completeReport(state, report, 'verified', reason);
  }
  if (device.fault) return;
  device.fault = { key: nextId(state, 'F'), type: 'fault', reason, at: state.now };
  for (const order of state.orders.filter(item => item.stationId === stationId)) {
    if (preStart(order) && at(order.date, order.end) > state.now) impact(state, order, device.fault);
    if (order.status === 'collecting') stop(state, order, state.now);
  }
  record(state, '凌矩模拟运营', '核实故障并暂停设备', stationId, reason);
  onClock(state, state.now);
}

function reopen(state, stationId, evidence) {
  const station = stationFor(state, stationId);
  const device = requireThat(station.device, '站点尚无设备');
  requireThat(device.fault || device.overdue.length, '设备未暂停');
  requireThat(!state.orders.some(order => order.stationId === stationId && holding(order)), '尚有设备待核验归还');
  const reason = text(evidence, '请记录模拟修复或归还后的可用性核验');
  device.fault = null;
  device.overdue = [];
  for (const order of state.orders.filter(item => item.stationId === stationId && preStart(item) && item.impact)) {
    order.impact = null;
    notify(state, order.collectorId, order.id + ':reopen:' + state.sequence, '设备已模拟复开', '请按最新订单状态查看可执行时间。', order.id);
  }
  record(state, '凌矩模拟运营', '模拟核验可用并复开', stationId, reason);
}

function timing(order) {
  const start = at(order.date, order.start);
  const end = at(order.date, order.end);
  return { start, end, before: [[start - 24 * HOUR, '24小时'], [start - 2 * HOUR, '2小时'], [start - 30 * MINUTE, '30分钟']] };
}

function onClock(state, since) {
  // Earlier reservations are processed first so a previous return exception blocks a later handoff.
  const ordered = state.orders.slice().sort((a, b) => at(a.date, a.start) - at(b.date, b.start));
  for (const order of ordered) {
    const { start, end, before } = timing(order);
    const reached = time => time > since && time <= state.now;
    const message = (key, title, content, time, who = order.collectorId) =>
      notify(state, who, order.id + ':' + key, title, content, order.id, time);

    if (preStart(order) && order.impact && order.impact.type === 'fault' && state.now >= start) {
      cancel(state, '凌矩模拟运营', order.id, '核实故障未恢复，原开工时间到达且未改约', true);
    }
    if (preStart(order) && !order.impact && !order.closed) {
      for (const [time, label] of before) {
        if (time > order.createdAt && reached(time)) message('pre' + label, '距预约开始' + label, '请核对站点及预约时间。', time);
      }
      if (!order.arrivedAt && reached(start + 15 * MINUTE)) {
        message('late15', '尚未签到', '如设备可用，仍可在原预约结束前签到。', start + 15 * MINUTE);
      }
      if (!order.arrivedAt && reached(start + 30 * MINUTE)) {
        order.suspected = true;
        message('late30', '疑似爽约待核实', '请联系凌矩说明情况。', start + 30 * MINUTE);
        message('late30', '预约未签到待核实', '核实出行、设备和签到记录。', start + 30 * MINUTE, 'ops');
      }
    }
    if (preStart(order) && !order.impact && state.now >= end) {
      order.status = 'missed';
      record(state, '模拟时钟', '预约到期未采集', order.id, '待核实，不扣分');
    }
    if (order.status === 'collecting') {
      if (reached(end - 15 * MINUTE)) message('ending', '还剩15分钟', '请准备结束采集并归还设备。', end - 15 * MINUTE);
      if (state.now >= end) {
        stop(state, order, end);
        message('ended', '预约已到期', '请停止采集并将设备放回模拟密码箱。', end);
        record(state, '模拟时钟', '到期停止采集', order.id, '按原结束时间截断');
      }
    }
    if (holding(order)) {
      if (reached(end + 5 * MINUTE)) message('late-return5', '设备尚待核验归还', '请归还设备或查看核验进度。', end + 5 * MINUTE);
      if (reached(end + 15 * MINUTE)) message('late-return15', '设备逾期15分钟', '请核查归还进度。', end + 15 * MINUTE, 'ops');
      if (reached(end + 30 * MINUTE)) {
        const device = stationFor(state, order.stationId).device;
        device.overdue.push(order.id);
        const outage = { key: 'overdue-' + order.id, type: 'overdue', sourceId: order.id, at: state.now, reason: '前序设备异常未归还' };
        order.overdue = true;
        message('late-return30', '异常未归还', '该设备暂停新预约，凌矩将核查原因。', end + 30 * MINUTE);
        message('late-return30', '异常未归还', '设备暂停接新单，核实后续影响。', end + 30 * MINUTE, 'ops');
        for (const next of ordered) {
          if (next.stationId === order.stationId && preStart(next) && at(next.date, next.start) >= end && !next.impact) impact(state, next, outage);
        }
        record(state, '模拟时钟', '逾期未归还暂停接单', order.id, '仅进入待核实，无信誉扣分');
      }
    }
  }
}

function advance(state, target) {
  requireThat(Number.isFinite(target) && target >= state.now, '模拟时钟只能向前推进');
  const ticks = new Set([target]);
  for (const order of state.orders.filter(item => preStart(item) || holding(item))) {
    const { start, end, before } = timing(order);
    for (const time of [...before.map(([time]) => time), start, start + 15 * MINUTE, start + 30 * MINUTE,
      end - 15 * MINUTE, end, end + 5 * MINUTE, end + 15 * MINUTE, end + 30 * MINUTE]) {
      if (time > state.now && time < target) ticks.add(time);
    }
  }
  for (const time of [...ticks].sort((a, b) => a - b)) {
    const since = state.now;
    state.now = time;
    onClock(state, since);
  }
}

module.exports = { ISSUE_TYPES, conflicts, availability, create, cancel, perform, verifyReturn, report, issueType, resolveReport,
  pause, reopen, advance, usable };
