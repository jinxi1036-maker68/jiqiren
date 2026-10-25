# 机器人数据采集 Project Knowledge｜唯一入口

> 聊天记忆不是权威；旧截图不是当前事实；口头条件在写进正式协议前都只是“待合同确认”。

## Hermes数字员工｜Owner最高有效理念（2026-10-16）

**任何新窗口、Codex或其他Agent，只要任务涉及Hermes身份、开发、记忆清理、浏览器、巡检、派单或扩展业务，必须在制订方案/改代码之前先读：**

- [唯一当前指导原则：Hermes数字员工岗位宪章](HERMES_DIGITAL_EMPLOYEE_CHARTER.md)
- [正式Owner决策与已否决方案](decisions/ADR-HERMES-SINGLE-EMPLOYEE-2026-10-16.md)
- [从起点到现在的理念、开发、纠偏历史](history/HERMES_PRODUCT_EVOLUTION_2026-10-16.md)（首次接手/需要复盘时读）
- [开发Agent入口](../AGENTS.md)与[Hermes代码工作区约束](../hermes/AGENTS.md)

**关键结论：Owner电脑里最终只有一名正式Hermes员工；不把它变成新管理系统，也不长期保留旧Hermes+数采Hermes两个身份。公司给目标/底线，员工自主判断/完成/成长；当前先灵生数采，未来按Owner需要扩展。** 之前独立profile仅是模拟测试策略；原Hermes正式清理/迁移尚未做。具体岗位权限仍需单独授权和验收。

**换新对话窗口时可直接复制：**[Hermes跨窗口接力启动语](HERMES_NEW_CHAT_HANDOFF.md)。新窗口仍须读取上述宪章/ADR/历史，不仅凭交接语回答。\n\n## 2026-10-24 最新公司/税务与合同进展

- 当前税务办理记录：[开业信息确认进度](reports/2026-10-24_COMPANY_TAX_PROGRESS.md)。Owner报告已提交，但最终办结状态未核实。
- 当前税务优化目标：[合法节税核查清单](reports/2026-10-24_TAX_PLANNING.md)。政策优惠须在实际申报前再次核实。
- 灵生合作最新合同、验收问题：[合同和QA沟通报告](reports/2026-10-24_LIVSYN_CONTRACT_QA.md)。尚无最终签署合同和最新结算证据。
- 具体机器状态以 [CURRENT_WORK.json](CURRENT_WORK.json)、[PROJECT_INDEX.json](PROJECT_INDEX.json) 为准；Hermes现行理念仍以其岗位宪章为唯一权威。

## Agent Bootstrap
新 ChatGPT / Codex / 协作者只按这个顺序启动：

1. 读 `knowledge/KNOWLEDGE_HARNESS.json`
2. 读 `knowledge/PROJECT_INDEX.json`
3. 读 `knowledge/CURRENT_WORK.json`
4. 根据当前任务执行必要 Freshness Gate
5. 按 `CURRENT_WORK.context_profile` 读取所需文件
6. 只在需要时读取 Evidence / History / Archive

**禁止一上来整库全读。**

## 当前权威顺序
1. Owner 最新明确决定
2. 实时合同 / 任务单 / 平台后台 / 对公文件
3. `PROJECT_INDEX.json`
4. `CURRENT_WORK.json`
5. Partner / Economics / Scene / People 等机器事实文件
6. 已封存 Evidence / ADR
7. History / Archive / 旧聊天

## 事实标记
- `confirmed`：已有正式文件、平台后台或双方明确书面确认
- `conversation_confirmed`：微信/电话已明确，但尚未进入正式合同
- `assumption`：用于测算或规划的经营假设
- `pending`：待对方、现场或合同确认
- `rejected`：明确不采用或已失效

## 这套 Harness 的核心
Current 只保存“现在”；History 只保存“过去”；Evidence 只保存“证明”；Roadmap 只保存“未来”。

## 新窗口启动语
> 读取 `jinxi1036-maker68/jiqiren`，从 `knowledge/00_START_HERE.md` 开始，按 Knowledge Harness 路由：先读 PROJECT_INDEX 和 CURRENT_WORK，再按 context_profile 渐进加载。不要把旧聊天或历史文档当成当前事实。


## 2026-10-25 Hermes浏览器专项本地实施

Owner已委托技术自主推进。原Desktop接入和QQ实际浏览器/辅助视觉已有证据；两次QQ任务未完成全目标，旧120次保守HTTPX额度已满。定点零模型改进已通过组件检查，旧翻页超时原因仍未知；Owner已明确追加新一轮60次模型/3条QQ任务，新计数护栏已接入；第一项全页QA比较有实证，但复用了旧会话，新会话验收条件未通过。接入已修正编号并加只读查重，当前仅开放第二项创建绑定，60次中已用19、剩41，仍同一原身份W。见[实施报告第11节](../hermes/reports/HERMES_BROWSER_LOCAL_B_IMPLEMENTATION_2026-10-25.md)与[范围决策](decisions/ADR-HERMES-BROWSER-LOCAL-B-2026-10-24.md)。原宪章不变，真实平台及QQ晨报未启用。
