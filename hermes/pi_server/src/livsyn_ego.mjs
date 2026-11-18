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

function collectPage({ heading, fields = [] }) {
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
  if (indexes.includes(-1)) return null;
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
  };
}

export async function readLivsynView(page, view, requestedPage = 1) {
  if (!Object.hasOwn(views, view) || !Number.isSafeInteger(requestedPage) || requestedPage < 1) {
    throw new Error("无效的灵生查询范围");
  }
  const spec = views[view];
  const source = origin + spec.path;
  await page.goto(source, { timeout: 12000 });
  try {
    await page.waitForFunction(collectPage, spec, { timeout: 12000 });
  } catch (error) {
    const current = new URL(await page.url());
    if (current.origin !== origin || /(?:login|sign-in|signin)/i.test(current.pathname)) {
      throw Object.assign(new Error("需要重新确认灵生登录"), { code: "LOGIN_REQUIRED" });
    }
    throw error;
  }
  if (new URL(await page.url()).origin !== origin) throw new Error("灵生页面不在已授权站点");
  const first = await page.evaluate(collectPage, spec);
  if (!first) throw new Error("未识别到要求的页面数据");
  if (view === "statistics") {
    if (requestedPage !== 1) throw new Error("统计报告按日期显示，当前只支持读取默认日期");
    return { view, source, observedAt: new Date().toISOString(), ...first };
  }
  if (requestedPage > first.pageCount) throw new Error("请求页超过平台显示的页数");
  let result = first;
  if (requestedPage !== first.page) {
    const direct = `main .ant-pagination li.ant-pagination-item[title="${requestedPage}"]`;
    const quick = "main .ant-pagination-options-quick-jumper input";
    const control = await page.evaluate(({ direct, quick }) => {
      const button = document.querySelector(direct);
      const element = button ?? document.querySelector(quick);
      if (!element) return null;
      element.scrollIntoView({ block: "center", behavior: "instant" });
      return button ? "direct" : "quick";
    }, { direct, quick });
    if (control === "direct") {
      await page.click(direct, { label: "读取所选业务数据页" });
    } else if (control === "quick") {
      await page.fill(quick, String(requestedPage));
      await page.press(quick, "Enter");
    } else {
      throw new Error("该页不在当前分页栏，尚未读取");
    }
    await page.waitForFunction(({ number, previous }) => {
      const current = document.querySelector("main .ant-pagination-item-active");
      const row = document.querySelector("main tr[data-row-key]");
      return Number(current?.innerText.trim()) === number && row && row.dataset.rowKey !== previous &&
        !document.querySelector("main .ant-spin-spinning");
    }, { number: requestedPage, previous: first.keys[0] }, { timeout: 12000 });
    await page.waitForFunction(collectPage, spec, { timeout: 12000 });
    result = await page.evaluate(collectPage, spec);
  }
  if (!result || result.page !== requestedPage || (!result.data.length && !result.noDataShown)) {
    throw new Error("未确认请求页的实际业务数据");
  }
  return { view, source, observedAt: new Date().toISOString(), ...summarize(result) };
}
