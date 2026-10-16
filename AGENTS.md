# 本仓库所有AI开发者必须先读｜Agent Entry

本仓库是`jinxi1036-maker68/jiqiren`，包含机器人数据采集经营知识库以及一名**Hermes数字员工**的培训/开发代码。

## 新窗口 / 新Agent的最短启动路径

1. 阅读`knowledge/00_START_HERE.md`，按`knowledge/KNOWLEDGE_HARNESS.json`路由，再读`knowledge/PROJECT_INDEX.json`和`knowledge/CURRENT_WORK.json`。
2. **只要任务涉及Hermes身份、开发、记忆、工具、定时工作、浏览器、运营，必须额外读取`knowledge/HERMES_DIGITAL_EMPLOYEE_CHARTER.md`。** 它是**唯一当前发展理念**，不能用旧聊天、旧PR或旧技术方案代替。
3. 重要变更动机读`knowledge/decisions/ADR-HERMES-SINGLE-EMPLOYEE-2026-10-16.md`；需要理解走过的路再读`knowledge/history/HERMES_PRODUCT_EVOLUTION_2026-10-16.md`。
4. 开发Hermes时读`hermes/AGENTS.md`和`hermes/identity/ROLE_BRIEF.md`，再看对应代码与已合并/未合并PR。

## 宪章的不可偏离要义

- Hermes是Owner电脑里**唯一正式数字员工**；不是第二套业务系统，也不追求长期维护原Hermes+隔离Hermes双身份。
- **公司给岗位目标、业务知识、授权、底线和成果标准；Hermes自主决定工作方法、自己发现问题和自我提升。** 不将思考限制在硬编码“第一步/第二步/第三步”。
- 只为当前实际需要逐步培养新技能。现在重点是灵生真实数采后台运营；Owner未来增加新客户/项目时，继续培养同一员工。
- 底线必须遵守：真实数据、正式SOP/任务关键要求、权限、隐私、财务/重大操作审批；日常明确授权的工作不必事事请示。
- 原Hermes目前**尚未执行正式单身份清理/迁移**；Phase02A/02B隔离profile为历史模拟实验，不可把它们称为Owner批准的终局架构。
- 现场页面权限、业务事实、已部署能力必须核验；不把历史模拟通过写为已经能在真实灵生后台自动值班。
- `knowledge/`保存理念、当前事实、ADR与历史；`hermes/`保存岗位植入模板、开发源码和测试。**禁止提交生产凭据、私人聊天/员工资料/工资明细或视频。**

## 变更与审阅

Owner最新明确决定优先，旧方案有冲突时标注`SUPERSEDED`并保留历史。每轮真实改动需要对应GitHub提交、脱敏测试和验收记录。对于会影响电脑上现有Hermes的删除、记忆重置、正式浏览器账号接入、自动派单及全局配置变更，先确认具体范围，不能因为文档写了“最终应清理”就擅自执行。

**结束时核对**：是否依循宪章、是否保留Hermes自主性、是否未越权、是否同步了相应知识/代码/历史、是否对已做与待做做了诚实区分。
