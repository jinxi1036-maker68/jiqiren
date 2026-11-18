const origin = "https://ldp.lingrobotics.com";

export const views = Object.freeze({
  statistics: { path: "/statistics", heading: "采集统计报告" },
  projects: { path: "/collection-projects", heading: "项目ID", fields: ["项目状态", "任务数"] },
  tasks: { path: "/data-collection", heading: "任务ID", fields: ["状态", "数据集数"] },
  uploads: { path: "/production/uploads?tab=records", heading: "上传时间", fields: ["状态"] },
  datasets: { path: "/data", heading: "数据集ID", fields: ["状态"] },
  reviews: { path: "/annotation-review", heading: "复核进度", fields: ["复核进度"] },
  devices: { path: "/device-management", heading: "设备 ID", fields: ["设备类型", "状态", "采集员", "设备分组"] },
});

const recordFields = Object.freeze({
  projects: ["项目ID", "项目名称", "项目状态", "任务数", "采集进度", "标注进度", "交付进度"],
  tasks: ["任务ID", "任务名称", "所属项目", "状态", "数据集数", "采集进度", "标注进度", "交付进度"],
  uploads: ["上传时间", "入库时间", "数据集", "设备类型", "类型", "状态"],
  datasets: ["数据集ID", "采集任务", "状态", "操作时间"],
  reviews: ["数据集", "标注类型", "AI 质检", "复核进度", "数据集抽检"],
  devices: ["设备类型", "设备类别", "设备分组", "状态", "软件版本", "存储用量"],
});

function collectPage({ heading, fields = [], recordFields = [] }) {
  const visible = (element) => Boolean(element?.getClientRects().length);
  const text = (element) => element?.innerText?.replace(/\s+/g, " ").trim() ?? "";
  const label = (element) => element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const main = document.querySelector("main");
  if (!main || main.querySelector(".ant-spin-spinning")) return null;

  if (heading === "采集统计报告") {
    if (![...main.querySelectorAll("h1,h2,h3")].some((element) => text(element) === heading)) return null;
    const totalRow = [...main.querySelectorAll("tfoot tr")].find((row) => visible(row) && text(row.cells[0]) === "合计");
    const dates = [...main.querySelectorAll('input[placeholder="开始日期"], input[placeholder="结束日期"]')];
    const reportRows = [...main.querySelectorAll("tbody tr")].filter((row) =>
      visible(row) && row.cells.length === 7 && /^\d{4}\.\d{1,2}\.\d{1,2}$/.test(text(row.cells[0]))
    );
    const freshness = main.innerText.split("\n").map((line) => line.trim()).find((line) => /^数据截至.+更新于/.test(line));
    if (!totalRow || dates.length !== 2 || !freshness) return null;
    return {
      dataScope: "采集统计报告当前日期范围，按数据准备完成日期",
      dateRange: dates.map((input) => input.value),
      freshness,
      collectionRows: reportRows.length,
      zeroRateRows: reportRows.filter((row) => text(row.cells[6]) === "0%").length,
      collectionDuration: text(totalRow.cells[3]),
      annotationProgress: text(totalRow.cells[4]),
      validDuration: text(totalRow.cells[5]),
      validRate: text(totalRow.cells[6]),
    };
  }

  const wrapper = [...main.querySelectorAll(".ant-table-wrapper")].find((element) =>
    visible(element) && [...element.querySelectorAll("thead th")].some((cell) => visible(cell) && label(cell) === heading)
  );
  if (!wrapper) return null;
  const columns = [...wrapper.querySelectorAll("thead th")].filter(visible).map(label);
  const indexes = fields.map((field) => columns.indexOf(field));
  const recordIndexes = recordFields.map((field) => columns.indexOf(field));
  if (indexes.includes(-1) || recordIndexes.includes(-1)) return null;
  const rows = [...wrapper.querySelectorAll("tbody tr[data-row-key]")].filter(visible);
  const noDataShown = [...wrapper.querySelectorAll(".ant-empty-description")].some(visible);
  if (!rows.length && !noDataShown) return null;
  const pager = [...main.querySelectorAll(".ant-pagination")].find(visible);
  const data = rows.map((row) => indexes.map((index, at) => {
    const value = text(row.cells[index]);
    const field = fields[at];
    if (field === "采集员" || field === "设备分组") return value && !/^(?:—|-|--)$/.test(value) ? "已填写" : "未显示";
    if (field === "复核进度") {
      const percent = value.match(/(\d+(?:\.\d+)?)\s*%/)?.[1];
      return percent === undefined ? "未显示" : Number(percent) === 0 ? "0%" : Number(percent) === 100 ? "100%" : "部分完成";
    }
    return value.slice(0, 40) || "未显示";
  }));
  return {
    columns,
    fields,
    data,
    records: recordFields.length ? rows.map((row) => Object.fromEntries(recordFields.map((field, index) => [
      field, text(row.cells[recordIndexes[index]]).slice(0, 120),
    ]))) : undefined,
    keys: rows.map((row) => row.dataset.rowKey),
    page: Number(text(pager?.querySelector(".ant-pagination-item-active"))) || 1,
    pageSize: Number(text(pager?.querySelector(".ant-select-selection-item")).match(/\d+/)?.[0]) || null,
    pageCount: pager ? Math.max(1, ...[...pager.querySelectorAll("li.ant-pagination-item")].map((item) => Number(item.title)).filter(Number.isFinite)) : 1,
    reportedTotal: text(pager?.querySelector(".ant-pagination-total-text")),
    noDataShown,
  };
}

