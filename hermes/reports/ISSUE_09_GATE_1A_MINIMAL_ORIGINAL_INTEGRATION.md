# Issue #9｜Gate 1A 原 Hermes 最小岗位接入：已落盘，原 Desktop 验收受阻

日期：2026-10-16，Asia/Shanghai。**结论：部分完成，Gate 1A 未完整验收通过。**

原 Hermes 的 SOUL、公司工作区、Desktop 默认项目设置和新增中性模拟 MCP 已实际写入。本轮原生加载函数与真实浏览器组件验证通过。**原 Desktop 没有启动，Hermes 本人真实模型对话为 0/3**：Codex 的 Computer Use 工具在应用发现前初始化失败；有界重试及重置后仍报内核资源路径不存在。没有用 CLI、假 MCP、脚本浏览器或先前独立身份的模型结果冒充原入口验收。

目前保留已应用的最小接入，尚未自动回退。没有观察到原 Hermes 自身身份冲突、入口失效、越界或 SDK 旧目录引用的触发条件；开发工具不可用也不能证明原 Desktop 损坏。**同时，没有证据证明原入口已完成岗位转正。** 旧 MEMORY/USER 和旧 MCP 仍保留、仍可能进入实际会话；不得投入正式运营。到此停止，等待 Owner 和 ChatGPT 审阅，不进入 Gate 1B/Gate 2。

## 1. 授权、继承与本轮边界

