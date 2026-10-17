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

## Owner最新要求：每次具体议题讨论后及时同步知识库（2026-10-17）

Owner明确要求：每次和ChatGPT/Codex等讨论了具体问题、约束、取舍、可行方案或新增事实后，**不能只停留在聊天记录或口头“记住”**。在本轮能操作仓库时，按现有Knowledge Harness路线及时提出可追踪的知识库变更；若当前无GitHub/文件写入权限，必须明确告知“未入库”，提供可交给本机Codex执行的待写入内容，不能声称已保存。

执行要求：
1. **识别和分类**：Owner最新明确决定、现场观察、客户已确认条件、技术假说、模拟计算、未解决问题及已否决方案分别标注，保留来源、时间、状态及最新权威边界。新讨论不是正式合同或对方批准。
2. **更新最小正确位置**：先核对`knowledge/PROJECT_INDEX.json`与`knowledge/CURRENT_WORK.json`，把当前工作新事实/待办写机器索引；稳定方法和讨论过程用主题知识文件；重要Owner定位/授权变动按原规则更新ADR、历史和Hermes有关文件。不要为了简单讨论反复建立第二套动态事实或改动Hermes本机配置。
3. **留痕与复核**：在GitHub分支/PR记录增量、验证JSON/链接/原文、写清哪些已实施、哪些仅建议；未经审核合并的PR仍是**待纳入main**，不得宣称已成为main当前权威，也不应覆盖其他开放PR中的Owner最新事实。
4. **回到业务**：涉及灵生客户反馈、视频采集SOP、设备与人工工资时，以正式订单/验收规范/书面合同为上位依据；未获认可的自动切片、员工报酬或设备固件升级不得执行。对外沟通后按回答更新状态，完成后再考虑开发。
5. **跨窗口接力**：新ChatGPT/Codex应优先加载入口、当前机器索引和主题文件，而非单靠聊天记忆；更新后报告实际提交位置和是否合并。知识库不含任何私人记忆、凭据、员工身份或真实视频。
