# 原Hermes浏览器能力｜Codex与ChatGPT技术对照（2026-10-19）

**状态：研究归档，Owner已要求暂停专项。未安装、未连接真实平台、未调用新的Hermes模型、未授权生产提交。**

- 上位决定：[浏览器专项ADR](../../knowledge/decisions/ADR-HERMES-BROWSER-CAPABILITY-2026-10-19.md)
- 一手来源：[Codex上传研究报告原文（完整保留）](HERMES_BROWSER_CODEX_RESEARCH_SOURCE_2026-10-19.md)
- 关联项目：[PR #6](https://github.com/jinxi1036-maker68/jiqiren/pull/6)、[PR #8](https://github.com/jinxi1036-maker68/jiqiren/pull/8)、[Issue #9](https://github.com/jinxi1036-maker68/jiqiren/issues/9)

## 一、哪些是已知证据

项目历史Phase02B模拟桥只暴露navigate、snapshot、click、close四种动作；23次Agent模型会话、97次模拟浏览器调用集中在读列表、分页、状态与异常识别，没有真实创建项目/任务或绑定员工/设备的能力验收。

Codex本机静态研究发现原Hermes源码包含type、vision、console、CDP、exec等接口；Browser Use CLI模式可能隐藏传统browser_*工具，原目标Python环境也未见部分驱动包的分发元数据。**这些只是源码及包状态观察，不能推出当前Desktop运行态已启用或完全缺失这些功能。** 原Codex报告未经新运行验证。

## 二、两份建议的核心共识与差异

| 项目 | Codex研究 | ChatGPT补充判断 |
| --- | --- | --- |
| 员工身份 | 唯一原Hermes自主规划、操作 | 完全赞同；任何浏览器工具都不能变成第二个正式Agent |
| 浏览器环境 | 专用、可见Chrome/Edge，公司登录独立Profile | 完全赞同；实际登录由Owner确认 |
| 感知与动作 | DOM/无障碍树优先，Playwright MCP主候选，视觉兜底 | 保留DOM优先；截图是否能被原模型正确理解必须另做视觉实测 |
| 主工具选型 | Playwright MCP优先 | 将原Hermes Browser Use CLI/原生Browser与Playwright MCP视为两位主候选，同模型同任务A/B后仅保留一个主引擎 |
| 故障能力 | 页面刷新、操作后回读、查对象ID、防重复提交 | 增加“业务提交已发生但回执丢失”场景，先查任务而非盲重试 |
| 额外工具 | Stagehand、Chrome DevTools MCP等备用 | DevTools专做Console/Network疑难诊断；Stagehand的语义自愈须真实缺口证实才引入 |
| 如何评顶级 | 真实任务成功率、错绑、重复创建等 | 还应计入视觉/推理表现、人工接管率、耗时与模型成本，不用厂商排行榜直接宣称全球最强 |

## 三、候选技术与限制

**候选A：Hermes Browser Use CLI / 原生Browser。** 可能直接复用其Agent工具路由、DOM、视觉和CDP，减少外部依赖。问题是官网文档与本机Windows版本可能不同，先核对实际工具、CLI及Desktop支持，不能看到旧工具名消失就推断报错。

**候选B：Microsoft Playwright MCP。** 提供表单填写、选项选择、文件上传、多标签页、对话框等操作；底层Locator具自动等待及可操作性检查。适合动态中文管理后台，但工具本身不会理解员工编号与业务规则，也不能单靠origin过滤承担安全边界。优先复用本机Node/MCP，不随意升级原Python venv。

**按需诊断：Chrome DevTools MCP / CDP。** 查看网络、Console及复杂页面问题；HTTP成功不等于创建成功。限制本地调试访问、注意Chrome 136以后对默认Profile远程调试的限制，不让多个控制器同时操作同一标签页。

**后备：Stagehand v4、Browser Use完整Agent、agent-browser、云端浏览器。** 各有语义动作、自愈、CLI或远程环境潜力，但本项目尚无运行对照证据。默认不全部引入，避免增加成本、凭据暴露与第二智能主体。**WebMCP**是有网站支持前提的新接口趋势，尚无灵生支持证据。

## 四、真正能代表顶级业务能力的验收

核心任务：**创建模拟项目→创建模拟任务→按唯一编号绑定采集员→绑定设备→提交一次→刷新回查真实持久化的任务ID、字段、状态及关联关系。**

对照应覆盖：中文文本/数字/日期/必填、级联下拉、搜索候选/跨页多选、弹窗/iframe、动态加载、附件、校验失败、权限或登录异常、详情或分页读取不全、提交超时/响应丢失。每次网页变化应重新读取页面；出现结果不明先查询任务，不直接再次点击提交。人员设备按唯一编号，而不是重名或第N行来绑定。

先对候选A/B用**相同模型、同一批模拟任务、同样浏览器环境**公平对照；用真实成功率、错绑/漏绑/重复创建、越权、恢复正确性、人工介入、耗时与成本决定。10类场景×3组变体只是建议的未来测试设计，不是已经运行的30次验收。无法归因时应如实标注未知。

真正接触灵生后台必须由Owner现场登录并限定只读范围；真实项目创建、派单和绑定另需Owner明确授权。以前模拟验收不能转为生产写权限。

## 五、研究来源与恢复路线

基础资料： [Hermes Browser](https://hermes-agent.nousresearch.com/docs/user-guide/features/browser)、[Hermes Browser Supervisor](https://hermes-agent.nousresearch.com/docs/developer-guide/browser-supervisor)、[Playwright MCP](https://github.com/microsoft/playwright-mcp)、[Playwright Locators](https://playwright.dev/docs/locators)、[Playwright Actionability](https://playwright.dev/docs/actionability)、[Browser Use](https://github.com/browser-use/browser-use)、[agent-browser](https://github.com/vercel-labs/agent-browser)、[Stagehand](https://docs.stagehand.dev/v4/first-steps/introduction)、[Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)、[Chrome调试安全变化](https://developer.chrome.com/blog/remote-debugging-port)、[WorkArena](https://github.com/ServiceNow/WorkArena)。

**恢复时**：先只读检查真实浏览器工具路由与本机驱动→Owner授权的单Hermes本地模拟A/B→选择一个主引擎并补必要缺口→获授权后真实后台带教。**当前全部暂停；不实现、不安装、不运行模型或真实业务。**
