# Knowledge Update Protocol｜RDKH-001

## 动态权威
- `PROJECT_INDEX.json`：项目当前阶段和路由
- `CURRENT_WORK.json`：当前唯一工作项
- `PARTNER_LEDGER.json`：上游关系
- `SCENE_PIPELINE.json`：场景管道
- `PEOPLE_PIPELINE.json`：人员管道
- `ECONOMICS_MODEL.json`：经营参数
- `EVIDENCE_INDEX.json`：证据索引

Markdown 负责稳定方法和解释，不和 JSON 建第二套动态事实。

## 每次有新进展时
1. 判断是 Current、Evidence、Decision、History 还是 Assumption。
2. 先更新机器事实。
3. 重要经营决定写 decision。
4. 阶段完成再写 History。
5. 旧事实失效时标记 superseded，不静默覆盖原因。

## 进入正式合同后
微信口头条件应升级：
`conversation_confirmed → confirmed`

若合同与微信不同：
以合同为准，并在 Evidence/History 记录差异。

## 扩张前
任何10→20→50台变化，都必须先更新：
- 真实产能
- 通过率
- 综合成本
- 现金占用
- 结算证据

## 隐私
不在仓库保存私人手机号、身份证、银行卡、学生信息、个人住址。
