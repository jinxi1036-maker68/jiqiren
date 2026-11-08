# 2026-11-08 凌矩城市共享采集站｜演示版获Owner批准与Codex任务交接

**状态**：Owner明确批准“先让Codex做一个演示版”；仅限纯前端可点击样机、虚构数据，用于向灵生吴总展示概念。**不批准正式APP研发预算、外网部署、连接真实灵生设备/业务API/客户数据、人员实名或真实付款**。
**业务来源**：`knowledge/strategy/2026-11-08_LIVSYN_PINGDINGSHAN_CITY_STATION_CO_PILOT_V0_5.md`；门店提供授权场景和设备存取，社会兼职就近接单，凌矩担当平顶山市地面运营站长，上游设备/技术/QA支持尚未确认。

## 此次实际动作

1. GitHub正式研发需求 Issue **#24**：https://github.com/jinxi1036-maker68/jiqiren/issues/24 ，包含角色、任务闭环、移动端、纯演示数据、验收条件及不自动合并等要求。
2. 曾用GitHub工具尝试将 #24 指派给“codex”，但连接器结果未能证明Codex代理已启动或PR已生成；**不可宣称Codex正在开发/已完成**。需在GitHub Agents/Issue指派界面由Owner确认仓库已启用Codex agent并启动。
3. 为避免止于需求单，ChatGPT在本轮用独立容器实现了**单HTML纯前端可点击业务演示**；它不是Codex生成，也**尚未提交到GitHub项目代码分支**。该用户可下载的HTML演示包含三个角色、四个虚构任务、三个不同场景、四台虚构设备、任务预约/领机/模拟上传/归还/审核/结算、门店登记设备绑定、城市看板与异常工单。通过Node语法检查和Playwright无页面脚本错误的完整流程模拟测试。容器中的演示及截图属于会话生成文件，不能把临时沙盒路径当长期GitHub正式交付。
4. 全部任务、门店、设备和账款数据均为虚构；未调用客户接口，未与实际生产设备连接，不真实收款。后续若Codex有启动确认，应在独立分支提交可复核PR，测试后Owner决定是否合并。

## 后续启动Codex的最短路径

GitHub仓库 `jinxi1036-maker68/jiqiren` → Issue #24 → Assignees / Agents 中选择 Codex（前提是当前账号、仓库已启用 Codex coding agent）或在已发布的Codex Cloud environment中以#24内容发起任务。不能把Issue创建等同于Codex启动。

## 原则

- Owner希望沟通简短、一次只推进一个问题。先拿到可点击的演示，不把软件演示当作灵生已认可商业模式。
- 若灵生现有平台支持所需功能，优先复用，避免重复搭正式APP。若客户不认可数据或设备授权，无需继续建设该系统。
- 不改`CURRENT_WORK.json`主运营与`ECONOMICS_MODEL.json`价格；已批准的是“开发演示样机”这一具体小范围动作，并非V0.5商业试点本身。
