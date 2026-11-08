# GitHub逐步迭代协议｜所有Codex版本从同一底板继续

**正式执行的工作方式（2026-11-08设立）：**
1. **开工前读版本**：`miniapp/knowledge/00_START_HERE.md` → 宪章 → `PROJECT_STATE.json` → `REQUIREMENTS.json` → 最近变更与Issue/PR → 源代码，不可直接依据旧聊天重写。
2. **做变更记录**：每次需求增加或纠错必须记“日期、发起者/是否Owner确认、原因、受影响页面/需求编号、与旧版本关系（例如SUPERSEDED）”，再动代码。
3. **只在已有代码基础上演化**：复用现有组件与数据结构；需要删除/重写需写影响评估、数据迁移与回滚措施，不另建互相冲突的项目根目录。
4. **代码与知识同时交付**：更新对应应用源码 + 必要测试 + `REQUIREMENTS.json`实现状态 + `PROJECT_STATE.json`真实进度 + `CHANGELOG.md`版本差异；重大设计决策同步`DECISION_LOG.md`与`EVOLUTION.md`。
5. **Git记录**：小范围提交；独立开发分支与Draft PR；明确基准commit、改动文件、测试方式、已通过/未通过的验收项及截图或演示路径，Owner审核后再合并。
6. **不能做什么**：不能把“准备任务”“本地一次运行”“模拟过关”说成“已在GitHub合并”“已连客户”“上线收款”；权限不足时出具能复用的变更说明并说清未同步。
7. **验收和回退**：合并前确认商家/个人角色不被颠倒、时段和多订单不会冲突、资金和QA仅为模拟、没有真实凭据/个人视频；重要版本可打tag或标注commit，随时可回退。
8. **双层历史**：`miniapp/CHANGELOG.md`记已执行的代码变更；`miniapp/knowledge/EVOLUTION.md`记想法与路线演进；公司`knowledge/history/COMPANY_EVOLUTION_TIMELINE.md`只追加重要里程碑索引，不复制全部代码明细。

**知识库是权威，不代替真实技术验收**。Codex有独立运行权限和GitHub写权限时才能真正提交代码，当前ChatGPT能写入GitHub并不意味着Codex的原权限问题已经解决。
