# 原Hermes浏览器能力强化：本地B路线首轮

状态（2026-10-25续办）：原Desktop的Playwright路线已通过零模型接入核验，等待Owner逐条发送本人验收任务。
原身份、W、同步/异步请求限额和13项MCP工具有实际启动收据；尚未发送任何验收任务。
最初停止原因和原证据保留，下文历史段落不能当作续办后的最新状态。
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

安装Desktop打包版本为0.17.0。续办确认正常入口本来就在使用原安装目录；
此前启动器把HOME下canonical runtime当成唯一入口，检查过严，已修正。
使用已安装Desktop支持的HERMES_DESKTOP_HERMES_ROOT/PYTHON参数，且仅作用于本轮进程。
没有改HOME、安装另一份程序或修改原快捷方式；原Desktop实际收到工具选择及限额标记已有收据。

MCP会过滤LINGJU_*变量，但保留XDG_*路径元数据。本轮只用
XDG_LINGJU_BROWSER_RUNTIME传递已批准的运行目录，分派器校验目录归属、路线和toolRoot。
没有改MCP环境白名单、服务器注册或权限；无标记仍走原4项工具。

## 首次交付的验证和阻断（历史，续办结果见后）

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

首次交付时全部61项保护记录（其中59份文件存在，包含缺失路径状态）无变化。
续办时将2份会更新的cron心跳单列观察，其他59项记录严格核对，不能再说61项全未变。
W本轮开始即有37份文件：35份部署集和2份既有deliverables，全部未改。
原安装venv未升级；公司知识没有部署更新。

## 2026-10-25续办结果和下一步

Owner已明确批准本轮临时请求限额器和空闲Desktop重开。新增startup/sitecustomize.py只在
显式标记的测试进程加载，不装入原venv，不更改模型地址、凭据或配置，也不使用解密代理。
六条任务共用一个120次账本。所有HTTPX发送尝试保守计数，失败、重试、跳转、辅助和异步调用
均受限；不支持的外网Python传输拒绝。它不是任意代码或独立子程序的安全沙箱。
发现未经覆盖的新模型通道必须停止，不能绕过计数。

15项Python组件检查通过，包含实际OpenAI SDK对本机假服务器的重试/异步及到限拦截。
SDK默认4工具、直接标记13工具、经过过滤后使用XDG路径13工具均通过。
原生CLI能读取和截图；补齐了当前Hermes无参数stdin调用与旧exec两种接口。
原生截图的主模型直接附图路径为false；保留原有vision_analyze工具供两路线自主使用，
实际视觉理解仍须本人验收，不能由截图生成成功推定。

verify_active_run.py验证活跃原Desktop、后端父子关系、工作区、限额源码、实际13工具、
保护哈希及尚无用户任务消息，再生成只对应这一次运行的gate。
启动器收到arm命令后才开放共享额度；arm不会清零计数，到限阻断并退出自有进程树。

本轮先验收Playwright路线，最多3条原有机会；原生的3条不转移。
模型任务尚未执行，未推荐正式主驱动。真实灵生仍在后续独立带教阶段。
本轮的保护口径将两份持续更新的cron心跳作为运行状态观察，其他59项内容记录严格核对。
没有冻结或恢复正常心跳，没有修改cron配置。

详情：[续办证据](evidence/preacceptance-followup-2026-10-25.json)、
[临时限额器授权和范围](REQUEST_BUDGET_INTEGRATION_PROPOSAL.md)。


## QQ远程入口（2026-10-25 Owner追加授权）

Owner离开电脑后要求通过原QQ发任务。`qq_runtime.py`复用原安装I的QQAdapter与
GatewayRunner原生消息管线，使用同一H/W及本轮已武装的共享120请求账本；不是另一个身份。
QQ消息不经过Desktop窗口，这一点不能冒称为Desktop对话验收。
首条先由Owner发`/status`，它由接入层返回状态，不调用模型。当前服务器READY已证实，手机收发待证。

启动只选择原有白名单中的QQ私聊；不执行整个gateway启动过程，因其还会启动其他平台、
cron、kanban、恢复旧后台进程和历史维护。未改原配置、模型地址/凭据、QQ或语音持久设置。
只有原QQ官方WebSocket连接被允许使用其aiohttp传输；HTTPX请求仍共用硬限额，
QQ认证/回复等HTTPX也保守计数。任意代码/独立子程序仍不在沙箱保证内。

Playwright最多接收3条文字任务，不挪用A路线额度；消息ID哈希去重和额度持久保存在本轮工具目录。
每条建新会话，仍使用同一正式身份；发回QQ的对象不变。原生处理管线自行运行Agent，接入层不替它操作页面。
模型实际使用工具、公司知识和任务结果必须等真实收据，不能由启动参数提前宣布通过。

