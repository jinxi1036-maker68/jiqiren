# Issue #9｜Gate 1前置无损准备报告

日期：2026-10-16（Asia/Shanghai）。**本轮仅准备，原Hermes未迁移、未改写、未删除或停用。**

依据：[Owner本轮授权](https://github.com/jinxi1036-maker68/jiqiren/issues/9#issuecomment-6210554053)、[PR #10 ChatGPT审查](https://github.com/jinxi1036-maker68/jiqiren/pull/10#pullrequestreview-5544439274)。PR #10是Gate0已审阅方案基线，不是34项变更批准。本轮直接继承Phase01、02A、02B及PR #10的证据，不重复全量审计、14,349文件备份/恢复或23次模型测试。

最高宪章、ADR、ROLE_BRIEF及Knowledge Harness沿用固定main `053b5b4cd2476fdf6df68e2c924a6b1c7d28e080` 的已完整阅读版本；当前主业务工作项保持 `WI-2026-10-livsyn-first-trial-prep`。正式方向仍是**原Hermes、唯一长期身份、原日常入口，公司给目标和底线，Hermes自主选择方法**。

## 1. 交付物及当前权限

- [四份身份/记忆/工作区草案](../preparation/issue09/drafts/)：SOUL、MEMORY、USER、HERMES。文件后缀为.draft.md，既没有放到原数据根，也没有被原Hermes加载。
- [条目级脱敏差异](../preparation/issue09/IDENTITY_ITEM_DIFF.json)：原文件版本hash、行范围、审阅片段ID、主题线索、草案位置、待Owner决定的处置。**不公开旧正文，所有改写待批准。**
- [配置字段差异C01—C06](../preparation/issue09/CONFIG_FIELD_DIFF.json)：工作区、Desktop默认项目、两项旧MCP绑定及中性模拟接入。模型/.env/auth不提出改写。
- [133个已展开候选文件](../preparation/issue09/EXACT_CANDIDATE_OBJECTS.json)、[34项状态映射](../preparation/issue09/MATRIX_34_STATUS.json)：116个文件来自12个指定Skill目录，另17个指定脚本；不是全盘Skills扫描或删除许可。
- [定点核实证据](../evidence/issue09_preparation/TARGETED_FINDINGS.json)、[准备验证](../evidence/issue09_preparation/PREPARATION_VALIDATION.json)、[SDK依赖锁定记录](../evidence/issue09_preparation/SDK_DEPENDENCY_LOCK.json)。
- [中性SDK桥接代码与复现说明](../preparation/issue09/SDK_DECOUPLING.md)、[下一轮决定页](../preparation/issue09/NEXT_DECISIONS.md)。

本轮没有原机配置、身份、Skills、任务、快捷方式或浏览器资料写入；没有模型凭据注入/复用、模型请求、真实浏览器会话、灵生访问、外发或任务派发；没有创建新备份或恢复旧环境。只在开发区写草案、工具原型和非敏感证据。

## 2. 原入口/home/cwd：已核实与仍未证明

| 项目 | 定点结果 | 限制/影响 |
|---|---|---|
| Desktop及Start Menu的两个Hermes.lnk | 均指向 `P/hermes-agent/apps/desktop/release/win-unpacked/Hermes.exe`；无参数；WorkingDirectory为该程序目录 | 两个快捷方式是同一原程序的入口，不是两个员工；本轮未启动或保存快捷方式 |
| HERMES_HOME | 当前用户环境与本次进程环境均为 `H=<USER_HOME>/.hermes`；Machine项为空 | 证明当前启动环境配置，不能代替未来原Desktop进程实际解析值 |
| 当前原Hermes进程 | 定点匹配未发现运行中的原Hermes/对应后端 | 本轮不为验证而启动它；新会话真实home、cwd、注入、缓存和截断验收仍待授权 |
| Desktop默认项目文件 | `D/project-dir.json`不存在；HERMES_DESKTOP_CWD及userData覆盖的检查结果见证据 | 按所读源码，默认项目优先，其后环境提示/打包回退，最终用户目录；打包二进制行为仍须原入口验收 |
| 历史Desktop会话 | 只读immutable基础库的最近Desktop记录cwd为用户目录；未读取该会话正文 | 排除了活动WAL，不代表当前/最新运行状态 |
| 上下文覆盖 | 仅检查用户目录的.hermes.md、HERMES.md、AGENTS.md，均不存在；H/active_profile也不存在 | 不是全盘上下文扫描；新工作区及实际会话仍须核实最近HERMES.md/AGENTS优先链 |

真实装载设计继承PR #10：SOUL来自有效home及session home_override；MEMORY/USER通过原记忆工具形成快照；项目上下文受实际会话cwd影响。仅改terminal.cwd不能保证Desktop新会话进入公司工作区，旧会话恢复也可能带回原上下文。

拟定W为 `H/company-workspace`，不改变HERMES_HOME、不注册新profile。C01拟改terminal.cwd，C02拟设置Desktop默认项目dir；二者当前均未执行，需通过原入口新会话证明。安装源码与打包版本差异仍保留为风险，不能因静态读源码声称部署成功。

## 3. 身份与记忆草案：具体内容和差异

| 草案 | 对应原目标 | 准备结果 |
|---|---|---|
| SOUL.draft.md | H/SOUL.md | 唯一公司身份、目标管理、自主方法、证据纪律、权限边界和当前接入阶段；不复用旧托管角色或模拟SOUL的永久loopback限制 |
| MEMORY.draft.md | H/memories/MEMORY.md | 8条公司岗位事实/经验，使用原生 `\n§\n` 分隔；不带DEMO基线；设备/SOP/QA/结算未知保持未知 |
| USER.draft.md | H/memories/USER.md | 5条来自Owner当前明确决定的通用工作偏好；不把未核实的旧私人偏好自动迁入 |
| HERMES.draft.md | 拟新建W/HERMES.md | 按Harness渐进加载、当前权限与事实核验、方法自主和待办记录；不另造管理系统 |

本轮只定点读取三个拟改文件，未遍历其他旧记忆或全量会话。原MEMORY原生条目40，USER原生条目27；为定位审阅拆成SOUL21、MEMORY40、USER39个**审阅片段，共100个**，其中标题/空行分段不等于原生记忆条目。

差异中的“旧主题线索”来自规则提示，不是完整语义归属结论。含旧业务线索的内容建议退出当前公司岗位事实，混合通用方法待Owner挑选；未分类内容保持待决。**不能因新草案很短就将未处理旧条目整体清掉。** 整文件重写必须同时批准新稿及受影响片段的处置。本机private审阅索引可按ID定位原文件行，旧原文不复制进GitHub。

SOUL/公司上下文各低于所读源码20,000字符保守默认值，MEMORY/USER分别低于当前10,000/5,000字符上限。这里只是长度静态检查；**尚未证明实际提示扫描、home_override、注入、截断或自动记忆回写不回流**。这些必须在后续明确授权的原入口会话中验收。

C01—C06以原config文件hash及精确字段定位，禁止整份测试yaml替换原配置。记忆开关、字符上限、工具搜索auto、现有模型与安全字段保持现状；没有把测试身份“全部禁Skills/复盘”当长期员工设计，也没有扩大权限。未来权限变化由Owner决定，授权内工作不要求固定点击序列。

## 4. 两项任务的真实情况：修正旧快照推断

### 历史08:00 cron

**当前H/cron/jobs.json为0项**，其updated_at为2026-10-15 23:54:23 +08:00，71字节；与Phase02A已验证恢复包清单中该文件的hash一致。这不是本轮停用/删除，也不是刚发生的新变化。移除原因和写入者未知；不能继续将Phase01“1个enabled任务”的快照当成当前运行事实。

从只读基础库中定点读取相关执行元数据与一个确切cron会话首条任务提示，确认历史job ID为 **`44e3730eedc5`**。它是**旧托管业务朋友圈素材草稿**，涉及选题、天气、HTML卡片、Python313 Playwright渲染、视觉质检、三版文案及主题状态更新，交Owner选用；不是灵生数采巡检。历史提示说明通过QQ交给Owner，不等于自动发朋友圈。未公开机构/人员资料或原任务提示。

具体依赖包括H/moments_daily/theme_state.json、H/moments_daily及独立Python313。当前定义已无，具体投递路由/接收者、完整原配置无法从这份定义恢复；没有读取账号资料去重建。两条确切历史cron会话ID见证据，不因此扩大为全库旧会话删除许可。

**建议：不要恢复、重命名或沿用这个任务作数采值班。** 当前无可停用对象；历史输出/会话是否清理另由Owner按精确清单决定。

### Windows任务

准确对象为 **TaskPath=`\`，TaskName=`OpenClaw Gateway`**，当前enabled，检查时状态Ready。动作：

`powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File <USER_HOME>/.openclaw/gateway-launcher.ps1`

该脚本指向gateway.cmd，再用现有node.exe启动OpenClaw dist/index.js的gateway、端口18790、task-supervisor。只读源码显示其可检测、启动甚至终止网关进程；**本轮没有执行脚本、停止服务或更改任务**。

它属于OpenClaw网关运行链，不能直接认作原Hermes启动任务。选定任务/配置材料中未建立直接依赖，但其他应用、渠道和服务的共用关系未被完整排除，因此不建议当前停用。最终任务enabled、Execute及Arguments与首次定点记录一致。

## 5. 中性SDK解耦：开发区验证已做，原接入未做

既有桥通过H/tools/xianyu-browser-tools/package.json定位SDK。当前独立SDK为1.30.0，Playwright MCP目录没有同样的独立SDK入口。为避免联网安装或触碰旧目录，本轮将**仅运行库依赖闭包**复制到开发private/neutral-sdk：93个包、3,496个第三方库文件；不复制旧业务server、数据、Cookie或凭据。这不是原环境备份，不改变原node_modules；第三方源码不入本PR，只提交版本/许可及内容清单hash。

新sdk_resolver.mjs要求显式绝对sdkAnchorPackage、固定SDK1.30.0，校验实际模块位于选定中性包中；拒绝旧业务anchor和静默fallback。browser_bridge.mjs仅替换SDK装载部分，保留模拟loopback/精确路径与四工具边界，旧sdkPackage字段直接拒绝，防止误用旧运行配置。

新增4项小范围组件验证通过：中性导入、缺少anchor拒绝、旧anchor拒绝、真实stdio MCP握手并保持工具/导航拒绝。下游是假MCP，返回明确标记的MOCK DOM，**没有Playwright浏览器、HTTP请求或Hermes模型参与**。第一轮3通过/1连接关闭：测试夹具依赖的环境变量被桥安全过滤；改成显式夹具入口传anchor后4/4通过，没有放宽桥的环境边界。失败记录保留在验证JSON。

这些结果证明开发区模块/协议解耦，**不证明原Desktop已接入或真实网页只读安全**。原H/tools/xianyu-browser-tools、两项正式MCP配置及旧脚本都未改。未来需批准中性目录位置、字段差异、原入口小范围验收后再考虑退出旧绑定；不能把loopback替换成灵生域名直接上线。click也可能写入，真实SSO、重定向、子资源和副作用边界属于Gate2单独设计。

## 6. 精确对象与仍然待决的范围

133个候选文件的相对目标、归属线索、依赖引用和ID已经列明：指定12个Skill目录展开为116文件，另17个指定脚本。只读取目录元数据及所选脚本的必要引用，不扫描其余Skills或全部历史材料。目录中有通用浏览器取证/维护参考，未逐篇语义审查，不能凭旧业务目录名整体判废；记录/财务保留例外也未替Owner作决定。

其余大类glob、全体旧session、全部缓存/备份、第二数据根、浏览器存储等没有为“凑齐清理表”去大范围扫描，维持待决。有效DPAPI包、测试profile/CMD及恢复演练副本均未删除、重命名或停用。34项逐项映射为本轮准备状态、后续需单独批准或保持不触碰，**没有一项自动变成删除授权**。

36项定点文件hash检查通过：包括拟改身份/配置/cron、两项SDK清单、所选脚本与Skill主文件；不是全机或整个资料库冻结证明。原任务动作与enabled另作前后对照。无法确认归属的对象不因本轮完成就转为可清理。

## 7. 风险、恢复和下一轮最小验收建议

本轮只新增开发区文件；停止自己的mock组件即可结束，原环境无需恢复。已有DPAPI保护及其同用户/文件与SQLite级局限直接继承，没有重新解密、全量恢复或创建新加密包。

正式改写前仍需Owner批准：维护窗口；C01—C06与三份原身份文件的最终内容；受影响片段如何保留/改写；必要增量保护范围与留存期；原入口少量模型测试使用范围。7日复核/超过14日再决定仍只是PR #10建议，**没有因此获批，也不会自动删备份**。

建议下一轮先只做可回退的岗位/入口接入，不做物理旧档清理：
1. 在批准窗口锁定上述具体原文件版本及依赖，仅补保护已变化且将修改的对象，不重做完整备份。
2. 原入口加载唯一公司岗位与W；使用批准后的中性模拟接入，不切全局profile，不部署第二长期入口。
3. 获模型授权后只做覆盖新增接入的少量目标任务：不把岗位答案写进用户任务的身份/知识核验；一个新QA变化目标；一个部分读取失败目标。由Hermes自主选合理路径，不要求原点击次数；不重跑旧九类全矩阵。
4. 实测home/cwd、实际SOUL/记忆注入、提示截断、重开会话/自动复盘回流与模型工具集合；失败即停，对批准变更集恢复，不启动旧cron/渠道。
5. 验收后再按Owner明确选定的文件/记录ID处理旧业务与测试身份；未明确项继续待决。真实灵生登录和只读带教仍属后续Gate2。

**本轮完成的是准备和组件验证，不是Gate1正式部署。** 新PR供Owner/ChatGPT第二轮审查；PR #6/#8/#10均未自动合并或改base。到此停止，等待下一轮精确授权。

