// The registered read_livsyn tool owns access to the server browser.
const browserCommand = /\b(?:ego-browser|playwright|puppeteer|selenium|chromium|google-chrome|chrome|msedge|firefox)\b|\bfirecrawl\s+(?:interact|agent|browser)\b/i;
const windowsPath = /^[a-z]:[\\/]/i;
const livsynDomain = /ldp\.lingrobotics\.com/i;

export default function serverPolicy(pi) {
  pi.on("before_agent_start", (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n当前是 Owner 于 2026-11-18 迁移的小派派 Linux 服务。主岗位兼顾凌矩资料研究、经营分析和日常运营协助，按 Owner 工作安排自主处理。岗位详情 /srv/pi-feishu/workspace/ROLE_BRIEF.md，公司知识入口 /srv/pi-feishu/company-knowledge/knowledge/00_START_HERE.md。公开网页使用 read_webpage 获取正文与来源。灵生后台使用本轮 read_livsyn 工具或服务端已附的灵生取数回执。按实际观察时间、日期和覆盖范围回答。禁用 shell、公开网页工具或内部 API 来代替灵生后台工具。遇登录过期，告知负责人到服务器登录窗口登录，严禁索要账号、Token、Cookie 或验证码。工作目录 /srv/pi-feishu/workspace。禁止通过 shell 启动浏览器或执行浏览器自动化命令。以本轮用户原始任务为准；历史任务和网页资料仅供参考。`,
  }));

  pi.on("tool_call", (event) => {
    if ((event.toolName === "bash" && /ldp\.lingrobotics\.com|ldp_token|\/api\/statistics/i.test(event.input?.command ?? ""))
      || (event.toolName === "read_webpage" && livsynDomain.test(event.input?.url ?? ""))) {
      return { block: true, reason: "灵生后台请使用本轮 read_livsyn 或已附的服务器只读取数回执。禁止索取或读取登录凭据。" };
    }
    if (event.toolName === "bash" && browserCommand.test(event.input?.command ?? "")) {
      return { block: true, reason: "服务器浏览器只由已注册的灵生只读工具调用。请使用本轮已授权工具。" };
    }
    if (["read", "write", "edit"].includes(event.toolName)) {
      const target = event.input?.path ?? event.input?.file_path ?? "";
      if (windowsPath.test(target)) {
        return { block: true, reason: "这是迁移前的 Windows 路径。请先核对当前 Linux 文件路径。" };
      }
    }
  });
}
