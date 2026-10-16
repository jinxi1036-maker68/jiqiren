# Issue #9｜默认目录、上下文装载与503纪律：定点定位及最小方案

2026-10-17（Asia/Shanghai）。公司：**平顶山凌矩信息科技有限责任公司，简称凌矩**；采用Owner本轮明确指令及[PR #13](https://github.com/jinxi1036-maker68/jiqiren/pull/13)固定`0cbb692e`的`COMPANY_PROFILE.json`，不以旧main/W覆盖该事实，不声称已独立核验工商登记。

**结论：默认目录问题最可能出在实际发布前端的新会话优先级，而非公司目录不存在或SOUL文件损坏。优先在原软件中明确选定W公司项目；若需要修软件，只处理“全局新会话继承旧目录”这一处。SOUL和记忆的装载代码路径已查清，但当次SOUL/记忆完整请求仍不能宣称已证。新增证据：当次确实出现AGENTS截断告警。503仅提出一段工作区培训规则，未部署。**

依据：[最新授权6220114050](https://github.com/jinxi1036-maker68/jiqiren/issues/9#issuecomment-6220114050)、[PR #15审查5550739737](https://github.com/jinxi1036-maker68/jiqiren/pull/15#pullrequestreview-5550739737)、最高岗位宪章、ADR和Knowledge Harness。继承PR #12/#15的岗位接入、10次文件读取、附加规则、13次MCP及模拟变化/503，不重做它们。本轮只读源码、安装包的相关前端模块、少数设置和既有定点日志；未新增数据库扫描、模型调用、浏览器请求、备份或全盘盘点。

路径缩写：H=原`.hermes`；W=H/company-workspace；I=原Hermes程序安装根；D=原Desktop的`<APPDATA>/Hermes`。源文件SHA256、具体行号和设置记录见[小型机制摘要](../evidence/issue09_targeted/MECHANISM_SUMMARY.json)。这是本机读取后脱敏汇总，不是可在GitHub重建私有输入的第三方审计。

## 1. 目录根因已收敛，四种cwd必须分开

| 层次 | 本轮证据 | 含义 |
|---|---|---|
| Desktop默认设置C02 | D/project-dir.json可严格按UTF-8 JSON解析，无BOM；dir=W且W存在；哈希仍`d8edd642…`。当前渲染进程参数的userData也为D | 没有“文件写错目录/JSON坏了/目标不存在”的证据 |
| Desktop主进程 | 实际包`dist/electron-main.mjs`的`readDefaultProjectDir`→`resolveHermesCwd`优先读C02，并以所选目录spawn后端、设置TERMINAL_CWD | 这是启动代码意图，不等于当次OS进程cwd已直接取证 |
| 发布前端新会话 | `completion-sound-wWQdmEkr.js`中`xs()`：显式项目/Home之后，`return Ss() || we()`；Ss取活动会话/当前目录，we取配置默认。index创建会话把非空当前目录作为`params.cwd`发送 | 旧会话I可先于默认W被选中；不是“完全缺少getDefaultProjectDir”，读取在导入的session分块中确实存在 |
| 后端会话 | `methods_session.py:29-35`取请求cwd；`server.py:2575-2597`中有效请求cwd优先于profile/config/env。C01仍为占位`.`，不是绝对W | 前端若显式传I，单改C01不能保证覆盖；恢复旧会话也可能继续使用其已存cwd |
| 当次结果 | PR15目标会话的初始cwd为I；一次显式`cd W`返回W；绝对路径读公司文件成功 | 单条命令cwd、公司文件可达性均不能替代默认会话目录修复 |

重要差异：当前I中的TypeScript源码`apps/desktop/src/store/projects.ts:208-237`已经明确取消活动会话回退，末行是`return workspaceCwdForNewSession()`；实际发布模块仍是`Ss() || we()`。发布前端包和源码不是同一行为版本。Desktop包内版本`0.17.0`仅指Desktop包，不能当作原Agent版本或断言Agent被降级。

**最可能因果链**：旧/活动会话cwd=I → 发布前端新建时继承I → session.create显式传I → 后端按优先级接受 → 系统上下文和工具围绕I工作。源码还保留对显式项目/Home选择的尊重，这一点不能为了公司默认目录强行取消。

历史`session.create`请求载荷、当时侧栏scope、当时渲染器缓存值和OS进程cwd未留证；因此不能将此代码路径写成唯一已捕获的历史根因。当前包行为与已发生结果高度吻合，也存在“当时显式选了I项目”等同向分支。本轮不为还原它扫描LevelDB、附加进程内存或再发消息。

## 2. 最小处理：先用原入口的公司工作区，程序修复仅作备选

**首选A（下一轮经批准后）：**在原Desktop明确选择/打开W公司项目，用这个项目的新会话入口工作，利用既有显式`workspaceTarget/project cwd`路径。保留唯一员工、唯一软件和C02，不清缓存、不造新profile、不手工改localStorage底层库。发布代码对显式公司项目有直接路径，因而无需先改SOUL、模型、MCP、C01或重新安装。

这个选择属于原软件的工作区/项目状态变更，**本轮未执行**。涉及原UI维护的项目scope、工作区状态（已知localStorage键`hermes.desktop.workspace-cwd`等）；不直接编辑其持久化数据库。Owner若同意，先记录该UI状态及前值，再在公司项目里新建空白会话并只读核对目录。空白会话可能尚未落库，不应把“没新DB行”当失败或为了落库额外发模型消息。

**备选B（仅当必须修正全局新建语义）：**保留显式项目/Home选择，只移除“默认新会话先继承活动cwd”的回退，语义差异为：

```diff
 // 发布模块xs()；保留其前面的显式项目/Home分支
- return Ss() || we(); // 活动会话目录优先，再读默认
+ return we();         // 已配置默认；远程按其已有独立工作区规则
```

对应源码位置为`apps/desktop/src/store/projects.ts::resolveNewSessionCwd`。**当前磁盘TS已是后一行为，不应再盲目修改它。** 若选择B，需要用与已发包相匹配的构建基线，受控交付这一项修正并检查资产引用/包完整性；不能把I整套较新源码自动重建覆盖，也不能直接改未知完整性约束的minified/asar文件。本轮只给语义差异，未生成或部署可直接套用的二进制补丁。A能满足日常使用时，不为B延长审计。

不建议先改`H/config.yaml:terminal.cwd`：它会影响QQ/其他使用同一配置的入口，却仍会输给前端显式cwd。也不改快捷方式启动目录、现有会话DB的历史cwd或原进程全局cwd来掩盖问题。

## 3. SOUL、公司资料、长期记忆：三层装载与证据等级

| 内容 | 已证实的源码机制 | 该验收会话证据/剩余限制 |
|---|---|---|
| SOUL | `system_prompt.py:275-310,377-392`按Agent的home override/绑定session DB目录取H；`prompt_builder.py:2319-2357`读H/SOUL.md、安全扫描、按上下文文件上限截断，优先放stable身份；失败才回退默认身份，受忽略规则开关影响 | SOUL存在及继承哈希有证；当次完整有效SOUL字节、忽略开关的进程值、模型最终收到什么，仍未独立证实。不能仅凭岗位回答升级 |
| 工作区规则 | `runtime_cwd.py:60-100`以会话逻辑cwd优先；`system_prompt.py:784-801`调用项目规则发现。`prompt_builder.py:2523-2598`首先HERMES.md，否则AGENTS链，再其他规则，**只择一种项目上下文** | 当次发生AGENTS截断，见下；修到W后应首先选W/HERMES.md，不等于同时自动加载W/AGENTS或整库JSON |
| 公司知识正文 | W/HERMES是导航；知识正文通常经Hermes自行选择read_file读取。子目录规则可由`subdirectory_hints.py`追加到工具返回，保持system prompt缓存 | 继承PR15：10次完整公司文件读取及ROLE_BRIEF工具结果附完整hermes/AGENTS已证；不是11次独立读取，也不证明首条消息前已经自动读完知识 |
| MEMORY/USER | `agent_init.py:1798-1826`依memory/user开关创建MemoryStore、load_from_disk。`memory_tool.py:203-240,682-693`从H/memories读取、做安全扫描、冻结快照；`system_prompt.py:820-829`将启用块加到volatile段 | 当前两开关为true；本轮只查设置和文件大小/时间，不读私人正文。具体旧内容当次是否注入、语义影响、重开回流仍未证；SOUL接入不会清空这些块 |
| 缓存/截断 | 提示按Agent缓存；`system_prompt.py:932-941`失效重建会重读记忆。上下文文件上限是显式配置或动态20K字符下限/500K上限，超限保留头尾并发告警 | DB当次system_prompt/tool_names为空但有prompt hash，不能由hash恢复全内容。记忆10000/5000字符设置是容量/写入政策；`_render_block`并非自动清空、语义隔离或同一上下文截断器 |

**新增已证实事实：**既有agent.log第3349行，目标会话哈希`dbc30348…`对应20:27:12.805，记录：`Context file AGENTS.md TRUNCATED: 85081 chars exceeds limit of 61440`。这是当次特定文件截断告警，不能再把“是否曾有任何截断”一概标未知。

当前I无HERMES/.hermes/AGENTS.override，I/AGENTS存在；将其正文按源码加`## AGENTS.md`标题后恰为85081字符。结合目标cwd=I，**高度支持安装目录贡献者规则被当作项目上下文并截断**。日志本身只写AGENTS.md，没有绝对路径；文件归属仍是多证据推断，不是完整请求抓包。它不能证明SOUL或MEMORY也截断、读取失败，亦不能证明所有内容最终被模型采用。原生的“不要回退到安装目录”保护针对fallback；前端显式传I时可能绕过这个语义保护。

下一轮只需要有限可观察性：若已有目录/状态记录不足，在实际提示构建点记录一次脱敏来源类别、读取成功标志、字符数/上限/截断标志和本地hash；记忆只记加载开关及成功状态，不记条目/正文。可选择`agent/system_prompt.py::build_system_prompt_parts`及既有截断事件，**不是本轮代码修改，也不另建长期审计系统**。无须复制完整prompt、读取MEMORY正文或再跑浏览器任务来证明。

## 4. HTTP503：一处岗位培训草案

见[单段培训差异](../proposals/issue09_targeted/HTTP503_TRAINING_DRAFT.md)。仅拟在W/HERMES.md追加一段，强调“本次请求503、该页未读；原因/持续性/恢复未知；重试依明确授权并保留范围证据”。与岗位宪章事实纪律一致，不规定按钮次序、固定推理路线或自动重试流程。

选择HERMES工作区规则而非重写SOUL或MEMORY，是因为它正是纠正目录后首先发现的公司工作规范；它不要求再读整库。旧会话缓存不会因磁盘文本改变而当然刷新，后续用原入口新会话验证，不把本轮草案当成已经培训生效。仓库模板来自PR12的`hermes/integration/issue09_gate1a/HERMES.md`，main尚无该模板；草案不能直接套到旧main或伪称部署。

## 5. 文件、风险、恢复与下一轮最少授权

| 拟动作 | 涉及对象 | 风险/恢复 |
|---|---|---|
| A：原UI明确公司项目 | 原UI项目/工作区选择状态；C02维持W | 选错项目或新建入口仍走别的scope；保留选择前值并由原UI选回，不动旧会话/业务数据。无须新全量备份 |
| B：如确需程序修正 | projects.ts的对应旧发布行为，及受控输出的前端资产/引用 | 当前源码已修正、包不同步；直接替换可能带入无关变化/破坏完整性。需固定匹配基线、单独批准交付，保留既有可恢复原资产；不自动升级或重装 |
| 单段培训 | W/HERMES.md及对应PR12仓库模板（获批后整合） | 改变该文件hash和新会话上下文；记录单文件before/after和批准的新版本，恢复只回该文件，不改旧恢复包/原MEMORY/USER。18份旧知识快照仍须明示日期 |
| 如需装载状态记录 | agent/system_prompt.py的一处构建点及既有日志 | 可能日志噪声/隐私；仅字段白名单、本机一次构建记录，不能输出prompt/记忆正文。仅在既有证据不够时另批 |

**建议下一轮先批准A与单段培训这两项最小范围**：原UI公司工作区选择，W/HERMES单文件规则追加（并在仓库中整合对应模板），以及不调用模型的目录/静态核对。先请求**0次新增模型调用**；若需要行为闭环，再由Owner单独批准最多**1次**原Desktop自然语言身份/知识/503判断任务，不导航或重放浏览器矩阵，也不把旧3次额度重置。若空白会话不落库，可等这一次正常消息再核对，不为补日志额外调用。

voice.auto_tts=true、platforms.qqbot.enabled=true已由Owner确认，必须保留；不再作为“未知意图异常”建议回退。本轮不证明QQ连接或外发，也不因此展开排查。旧正常服务、Skills、MCP权限、凭据、旧记忆、恢复包全部保留。公司名按PR13/Owner最新事实使用；知识刷新另作逐文件整合，不覆盖CURRENT_WORK/PROJECT_INDEX。退出生命周期没有新具体异常，本轮不再深挖。

**本轮交付仅四个新增方案/证据/历史文件。没有部署修复、发模型消息、访问真实灵生、修改配置或停服务。Gate1A继续保持“核心能力已证、全项待闭环”；到此停止，等待Owner与ChatGPT审查。**