执行依据是 [Owner Gate 1A 授权评论 6213175793](https://github.com/jinxi1036-maker68/jiqiren/issues/9#issuecomment-6213175793)及 [PR #11 第二轮审查 5546195454](https://github.com/jinxi1036-maker68/jiqiren/pull/11#pullrequestreview-5546195454)。授权是可回退最小接入，不是 100 段旧记忆、133 个候选文件、34 项矩阵或 C01—C06 全部放行。

以 main `053b5b4cd2476fdf6df68e2c924a6b1c7d28e080` 的最高宪章、ADR、Harness 和原业务事实为基线，继承：

- [PR #10](https://github.com/jinxi1036-maker68/jiqiren/pull/10)固定 head `e6d581cd4454c60d84750ef769da427cb01b11a8` 的迁移与风险方案；
- [PR #11](https://github.com/jinxi1036-maker68/jiqiren/pull/11)固定 head `728de1b667de73c6c400d82c20d2ad3a9edc2807` 的 SOUL 草案、中性 SDK/resolver/bridge 和定点核实；
- PR #4 的既有审计、PR #6 的全量本机恢复验证、PR #8 的模拟能力与失败记录。本轮没有重做全量审计、14,349 文件/129 库备份、161 Skills 盘点或 23 次模型矩阵。

最新核对 #6/#8/#10/#11 均开放、未合并；#8 仍以 #6 分支为 base。未合并、关闭或改 base。本 PR 从 main 单独提交；旧分支合并策略仍由 Owner 决定。

## 2. 定点预检与短期恢复保护

别名：H=`<USER_HOME>/.hermes`，I=`<LOCALAPPDATA>/hermes/hermes-agent`，D=`<APPDATA>/Hermes`，W=H/company-workspace。P 第二数据根包含 I，没有移动或清理。

- 两个原快捷方式仍指向同一 `I/apps/desktop/release/win-unpacked/Hermes.exe`，无附加参数。用户/进程 HERMES_HOME 都是 H；原 active_profile、Desktop project-dir.json 和三个拟建目录在预检时不存在。
- 原 SOUL、config.yaml、MEMORY、USER、cron/jobs.json 共 5 个目标哈希匹配 PR #11。安装源码 head 仍是 `8794e5a21c980a0f26532cb4883284b786cb3f25`；三份相关加载源码无相对 HEAD 修改。这不等于已证明打包 Desktop 与源码完全一致。
- 外部进程点查未检测到原 Hermes Desktop/后端在用，没有终止进程、网关或共用服务。最初自检将本次 Windows venv redirector 计入，纠正为仅排除自身及核实过的直接父 redirector，未据此停任何服务。
- 对即将替换的 SOUL、增补绑定所属 config，以及只读验收关联的 MEMORY/USER 共 **4 个小文件**制作一次 AES-256-GCM 增量保护，密钥由同一 Windows 用户 DPAPI 包裹；Desktop 项目设置的“原来不存在”也记录在包内。加密包 **144,232 字节**，SHA-256 `de0512df54c0f3d1041151bb9ad5baf058d78a903d05b3a4ddf3692643d97055`。
- 先在私有隔离目录解密、恢复四文件并逐字节哈希比对，篡改认证负例拒绝通过，之后才修改原环境。私有目录 ACL 仅当前用户和 SYSTEM。旧 SOUL 原文及原哈希保存在本机私有记录，未上传。
- 继承旧有效恢复包，未新备份 1.2GB state.db，也没有启动 Desktop/Agent 或修改其会话库。本恢复点证明文件级恢复；**不证明完整 Desktop、跨用户/跨机、浏览器登录态或模型会话恢复**。

验收后第 7 日复核留存，第 14 日必须请 Owner 决定处置；本授权不允许自动销毁有效恢复包。本轮尚未完成验收，因此相对验收日期尚未成立；没有创建定时销毁或提醒任务。

## 3. 原环境实际变更

[EXACT_CHANGES.json](../evidence/issue09_gate1a/EXACT_CHANGES.json)列出字段、旧/新完整哈希、43 个新增非 vendor 文件哈希、三个新目录的完整清单摘要及依赖锁；本机另有全部 3,540 个新增文件逐项哈希清单。

| 目标 | 实际变更 | 回退依据 |
|---|---|---|
| H/SOUL.md | 使用 PR #11 固定版本 SOUL.draft.md 的原字节，核对公司唯一员工、自主方法、事实/权限/隐私底线 | 旧正文仅本机；原 SHA `dfaee81231795d373413601f104b7d05e74e9a44200fa621ffac261cd01f6f6f` → 新 SHA `6cde9e101908e83578a666380a0dab0aa9fba00cbb5bdfa480cb0a748c7032eb` |
| D/project-dir.json:dir（C02） | 原文件不存在；新建后指向 W | 文件 SHA `d8edd6427eaefaebfa31da376e225b18b712a267f227d11863c335e75f518c63`；回退恢复“原来不存在” |
| H/config.yaml（C05） | **仅增加一行** mcp_servers.company_browser_simulation；指向原 Python 的隔离模式和新 launch_bridge.py/template.json | `d9a6fd4cf0c87cf6cd6d4c118138e19fad2af7d6c668c510acdfeafb0979c0f9` → `a6886244db5baab40566fd717c5503d835a70243594a0fb0adcc527bae4ce5af`；移除这唯一新行后逐字节等于原文件 |
| W | 18 份固定 main 资料、HERMES.md、快照清单和本轮状态，共 21 文件 | 整个目录预检不存在；只作为原员工的公司 cwd，不是新 profile/HERMES_HOME |
| H/tools/company-browser-sdk（C06） | 中性 SDK 1.30.0 完整运行闭包：93 包、3,496 vendor 文件及 1 个 anchor manifest | 与 PR #11 离线副本的每包版本/内容摘要一致，不从旧 xianyu 目录 fallback |
| H/tools/company-browser-simulation（C06） | 8 个组件文件，加 1 次已落盘组件探针的 14 个合成运行文件，共 22 文件 | 明确新目录和本次运行 ID；不包含凭据、旧业务数据或原浏览器 profile |

**没有做的变更**：C01 terminal.cwd 仍为 `.`。Desktop 源码优先读取 D/project-dir.json，因此只改 C02；实际新会话 cwd 仍待 Desktop 验证。C03/C04 的两个旧 MCP 绑定和物理目录都保留。除唯一新增 MCP 行外，原配置全部字节和全部其他字段保持，包含模型、权限/审计、安全、Skills/记忆开关、voice.auto_tts:false 等。

MEMORY、USER、空 cron 的原哈希保持；没有整写或清空记忆，也没有关闭记忆功能。没有删除 F001—F133、旧 session/state.db/checkpoints、测试 profile/CMD、安装目录、旧备份、Cookie 或浏览器登录资料。Windows `\OpenClaw Gateway` 仍 enabled，未操作动作；当前 0 项 cron 未创建、恢复或停用历史任务。

## 4. 公司知识入口实际可读

[KNOWLEDGE_SNAPSHOT.json](../evidence/issue09_gate1a/KNOWLEDGE_SNAPSHOT.json)记录每份资料的固定来源 URL、Git blob SHA、SHA-256 和大小。W 中确实存在并可读取：00_START_HERE、KNOWLEDGE_HARNESS、PROJECT_INDEX、CURRENT_WORK、最高宪章、正式 ADR、完整历史、根/开发 AGENTS、ROLE_BRIEF、Freshness、North Star，以及当前 pre_trial profile 和 must_read 涉及的场景/人员培训/合同/合作方资料。

PROJECT_INDEX 与 CURRENT_WORK 的工作项一致，仍是 `WI-2026-10-livsyn-first-trial-prep`；设备实到数、QA、结算等未知仍是未知。没有把 10 台目标或三任务方向写成已获完整 SOP/样本验收。

这是 **18 份资料的最小固定快照，不是全仓同步器**。未缓存的引用明确报本地未提供，由开发者按后续目标核实更新；Hermes不得猜内容、取仓库凭据或自行扩大访问。HERMES.md 指明旧 main 的部署进度是历史快照，本轮安装/权限以 W/GATE_1A_STATUS.json 及 Owner 授权为准。GitHub 本 PR 的 Current/Index 仅更新 Hermes 状态，原业务字段保持；历史追加并继承 PR #11 的 Gate0/前置准备记录，没有改写过去。

## 5. 实际验证及失败

### 原生加载函数验证（不是实际 Desktop Agent）

使用原安装 Python，在只读/禁网络探针中调用已安装的 load_soul_md、build_context_files_prompt 和 MemoryStore；没有构造 AIAgent 或加载新模型凭据。

- H 解析为原 H；新 SOUL 经原扫描/截断函数仍与批准文本完全相同，894 字符（去首尾空白）。公司工作区入口进入上下文片段，片段 726 字符。
- 显式传入 W 只证明加载函数能读取 W，**不证明 Desktop 新会话实际 cwd 为 W**；整份实际模型提示、模型 context 长度与总截断未观测。
- 原 MEMORY **40 条**、USER **27 条**仍进入原生加载流程，两个新建 MemoryStore 的快照相同。记忆快照片段长度为 9,670/5,109 字符（含包装）；不是清理结果。语义冲突、原 Desktop 重开和后台自动记忆复盘是否回灌尚未实测。
- 探针前后 5 个选定文件保持，保护钩子未发生拒绝；它只是该 Python 探针的保护，不是 Hermes 的 OS 沙箱。

### 中性浏览器组件验证（不是自主 Agent）

开发区和原 H 正式落盘位置各有一次最终通过的真实 stdio → Python owned Job → Node bridge → Playwright MCP/Edge 验证。已落盘结果见 [VALIDATION.json](../evidence/issue09_gate1a/VALIDATION.json)：

1. 中性 SDK 与四工具 browser_navigate/snapshot/click/close；没有 evaluate 等额外工具。
2. 合成 DEMO-001 从待审/暂无变成已审/模拟通过，读取真实 DOM 前后值。
3. 合成部分分页显示第 2 页 HTTP 503；未取得第二页记录。**本轮没有模型对其归因，不能宣告原 Agent 的 503 判断已过验收。**
4. 外站、猜测的同源路径和 evaluate 均拒绝；服务日志只记录 /change、/partial 和 /api/page2。
5. stdin 关闭即结束本次 invocation，Windows Job 只回收该调用的子树；结束标记及三个跟踪 PID 均退出。没有接管或关闭现有 Edge/共享服务。

每次工具启动创建独立的**无真实登录的浏览器上下文**和随机 loopback 端口，退出即关本次合成服务；不是第二 Hermes 员工。继承的 page guard 和 URL 白名单只用于合成模拟，**不是生产只读安全策略，也不是 OS 级网络沙箱**。原终端和旧 MCP 权限并未由此缩小，不能将其换成真实灵生域名使用。

保留失败：最初进程过滤误计自身；SDK 校验误重复包含嵌套包（93 包/3,496 唯一文件核对后修正）；4 次开发区浏览器探针依次暴露导航返回文件链接（两次）、click 参数名和分行 DOM 断言不匹配；早期强制退出无最终生命周期标记。已修正探针及 EOF 回收，最终开发/安装位置各通过一次。没有丢掉失败后宣称“一次全过”。

### 原入口验收阻塞

Computer Use 三次初始化尝试（含一次 kernel reset 后）均在应用发现前报：`failed to write kernel assets: 系统找不到指定的路径。 (os error 3)`。参照技能的有界恢复流程停止 UI 操作；这是对初始化故障的处理判断，不是原 Hermes 界面故障或额外权限拒绝。未改开发工具配置或绕路控制 Windows。

所以以下均未完成：原 Desktop 启动/新会话/重开、真实 session home/cwd、实际完整工具集合/提示截断、身份与知识问答、Hermes 自主 QA 比较和部分失败汇报、自动记忆回流。现有模型服务是否可用也未试探。模型对话 **0/3**、新账号/临时 key 注入 **0**、真实灵生登录/业务操作 **0**。

## 6. 回退办法、当前状态与下一审阅

文件保护包已隔离恢复验证；完成落盘后又做了一次**只读回退就绪检查**：认证解密、四文件 payload 哈希、当前三个改动目标 after 哈希及全部新增文件清单均匹配。未在原 H 执行真实回退，不冒充完整桌面恢复演练。

批准变更集的回退顺序：原 Hermes 必须未被使用；核对没有并发修改和未知新增文件 → 从本机加密增量恢复 SOUL/config 原字节 → 将本轮新建 project-dir.json 移入私有回退留存，恢复原来不存在 → 仅将三个明确新目录移入私有回退留存。未知文件或哈希漂移则停止，不广泛移动或覆盖。**不删除任何旧资料/有效恢复包，不恢复旧 cron，不启动网关/投递。** 本机私有交接说明保留可执行路径；GitHub不含恢复包、密钥、旧正文或账号。

Owner/ChatGPT 本轮应审查：是否接受保留“已应用、待 Desktop 验收”的最小接入；先解决开发桌面工具阻塞，再继续同一 Gate 1A 剩余的最多 3 次原入口目标验收。不能把旧隔离身份历史通过或本轮脚本浏览器结果当替代证据。

以下仍需后续**具体**批准：MEMORY/USER 条目处置、C03/C04 旧 MCP 退出、任何旧文件/测试身份/备份处置；新凭据或费用；真实灵生登录学习及业务权限；持续值班/外发/派单。没有为这些创建任务或自动实施。PR #6/#8/#10/#11 的整合/合并仍由 Owner 决定。

本轮源码、非敏感配置、脱敏证据和有限失败已入新分支；发布采用显式文件白名单，不引入 PR #11 的宽泛 auth/token 忽略模式。GitHub审阅可核对代码与证据的自洽性，不能独立证明所有本机运行事实。**停止在 Gate 1A，等待审查。**