export function summarize(result) {
  if (!Array.isArray(result.keys) || result.keys.some((key) => !key) || new Set(result.keys).size !== result.keys.length) {
    throw new Error("分页记录编号不完整或重复");
  }
  const counts = new Map(result.fields.map((field) => [field, new Map()]));
  for (const values of result.data) {
    result.fields.forEach((field, index) => {
      const seen = counts.get(field);
      const value = values[index];
      seen.set(value, (seen.get(value) ?? 0) + 1);
    });
  }
  return {
    page: result.page,
    pageSize: result.pageSize,
    pageCount: result.pageCount,
    reportedTotal: result.reportedTotal || null,
    rowsRead: result.keys.length,
    emptyConfirmed: result.noDataShown,
    fields: result.fields,
    counts: Object.fromEntries([...counts].map(([field, values]) => [field, Object.fromEntries(values)])),
    ...(result.records ? { records: result.records } : {}),
  };
}

async function movePage(page, spec, from, desired) {
  let current = from;
  const pager = "main .ant-pagination";
  const quick = pager + " .ant-pagination-options-quick-jumper input";
  for (let step = 0; current.page !== desired && step < 68; step++) {
    const control = await page.evaluate(({ pager, quick, currentPage, lastPage, desired }) => {
      const root = document.querySelector(pager);
      const numbered = (number) => root?.querySelector(`li.ant-pagination-item[title="${number}"]`);
      const direct = numbered(desired);
      const jumpInput = document.querySelector(quick);
      const towardLast = currentPage === 1 && lastPage - desired < desired - 1;
      const shortcut = towardLast ? numbered(lastPage) : null;
      const backwards = desired < currentPage;
      const jumpClass = backwards ? "li.ant-pagination-jump-prev" : "li.ant-pagination-jump-next";
      const jump = root?.querySelector(jumpClass);
      const jumpSize = Number(jump?.title.match(/\d+/)?.[0]);
      let element, selector, number, typed = false;
      if (direct || shortcut) {
        element = direct ?? shortcut;
        number = direct ? desired : lastPage;
        selector = `${pager} li.ant-pagination-item[title="${number}"]`;
      } else if (jumpInput) {
        element = jumpInput;
        selector = quick;
        number = desired;
        typed = true;
      } else if (jump && jumpSize && Math.abs(desired - currentPage) >= jumpSize) {
        element = jump;
        selector = `${pager} ${jumpClass}`;
        number = currentPage + (backwards ? -jumpSize : jumpSize);
      }
      if (!element) return null;
      element.scrollIntoView({ block: "center", behavior: "instant" });
      return { selector, number, typed };
    }, { pager, quick, currentPage: current.page, lastPage: current.pageCount, desired });
    if (!control) throw new Error("找不到可核验的分页控件");
    if (control.typed) {
      await page.fill(control.selector, String(control.number));
      await page.press(control.selector, "Enter");
    } else {
      await page.click(control.selector, { label: "读取所选业务数据页" });
    }
    await page.waitForFunction(({ number, previous }) => {
      const active = document.querySelector("main .ant-pagination-item-active");
      const row = document.querySelector("main tr[data-row-key]");
      return Number(active?.innerText.trim()) === number && row && row.dataset.rowKey !== previous &&
        !document.querySelector("main .ant-spin-spinning");
    }, { number: control.number, previous: current.keys[0] }, { timeout: 10000 });
    await page.waitForFunction(collectPage, spec, { timeout: 10000 });
    const next = await page.evaluate(collectPage, spec);
    if (!next || next.page !== control.number || next.pageCount !== from.pageCount ||
        next.reportedTotal !== from.reportedTotal || next.pageSize !== from.pageSize) {
      throw new Error("分页结果不一致，无法确认当前读取范围");
    }
    current = next;
  }
  if (current.page !== desired) throw new Error("未到达请求页");
  return current;
}

