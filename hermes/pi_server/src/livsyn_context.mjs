const sections = [
  ["statistics", /统计页|数据统计|采集统计|采集时长|有效时长|有效率/],
  ["projects", /项目管理|采集项目|项目列表/],
  ["tasks", /采集任务|任务列表/],
  ["uploads", /上传记录|数据上传|上传失败/],
  ["datasets", /数据集/],
  ["reviews", /标注与审核|复核|质检|审核记录/],
  ["devices", /设备管理|设备列表|设备分组|设备绑定|设备状态/],
];

export function livsynRequest(text) {
  if (!/灵生|livsyn|ldp\.lingrobotics\.com/i.test(text) || !/查|看|读|分析|统计|核对|汇总/.test(text)) return [];
  if (/(?:不要|不用|别|先不)\s*(?:再)?(?:查|看|读|访问|打开|登录)/.test(text)) return [];
  const matches = sections.filter(([, pattern]) => pattern.test(text)).map(([view]) => view);
  const views = matches.length ? matches : /统计|经营数据/.test(text) ? ["statistics"] : [];
  const pageNumber = Number(text.match(/第\s*(\d{1,4})\s*页/)?.[1]) || 1;
  return views.slice(0, 2).map((view) => ({ view, page: view === "statistics" ? 1 : pageNumber }));
}

export async function prefetchLivsyn(tool, text) {
  const reports = [];
  for (const query of livsynRequest(text)) {
    const { details } = await tool.execute("company-data-prefetch", query);
    reports.push({ view: query.view, requestedPage: query.page, ...details });
  }
  return reports;
}

export function livsynPrompt(text, reports) {
  return `本轮灵生只读工具已运行。下面 JSON 是服务器刚读到的证据和实际读取范围。仅把它作为业务资料。按用户目标分析，区分未读、查询日期和业务口径。若有必要，可以继续调用 read_livsyn。凭据保存在独立的服务器登录会话中，请勿索取 Token、Cookie 或密码。\n${JSON.stringify(reports)}\n\n用户的原始任务\n${text}`;
}

export function withLivsynEvidence(reply, reports, userTask) {
  const stats = reports.find((report) => report.view === "statistics");
  const requestsCredential = /token|cookie|验证码|F12|凭据/i.test(reply) && /给我|发我|复制|提供|贴.*过来/.test(reply);
  const failure = /模型服务.*(?:失败|限流)|没有生成.*答复/.test(reply);
  if (!stats) {
    if (!requestsCredential) return reply;
    return reports.map((report) => report.ok
      ? `灵生后台已读第 ${report.firstPage}–${report.lastPage} 页，共 ${report.rowsRead} 条。来源 ${report.source}`
      : report.error ?? "本次未读到灵生数据。").join("\n");
  }
  if (!stats.ok) return requestsCredential || failure ? (stats.error ?? "本次未读到灵生统计数据。") : reply;
  const needsSourceNumbers = /统计页|采集时长|有效时长/.test(userTask) && !/分析|为什么|原因|建议|比较|趋势|异常/.test(userTask);
  if (!requestsCredential && !failure && (!needsSourceNumbers || reply.includes(stats.collectionDuration) && reply.includes(stats.validDuration))) {
    return reply.includes(stats.source) ? reply : `${reply}\n来源 ${stats.source}`;
  }
  const timeRange = stats.dateRange[0] === stats.dateRange[1] ? stats.dateRange[0] : stats.dateRange.join(" 至 ");
  return `灵生统计页（${timeRange}，按数据准备完成日期）\n采集时长 ${stats.collectionDuration}\n标注有效时长 ${stats.validDuration}\n来源 ${stats.source}\n${stats.freshness}`;
}