可复现启动使用原`I/venv/Scripts/python.exe -B -u H/tools/company-browser/qq_runtime.py`，
传入`--install I --runtime <现有runtime.json> --baseline <本轮保护快照> --output <本轮qq-transport>`。
新文件单独校验SHA，并记录`qq-addon-deployment.json`；既有23份工具源及分派无需覆盖。
不注册开机启动。关停仅结束此QQ接入及其自有子进程，不停Desktop、OpenClaw或原守护任务；
不删原记忆、不整份回滚数据库或配置。


### 首条QQ任务失败后的门槛修正

首版QQ入口漏掉原网关的MCP发现步骤，Owner任务只拿到文件/vision工具，8次私有URL图片调用被拒绝，
没有浏览器动作或QA刷新；源代码/真值文件读取不能替代浏览器验收。该slot1保持失败。
入口现在复用原discover_mcp_tools，并在本进程同时验证company服务器连接和模型完整目录内的13项工具；
初始工具中提供tool_search/tool_describe，不声称13项全直接注入首屏。
只在进程内选择原company服务器，未改原权限或配置。原SSRF规则不放宽。

启动默认仅/status，不接新模型任务。`--allow-task-messages`只有Owner完成失败复核并明确允许下一条后才可使用；
不要自动加该参数重试。消息去重库/失败slot和120共享账本保留，不重置、不增加、不拆分、不补偿QQ流量。
已保存本轮QQ源与工具侧部署收据的必要私有前像；恢复也须先核对当前SHA，无并发变化才单文件恢复。
其他旧工具、配置和数据库不整份回滚。


### Owner批准的单次补验接收控制

Owner明确例外批准后，本次仅使用`--allow-task-messages --admit-through-slot 2`。
不能仅加allow而不指定总序号上限；已保留失败slot1，因此只再接收slot2。
到达本次上限后自动暂停文字模型任务，/status继续工作；接入重启也不重置消息库/120请求账本。
是否继续后续机会须单独按Owner指令处理，不能自动把本次同意扩大为其余任务或额度调整。

### 最新：定点改进已交付，本人目标尚未通过

Owner已委托Codex自主推进技术，不再等待逐轮审查。原120次保守HTTPX账本到限保留，
本轮未调用模型、未开放下一条QQ任务；新增模型预算须明确授权。原临时QQ入口目前停止。

`browser_evidence.mjs`已经接入新工具桥：新鲜且限于本轮目录的YAML快照直接返回；
动作失败只附一次新快照、不重点击，原isError保留；截图scale沿用css默认。
原13项公共工具和权限不扩展。4项新单元检查及实际桥接组件检查通过。
`diagnose_actionability.mjs`在本机合成站正常翻到第2页，旧超时未复现，根因仍未知。
`verify_browser_evidence.mjs`只做针对上述交付的零模型检查，不是Agent业务验收。

`traffic_guard.py`是尚未部署/启用的计数候选：精确QQ通信、空GET目录查询单独审计，
主/重试/辅助/未知HTTPX共同受模型硬限额。6项测试使用假服务器/传输桩，未发真实请求。
不得将它用于重新解释已耗尽的账本，也不保证任意代码/子进程的沙箱隔离。
后续真实运行须有新的明确预算、独立授权记录和新的运行门槛，不使用已经关闭的旧gate。

当前源码/部署哈希、保护校验及退出证据见
[零模型后续证据](evidence/browser-followup-zero-model-2026-10-25.json)。

### 新授权轮次：60次模型请求、3条Owner QQ任务

Owner已在当前对话明确批准上述新额度，旧120账本不改。当前新QQ入口已恢复服务器READY，
原身份H/W和同进程13项浏览器目录已确认；本轮只选择company_browser_simulation和vision，
不提供file/terminal工具，不让合成源码读取代替浏览器操作。

使用原Python运行工具qq_runtime.py，额外传入明确的`--acceptance-gate <本次runtime目录/qq-acceptance-gate.json>`，
并显式`--allow-task-messages --admit-through-slot 1`开放第一阶段。Gate绑定runtime/source SHA及新授权、
独立60次模型账本、原120次历史账本；目录和保护内容缺失则拒绝。旧模式仍使用旧120次规则，不能代替新授权。
新Intake在共享60次账本的同目录持久保存；切换案例或重启时保留同一个Intake，不逐案例清零。
当前初始0/60，未发送任何模型任务。新护栏在原网关导入前安装，QQ和精确GET目录单独审计，
未知HTTPX仍扣模型硬限额。仅本次进程有效，原配置/账号/权限不变。

SDK/QQ目录、原运行环境及保护检查通过后才开放模型发送。阶段目标和范围见TASKS.md；
只有Owner发任务。跨阶段准备与取证由Codex负责，无须等待ChatGPT逐轮复核；不补发或追加提示。
[新轮次收据](evidence/qq-authorized-round-ready-2026-10-25.json)。

### 新轮次slot1结果与slot2准备