export async function readLivsynView(page, view, requestedPage = 1, requestedCount = 1, details = false) {
  if (!Object.hasOwn(views, view) || !Number.isSafeInteger(requestedPage) || requestedPage < 1 ||
      !Number.isSafeInteger(requestedCount) || requestedCount < 1 || requestedCount > 5) {
    throw new Error("无效的灵生查询范围");
  }
  const spec = { ...views[view], ...(details && recordFields[view] ? { recordFields: recordFields[view] } : {}) };
  const source = origin + spec.path;
  await page.goto(source, { timeout: 12000 });
  try {
    await page.waitForFunction(collectPage, spec, { timeout: 12000 });
  } catch (error) {
    const current = new URL(await page.url());
    const loginForm = await page.evaluate(() => Boolean(document.querySelector('input[type="password"]'))).catch(() => false);
    if (current.origin !== origin || loginForm || /(?:login|sign-in|signin)/i.test(current.pathname)) {
      throw Object.assign(new Error("需要重新确认灵生登录"), { code: "LOGIN_REQUIRED" });
    }
    throw error;
  }
  if (new URL(await page.url()).origin !== origin) throw new Error("灵生页面不在已授权站点");
  const first = await page.evaluate(collectPage, spec);
  if (!first) throw new Error("未识别到要求的页面数据");
  if (view === "statistics") {
    if (requestedPage !== 1 || requestedCount !== 1) throw new Error("统计报告按日期显示，当前只支持读取默认日期");
    return { view, source, observedAt: new Date().toISOString(), ...first };
  }
  if (requestedPage > first.pageCount) {
    throw Object.assign(new Error("请求页超过平台显示的页数"), { code: "PAGE_OUT_OF_RANGE" });
  }
  const lastPage = Math.min(requestedPage + requestedCount - 1, first.pageCount);
  let result = await movePage(page, spec, first, requestedPage);
  const pages = [];
  const keys = new Set();
  for (let number = requestedPage; number <= lastPage; number++) {
    if (number !== result.page) result = await movePage(page, spec, result, number);
    if ((!result.data.length && !result.noDataShown) || result.keys.some((key) => keys.has(key))) {
      throw new Error("分页之间有重复或未确认的数据");
    }
    result.keys.forEach((key) => keys.add(key));
    pages.push(summarize(result));
  }
  return {
    view, source, observedAt: new Date().toISOString(),
    firstPage: requestedPage, lastPage, pageCount: first.pageCount, rowsRead: keys.size,
    reportedTotal: first.reportedTotal || null,
    nextPage: lastPage < first.pageCount ? lastPage + 1 : null,
    wholeListRead: requestedPage === 1 && lastPage === first.pageCount,
    pages,
  };
}
