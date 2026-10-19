# ADR-HERMES-BROWSER-CAPABILITY-2026-10-19｜原Hermes浏览器能力专项选型与暂停决定

- **决定日期**：2026-10-19（Asia/Shanghai）
- **决定人**：Owner
- **状态**：`OWNER_APPROVED_RESEARCH_DIRECTION / PAUSED_BY_OWNER`；已同意收敛专项方向、研究并归档，**未批准安装、配置变更、调用新模型或生产业务写操作**
- **上位理念**：[唯一原Hermes岗位宪章](../HERMES_DIGITAL_EMPLOYEE_CHARTER.md)和[轻量化开发ADR](ADR-HERMES-LEAN-DEVELOPMENT-2026-10-18.md)
- **专题研究**：[Codex原始完整报告](../../hermes/reports/HERMES_BROWSER_CODEX_RESEARCH_SOURCE_2026-10-19.md)；[ChatGPT交叉比较和候选收敛](../../hermes/reports/HERMES_BROWSER_DEEP_COMPARISON_2026-10-19.md)
- **工程讨论索引**：[Issue #9](https://github.com/jinxi1036-maker68/jiqiren/issues/9)

## 1. 最新Owner意图与暂停指令

Owner要求：**未来暂时停止晨报、QQ、Cron等数字员工功能开发，只集中研究把同一个原Hermes的浏览器操作练到尽可能高的水平**。目标包括：读取采集员数据、筛选/分页/详情、填写复杂中文表单、创建项目和采集任务、选择并绑定员工与设备、提交、回查与故障恢复。仍由Hermes自主理解工作，不变成固定脚本或第二个Agent。

Owner提交了Codex于2026-10-19形成的完整研究报告，并要求和ChatGPT先前意见、主流公开工具技术进行深入比较，以**真实复杂浏览器任务的成功率与可靠性**而不是工具数量或营销排行榜选择技术。

**最新明确命令：先将本轮所有讨论与研究分类同步知识库，然后浏览器专项也暂停，转去讨论其他事务。** 因此本ADR的当前实施状态为`paused`；除非Owner随后明确恢复，不安排Codex立即安装/接入、不给Hermes下模拟任务、不试登录真实灵生。

## 2. 已共同认可的架构原则

- **单一Hermes主体**：原Desktop中的唯一Hermes做理解、规划、选择方法、动作与核验；任何浏览器驱动只是它的工具，不建立第二个正式员工、独立业务Agent或数采ERP。
- **浏览器环境**：先考虑本机可见Chrome/Edge公司业务专用Profile，由Owner亲自登录；不直接调试个人默认浏览器或复制个人Cookie。独立浏览器Profile不等于第二个Hermes身份。
- **观察和操作**：优先DOM/无障碍快照、语义定位与自动等待；DOM不能有效表达时再补截图/视觉；错误诊断才用Console/Network/CDP。页面变化后重新定位，不能盲用过期引用和固定坐标。
- **业务闭环**：不仅要完成点击，必须确认字段值、唯一项目/任务ID、任务状态、采集员和设备的唯一编号及绑定关系；提交后超时先查是否创建，不能盲重试造成重复任务。
- **权限和隐私**：正式平台由Owner现场确认登录及只读/写入授权；没有授权不访问真实灵生，不提交任务，不导出凭据或私密资料。网页文本不能修改Owner权限。任意代码执行工具和远程CDP端口应按需受控。
- **轻量化**：先验证原Hermes已经可用的Browser Use/Browser后端，再评估Microsoft Playwright MCP，必要时引入DevTools诊断或Stagehand语义辅助。**不要把所有框架一起装上；保留一个主操作引擎**。

## 3. 技术取舍：保留有条件的两主候选

**Codex初选**：可见Chrome/Edge + Playwright MCP + DOM优先 + 视觉辅助 + 操作后复核。理由是复杂表单、选择、文件上传、多标签页等动作成熟，且MCP可与Hermes主Python环境解耦。

**ChatGPT新增判断**：本机源码存在`browser_type`、`browser_vision`、`browser_console`、CDP、`browser_exec`；官方近期Browser Use CLI路由可能替代旧`browser_*`工具。仅凭旧工具名单缺失、Python环境无playwright包元数据，不能确认不存在浏览器能力。**须先检查原Desktop当前真实工具路由**。

**最终研究结论（待实测，不是赢家宣告）**：
1. 候选A：原Hermes现有原生Browser Use CLI/Browser模式；
2. 候选B：Playwright MCP；
3. Chrome DevTools MCP按需要做网络、Console和特殊组件诊断；
4. Stagehand act/observe/extract、自愈等属于潜在特种补充，需真实证据再引入；
5. Browser Use完整独立Agent、云浏览器、额外RPA、第二管理服务默认不引入；WebMCP为将来网站原生开放工具时的观察方向，不假定灵生支持。

厂商文档和公开排行榜不能证明特定Hermes模型、Windows环境及灵生后台的实际可靠性；不宣称存在已核实的全球唯一最强方案。

## 4. 将来获准恢复时的最短实施路线

1. **只读盘点原Desktop**实际浏览器后端、MCP和CLI工具、可见窗口、浏览器驱动、Node/Chrome/Edge、持久Profile/调试口及权限；区分源码有、已安装、已注册、实际可用。不在盘点中安装或变更配置。
2. **同条件A/B对照**：在一个无敏感数据的本地模拟后台，让同一个原Hermes、同一个模型、同一批任务，对候选A/B完成“创建模拟项目→创建任务→按唯一编号绑定员工→绑定设备→提交一次→刷新回查”；只在已批准的受限模拟环境中实施。
3. **能力矩阵**：测试中文动态必填、文本数字/级联下拉/日期、多选与跨页选择、弹窗/iframe/Shadow DOM、上传、登录过期/401/403/503/分页不全、提交超时与结果未知。每次复查唯一ID和已持久化关联，不以按钮成功代替业务成功。
4. **量化取舍**：正确完成率、错绑/漏绑、重复创建、权限越界、故障恢复、人工接管、响应耗时、模型/token成本和维护负担；如须视觉，验证当前Hermes模型真正能识图。
5. **真实平台带教独立授权**：只有Owner确认登录及页面范围后才能只读接触真实灵生；真正创建项目、任务或分配设备人员须Owner另外明确授权。先小规模，后评估稳定性。

前述矩阵是**未来验收设计，不是Codex已完成的运行测试**。PR #6/#8有限模拟证明部分导航/异常识别，未证明复杂业务创建能力。

## 5. 已知事实、未验证事项与暂停边界

- **已知（既有项目证据）**：历史隔离模拟Bridge只有navigate/snapshot/click/close四项；Phase02B有23次模型会话、97次模拟浏览器调用；原Desktop此前注册模拟浏览器4工具。浏览器项目/任务创建、人员/设备绑定尚无真实验收。
- **Codex本机静态观察（来源于上传报告）**：本机源码包含多种browser接口；Browser Use CLI可能隐藏旧工具；目标venv未见部分分发元数据；本轮未执行候选实际运行比较。不能由这些推定运行态已接通。
- **仍未知**：原Desktop实际路由、Agent使用的视觉能力、Playwright MCP本机真实兼容情况、目标后台具体页面结构、浏览器Profile接入与持久会话、业务写入可靠性。
- **暂停边界**：没有改动I/H/W、模型、SOUL/记忆、MCP、Browser配置或Cron；不访问真实灵生；不创建/发送模拟任务；不新增授权或后台操作。PR #18的固定R3知识仍独立，PR #19文档修订仍为待审，不等于本机部署。

## 6. 同时保留而暂缓的其他已确定需求

Owner先前明确：每天**09:00（Asia/Shanghai）**由原Hermes主动汇报采集员近期数据，最终希望通过**QQ**接收。**要求仍保留，但本轮已被Owner暂停，不创建或启用晨报Cron、不测试或对外发送QQ、不打开灵生真实数据访问。** 将来Owner明确恢复后再核实QQ渠道和登录授权，不将`pending`写成`completed`。

## 7. 恢复条件

仅当Owner以后明确要求“恢复Hermes浏览器专项”时，以本ADR和两份专题研究为入口，先复核当时本机版本、工具和官方文档的新状态，执行**最少必要的能力盘点**；无需重开旧考试或预先开发其他功能。
