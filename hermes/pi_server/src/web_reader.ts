import { Type } from "typebox";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export default function webReader(pi) {
  pi.registerTool({
    name: "read_webpage",
    label: "读取公开网页",
    description: "用普通 HTTP 读取公开网页，优先提取文章正文；带表格的页面保留原网页文本。返回来源、抓取时间、链接和读取范围。需要核对正文之外的文字时，使用 text_mode=page。动态内容、登录数据、图片和图表可能无法取得。",
    parameters: Type.Object({
      url: Type.String({ description: "要读取的公开 HTTP/HTTPS 网页链接" }),
      max_chars: Type.Optional(Type.Number({ minimum: 500, maximum: 12000, description: "本次正文最多返回的字符数，默认 12000" })),
      text_mode: Type.Optional(Type.Union([
        Type.Literal("auto"),
        Type.Literal("page"),
      ], { description: "auto 优先提取文章正文，page 读取网页文本（仍受字符上限限制）。默认 auto。" })),
    }),
    async execute(_id, params, signal) {
      try {
        const { stdout } = await run("python3", [
          "/srv/pi-feishu/app/src/web_read.py", params.url, String(params.max_chars ?? 12000), params.text_mode ?? "auto",
        ], {
          timeout: 25000, maxBuffer: 512 * 1024, encoding: "utf8", signal,
        });
        const result = JSON.parse(stdout);
        return { content: [{ type: "text", text: JSON.stringify(result) }], details: result };
      } catch (error) {
        const result = { ok: false, error: "网页读取未完成，请将该来源列为尚未读到。", error_type: error.code ?? error.name };
        return { content: [{ type: "text", text: JSON.stringify(result) }], details: result };
      }
    },
  });
}
