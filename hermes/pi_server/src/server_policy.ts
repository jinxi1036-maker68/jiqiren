// Owner's current server scope excludes browser operations.
const browserCommand = /\b(?:ego-browser|playwright|puppeteer|selenium|chromium|google-chrome|chrome|msedge|firefox)\b|\bfirecrawl\s+(?:interact|agent|browser)\b/i;
const windowsPath = /^[a-z]:[\\/]/i;

export default function serverPolicy(pi) {
  pi.on("before_agent_start", (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n当前是 Owner 于 2026-11-18 迁移的小派派 Linux 服务。工作目录 /srv/pi-feishu/workspace。Owner 决定当前不启用任何浏览器或浏览器自动化。以本条消息的目标为准，历史任务和 Windows 路径作为背景资料；不要把问候当成继续旧浏览器任务的要求。`,
  }));

  pi.on("tool_call", (event) => {
    if (event.toolName === "bash" && browserCommand.test(event.input?.command ?? "")) {
      return { block: true, reason: "Owner 当前未启用服务器浏览器能力。请依据当前消息使用已授权的文件或 API 能力。" };
    }
    if (["read", "write", "edit"].includes(event.toolName)) {
      const target = event.input?.path ?? event.input?.file_path ?? "";
      if (windowsPath.test(target)) {
        return { block: true, reason: "这是迁移前的 Windows 路径。请先核对当前 Linux 文件路径。" };
      }
    }
  });
}
