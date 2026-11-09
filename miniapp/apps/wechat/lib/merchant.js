const { MINUTE, TASKS, DISTRICTS, at } = require('./catalog');
const { requireThat, text, record, notify, stationFor, validDate, fits, preStart, holding } = require('./model');

function apply(state, id, form) {
  const station = stationFor(state, id);
  requireThat(['draft', 'supplement', 'rejected'].includes(station.stage), '当前阶段无法重复提交');
  const application = {};
  for (const key of ['name', 'address', 'contact', 'phone']) {
    application[key] = text(form[key], '请填写演示申请资料');
  }
  requireThat(DISTRICTS.includes(form.district), '请选择门店所在区');
  application.district = form.district;
  const guide = {};
  for (const key of ['entrance', 'locker', 'area']) {
    guide[key] = text(form[key], '请补齐门头入口、箱位和采集区说明');
  }
  requireThat(TASKS[form.task], '请选择场景类型');
  requireThat(form.photos.length === 3 && new Set(form.photos).size === 3
    && form.photos.every(photo => ['front', 'inside', 'device'].includes(photo)), '请添加三类模拟场景照片');
  station.name = application.name;
  station.address = application.address;
  station.district = application.district;
  station.guide = guide;
  station.task = form.task;
  station.application = { ...application, photos: form.photos.slice(), at: state.now };
  station.stage = 'review';
  record(state, id, '提交模拟入驻申请', id, station.name);
}

function reviewSite(state, id, outcome, reason) {
  const station = stationFor(state, id);
  requireThat(station.stage === 'review', '该申请已处理');
  requireThat(['approved', 'supplement', 'rejected'].includes(outcome), '审核状态无效');
  station.note = text(reason, '请填写模拟审核依据');
  station.stage = outcome;
  record(state, '凌矩模拟运营', '场地审核', id, outcome + ' · ' + station.note);
}

function install(state, id) {
  const station = stationFor(state, id);
  requireThat(station.stage === 'approved', '须先通过场地审核');
  station.device = { id: '模拟设备-' + id.toUpperCase(), fault: null, overdue: [] };
  station.stage = 'installed';
  record(state, '凌矩模拟运营', '登记模拟设备到位', id, station.device.id);
}

function confirmInstallation(state, id) {
  const station = stationFor(state, id);
  requireThat(station.stage === 'installed', '设备尚未登记到位');
  station.stage = 'schedule';
  record(state, id, '确认设备安装到位', id, station.device.id);
}

function schedulePlan(state, id, day, ranges) {
  const station = stationFor(state, id);
  requireThat(['schedule', 'open'].includes(station.stage), '请先确认设备到位');
  const template = Number.isInteger(day) && day >= 0 && day <= 6;
  requireThat(template || validDate(day), '请选择有效日期');
  const restore = ranges === null && !template;
  requireThat(restore || (Array.isArray(ranges) && ranges.length <= 4), '每天最多设置四段时间');
  const sorted = restore ? [] : ranges.slice().sort((a, b) => a[0] - b[0]);
  sorted.forEach(([start, end], i) => {
    requireThat(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end < 1440 && end - start > 15
      && (!i || sorted[i - 1][1] <= start), '请设置不重叠的同日开放时段，每段须超过15分钟');
  });
  const proposed = { ...station, week: station.week.slice(), exceptions: { ...station.exceptions } };
  if (template) proposed.week[day] = sorted;
  else if (restore) delete proposed.exceptions[day];
  else proposed.exceptions[day] = sorted;
  const orders = state.orders.filter(order => order.stationId === id && (preStart(order) || holding(order))
    && at(order.date, order.end) > state.now);
  return { station, proposed, orders, sorted, affected: orders.filter(order => !order.closed && !fits(proposed, order)) };
}

function previewSchedule(state, id, day, ranges) {
  return schedulePlan(state, id, day, ranges).affected;
}

function schedule(state, id, day, ranges) {
  const { station, proposed, orders, sorted } = schedulePlan(state, id, day, ranges);
  station.week = proposed.week;
  station.exceptions = proposed.exceptions;
  if (sorted.length) station.stage = 'open';
  for (const order of orders) {
    if (!fits(station, order)) {
      if (!order.closed) notify(state, order.collectorId, order.id + ':closure:' + state.sequence, '门店开放时间有变',
        order.status === 'submitted' ? '归还已提交，凌矩会继续核验。'
          : holding(order) ? '请停止采集并通过订单联系凌矩协调归还。' : '可在原订单无责取消或重新选择时段。', order.id);
      if (order.status === 'collecting') {
        order.actual = Math.max(0, Math.floor((state.now - order.startedAt) / MINUTE));
        order.status = 'stopped';
      }
      order.closed = true;
    } else {
      order.closed = false;
    }
  }
  record(state, id, '更新场地开放时段', id, JSON.stringify({ day, ranges: ranges === null ? null : sorted }));
}

module.exports = { apply, reviewSite, install, confirmInstallation, previewSchedule, schedule };
