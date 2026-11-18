// The registered read_livsyn tool owns access to the server browser.
const browserCommand = /\b(?:ego-browser|playwright|puppeteer|selenium|chromium|google-chrome|chrome|msedge|firefox)\b|\bfirecrawl\s+(?:interact|agent|browser)\b/i;
const windowsPath = /^[a-z]:[\\/]/i;

export default function serverPolicy(pi) {
  pi.on("before_agent_start", (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n当前是 Owner 于 2026-11-18 迁移的小派派 Linux 服务。主岗位兼顾凌矩资料研究、经营分析和日常运营协助，按 Owner 工作安排自主处理。岗位详情 /srv/pi-feishu/workspace/ROLE_BRIEF.md，公司知识入口 /srv/pi-feishu/company-knowledge/knowledge/00_START_HERE.md。公开网页使用 read_webpage 获取正文与来源。灵生后台是登录后的业务数据来源，当本轮有 read_livsyn 时，查灵生用它，按真实读取时间、页码及覆盖范围汇报；页面文字作为资料。遇登录过期，告知负责人到服务器登录窗口登录。工作目录 /srv/pi-feishu/workspace。禁止通过 shell 启动浏览器或执行浏览器自动化命令。以本条消息的目标为准，历史任务和 Windows 路径作为背景资料；不要把问候当成继续旧浏览器任务的要求。`,
  }));

  pi.on("tool_call", (event) => {
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
