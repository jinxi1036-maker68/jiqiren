import { views } from "./livsyn_ego.mjs";

export function createLivsynTool(Type, readView) {
  return {
    name: "read_livsyn",
    label: "读取灵生后台",
    description: "读取公司灵生后台的统计汇总或指定列表页。返回日期、来源和实际读取范围。列表结果是指定页的汇总，不能按分页总数推断已读全表。采集、上传、复核和结算应分别分析。",
    parameters: Type.Object({
      view: Type.Union(Object.keys(views).map((view) => Type.Literal(view)), {
        description: "statistics 采集统计，projects 项目，tasks 采集任务，uploads 上传记录，datasets 数据集，reviews 标注与审核，devices 设备",
      }),
      page: Type.Optional(Type.Integer({ minimum: 1, description: "列表页码，默认第 1 页" })),
    }, { additionalProperties: false }),
    async execute(_id, { view, page = 1 }, signal) {
      let result;
      if (!Object.hasOwn(views, view) || !Number.isSafeInteger(page) || page < 1 || (view === "statistics" && page !== 1)) {
        result = { ok: false, error: "无效的灵生只读查询范围" };
      } else {
        try {
          result = { ...await readView(view, page, signal), ok: true };
        } catch (error) {
          const hint = error?.code === "LOGIN_REQUIRED"
            ? "灵生登录已过期，需要负责人在公司浏览器重新登录。"
            : "本次未取得所请求的灵生数据，请按实际已读范围汇报。";
          result = { ok: false, error: hint };
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }], details: result };
    },
  };
}
