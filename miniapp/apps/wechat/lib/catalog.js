const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const OFFSET = 8 * HOUR;
const START = Date.parse('2026-11-09T08:00:00+08:00');

function dateOf(time) {
  return new Date(time + OFFSET).toISOString().slice(0, 10);
}

function clock(time) {
  return new Date(time + OFFSET).toISOString().slice(11, 16);
}

function stamp(time) {
  return dateOf(time) + ' ' + clock(time);
}

function at(date, minute = 0) {
  return Date.parse(date + 'T00:00:00+08:00') + minute * MINUTE;
}

function timeLabel(minute) {
  return String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
}

function minutes(value) {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

const TASKS = {
  stationery: {
    category: '文具店', title: '文具分拣与陈列', art: '/assets/stationery.svg', hourlyCents: 3000,
    min: 60, max: 180, daily: 420,
    steps: ['在示范台清点不同颜色的空白笔盒，确认镜头只对准操作台。', '将笔盒按颜色分入对应格，再按从左到右的顺序补齐货架。', '逐格复核，恢复台面并记录漏放或遮挡。']
  },
  packing: {
    category: '包装工作间', title: '可重复周转盒装配', art: '/assets/packing.svg', hourlyCents: 3600,
    min: 90, max: 180, daily: 360,
    steps: ['取没有姓名或快递面单的空白周转盒及隔片。', '展开盒体，插入隔片，放入演示样件并合盖。', '检查盒盖和隔片是否到位，再拆回待用状态。']
  },
  floral: {
    category: '花艺工作室', title: '仿真花束整理', art: '/assets/floral.svg', hourlyCents: 3200,
    min: 60, max: 120, daily: 360,
    steps: ['在示范台按颜色分拣仿真花材，移走带客户信息的物品。', '取三类花材对齐，使用预切绑带整理花束。', '展示完成形态，将花材和工具归位。']
  }
};

function week(open, close) {
  return Array.from({ length: 7 }, () => [[open, close]]);
}

function station(id, name, district, address, task, open, close) {
  return { id, name, district, address, task, taskEnabled: true, stage: 'open', week: week(open, close),
    exceptions: {}, device: { id: '模拟设备-' + id.toUpperCase(), fault: null, overdue: [] } };
}

function seed() {
  return {
    schema: 1, sequence: 0, now: START, selection: '', merchant: 'new', collector: 'c1',
    stations: [
      station('s1', '松墨文具（虚构）', '新华区', '样例街 A-01', 'stationery', 540, 1080),
      station('s2', '方盒工坊（虚构）', '卫东区', '样例街 B-02', 'packing', 600, 1140),
      station('s3', '青枝花室（虚构）', '湛河区', '样例街 C-03', 'floral', 540, 1050),
      { id: 'new', name: '我的演示门店', district: '新华区', stage: 'draft', task: 'stationery',
        taskEnabled: true, week: week(540, 1080), exceptions: {}, device: null }
    ],
    collectors: [
      { id: 'c1', name: '采集员 A', eligibility: [] },
      { id: 'c2', name: '采集员 B', eligibility: [] }
    ],
    orders: [], messages: [], audit: [], earnings: [], reports: [], violations: [],
    subsidy: { cents: 1200, version: 1 }
  };
}

module.exports = { MINUTE, HOUR, DAY, TASKS, dateOf, clock, stamp, at, timeLabel, minutes, seed };
