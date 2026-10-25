# Hermes数字员工｜跨窗口接力启动语（2026-10-16）

> 这是**新聊天的使用入口**，不是另外一份岗位宪章；当前唯一有效的开发理念始终由`knowledge/HERMES_DIGITAL_EMPLOYEE_CHARTER.md`定义。历史实施状态必须以实时GitHub与本机Codex实际反馈核验。此文档不代表Owner已批准执行旧记忆永久删除、后台登录或任务写入。

> **2026-10-25时效提示**：以下正文中“原Hermes尚未接入、仍停在PR#8”等为2026-10-16创建本交接语时的历史快照。后续PR#12/#15已有原Hermes部分本机接入与合成模拟记录，PR#20报告QQ普通对话入口恢复尝试；正式灵生业务权限和完整验收仍不可据此认定。**接力前先读** [2026-10-25 PR分流台账](reports/2026-10-25_OPEN_PR_TRIAGE_REGISTER.md) 和 [恢复的决策时间线](history/2026-10-16_TO_2026-10-25_RECOVERED_DECISION_TRAIL.md)，再核当前机器和Owner授权。\n\n## 可直接复制到新ChatGPT对话的指令

我正在持续建设机器人数据采集公司的**唯一Hermes数字员工**。请接管GitHub仓库 `jinxi1036-maker68/jiqiren` 的该项目，不要按照旧聊天的独立双Hermes方案继续。

**先读取** `knowledge/00_START_HERE.md` 与 `knowledge/KNOWLEDGE_HARNESS.json`，再按路由读取 `knowledge/PROJECT_INDEX.json`、`knowledge/CURRENT_WORK.json`。本任务涉及Hermes，因此必须读取：
- `knowledge/HERMES_DIGITAL_EMPLOYEE_CHARTER.md`——**Owner唯一当前理念、权威来源**；
- `knowledge/decisions/ADR-HERMES-SINGLE-EMPLOYEE-2026-10-16.md`——为何否决旧方案；
- `knowledge/history/HERMES_PRODUCT_EVOLUTION_2026-10-16.md`——从初衷、开发、错误、纠偏到最终理念的全过程；
- `AGENTS.md`、`hermes/AGENTS.md` 与 `hermes/identity/ROLE_BRIEF.md`——跨开发Agent的一致工程约束与待部署岗位蓝图。

**最终理念**：电脑上原本安装的**同一个Hermes**是公司唯一正式数字员工；不是新建业务管理系统，不长期开“原Hermes＋隔离数采Hermes”两名员工。初次入职清理无关旧业务（先检查依赖并明确具体删除范围），当前专注灵生数采，未来我增加业务再教同一员工。像培训真实员工一样：公司讲岗位、目标、真实业务知识、规则、授权、最终结果，Hermes在底线内**自主思考、主动发现工作、自己选择做法、持续跟进、自主改进、按需汇报**，而不是被写死每步操作、事事问老板。正式SOP、任务派单关键规则、真实数据、平台授权、隐私、合同/工资/重大操作审批为不容擅改的底线。

**当前事实**：第一阶段 PR #4已合并；PR #6（隔离数采测试身份）和PR #8（模拟异常整改与独立CLI入口）在本交接文档建立时尚未合并，且#8以#6的分支为base；应重新核对实时状态。既有模拟测试证明Hermes Agent本人可在虚拟网页操作并识别审核变化/异常，但**原Hermes单身份正式岗位迁移未完成**，临时模型授权已撤回，**真实灵生后台页面尚未学习**，跨天巡检、可靠主动汇报、正式创建项目/派单都未验收。不得把模拟能力当正式上线。

**现在的开发接力点**：[Issue #9](https://github.com/jinxi1036-maker68/jiqiren/issues/9)。先按其Gate 0核对现有PR和本机情况，提出原Hermes单身份清理与岗位植入方案；**永久删除、实际配置更改、后台登录或写操作必须在明确范围授权后实施**。以后所有进展按知识库规则分别更新当前事实、ADR/历史和`hermes/`代码/测试，保存GitHub版本痕迹、错误与修正；不要上传密码、Cookie、员工隐私或视频。

请先简要向我复述你读取到的**唯一理念、已经实测的能力、未完成事项、Issue #9的下一步**；如果仓库连接不可用，请直接说明，不要凭旧聊天或猜测冒充已读取。暂不擅自修改本机Hermes或合并PR。

## 2026-10-25新增任务SOP知识入口（新窗口优先读）

- **[最新业务场景/任务文件版本入口](sop/00_START_HERE.md)**：同日新增V2对外Excel、V3内部详细Excel以及[33项任务198步Hermes可读完整SOP](sop/internal/2026-10-25_LINGJU_33_TASK_SOPS_HERMES_V3.md)，五份Excel真实二进制已上传GitHub主分支且回读一致；这些是**知识资料可用，不等于本机Hermes已自动加载或完成生产能力认证**。
- Owner明确：唯一原Hermes数字员工后续可在授权下基于内部V3对应F/S/W编号起草任务；**必须先以真实现场动作更新草案，不得未经明确授权在灵生生产平台创建、发布或派单**。对外V2仅限简洁场景/候选任务，不发内部步骤、房屋内部布局和持续耗材清单。
- 新聊天若当前任务是**业务SOP/场景**而非开发Hermes，应以[新的业务接力语](2026-10-25_NEXT_CHAT_HANDOFF_SCENE_SOP.md)为首选；本旧交接语主体技术实施状态以其撰写日期为准，不得覆盖2026-10-25以后更新。

## 给其他Agent的简版规则

- 先读宪章，`knowledge/`保存权威原则/业务事实/ADR/历史，`hermes/`保存岗位模板/Skill/代码/测试。
- 当前技术成果是独立模拟实验；用户批准的长期产品是**原Hermes单身份**。
- 能自主处理的是日常已授权事务；不能自动突破权限、合同/SOP、正式派单边界。
- 每轮开发留下脱敏证据，标明已实施/仅建议/已否决；旧方案用`SUPERSEDED`追溯，不把试验成果抹掉。
