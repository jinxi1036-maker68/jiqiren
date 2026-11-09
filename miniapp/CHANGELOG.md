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

## 2026-11-09｜V0.1 原生微信模拟体验

- [Issue #25](https://github.com/jinxi1036-maker68/jiqiren/issues/25)。在 `apps/wechat/` 交付商家、个人采集员双入口和隔离的凌矩运营工作台，提供三处虚构场景和重置入口。
- 以本机模拟时钟和存储演示门店入驻、开放窗口、分时预约、密码箱自助领还、归还核验、QA 与月度账目、信誉和交通补贴复核。
- 25 项 Node.js 流程及原生页面逻辑测试通过。微信离线编译器编译并渲染 6 个 WXML 页面，WXSS 编译通过。
- 微信开发者工具 2.02.2609250 识别工程信息。游客模式校验占位 AppID 时返回系统错误 1，模拟器和真机预览待使用有权限的本地 AppID 验收。
- [导入说明与三个演示剧本](apps/wechat/README.md)。
- 已创建 [Draft PR #26](https://github.com/jinxi1036-maker68/jiqiren/pull/26)。[验收记录和离线编译截图](apps/wechat/evidence/README.md)随分支交付。
- 账号持有人配置本地 AppID 后，桌面模拟器编译并验证首页、采集员任务列表及任务详情。修正任务页空值警告，25 项测试复跑通过。
