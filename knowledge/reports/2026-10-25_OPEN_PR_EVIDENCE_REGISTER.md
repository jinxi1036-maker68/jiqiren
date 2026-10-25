# 截至2026-10-25｜GitHub PR分支成果逐项归档台账

> 按GitHub实时PR元信息及PR描述检查。此文件是**分支资料目录**，不能替代每个PR的源代码、安全审核、Owner验收或对原电脑的现场复查。只保留链接、报告与证据门槛；**本轮不合并、关闭或切换任何PR**。

| PR | 主题 | 状态（核查时） | 整理去向与后续边界 |
|---|---|---|---|
| [#2](https://github.com/jinxi1036-maker68/jiqiren/pull/2) | 采购Excel补图 | 开放、未合并 | 分支成品待Owner离线验收；不因提交PR就宣布实物图已在main |
| [#4](https://github.com/jinxi1036-maker68/jiqiren/pull/4) | Hermes Phase01能力审计 | 已合并 | 已合并main；局部隔离浏览器测试≠灵生正式后台 |
| [#6](https://github.com/jinxi1036-maker68/jiqiren/pull/6) | Hermes隔离测试身份 | 开放、未合并 | 保留实验历史；长期双profile方案已被Owner否决，择证据而不整包按旧架构合并 |
| [#8](https://github.com/jinxi1036-maker68/jiqiren/pull/8) | Hermes模拟异常整改与CLI | 开放、未合并 | 依赖PR#6，Gate A合成测试证据可参考，不能当真实运营 |
| [#10](https://github.com/jinxi1036-maker68/jiqiren/pull/10) | 原Hermes单员工迁移方案 | 开放、未合并 | Gate0文档，未自动实施清理；需Owner确认实际删改范围 |
| [#11](https://github.com/jinxi1036-maker68/jiqiren/pull/11) | 原身份无损准备与SDK解耦 | 开放、未合并 | 仅候选配置与小范围验证，勿以PR说明认为本机已完成所有迁移 |
| [#12](https://github.com/jinxi1036-maker68/jiqiren/pull/12) | 原Hermes最小文件接入 | 开放、未合并 | PR报告称部分本机已应用，但当时Desktop验证受阻；需重新核实实际机器 |
| [#13](https://github.com/jinxi1036-maker68/jiqiren/pull/13) | 公司档案、Logo调研、现场日报 | 开放、未合并 | 公司已有2026-10-19执照等更新，旧档案license=false已失效；有用历史择要摘录 |
| [#14](https://github.com/jinxi1036-maker68/jiqiren/pull/14) | 原Hermes桌面验收受阻报告 | 开放、未合并 | 保留工具阻塞与Owner手动验收指令；不是正式生产验收 |
| [#15](https://github.com/jinxi1036-maker68/jiqiren/pull/15) | 原Desktop合成任务只读证据 | 开放、未合并 | 13次合成浏览器动作可追溯，仍有cwd和503表述问题；非真实灵生 |
| [#16](https://github.com/jinxi1036-maker68/jiqiren/pull/16) | cwd加载与503培训提案 | 开放、未合并 | 尚未执行具体修复，不能当故障已解 |
| [#17](https://github.com/jinxi1036-maker68/jiqiren/pull/17) | 录制效率、人员薪酬、经营路线 | 开放、未合并 | 10月17/18若干ADR已被10月24/25新口径部分取代；main仅脱敏历史补档 |
| [#18](https://github.com/jinxi1036-maker68/jiqiren/pull/18) | 凌矩知识整合与R3发布计划 | 开放、未合并 | 属于待批准部署预案；分支旧机器索引不能覆盖main新财税事实 |
| [#19](https://github.com/jinxi1036-maker68/jiqiren/pull/19) | Hermes轻量化理念、晨报/浏览器暂停、真实加工构想 | 开放、未合并 | Owner已认可的理念和未来构想可脱敏摘录到main；完整PR仍待单独审查 |
| [#20](https://github.com/jinxi1036-maker68/jiqiren/pull/20) | 原Hermes浏览器与QQ本机探索 | 开放、未合并 | 分支报告有临时QQ修复和模拟闭环，也有未通过项目；不得当真实灵生上线或已启用晨报 |

## 建议的处理顺序

1. **当下只补业务知识，不启动技术部署**：PR#13/#17/#18/#19的历史事实已经按source-labeled摘要分类归档；其完整未审变化继续留在开放分支，不将PR中的旧CURRENT_WORK/PROJECT_INDEX直接覆写main。
2. Hermes唯一正式身份与自主目标管理优先遵守main唯一宪章；对PR#10～#16/#20按“源证据—当次本机操作—当前机器状态”三层核查。PR说明中称“已应用”只代表那次留下的运行证据，不保证当下配置状态。
3. PR#19 Owner已批准的“尽量少写代码”是开发理念，可以独立整理Owner ADR、修改唯一岗位宪章；PR#19本体仍不因此自动通过合并审查。
4. PR#2的Excel待Owner实际下载/离线图片验证再决定合并；任何未经确认的法律/财税/用工安排不以Git分支替代正式材料。
5. 后续如确需合并PR：检查base/依赖、合并冲突、重复文件和可能覆盖2026-10-25 main的最新财税、主线和Owner决策；提案与生产实施须分开批准。

## 现阶段未被证明的目标
- 没有真实灵生正式后台的完整账号/权限学习、自动派单、QA跨日稳定巡检和已验收生产成果证明。
- 不能由PR#20中本机临时QQ会话服务、一次未认证GET200或模拟数据推断“真实复杂浏览器业务已上线”。
- 未检查每一份源码diff、Owner私有聊天原文和本地电脑当前状态；此台账是**逐PR证据与分类盘点，不是代码完整审计**。
