# 小优封存清理与唯一 Hermes 迁移：现场执行状态

**核对时间**：2026-11-11 17:20（北京时间）  
**状态**：旧小优加密封存、隔离恢复及专属资产清理已完成；正式 Hermes 尚在原 Windows 电脑运行，Linux 迁移与唯一切换尚未执行。  
**理念**：以 [唯一正式数字员工宪章](../HERMES_DIGITAL_EMPLOYEE_CHARTER.md) 为准。服务器旧 `hermes-erxiao` 代理不是原电脑的正式 Hermes，未把它当作迁移源。

## 1. 已完成的旧小优封存与恢复验证

- 原服务器为 Alibaba Cloud Linux 3、2 vCPU。按已冻结清单归档 97 个顶层来源，包括小优生产代码、候选版、记忆与 Skills、租户数据、系统服务、专属配置和旧备份；活动 SQLite 用在线一致性快照替代直接复制主库/WAL。
- 完整加密包 `xiaou-full-2026-11-11.aesgcm` 为 1,003,470,707 字节，SHA256 `9801f5ea3d28058e06c47718eaf135fe945ca04da9514d3a84567902ec114183`。另将固定版本的搜索容器镜像保存为 104,913,530 字节的加密补充包，SHA256 `994d499f351e26c945bc3d1420ebe03ca7418206066e3b1dda66179b48542552`。
- 两包均已上传至 Owner 指定的**私有小优 GitHub 仓库**，从 GitHub 新克隆重新下载，实际字节数、SHA256 与 AES-256-GCM 认证均通过。解密钥匙仅存于 Owner 电脑本机私有目录及桌面 `小优封存备份恢复钥匙_2026-11-11`，未提交或传输到 GitHub。桌面说明写明钥匙与电脑一起丢失时密文无法解开；后续宜再由 Owner 自行保存一份独立副本。
- 在服务器私有隔离目录从密文恢复出 456,353 个普通文件；数据库快照 `PRAGMA integrity_check=ok`、13 张表；关键运行入口匹配并通过语法检查。恢复副本的核心 Resident 在无外网、隔离挂载环境启动并维持 8 秒，无错误后按测试超时退出。搜索镜像加密流通过完整 gzip/tar 检查。**未**演练真实企业微信送达、旧域名及证书未来可用性。
- 脱敏源码、恢复说明、完整加密包的 LFS 指针和校验清单见私有仓库 [Draft PR #39](https://github.com/jinxi1036-maker68/xiaou-pi-lab/pull/39)。此处 GitHub 存放加密包，是 Owner 对原 ADR“另选外部加密存储”的最新明确变更；仓库中没有解密钥匙或明文生产数据。

## 2. 已完成的服务器清理

- 在上述恢复验证通过后，停止并禁用 `xiaou-pi-cloud-resident`、`xiaou-pi-cloud-wecom`、`xiaou-pi-search`、`hermes-wecom-proxy` 四项旧代理服务；确认旧进程已退出。
- 按归档中的**精确路径清单**预检真实路径、重解析点和挂载边界后，移除 95 个专属路径，包括旧代码、租户数据、旧代理资料、专属配置、专属 systemd 单元和旧备份；复核 95 项残留为 0。已删除专属搜索容器与已单独加密封存的镜像。本轮演练临时目录也已清理。
- 保留 `aa-nginx` 共享配置、`youyi-trip-h5`、`pm2-root`、Docker、SSH 及系统服务；清理后这些服务均为 `active`。根盘可用空间由演练期间约 14GB 回升至约 26GB。
- 两份旧 `hermes-cloud-hub` 环境备份及一个 masked 单元等未归档、归属不完全明确的旧文件留在原位；它们没有活动服务证据，**未擅自删除**。旧域名、备案和企业微信外部故障未修复。

## 3. 原 Hermes 迁移前现场事实

- 原 Windows 电脑当前仍有唯一正式 Hermes Desktop 与 gateway 在运行；`hermes --version` 返回 Agent **v0.22.2**、本地源码提交 `d923a5eb487a`、Python 3.14.4。安装目录名字含 `v0.21.0`，但不能据目录名误报实际版本。Desktop 自身包版本与 Agent 版本分别记录，不混用。
- 活动用户数据根为该电脑的 `~/.hermes`；SOUL、公司工作区 `company-workspace/HERMES.md`、记忆、Skills 和会话均存在。`state.db` 主文件约 1.213GB，仍有 WAL；已启用的 cron 工作有 4 项。Skills 目录 822 个文件、sessions 目录约 3,549 个文件；浏览资料和 Windows 工具依赖需重新适配，不能把登录 Cookie 或 Windows 可执行文件直接搬到 Linux。
- 本轮只读取元数据和数量，没有输出私人记忆、会话正文、提示词或凭据；没有向 Hermes 发送模型消息，没有关闭原电脑网关或修改其正式身份、工作区、任务和配置。
- **17:41 增量核验**：使用原 v0.22.2 的 `hermes backup`，显式指向活动 `~/.hermes`，在电脑本机私有目录生成迁移前恢复点；9,148 个文件，压缩后 514,854,360 字节，SHA256 `b1055b654e410345941c5de4fdc7335aa7efdd7298894be382ad623243ed473b`。ZIP 全成员 CRC 检查通过；从包内取出的 `state.db` 为 1,213,476,864 字节，独立 SQLite `PRAGMA quick_check=ok`。确认包含 `SOUL.md`、`company-workspace/HERMES.md`、`cron/jobs.json`、`.env` 与 `auth.json`，**未读取其私人正文或凭据，也未上传该备份**。验库时临时取出的数据库及其 sidecar 已删除。此备份是迁移前回退点；正式切换前仍需再取一次最新状态，避免丢失期间新会话。

## 4. 阻断与下一步

- 清理后服务器仍只有 **1.83GiB 总内存**，可用约 1.16GiB；[Hermes 官方 Docker 文档](https://hermes-agent.nousresearch.com/docs/user-guide/docker/)要求启用浏览器时给 Hermes **至少 2GB**，推荐容器 2–4GB。服务器还保留网页服务、代理与 Docker，因此当前资源**不满足**把完整浏览器能力稳定迁入的前置条件。不能在此状态直接安装后宣布生产切换。
- 最小可选实例规格是同系列 `ecs.e-c1m2.large`（2 vCPU / 4GiB）；考虑长期浏览器工作与现有网页服务，建议 `ecs.e-c1m4.large`（2 vCPU / 8GiB）。[阿里云规格表](https://www.alibabacloud.com/help/en/ecs/user-guide/overview-of-instance-families)列出这两档。实际上海地域能否原机变配、增量费用和停机时长必须以 Owner 控制台当时显示为准；**本轮未申请、购买或升级**。
- 获得服务器规格与费用确认后：先保留原 Windows 端运行；建立一致性 `state.db` 快照及身份/记忆/Skills/必要会话/四项任务的受控迁移包；在服务器安装与 v0.22.2 兼容的 Linux 运行环境，先禁用真实飞书和 cron 作隔离验收；重新适配本机浏览器、MCP 及登录授权。通过后才安排停写窗口：停止原电脑的网关与调度，再让同一身份在服务器接管飞书和任务，验证唯一收发、重启恢复与回退。任何阶段失败，服务器实例保持不对外工作，原电脑继续承担正式岗位。

**本轮结论**：小优封存和明确范围内的清理已达成；原 Hermes 迁移尚未达成，当前阻断为服务器内存及跨 Windows/Linux 工具适配。不得把封存、备份或本报告当成“同一 Hermes 已在服务器运行”。
