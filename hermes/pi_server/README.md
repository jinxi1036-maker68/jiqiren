# 小派派 Linux 飞书部署

沿用电脑上现有 Pi 1.5.2、飞书 SDK 1.76.0 和 pi-memory 0.4.2。保留小派派原飞书应用身份、会话和记忆，在 Linux 上运行一个桥接进程。Owner 于 2026-11-18 明确服务器本轮暂不使用浏览器。

## 文件与运行

- `src/` 为现有飞书桥接源码。恢复会话时向 `SessionManager.open` 传入 Linux 工作目录，保留原 JSONL 会话内容。
- `package-lock.json` 固定依赖。使用 Node.js 22.19.0 及以上版本执行 `npm ci --omit=dev --ignore-scripts`。
- `pi-feishu.service` 使用独立用户 `pi-feishu`，从 `/srv/pi-feishu/app` 启动。用户主目录为 `/srv/pi-feishu/home`，工作目录为 `/srv/pi-feishu/workspace`。
- 运行目录的 `.env`、`home/.pi/agent/` 和 `app/data/` 由私有迁移包提供。其中包含认证、记忆和原会话，仅存 Owner 控制的位置。
- `.env` 中 `PI_CWD=/srv/pi-feishu/workspace`、`MAX_ACTIVE_SESSIONS=2`。会话映射中的文件路径改为 `/srv/pi-feishu/app/data/sessions/`，原会话正文保留。
- 服务器设置暂时排除浏览器相关 Skills 自动装载，保留其原始文件。没有安装浏览器运行时。
- `server_policy.ts` 在 Pi 工具调用入口阻止已知浏览器命令及 Windows 文件路径，提示以当前消息为工作目标。它由服务器 Pi 的 `settings.json` 中 `extensions` 配置加载。

服务设为开机启动和失败后自动恢复，内存软目标 600MiB、硬上限 900MiB。实际可用能力仍取决于模型服务及现有工具依赖。部署前后应通过原飞书单聊验证真实收发。

## 切换与恢复

先备份并核验电脑 Pi 的程序、模型配置、记忆和会话，完成服务器零模型检查与一次模型连接验证。停止电脑的 Pi 桥接，将其登录自启文件移到私有恢复目录，再启动服务器服务。

需要退回电脑时，先停止并禁用服务器的 `pi-feishu.service`，确认桥接进程结束。将切换后新增的会话和记忆同步回电脑并核对路径，恢复已保留的登录自启文件，再启动原电脑桥接。两端同时接收真实消息会造成重复或分流。

本轮停用的旧网站代码、PM2 启动快照和服务配置保存在服务器原目录及 `/var/lib/lingju-maintenance/pi-20261118/`。恢复网站前根据该目录的原始状态分别启用服务。完整回退资料保存在私有位置，GitHub 仅存脱敏源码和执行结果。
