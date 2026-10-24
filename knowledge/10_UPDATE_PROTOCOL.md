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

## Hermes数字员工：最新Owner理念与历史更新规则（2026-10-16）

Hermes任务必须先读`knowledge/HERMES_DIGITAL_EMPLOYEE_CHARTER.md`；它是岗位发展的当前权威。长期方向为：**唯一原Hermes员工身份、自主目标管理、底线稳定、当前业务优先、未来按Owner需要逐步扩展**。旧的“另建管理系统”“多正式profile并行”“僵化逐步脚本”的提案标记`SUPERSEDED`，不能以较早PR的技术方案覆盖Owner最新决定。

每次Owner调整定位：先更新唯一岗位宪章→`PROJECT_INDEX.json`及`CURRENT_WORK.json`相关并行开发状态→写一条新的ADR（旧ADR不删除）→追加`knowledge/history/HERMES_PRODUCT_EVOLUTION_2026-10-16.md`（或其续篇）→把对应执行要求/身份模板/Skill/代码写`hermes/`→在PR/Issue记录测试与结果。**讨论决定≠本机已部署，模拟通过≠真实后台已验收。**

清理无关私人记忆不应抹掉本项目合法的GitHub设计历史；GitHub的历史也不应泄漏旧记忆原文、真实员工数据和凭据。对于Owner希望“自主工作”的要求，应验收结果和授权边界，不把正常员工思考限定为唯一操作顺序。

## 2026-10-24 Owner新增要求：每项实际进度的持续记录

- 本项目每次重要对话、Owner新决定、客户书面回复、工商税务操作、人员/场地/设备变化、真实试采与审核、付款及退款、数字员工训练/部署，都需要在该次**有仓库访问权限**的工作中同步记录。
- 每条记录包含：日期、来源与可信度、上一状态、新发现、用户决定、实际做过的操作、结果和证据、风险/增效机会、下一步；保留失败及纠正经过，不把推测升级为确认。
- 更新顺序：机器事实与当前工作→专题进度→风险/证据→阶段性历史/决策；避免仅追加聊天流水导致索引过期。
- 税务特殊约束：核验金额单位、税种、纳税人资格和正式受理结果；以合规、减少总税费和净利润为共同目标；不建议非法逃税、凭空开票或挂名享受优惠。
- 交互方式：一轮只推进一个实际办事步骤，对上游一次只问一个简短明确的问题。
- **此协议是后续协作规则，不代表GitHub可自动监听未来的会话。** 没有连接/写权限时，应明确提示未同步，并提供待入库记录。