slot1本人实际读完QA前后各3页/关键详情，1次刷新、12次浏览器/16条工具收据，变化及分析与模拟真值一致。
没有文件或terminal调用，保护内容不变。消耗新预算19（chat路径17+未知HTTPX2），剩41，消息1/3。
但旧thread_id只使用`qq-transport`叶目录和slot，复用旧会话；新会话条件失败，不能算干净对照或全路线通过。
不清旧记录、不补发。现在改用唯一runtime目录+slot，启动及接收前只读检查线程尚不存在；新增2项检查，模块12项通过。

slot2已换到干净binding站，仍同一60次账本和Intake、同一原H/W/QQ管线。
准备时只暂停armed不清计数，启动检查通过再开放；`--admit-through-slot 2`只再接收一条。
实际新会话、图片理解、绑定关系及刷新持久性须等Owner本人发送后取证，不以预检推定。
[读取分析证据](evidence/qq-round2-analysis-2026-10-25.json) · [创建绑定就绪](evidence/qq-round2-binding-ready-2026-10-25.json)。

### 最新：slot2有实证，最后slot3已开放

slot2实际新会话20261025_132913_37894105，1条Owner任务、13逻辑API、20工具（10浏览器+9描述+1视觉）。
仅创建1项目/1任务，正确选择EMP-002和DEV-010；iframe截图经辅助视觉识别47后填入，
应用内重新查询与服务端真值一致，无重复。新会话键修正已在真实任务生效。
本项消耗21，累计40/60，消息2/3。第一项旧上下文限制仍保留，不宣称整路线验收通过。

最后recovery站已换干净初态，原H/W/QQ管线、13项目录及新线程查重通过。
仍原账本/Intake；当前`--admit-through-slot 3`只允许最后一条，不增加额度，20次用完即停。
准备阶段无新模型、源码或依赖变更，不重跑旧矩阵。
[创建绑定取证](evidence/qq-round2-binding-2026-10-25.json) · [最终项就绪](evidence/qq-round2-recovery-ready-2026-10-25.json)。

### 上一轮已结束：3/3、60/60，QQ仅状态回复（被下方新授权接替）

slot3已经执行；503后只创建1个项目并查证有实据，但越权刷新QA2次、最终汇报在限额阻断后缺失，不通过。
随后“继续”和重发均未提交模型。不是QQ离线，不要重发旧任务。原失败、旧账本及模拟记录保留。

新request_scope.mjs只为合成场景限制POST，launcher绑定并核验scope；recovery只允许项目与选项更新，
QA在代理到上游前拒绝，返回明确本地权限来源。5项新组件及独立浏览器真实请求验证通过，模型0；
没有把组件结果当Agent补验。该策略不是生产接口权限或OS沙箱，不屏蔽合法表单纠错，也不掩盖重复提交。

QQ部署了更清晰的次数/额度提示。显式communication_only gate必须禁用任务接收，并核实3条及60次已记账；
此时不建立模型处理管线，不启动MCP，不谎称已关闭浏览器的前置通过。当前原QQ已以该模式READY，
普通文字只回复停止说明，/status不调用模型。未来生成报告时的限额错误说明只有零模型验证，待新授权后实测。

[恢复任务失败取证](evidence/qq-round2-recovery-2026-10-25.json) ·
[零模型范围修正/状态入口](evidence/qq-round2-closed-scope-fix-2026-10-25.json)。


### 新批准的单次恢复补验：30次请求、1条QQ任务

Owner明确授权后单建账本/Intake，旧120/60账本和失败不重置。原QQ进程已确认13工具、原H/W、27工具源、59保护项及新线程未占用，当前0/30、0/1，等Owner发一次；不是Desktop窗口输入。
本轮只增QQ预算/消息上限的明确授权绑定，17项模块检查通过；原生模型/辅助/重试/未知路由仍共享硬限额，QQ控制流单独记录。
恢复操作范围沿用已验证护栏，不按固定点击路线控制员工。只有模拟项目创建和选项刷新可写，其他只读；不因此宣称Agent已经遵守或正式驱动通过。
[本轮启动证据](evidence/qq-round3-recovery-ready-2026-10-25.json)。


### 单次补验结果：模型服务HTTP429，尚未开始浏览器动作

Owner消息1/1已接收；新会话2逻辑API/9工具（search1/describe8），随后HTTP429/RateLimitError。
服务端限流原因未知；不是本地30次上限，物理预算11/30（chat10+未知1），已暂停保留剩19。
Agent浏览器动作0、模拟项目/任务/QA变更0，无最终汇报，权限/异常收尾仍未验证。
QQ在线但Intake已满、预算未arm，不接新模型任务；既有模型处理管线仍在，不能称无管线的communication-only模式。
自有浏览器已退出、59项保护未变，旧账本不清零；不要重发或自动调用模型探活。
[结果取证](evidence/qq-round3-provider-limit-2026-10-25.json)。
