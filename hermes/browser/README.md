# 原Hermes浏览器能力强化：本地B路线首轮

状态：工具建设和组件验证已完成一部分；Hermes本人模型验收被前置门槛阻断。
禁止把本目录的组件测试当成Hermes自主完成任务或真实灵生上线证据。

本轮依据Owner于2026-10-24批准的B路线计划，跨午夜实施至2026-10-25。
最高原则仍是[唯一数字员工宪章](../../knowledge/HERMES_DIGITAL_EMPLOYEE_CHARTER.md)。

## 设计

原Hermes仍是唯一Agent。这里提供浏览器工具、合成验收夹具和证据，不决定员工每天的工作步骤。
TASKS.md只交代目标、权限、结果标准；动作顺序由Hermes选择。
fixture.mjs / web/是本机测试站，不是新的公司管理系统，也不代表真实灵生菜单。

- 原生候选：browser-use 0.13.11 + browser-harness 0.1.13，独立venv；未改原活动venv。
- Playwright候选：@playwright/mcp 0.0.83 + @modelcontextprotocol/sdk 1.30.0，npm精确锁定。
- 原生CLI兼容层只把旧调用的exec参数转换为固定CLI的stdin形式；不修改Hermes或第三方包。
- 原生IPC仍超时，本轮停止该路线，不转移其三个模型任务机会。
- Playwright桥接提供13个结构化工具；禁止任意browser_run_code、browser_evaluate、文件上传等扩权接口。
- 图片补充仅从本轮输出目录读取刚生成的有效图片，限制4 MiB，保留原始结果并附加MCP image block。
- Company Chrome使用新空目录和本机代理；HTTP/CONNECT只允许当前合成站，拒绝外部导航。
- 这不是Python/terminal沙箱；原生代码执行仍须按权限和收据验收。

依赖来源：
[Browser Use固定包](https://pypi.org/project/browser-use/0.13.11/)、
[Browser Harness固定包](https://pypi.org/project/browser-harness/0.1.13/)、
[Playwright固定发布](https://github.com/microsoft/playwright-mcp/releases/tag/v0.0.83)。

## 原入口接入和保护

本机工具根为%USERPROFILE%\.hermes\tools\company-browser。
原company-browser-simulation/launch_bridge.py仅增加一个明确进程标记控制的分派；
未标记时保留原实现，原MCP注册、config.yaml、SOUL、HERMES.md、MEMORY、USER、
R3知识、凭据、语音QQ、cron、旧profile均不是写入目标。

分派和Windows Job/stdio EOF处理继承既有Gate1A工具；SDK依赖不从旧业务目录寻找。
不存在第二个Hermes profile。native-env是工具依赖venv；chrome-profile是浏览器测试目录。

仅在启动本次原Desktop的子进程环境设置：
LINGJU_BROWSER_EXERCISE、LINGJU_BROWSER_RUNTIME、HERMES_TUI_TOOLSETS、
HERMES_TUI_MAX_TURNS，以及原生路线的BU_CDP_URL和PATH前缀。
不持久写入用户/系统环境，不修改默认快捷方式。

当前安装Desktop的打包版本为0.17.0，不能用可变源码或网上新版本代替。
当前开发进程HERMES_HOME下没有canonical hermes-agent/venv；启动器会停止，
避免触发首次安装。未把这一现象认定为原软件故障，也未改HOME或安装另一份程序。
原Desktop真正收到工具选择和环境标记仍未实测。

## 已有验证和阻断

- Node单元测试13项、Python单元测试4项通过。
- Playwright组件：13个工具、页面快照、输入、下拉、标签页列表、弹窗、
  全页截图及image block、导航/输出路径拒绝通过；没有提交项目或任务。
- 已有分派：未标记4工具，标记后13工具；原身份目录未改，进程结束已记录。
- 原生：直接调用固定CLI不兼容exec参数；兼容层后能建立隔离CDP daemon，
  但两次有限调用均在45秒内未返回。根因未定，不再扩大修复。
- budget_gate.py确认：现有16轮限制是逻辑轮次，应用重试配置为3，
  还有回退/辅助调用；不能证明六条任务总物理请求不超过120。
  6×16×3=288是可达重试组合的理论主请求数，不是本轮实际请求。
- watch.py只读取本轮会话元数据、工具名和计数；不是物理API预算执行器。
- acceptance-gate.json为false；启动器拒绝进入模型验收。六条任务均未发送。

## 开发者复现

从本目录运行npm ci --ignore-scripts；不安装浏览器，使用已有Chrome。

    npm test
    原HermesPython -B tests/test_safety.py

run_unit_tests.py会运行上述新组件单元测试并记录真实退出码、数量和源码SHA；
collect_validation.py拒绝缺失、失败或与当前源码不一致的测试收据。

原生锁由uv pip compile生成；仅向新的工具venv执行带--require-hashes的安装，
不得对原Hermes的venv执行sync/install。requirements-native.lock不包含账号或私有索引。

smoke.mjs、dispatch_smoke.mjs需要显式提供：
LINGJU_SMOKE_ROOT（已部署的新工具目录）、
LINGJU_ORIGINAL_PYTHON（原解释器）、LINGJU_CHROME（已有Chrome）。
LINGJU_SMOKE_ROUTE=playwright只验证合格候选，不重复已停止的原生路线。

    node smoke.mjs
    node dispatch_smoke.mjs

这些命令由开发者执行组件检查，不能替代Owner从原Desktop发送任务的验收。

## 部署与回退

prepare.py只建立新的工具根并记录保护哈希。
deploy.py files只写FILES明确列出的本轮文件，发现目标被别人改动即停。
deploy.py hook先确认入口唯一、真实路径、私有ACL和前像SHA，再写分派。
恢复目录仅保存必要的单文件前像，未上传。

deploy.py rollback-hook仅在当前分派SHA和前像SHA都与收据相符时恢复原文件；
任何并发修改都停止。不要整份恢复config、知识库或身份目录。

当前全部61项保护记录（其中59份文件存在，包含缺失路径状态）无变化。
W本轮开始即有37份文件：35份部署集和2份既有deliverables，全部未改。
原安装venv未升级；公司知识没有部署更新。

## 下一步

先审查两个前置问题：原生IPC兼容，以及包含重试/辅助调用的模型预算口径。
若Owner希望避免为测试增加模型网关，可另行批准采用逻辑轮次限制并披露物理次数未知；
否则须单独批准一个可验证的受限物理计量方案。本轮不替Owner改变预算。

随后通过Owner正常启动的原Desktop核实真实运行环境；不得改HOME或触发重装。
只有门槛通过后，Owner才可发送TASKS.md中的消息。真实灵生仍在后续独立带教阶段。
