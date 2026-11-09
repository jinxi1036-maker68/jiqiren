# 小程序版本变更记录

版本必须对应**真正提交到GitHub**的文件和测试结果。产品构想和未实现的功能记录在知识库，不虚报成代码成果。

## 2026-11-08｜Knowledge baseline（仅知识底板，未发行App）
- 在既有 `jinxi1036-maker68/jiqiren` 仓库新增独立 `miniapp/` 模块，含产品原则、需求台账、决策史、Codex开发规范、代码/测试/发布目录。
- 固化Owner确认的“商家＋个人采集员”模式，保留原有城市运营V0.1—V0.5和GitHub Issue #24的历史来源。
- **当前没有可运行小程序、没有发布版本、没有正式支付和客户API接入。**


## 2026-11-09｜批量功能细化（文档版本，无应用代码）
- 记录Owner确认的第60项：低于60分后已有预约原则上继续，安全/恶意违规例外由凌矩逐单核查；因凌矩主动取消不追加扣分。
- 记录Owner将剩余日常交互和流程委托AI批量整理的工作方式，新增 `knowledge/FUNCTIONAL_RULES_BATCH_V1_20261109.md`，区分已确认规则、可调整工作默认与真实商业授权门槛。
- 更新 `DECISION_LOG.md`、`PROJECT_STATE.json`、`OPEN_QUESTIONS.md`、`SCREEN_DESIGN.md`、`REQUIREMENTS.json` 导航及状态。**仅文档已入库；未开发可运行小程序，未完成测试，也无真实支付/QA/IoT接入。**


## 2026-11-09｜原生微信小程序体验版开发方向（仅方案与Issue）
- Owner说明已有微信小程序账号，明确同意直接做**微信小程序原生模拟体验版**，不先做独立网页。
- 创建Codex开发任务 [Issue #25](https://github.com/jinxi1036-maker68/jiqiren/issues/25)，原生代码目标 `miniapp/apps/wechat/`，取代旧Issue #24网页优先方向但保留历史。
- 更新ROADMAP、AGENTS、README、PROJECT_STATE、REQUIREMENTS、DECISION_LOG和入口文档；**本次仍只是文档和任务单变更，尚未验证Codex实际编写、运行、测试或上传任何微信小程序**。
