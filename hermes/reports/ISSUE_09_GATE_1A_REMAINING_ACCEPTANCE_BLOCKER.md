# Issue #9 Gate 1A 剩余验收｜工具恢复未成功，保留接入并交付人工步骤

日期：2026-10-16，Asia/Shanghai。**Gate1A 仍未完整通过；本轮实际原 Desktop 模型对话 0/3。** 没有重做审计、备份、SDK 解耦、原生加载探针或浏览器组件测试。

本轮新增的正面证据是：原安装路径的 Desktop 与后端已在运行，Owner 在本任务中明确回复“已打开但空闲”“界面正常、输入框可用”。这是 **Owner 人工观察**，不是 Codex 独立看到了界面，更不是模型、岗位身份和工具通过验收。

Computer Use 仍在应用发现前失败；本轮完成有界排查/会话重置后停止，依 Owner 最新要求保留已有接入。没有改用 CLI、CDP、IPC、其他 UI 驱动或测试身份代替 Desktop。

## 1. 执行依据和继承

- [Issue #9 Gate1A 授权 6213175793](https://github.com/jinxi1036-maker68/jiqiren/issues/9#issuecomment-6213175793)：最多 3 次原身份、既有模型服务、loopback 合成目标对话；原 MEMORY/USER、旧数据/旧 MCP、任务和凭据保持。
- [PR #12 最新 ChatGPT 审查 5547274086](https://github.com/jinxi1036-maker68/jiqiren/pull/12#pullrequestreview-5547274086)：阶段文件/组件接入接受，完整 Gate1A 未通过；不得用旧隔离/CLI成功替代原入口。
- 本轮用户明确授权有限非破坏排查；工具仍不可用时保留改动、提交故障证据和 Owner 手动步骤，不无限重试或换通道。Owner 最新明确决定优先。
- 原接入固定为 [PR #12 / 2b7c8f6](https://github.com/jinxi1036-maker68/jiqiren/pull/12)，继承 #10/#11 及 Phase01/02A/02B 已验证结果。main 仍为 053b5b4cd2476fdf6df68e2c924a6b1c7d28e080，按 Harness 复核最高宪章、ADR、当前知识；独立 profile 不是长期架构。
- 已完整读取 [PR #13](https://github.com/jinxi1036-maker68/jiqiren/pull/13) 的三份业务更新及未完成一致性说明；发布前发现它从 f7a53ee 更新，已补读固定 315137f85b1b43692b88a969062e8bae642b32ce 的 T+1/T+3 补充。没有合并它或将其整份 CURRENT_WORK 覆盖任何当前文件。

## 2. 有界故障排查：已确认与未知

[TOOL_FAILURE.json](../evidence/issue09_gate1a_acceptance/TOOL_FAILURE.json)保留三次精确工具返回、恢复边界和脱敏日志摘要。

| 操作 | 本轮结果 |
|---|---|
| 按 Computer Use 技能通过 node_repl 导入 @oai/sky | failed to write kernel assets: 系统找不到指定的路径。 (os error 3) |
| 一次 js_reset 后重做相同初始化 | 同样失败 |
| 不导入 sky、仅运行 nodeRepl.write 哨兵 | 同样错误，未返回哨兵文本 |
| 配置的工作区/TEMP/TMP | 均存在；自有临时文件写入和读回成功，已仅移除该新建探针 |
| 已配置的主运行库 | bundle 26.1013.11914；Node CLI v24.19.0 能运行，Python 文件存在 |
| Computer Use 技能 | 26.1013.31256，技能/指导文件可读 |
| 3 份当日已识别 Codex 日志的少数匹配行 | 有 node-repl 解析元数据和较早 bundled-plugin 路径警告；相关暂存源目录当前均存在 |

**推断**：连最简单 Node 会话也失败，故障更像在 node_repl 会话资源准备层，而非 Hermes 界面操作或单独 sky 模块调用。**未确定**真正缺失的 kernel assets 源/目标路径，也未证明较早插件警告与本次错误有因果关系。目录当前存在，不能据此擅自复制资源、创建猜测目录、改权限或重装。

参考[官方 OpenAI 插件排查文档](https://developers.openai.com/plugins/deploy/troubleshooting)按层隔离并保留调用/日志证据；该文档没有给出这个具体错误的修复程序。不会把“重开 Codex”建议写成已经修复或保证有效。

本轮到此停止工具重试。没有搜索/运行桌面 helper、构造自定义客户端、修改 Codex/Hermes 配置、清缓存、安装软件、重启/终止现有进程或改变安全设置。

## 3. 原 Hermes 的定点状态

[FINDINGS.json](../evidence/issue09_gate1a_acceptance/FINDINGS.json)含 6 个目标的继承哈希、本轮前后哈希和观察来源。

- 原 Desktop 主进程在原 I/apps/desktop/release/win-unpacked/Hermes.exe，创建时间为 2026-10-16 19:53:22 +08:00，早于本轮工具尝试。未由 Codex 启动、重启或关闭。
- H/SOUL、H/config.yaml、D/project-dir.json 与 PR #12 after 哈希相同；MEMORY、USER 和 cron/jobs.json 与继承基线相同。**6 项均一致**，不能据此宣称整台机器所有状态都未变化。
- OpenClaw Gateway 仍 enabled/Ready，未停用；原公司接入、新旧工具、恢复包、测试 profile/CMD 保留，没有本轮原环境文件改写。
- Owner 已人工确认界面正常、输入框可用，未要求其发模型消息或登录真实后台。
- 仅对 H/state.db 的 sessions 表作只读 SELECT/结构查询，未读取消息、系统提示、model_config、密钥或旧记忆正文。按ID选出的历史记录最初为10月15日；之后按 started_at 与ID选出9月10日，cwd 都是用户主目录。**结果变化原因未知**，没有扩查或修复会话库；这些历史元数据不能证明当前前台会话，也不能用来认定 C02 生效或失效。

原 Desktop 的真实新会话 home/cwd、SOUL/公司知识注入、完整工具集合/提示截断、重开与自动记忆回流仍未证实。旧记忆语义冲突也不能因没有新模型答复就写“已排除”。未追加 C01/C02 或其他配置修改。

## 4. 新业务事实的处理

[BUSINESS_FRESHNESS.json](../evidence/issue09_gate1a_acceptance/BUSINESS_FRESHNESS.json)记录 PR #13 固定来源、哈希、事实分层和本地新鲜度缺口。

- **Owner 报告的进展**：10月15日三场景准备完成，10月16日内部路径/动作演练。不是平台 QA 验收。
- **计划**：10月17日 3 台，每台采集6小时、目标有效4小时；合计18/12小时是目标，不是实绩或已审核有效小时。原10台阶段目标没有自动变成已到位数量。
- **灵生转交要求**：日报四部分为投入产出、设备、时间/人力/场景计划、上传及按采集日期追踪积压；投递渠道/时限、接收人、人效与有效小时口径仍待确认。没有代为发送日报。
- **灵生较新反馈**：Owner 转发称试采 T+1 出有效时长、周结束不超过 T+3。T 起算点、自然/工作日、周截止及是否最终 QA 未定；不是付款日承诺，也不保证每台4小时通过。已纳入手动第1条的明确补充背景。
- PR #13 仍未合并，仅三份文件，PROJECT_INDEX/SCENE_PIPELINE/PARTNER_LEDGER 同步仍未完成。本轮不补写未经核实的机器事实，也不合并/关闭/改 base #6/#8/#10/#11/#12/#13。
- 原 W 的 18 份资料仍是旧 main 固定快照。本轮没有更新 W 或其 HERMES/状态/清单；保留现状。手动第1条目标显式传递 PR #13 的较新背景，要求 Hermes 与本地旧来源分开，**不能把提示中的背景当成自动读到了新文件**。正式最小知识刷新仍待后续在明确来源/逐文件差异下实施。

## 5. 已交付的人工配合步骤（待执行）

见 [Owner 手动步骤及记录表](../tasks/gate1a_remaining/OWNER_DESKTOP_STEPS.md)，含三份分别复制的自然语言目标：

1. 原入口新会话的身份、实际目录、知识来源及底线核对。
2. 在本次 company_browser_simulation 声明的 /change 合成页自主观察 QA 前后变化。
3. 在 /partial 合成页自主核查覆盖范围、失败与未知。

给目标和底线，不给固定点击顺序，不把正确答案预填进记录。每次用原 Desktop 新会话、逐条核对，最多3次；错误不自动重发。需要凭据/费用、发现旧身份冲突、实际路径不符或越界即停，不关闭记忆、清旧资料、改后台权限来凑通过。完整提示/截断等若没有请求侧证据，继续标未证实。

Owner 可先保存交接材料并手动重开 Codex 一次，再恢复本任务；这是客户端恢复建议，非确认的修复。也可按原已授权范围手动输入目标，再由开发者只读核对这些具体新会话和合成工具记录；不借此启用新自动化操作通道。

## 6. 当前验收表和停止点

| 项目 | 本轮状态 |
|---|---|
| 既有接入文件、恢复点、SDK/组件成果 | 继承保留；本轮不重跑 |
| 原 Desktop 界面 | Owner 人工确认正常；Codex 无独立截图/输入证据 |
| 桌面开发工具恢复 | 未成功，三次调用及一次 reset 后停止 |
| 新 Agent 对话/QA/部分失败 | 0/3，未执行；不是失败答卷，也不是通过 |
| 实际新会话上下文/工具/截断/记忆冲突 | 未证实 |
| 原环境改写/模型凭据/真实业务 | 本轮均未执行 |
| Gate1A/Gate1B/Gate2 | Gate1A 未完整通过；未进入下一 Gate |

本 PR 只追加报告、脱敏证据、手动目标和两个只读取证源码及独立历史记录，不覆盖 CURRENT_WORK/PROJECT_INDEX 或既有完整 History，避免与 PR #13 的较新业务字段发生旧版本整写冲突。主库当前状态仍须 Owner 选择性整合，不能把开放 PR 当已合并。

按用户最新要求保留原接入，不回退、不清理、不停任务。到此停止自动验收，等待 Owner 手动配合及 Owner/ChatGPT 审阅；任何新凭据、旧记忆处置、真实后台或正式运营仍须另行具体授权。
