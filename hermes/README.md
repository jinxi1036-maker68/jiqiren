# Hermes｜机器人数据采集运营数字员工

> **定位**：Hermes 是一名在 Owner 电脑上实际工作、可以自主巡检与跟进的**数字员工**，不是另造一套业务管理系统，也不等同于固定点击脚本。

## 与原有业务知识库的关系

本仓库 `jinxi1036-maker68/jiqiren` 同时承载两条主线：

- `knowledge/`：真实世界/EGO数据采集的业务知识、灵生合作、质检SOP、场景、团队、成本与经营决策。
- `hermes/`：Hermes 数字员工的岗位培训、浏览器能力、工作方法、开发代码、验证、故障排查与版本历史。

两条主线互相引用，但不能将业务假设当成平台事实，也不能把技术工具代替员工角色。

## 四方协作

1. **Owner**：确定现实工作需求、工作习惯、审批边界，提供必要的后台使用授权和最终验收。
2. **ChatGPT**：与Owner讨论目标、拆任务、审阅Codex/Hermes实际反馈和验收结果，维护知识库。
3. **Codex**：在获得本机访问权限的环境内检查真实安装，编写/测试能力，提交代码与**脱敏**报告到GitHub。
4. **Hermes**：持续在其被授权的本地环境中执行运营工作；主动巡查、发现问题、学习业务流程、跟进事项、向Owner汇报。

## 核心原则

- **从真实网页和Owner习惯出发**：`https://ldp.lingrobotics.com/statistics`只是灵生后台已知的统计页入口，其他页面、字段、按钮、可执行行为一律**待实地核验**。
- **先认识岗位、再做自动化**：不根据猜测开发大量功能。先学习系统菜单、字段含义、正确操作，再训练观察/总结，最后循序渐进授权提交任务。
- **主动工作**：检查待审核数据、质检新标注、员工上传进度和积压事项，自动跟进并汇报。具体巡检节奏/异常阈值/汇报渠道与Owner商定后定稿。
- **事实与判断分层**：后台可见事实、采集员自身解释、Hermes推测原因、建议动作要分开写；没有新增质检结果不能伪称看到了。
- **安全先行**：首期只读。创建/修改/分配项目或任务需经Owner允许且符合平台权限；删除、工资最终核准和付款由Owner审批。
- **可追溯但不泄密**：GitHub保留可复现代码、角色规则、流程知识、脱敏测试和迭代记录；本地存有登录凭据、Cookie、员工身份信息、工资明细、视频源文件，不应提交仓库。
- **可回退、可复核**：升级前备份；经Codex真实验证后才记录“已具备”，不可把计划误写成成果。

## 当前阶段

**PHASE 02B Gate A：模拟异常整改与独立classic CLI入口已完成，等待Owner与ChatGPT验收。** Phase02A模拟基线获审阅范围内认可，PR #6仍由Owner决定是否合并。本轮完成21次矩阵与2次原生CLI真实模型对话，九类最新模拟样本通过公开答复/DOM核对；失败记录保留。临时模型凭据已撤下，独立入口自检可用，长期聊天尚未授权。原Hermes及Phase02A选定文件一致。**Gate B未授权、未开始，未登录灵生，未启动正式巡检/任务/派单。**

- [Phase 02B Gate A报告](reports/PHASE_02B_REAL_BACKEND_READONLY_ONBOARDING.md)
- [独立入口使用说明](phase02b/使用说明.md)
- [Phase 02B运行与回退](phase02b/RUNBOOK.md)
- [九类最新样本索引及完整失败历史](evidence/phase02b/FINAL_CASE_INDEX.json)

- [Phase 02A实测报告](reports/PHASE_02A_SPECIALIZED_AGENT_BASELINE.md)
- [Phase 02A代码与运行说明](phase02a/RUNBOOK.md)
- [最终Hermes对话与工具证据](evidence/phase02a/AGENT_RUNS.json)

- [第一阶段执行任务](tasks/PHASE_01_LOCAL_AUDIT.md)
- [第一阶段实测报告](reports/PHASE_01_LOCAL_AUDIT_REPORT.md)
- [第一阶段后续变更建议（待批准）](reports/PHASE_01_CHANGE_PROPOSAL.md)
- [审计复现说明](audit/README.md)
- [迭代变更记录](CHANGELOG.md)

## 读取业务上下文

首次进仓库请从 `knowledge/00_START_HERE.md` 启动，按项目的`KNOWLEDGE_HARNESS.json`顺序最小加载。只有与本阶段需求相关时才进一步读取业务文件。

## 验收哲学

真正的完成不是“代码能启动”，而是 Hermes 在获授权场景下**独立完成真实工作并经人工对照验收**。例如：检测1—2天前新返回的质检标注，准确指明员工/任务/错误标注，区分已审与待审，提示Owner而不自行推断为定论。

