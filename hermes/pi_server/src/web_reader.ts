import { Type } from "typebox";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export default function webReader(pi) {
  pi.registerTool({
    name: "read_webpage",
    label: "读取公开网页",
    description: "用普通 HTTP 请求读取公开网页正文、标题、文本表格和链接，供资料研究与经营分析使用。返回来源、抓取时间和读取范围。动态内容、登录数据、图片和图表可能无法取得。",
    parameters: Type.Object({
      url: Type.String({ description: "要读取的公开 HTTP/HTTPS 网页链接" }),
      max_chars: Type.Optional(Type.Number({ minimum: 500, maximum: 12000, description: "本次正文最多返回的字符数，默认 12000" })),
    }),
    async execute(_id, params, signal) {
      try {
        const { stdout } = await run("python3", ["/srv/pi-feishu/app/src/web_read.py", params.url, String(params.max_chars ?? 12000)], {
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
