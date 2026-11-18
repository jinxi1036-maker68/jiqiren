import { views } from "./livsyn_ego.mjs";

export function createLivsynTool(Type, readView) {
  return {
    name: "read_livsyn",
    label: "读取灵生后台",
    description: "从服务器读取公司灵生后台的真实统计汇总和列表。可分批读取，按 nextPage 继续，核对每次已读页码。采集、上传、复核和结算应分别分析。登录失效时报告状态，无需用户发送密码或 Token。",
    parameters: Type.Object({
      view: Type.Union(Object.keys(views).map((view) => Type.Literal(view)), {
        description: "statistics 采集统计，projects 项目，tasks 采集任务，uploads 上传记录，datasets 数据集，reviews 标注与审核，devices 设备",
      }),
      page: Type.Optional(Type.Integer({ minimum: 1, maximum: 9999, description: "起始页码，默认第 1 页" })),
      pages: Type.Optional(Type.Integer({ minimum: 1, maximum: 5, description: "本次连续读取页数，默认 1，最多 5" })),
      details: Type.Optional(Type.Boolean({ description: "是否读允许的业务明细列，默认否。读明细时最多连续 2 页。" })),
    }, { additionalProperties: false }),
    async execute(_id, { view, page = 1, pages = 1, details = false }, signal) {
      let result;
      if (!Object.hasOwn(views, view) || !Number.isSafeInteger(page) || page < 1 || page > 9999
        || !Number.isSafeInteger(pages) || pages < 1 || pages > 5 || typeof details !== "boolean"
        || (details && pages > 2) || (view === "statistics" && (page !== 1 || pages !== 1 || details))) {
        result = { ok: false, error: "无效的灵生只读查询范围" };
      } else {
        try {
          result = { ...await readView(view, page, pages, details, signal), ok: true };
        } catch (error) {
          const hints = new Map([
            ["LOGIN_REQUIRED", "服务器灵生会话需要负责人重新登录。"],
            ["BUSY", "灵生读取器正在工作，请等当前查询结束再查。"],
            ["TIMEOUT", "本批读取超时，可缩小到一页。"],
            ["PAGE_OUT_OF_RANGE", "要求的页码超过灵生当前分页范围。"],
          ]);
          result = { ok: false, error: hints.get(error?.code) ?? "本次未取得所请求的灵生数据，请按实际已读范围汇报。" };
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }], details: result };
    },
  };
}
