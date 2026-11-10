const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const DEVICE_BUFFER = 30;
const CLOSING_BUFFER = 15;
const MIN_BOOKING_MINUTES = 120;
const OFFSET = 8 * HOUR;
const START = Date.parse('2026-11-09T08:00:00+08:00');
const CITY = '平顶山';
const DISTRICTS = ['新华区', '卫东区', '湛河区'];
// GCJ-02 sample pins for the map demo. These do not represent physical partner venues.
const DEMO_MAP_POINTS = {
  新华区: { latitude: 33.7374, longitude: 113.2896 },
  卫东区: { latitude: 33.7372, longitude: 113.3292 },
  湛河区: { latitude: 33.7228, longitude: 113.3065 }
};
const DEMO_GUIDES = {
  s1: { entrance: '从「松墨文具」深绿门头正门进入。', locker: '进门右侧的编号 A-01 演示箱。', area: '贴有采集标识的文具分拣台。' },
  s2: { entrance: '从「方盒工坊」蓝色卷帘门旁的人行门进入。', locker: '人行门内左侧的编号 B-02 演示箱。', area: '工作间内划线的周转盒装配台。' },
  s3: { entrance: '从「青枝花室」木色门头下的玻璃门进入。', locker: '沿入口通道到编号 C-03 演示箱。', area: '靠窗的仿真花材示范台。' }
};

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
    min: MIN_BOOKING_MINUTES, max: 180, daily: 420,
    cue: '按颜色分拣，依次补齐货架，再逐格复核。',
    steps: ['在示范台清点不同颜色的空白笔盒，确认镜头只对准操作台。', '将笔盒按颜色分入对应格，再按从左到右的顺序补齐货架。', '逐格复核，恢复台面并记录漏放或遮挡。']
  },
  packing: {
    category: '包装工作间', title: '可重复周转盒装配', art: '/assets/packing.svg', hourlyCents: 3600,
    min: MIN_BOOKING_MINUTES, max: 180, daily: 360,
    cue: '展开盒体，放入隔片和样件，合盖检查。',
    steps: ['取没有姓名或快递面单的空白周转盒及隔片。', '展开盒体，插入隔片，放入演示样件并合盖。', '检查盒盖和隔片是否到位，再拆回待用状态。']
  },
  floral: {
    category: '花艺工作室', title: '仿真花束整理', art: '/assets/floral.svg', hourlyCents: 3200,
    min: MIN_BOOKING_MINUTES, max: 120, daily: 360,
    cue: '按色分拣花材，对齐扎束，展示后归位。',
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
        taskEnabled: true, week: Array.from({ length: 7 }, () => []), exceptions: {}, device: null }
    ],
    collectors: [
      { id: 'c1', name: '采集员 A', eligibility: [] },
      { id: 'c2', name: '采集员 B', eligibility: [] }
    ],
    orders: [], messages: [], audit: [], earnings: [], reports: [], violations: [],
    subsidy: { cents: 1200, version: 1 }
  };
}

module.exports = { MINUTE, HOUR, DAY, DEVICE_BUFFER, CLOSING_BUFFER, CITY, DISTRICTS, DEMO_MAP_POINTS, DEMO_GUIDES,
  TASKS, dateOf, clock, stamp, at, timeLabel, minutes, seed };
