# 机器人数据采集 Project Knowledge｜唯一入口

> 聊天记忆不是权威；旧截图不是当前事实；口头条件在写进正式协议前都只是“待合同确认”。

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
