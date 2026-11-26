# 机器人数据采集｜Project Knowledge Harness

这是“机器人真实世界 / EGO 数据采集”长期经营项目的知识库。

## 唯一入口
从 [knowledge/00_START_HERE.md](knowledge/00_START_HERE.md) 开始。

## 设计原则
- 聊天不是权威；知识库记录经过确认的当前事实。
- Current 只保存“现在正在做什么”，历史单独归档。
- 已确认事实、待确认信息、经营假设必须分开。
- 新会话只加载当前任务真正需要的上下文，不整库硬读。
- 重要扩张必须由真实试采、真实验收、真实结算证据驱动。

> 本仓库是经营知识库，不存放身份证、手机号、私人微信、银行账户等个人敏感信息。

## Hermes数字员工：跨窗口/跨Agent必读

[**Owner唯一有效理念：Hermes数字员工岗位宪章**](knowledge/HERMES_DIGITAL_EMPLOYEE_CHARTER.md) · [正式决策记录](knowledge/decisions/ADR-HERMES-SINGLE-EMPLOYEE-2026-10-16.md) · [完整演进历史](knowledge/history/HERMES_PRODUCT_EVOLUTION_2026-10-16.md) · [AI开发者入口](AGENTS.md)

现在的方向是**电脑里原Hermes唯一正式员工身份，给目标/底线让其自主工作，当前专注灵生数采，未来按需拓展**。此前Phase02A/02B独立profile属模拟实验，不代表最终双员工架构；正式迁移及原记忆清理尚未执行。具体项目代码规则见`hermes/AGENTS.md`。

## 商家版＋个人采集员版小程序（专属GitHub子项目）

- [小程序项目总入口](miniapp/README.md) · [产品知识库](miniapp/knowledge/00_START_HERE.md) · [Codex开发规则](miniapp/AGENTS.md)。
- 商家申请凌矩设备进店、控制可采时段、查看收益；个人采集员就近按任务/小时接单、查看QA有效率和改进、收益；凌矩负责城市运营。**Owner已确认此产品定位**，不是“采集团队接单”。
- 2026-11-08已建立17份专属知识/代码目录说明；实际代码和正式应用仍待开发，详细可验收演示版任务见[Issue #24](https://github.com/jinxi1036-maker68/jiqiren/issues/24)。

## 凌矩代理资源与场景协同平台（S2B 网站 · 2026-11-26 建立）

- [平台源码与快速启动](platform/README.md) · [变更记录](platform/CHANGELOG.md) · [开发Agent约束](platform/AGENTS.md) · [六大模块定版规范与深清查报告](knowledge/strategy/2026-11-26_AGENT_PLATFORM_V1_FINAL_SPEC_AND_FIRST_PRINCIPLES_AUDIT.md)。
- 定位为 S2B 资源集成中枢（上游合规任务分包 ＋ 个人 IP 30 秒免费场景备案双层池 `S1/S2` ＋ 认证小团队/代理承接 ＋ 首件 1–2h 绿灯熔断 ＋ 背靠背三方对账），采用零依赖 Node.js + SQLite 低内存架构；**已迭代至 `v1.2.0` 专业 SaaS 控制台并在本地完成端到端测试与三端浏览器验证；按 Owner 2026-11-26 晚决议，待后续继续完善优化（飞书提醒/改密重置/对账导出等）后再推进阿里云部署、ICP 备案与真实试行。**
