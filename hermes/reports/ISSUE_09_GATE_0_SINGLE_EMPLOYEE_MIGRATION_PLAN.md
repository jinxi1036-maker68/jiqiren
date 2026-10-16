# Issue #9 — Gate 0：原Hermes唯一员工岗位迁移与旧资料清理方案

日期：2026-10-16，Asia/Shanghai。**状态：方案已形成，待Owner与ChatGPT审查；所有本机变更均未执行。**

本轮依据 [Issue #9最新接力指令](https://github.com/jinxi1036-maker68/jiqiren/issues/9#issuecomment-6207298536)，完整阅读[岗位宪章](../../knowledge/HERMES_DIGITAL_EMPLOYEE_CHARTER.md)、[正式ADR](../../knowledge/decisions/ADR-HERMES-SINGLE-EMPLOYEE-2026-10-16.md)、[演进历史](../../knowledge/history/HERMES_PRODUCT_EVOLUTION_2026-10-16.md)、根/本目录AGENTS和[ROLE_BRIEF](../identity/ROLE_BRIEF.md)，并按Knowledge Harness加载当前工作和必要业务资料。

**最终落点只有原来安装的一个Hermes、一个正式身份、原来的日常入口。** 公司给岗位、目标、业务事实、授权、底线与成果标准；Hermes自主选择工作方法。当前只培养灵生数采，不新建管理系统，不长期维护第二员工。Issue #9的Gate 1/2是本方案后续阶段，不能与旧Phase02B Gate A/B混淆。

## 1. 证据继承、本轮边界与已确认状态

本轮读取固定main `053b5b4cd2476fdf6df68e2c924a6b1c7d28e080` 及PR实况。PROJECT_INDEX工作项与CURRENT_WORK一致，仍为 `WI-2026-10-livsyn-first-trial-prep`；只更新并行Hermes开发状态，不更改业务事实或主工作项。

| 继承项 | 已有证据，不是本轮重跑 | 尚不能证明 |
|---|---|---|
| PR #4 已合并 | [Phase01审计](https://github.com/jinxi1036-maker68/jiqiren/blob/053b5b4cd2476fdf6df68e2c924a6b1c7d28e080/hermes/reports/PHASE_01_LOCAL_AUDIT_REPORT.md)：Windows原生Agent/CLI0.20.4，Desktop源码package0.17.0；活动H为用户目录.hermes；161份Skill路径；原工作日08:00任务；隔离Playwright组件9项通过 | 原CDP恢复、真实后台能力、当前所有文件/进程仍与旧时刻相同 |
| PR #6 开放未合并，head `6a5b500c915a0a9b14e089752785937c67ce3bfa` | [Phase02A](https://github.com/jinxi1036-maker68/jiqiren/blob/6a5b500c915a0a9b14e089752785937c67ce3bfa/hermes/reports/PHASE_02A_SPECIALIZED_AGENT_BASELINE.md)、[恢复证据](https://github.com/jinxi1036-maker68/jiqiren/blob/6a5b500c915a0a9b14e089752785937c67ce3bfa/hermes/evidence/phase02a/GATE_0.json)：voice.auto_tts true→false，历史写入者未知；主包14,349文件/129 SQLite及32项增补恢复验证；最终3次Hermes本人模拟对话 | 跨机/跨用户恢复、浏览器登录态恢复、正式岗位已植入 |
| PR #8 开放未合并，base为#6分支，head `7d900d3a39c1e77f6a159347f6cd7d5207a709dd` | [Phase02B Gate A](https://github.com/jinxi1036-maker68/jiqiren/blob/7d900d3a39c1e77f6a159347f6cd7d5207a709dd/hermes/reports/PHASE_02B_REAL_BACKEND_READONLY_ONBOARDING.md)：23次真实模型对话/97次浏览器调用，九类整改后最新样本通过；原生CLI身份加载与退出机制；失败保留；临时key撤回 | 单次全量九项一次通过、Windows双击视觉验收、原Desktop正式部署或真实运营 |

本轮只读既有报告、代码、脱敏证据及**已保存的Phase01路径元数据**，没有重读原记忆正文、重扫161份Skills、运行全面审计、重复全量备份/恢复或再跑23次模型测试。没有导入Hermes或调用模型；没有注入凭据、启动浏览器、停08:00任务、删文件或改原配置。为核对岗位装载方案，仅静态阅读已知安装源码中的少数装载函数；源码行为不是已打包Desktop运行验收。

本机运行状态的最新既有保护证据来自Phase02B结束：选定1,433项原文件及5项Phase02A文件一致、临时key撤下。本轮没有新做运行期一致性证明，**不能声称从此以后没有外部变化**。Gate1实施前只对批准变更的目标/入口/依赖做最小只读预检；有具体漂移再处理受影响项，不启动全量重审。

当前业务知识仅用于岗位背景：自建真实工位模式已有沟通认可，SCENE_PIPELINE另记Owner转述三个场景方向确认；完整任务SOP、真实QA、设备到位数和可支付结算仍须实时材料核实。旧资料中的报价、目标日期与规划不能写成现行已完成事实。本Gate不作商务承诺、付款或扩张判断。

## 2. 原入口及真实装载链：迁移应改哪里

别名详见[变更矩阵](../plans/issue09_gate0/CHANGE_CLEANUP_MATRIX.json)。H=`<USER_HOME>/.hermes`；P=`<LOCALAPPDATA>/hermes`；I=P/hermes-agent；D=`<APPDATA>/Hermes`；W是拟定公司工作目录，**不是新HERMES_HOME或新profile**。

1. **原入口与活动根**：Phase01记录原Desktop可执行文件 `I/apps/desktop/release/win-unpacked/Hermes.exe`，后端 `python -m hermes_cli.main`，CLI `I/venv/Scripts/hermes.exe`。原进程明确指向H。Desktop源码 `apps/desktop/electron/main.ts::resolveHermesHome` 按进程HERMES_HOME、测试userData覆盖、Windows用户环境及平台回退解析；不能因为P是Windows默认就去清空P，**P还包含I程序安装**。原快捷方式的完整目标与当前打包入口设置需要Gate1定点验证，不能凭目录名推断。
2. **身份**：`agent/prompt_builder.py::load_soul_md` 从实际home（可能带session的home_override）读SOUL，经过扫描和截断；只在GitHub放ROLE_BRIEF没有部署效果。修改原H/SOUL后必须新会话验证，不能只看文件存在。
3. **岗位长期记忆**：`tools/memory_tool.py::load_from_disk` 读取H/memories/MEMORY.md与USER.md并形成快照；原字符上限分别10000/5000，原内容已接近上限。新SOUL不能自动消除旧记忆和旧会话快照。应在批准停写窗口内按条目重写、清理旧恢复来源，验证重启/新会话不会回灌。
4. **项目上下文**：`build_context_files_prompt` 优先装载最近.hermes.md/HERMES.md，其次AGENTS目录链，再CLAUDE/规则文件；SOUL独立。显式session cwd可优先于terminal.cwd/启动cwd，见 `agent/runtime_cwd.py`。建议在W放简洁HERMES.md和按Harness路由的公司资料，让原Desktop默认新会话实际进入W；不能只设置一个环境变量就假称成功。I内开发者AGENTS不得当作公司岗位宪章改写。
5. **历史/Skills/工具/调度**：旧sessions、state.db检索、checkpoints、Skills缓存、旧MCP、cron、Windows任务和守护脚本是可能回流的独立渠道。禁用一个文件不等于退出所有装载；也不能为干净身份整库删除state.db或全部Skills。

正式岗位内容分层：SOUL承载唯一身份和不变底线；USER只留经Owner认可的通用偏好；MEMORY存已确认的公司事实、有效经验和待办引用；W保存权威知识入口与按需文档；可变权限单列Owner批准的本机政策。变更前需核对实际注入长度/截断。公司知识更新可追溯，方法经验可由Hermes改进，账号权限、SOP和财务底线不可由其自主重写。

## 3. PR #6/#8 技术成果复用判定

这里的“复用”指代码、岗位规则和验收经验，**不是已训练模型权重或可直接拷贝的生产员工**。DEMO基线不进入正式公司记忆。

| 组件/源码（均以固定PR head读取） | 可保留的能力 | 接入原Hermes前必要改造 |
|---|---|---|
| `phase02b/agent_session.py`，继承AIAgent→MCP调用链 | Hermes自主选择导航/菜单/分页/详情、公开回答取证；模型前检查实际home/tool集合 | 测试外壳留测试用途；正式调用继续走原Desktop/原AIAgent，不另开长期循环；新home/岗位检查替换“必须isolated+DEMO”的断言 |
| [browser_bridge.mjs](https://github.com/jinxi1036-maker68/jiqiren/blob/7d900d3a39c1e77f6a159347f6cd7d5207a709dd/hermes/phase02b/browser_bridge.mjs) | MCP stdio、schema发现、四工具过滤、结果/失败轨迹、清理子连接；由Hermes决定调用 | 解除SDK对旧xianyu工具目录的依赖；参数化非敏感配置与日志；测试bridge仍为实验工具，不直接改域名上线 |
| `navigation_policy.mjs`、`loopback_guard.cjs`、`policy_test.mjs` | 明确拒绝越权导航、任意代码，禁止把工具拒绝编成HTTP状态 | loopback/固定路径仅模拟使用。真实页重定向、SSO、子资源/API、弹窗及有写副作用的点击/GET需另做允许政策和验证；四工具中的click也可能保存/删除 |
| `SOUL.md`中的503/401/403/空表/分页/详情规则 | 事实与推断分层、范围与未知、已审≠通过、逐行基线比对、不猜URL | 提炼为正式岗位纪律/可按需调用经验，不照抄“永久只准模拟”“首行固定格式”“每次URL逐项请示”；未来授权内自主选路 |
| `entry.py::enter/validate`、`owned_job.py` | home/cwd自检、避免source.env意外回退、进程所属关系、退出清理 | 不把测试启动器作为第二日常入口；原Desktop已有生命周期需适配，Job只管理自己创建的组件，不把已运行Desktop/共用浏览器装入清理Job |
| `native_smoke.py` | 用真实会话验证身份；SOUL内非凭据标识优于仅看NULL system_prompt列 | 原入口原会话链的验收脚本需新适配；不未经批准向原SOUL写标识或调用账号 |
| `CASES.json`、`demo_server.mjs`、`run_sessions.py`、`test_claims.py`等 | 可复现合成页面和九类失败教材；按结果/证据验收，允许不同合理路径 | 留历史测试；本轮不跑；未来只对新装载/改动做小范围增量验收，不固定浏览器调用顺序/次数 |
| `collect_evidence.py`、`finalize_evidence.py` | 只导出公开答复、DOM、调用；保留失败和重跑，不改写模型原文 | 当前含DEMO-002、固定case和短语启发式，不能直接当真实QA比较/生产脱敏器；生产需按真实主键/版本/范围及隐私规则另做 |
| `phase02a/encrypted_backup.py`、`protected_state.py`、`publish_safety.py` | 已验证恢复技术、受影响文件指纹、显式发布清单和泄密检查方法 | 不自动扫描整机/原记忆，不再全量备份；真实日志不能只替换用户名就公开，需字段级最小输出和人工核对 |
| `phase02a/b/setup_profile.py`、`make_entry.py`、测试yaml/SOUL/.no-bundled-skills | 保留作为历史实现与复现资料 | **退出正式部署路线**：不再create_profile、不复制临时key、不clone-all、不切全局profile；不沿用测试中全Skills/复盘关闭作为永久员工设定 |

特别风险：`setup_profile.py`的sdkPackage和bridge的createRequire借用 `H/tools/xianyu-browser-tools/package.json`。应先迁出经核实的中性SDK依赖，再清理旧业务server。反过来删目录会破坏可复用能力。移除旧上传server与保留通用库是两项操作，需分别核实。

自主性保留：常规已授权工作不逐按钮请示，Hermes可以选择不同读取和核验顺序、维护待办、总结经验；保护的是权限/政策和证据，不固定思考流程。持续唤醒、跨天基线、可靠去重/通知仍为 `not_implemented`，本Gate不开发“调度管理系统”。

## 4. 清理与改造影响清单

完整逐项清单是[34项变更矩阵](../plans/issue09_gate0/CHANGE_CLEANUP_MATRIX.json)，[Owner签字清单](../plans/issue09_gate0/OWNER_APPROVAL_CHECKLIST.md)可按ID回复。每项含具体目标、业务归属、来源、依赖、影响、拟动作、回退和路径完整性；全部 `not_executed`。有通配符、集合或未知ID的项目**不是可执行删除清单**，Gate1须先展开成本机精确绝对路径/记录ID，再批准；不因名称判废。

| 分类 | 主要ID与判断 |
|---|---|
| 保留核心 | M01/02程序、原入口；M04模型认证；M12可用的通用维护/文档方法；M17 Playwright/Node/Edge；M34记忆、Skills、规划与复盘。保留程序不等于自动授予所有工具权限 |
| 拟清理无关 | M05–07旧角色/记忆按条目重写；M11列出12个电商/托管Skill候选；M15–16旧业务MCP；M21列出17个旧业务脚本候选；M23四处旧业务数据目录。必须先查引用和资料保留例外 |
| 需Owner判断 | M09旧会话/数据库具体记录；M19含数采线索的08:00任务；M20名称尚未记录清楚的Windows任务；M24浏览器登录态；M25第二根；M26旧版本/本地自定义；M27插件/渠道；M28旧凭据与备份等 |
| 仅历史模拟 | M29两个测试profile/工作区/两CMD；M30私有测试运行残留；M31两份有效加密包；M32失败包与恢复演练明文副本。GitHub代码和脱敏历史保留，不视为第二正式员工 |

依赖核对包括任务→script/skill/workdir/provider/deliver、脚本→浏览器profile/SDK、原入口→home/项目cwd/session、恢复工具→旧快照及缓存。停用自启动引用应先于删除；不执行旧脚本中的停进程/删任务命令。原08:00任务的归属尚未确定，不能伪称已确认是无关业务。Windows任务完整名称和需清理的session ID尚未确认，当前建议为**保持待决**，不以模糊概括获得删除授权。

## 5. 单身份迁移顺序与需修改文件（仅计划）

这些是开发实施顺序，不是限制员工日常工作路线。每步失败即停在该步；通过不自动获得下一Gate权限。

| 步骤 | 获批后才执行的最小变更 | 验收/失败处理 |
|---|---|---|
| G1-0范围冻结 | Owner逐项确认M05–33有关变更、资料例外、停写窗口、模型测试授权和保护期限；核对精确目标/链接/进程依赖 | 与既有证据不符只复核受影响项；未知ID不动、不临时扩大范围 |
| G1-1短期保护 | 复用已有有效DPAPI恢复点；仅对批准修改且已变化的文件/选定SQLite做必要加密增量；不重复全量演练 | 变更集可解密/解析、选定DB一致；保护失败不改原文件 |
| G1-2先退旧启动链 | 批准后处理具体cron、Windows任务、旧MCP与守护引用；渠道按批准暂停 | 仅核对批准任务不再运行；不把原任务改成正式巡检 |
| G1-3能力中性化 | 原安装不动；解除旧SDK目录依赖；在H下批准位置放非敏感工具适配，原config只改必要字段 | 对新接入只做所需边界/生命周期检查；发现旧server依赖立即停 |
| G1-4原岗位植入 | H/SOUL.md、memories/MEMORY.md、USER.md；W/HERMES.md+按Harness路由的公司资料；批准字段级cwd/Skills配置 | 关闭旧上下文写入后原入口新会话加载；保留Owner底线与方法自主性 |
| G1-5原入口目标验收 | 原Desktop日常启动；新的公司会话与实际root/cwd/tool证据；少量增量模拟目标 | 无双员工入口选择；身份、知识、边界、浏览器事实和未知正确，不能用文件存在替代 |
| G1-6退出旧痕迹 | 验收通过后按批准精确清单清理旧会话检索/快照、无关Skills/脚本/资料、A/B profile及CMD | 重启/恢复会话后不回流旧业务；保留核心运行；未获批准项逐项列待决 |
| G1-7收尾 | 提交本地脱敏结果/失败及PR；到期发起短期保护处置复核 | 不自动恢复旧投递或后台任务，不形成长期影子；Gate2另行授权 |

拟新增仓库能力代码应以 `hermes/capabilities/browser/` 等中性位置承载必要适配、身份模板和针对变动的验收，不新造业务系统。本轮**没有创建这些运行代码、岗位Skill或部署包**，也未更改原H/I/D。

## 6. 恢复办法、短期保护与主要风险

已有主包及源码增补已验证：同一Windows用户DPAPI保护、AES-GCM认证、文件hash、129 SQLite完整性。未证明跨机/跨用户、LevelDB运行、旧Cookie登录或整套安装/venv恢复。失败包不是恢复点，演练明文副本不是长期备份。参见M31–33和[已有恢复边界](https://github.com/jinxi1036-maker68/jiqiren/blob/6a5b500c915a0a9b14e089752785937c67ce3bfa/hermes/evidence/phase02a/GATE_0.json)。

建议Owner批准：现有有效包+必要增量只作一次性迁移保护；**Gate1验收后7日处置复核，最长14日必须重新由Owner决定**。不自动删除，也不默认无限期保留。可优先处置经确认无价值的失败包、明文演练副本和测试运行残留。若Owner不接受短期留存，先明确可接受的不可恢复风险或缩小清理范围，不能一边承诺可回退一边删除唯一有效恢复点。普通文件/DB清理不宣称磁盘取证级不可恢复。

恢复触发：原入口/模型失效、root/cwd漂移、身份/记忆缺失或旧业务回流、核心工具损坏、任务意外外发、实际修改超清单。立即停止本次写入和自己创建的测试进程，保存脱敏异常；未经批准不停止其他服务。Owner授权的维护窗口中按一致变更集回退配置/记忆/选定SQLite；不把异时主DB与旧WAL拼接，不启动恢复出的旧Agent/旧任务。技术恢复在**同一原入口、单实例**完成；恢复旧调度、渠道或账号外发需再次明确确认，避免回滚同时触发旧业务。

主要风险与控制：第二根P含程序防误删；旧session/缓存/自动复盘回流需全装载链核验；SDK借用先解耦后清理；测试loopback不等于生产只读；包与源码可能不一致，原Desktop实测优先；过度删Skills或永久禁复盘会损伤自主性；历史恢复点可能不含后来变化，必要保护仅针对批准目标。

## 7. 未合并PR整合策略与语义冲突

本轮GitHub读取：#6为开放未合并、mergeable=false；#8为开放未合并、mergeable=true，但它只针对#6分支。这是查询时快照，不能将#8可合并当作可直接进main。#6改30文件，#8增量改39文件；两者共同触及.gitignore、hermes README/CHANGELOG、CURRENT_WORK。

字段级比较确认：两旧分支的CURRENT_WORK业务主字段与最新main一致，**风险集中在parallel_development_track**。旧id为 `HERMES-DIGITAL-EMPLOYEE-PHASE-01`，main已改 `HERMES-DIGITAL-EMPLOYEE`；旧文件均缺main新加的12项治理/状态字段，包括owner_charter、owner_adr、owner_latest_decision、previous_dual_profile_architecture、next_execution_issue等。整文件复制会倒退Owner单员工决策，即使Git能自动处理部分文字也不等于语义正确。main现有hermes README仍有Phase01旧状态，本轮按最新宪章更新入口说明，不改写历史报告。

**推荐方案**：

1. 本Gate0分支从最新main建立，只交方案、矩阵、继承证据和Current/History同步；不包含#6/#8运行代码复制或合并。
2. 经Owner审查后，另建“成果继承+原Hermes适配”PR，从届时main选择性引入两固定head的 `hermes/phase02a/`、`phase02b/`、证据与报告作为**historical experiment**；给旧部署脚本/运行说明明确历史标记，原证据不改。
3. 新的正式能力只提取中性部分，岗位以ROLE_BRIEF/宪章重构；CURRENT_WORK以main为底做最小字段更新，README/CHANGELOG与新History人工整合，忽略规则做并集，不用旧文件覆盖main。
4. Owner再决定旧PR标记被整合/关闭或采用其他合并路线。本轮不改其base、状态或内容，不自动合并。
5. 如果Owner选择保留原PR合并链，应先专门解决#6与main的冲突、去掉长期双员工假设并审阅；#6合并后是否改#8 base再另行决定。不能在Gate0静默替Owner选择。

## 8. Gate1具体验收与本轮停止点

Gate1验收必须在**原正式Hermes**，不拿A/B测试身份冒充：

- Owner点原入口即进入唯一员工，无需切profile或使用第二CMD；以真实进程有效home、session root、工作区和工具证据核验。新公司会话重开/重启仍正确。
- Hermes本人说明岗位、当前公司事实/待确认项、权限与底线；知道真实后台尚未授权，不虚称已懂所有菜单或看到真实QA。适用的Owner偏好保留，无DEMO基线或旧业务事实回灌。
- 在Owner批准的新一轮模型使用范围内，选取少量覆盖**新装载/新绑定**的模拟目标，例如发现新QA并区分不变行、遇部分读取失败保留未知。Hermes自主选择正确路径；不要求固定点击序列或调用次数。既有九类矩阵继承，不机械重跑全部训练。
- 精确批准的旧记忆/Skills/任务退出实际装载和检索；未批准项明确待决，核心程序、模型、安全、审计、文件读取、必要浏览器能力正常。不能靠“磁盘删了文件”当验收。
- 失败可按第6节恢复且不自动重启旧业务；临时保护与A/B身份的处置按批准期限收尾。
- 记录真实答复与必要脱敏证据，不公开凭据、旧记忆、生产截图/实名资料。文件审阅不能代替运行验收。

**Gate0已经完成的是分析和可审查方案；Gate1未授权、未实施。** 需要Owner批准的操作：具体角色/记忆条目重写；精确Skills/脚本/数据/会话清理；08:00及Windows任务处置；原配置/MCP/cwd与入口设置变更；短期保护的范围/期限/销毁；原入口模型测试的账号使用及维护窗口。未知目标不能打包批准删除。

Owner亲自登录灵生、允许的只读页面范围与真实样例属于后续**Issue #9 Gate2**，与本次方案或未来Gate1许可分开。持续值班/通知/跨天跟进及正式写操作仍待以后按实际需求开发与授权。**本轮到此停止，不进入Gate1。**

