# 2026-10-25｜第三轮知识库审计：早期证据与核心导航一致性

> 检查对象为GitHub main当时可读取的核心文档、机器索引及已保存的早期报告。**不是整仓库递归逐文件审计，也未获取2026年9月全部原始对话和微信记录。** 不宣称已有真实合同签署、合格QA小时、回款或Hermes正式生产部署。

## 第一部分：最早期历史来源
- GitHub检索并通过fetch_commit复核4个早期提交：2026-10-09两项（培训前执行计划、行业判断）、2026-10-14两项（采集员工资与SOP可行性）。这些是本轮**可检索并确认的原始提交**，不等于已经穷尽仓库全部历史提交。
- 2026年9月至10月7日的业务起点目前主要依赖`HISTORY_AND_MILESTONES.md`的后期回顾，不具备本轮可独立检索到的同日原始聊天/签约资料；不能准确还原“第一天几点说了什么”。
- 10月8日淘丁、10月9日灵生、10月10日战略ADR与10月11日Excel，已在现有台账中有来源分类；Excel审阅严格区分9处线索/10名候选与正式签约或上岗。
- 细化时间链与缺档清单在[早期历史证据审计](../history/2026-09_TO_2026-10-15_EARLY_HISTORY_EVIDENCE_AUDIT.md)；10月16日至25日另见[已恢复决策链](../history/2026-10-16_TO_2026-10-25_RECOVERED_DECISION_TRAIL.md)。

## 第二部分：核心引用实际存在性核验

### A. 主要Markdown链接
以本轮读取的以下5个文件为范围，解析Markdown相对链接并规整路径：
1. `knowledge/00_START_HERE.md`
2. `knowledge/HISTORY_AND_MILESTONES.md`
3. `knowledge/HERMES_DIGITAL_EMPLOYEE_CHARTER.md`
4. `knowledge/history/2026-10-16_TO_2026-10-25_RECOVERED_DECISION_TRAIL.md`
5. `knowledge/10_UPDATE_PROTOCOL.md`

**23个去重后的不同文件目标均能用GitHub fetch_file在main中读取（23/23）。** 外部http链接不在本次检测范围内；非Markdown硬编码路径亦须看机器引用校验。

### B. 核心JSON机器引用
读取并解析：
1. `knowledge/PROJECT_INDEX.json`
2. `knowledge/CURRENT_WORK.json`
3. `knowledge/KNOWLEDGE_HARNESS.json`
4. `knowledge/EVIDENCE_INDEX.json`
5. `knowledge/SCENE_PIPELINE.json`
6. `knowledge/PEOPLE_PIPELINE.json`

提取JSON字符串中符合`knowledge/*.md|json|...`及`hermes/*`模式的文件路径并去重，**41个不同路径均成功读取（41/41）**。该提取方式没有枚举所有GitHub文件，也不覆盖不含上述前缀、被自由文本拆分、外部链接、所有非JSON业务文档中的路径，不应称“整个仓库零死链”。

### C. 发现的时效/语义风险
- `knowledge/08_ROADMAP.md`仍有“现在→2026-10-13”“2026-10-15左右试采”等历史规划时间。若新Agent把它当当日行动清单将导致误导；须标为原始计划快照，阶段扩张只能按实际QA及回款证据。
- `knowledge/01_NORTH_STAR.md`保留“10→20台”旧阶段路线，这体现战略当时目标，不等于2026-10-25批准自营扩至20/30/50台。长期方向“可迁移数据交付能力”仍有效。
- `knowledge/HISTORY_AND_MILESTONES.md`的10月24日段落曾称企业税务登录待重试，是**当日旧状态**；10月25日Owner已登录成功，后续项目索引已更正，历史应显式标记“已被后续状态取代”，而不是静默删除原始阶段记录。
- `knowledge/00_START_HERE.md`存在两组指向同一决策链、设备效率和远期场景的重复导航，可适度合并以遵守轻量知识路由。
- `knowledge/EVIDENCE_INDEX.json`中早期税务证据事件与较新的EV-TAX条目描述不同日期，需按事件时间阅读；旧表单pending≠目前无法企业登录。

## 第三部分：仍不能宣称完成的项目
- 尚未得到2026年9月至10月初所有原始会话，无法做逐句内容覆盖率统计；不能因此宣传“100%完整”。
- 尚未递归读取GitHub全部正文、每个未合并PR分支、README外的所有路径和所有源附件；主导航23/23、机器引用41/41只是本轮明确范围。
- 仍未核验原Hermes当前运行环境与灵生后台、合同和实际QA结算记录。
- GitHub目录合法存在不代表链接指向的是**最新正确证据**；Owner新回复和官方文件具有更高事实优先级。

## 下一次合理维护顺序
1. 当Owner能够提供9月早期聊天原始内容或明确关键日期时，再补来源；**未提供前保持UNKNOWN**。
2. 对新业务状态：优先`CURRENT_WORK.json`与`PROJECT_INDEX.json`，旧Roadmap仅作时点方案。
3. 对重大决策：历史文件保留被取代的观点及被谁何时取代；不能以模拟产量、计划回款或PR未合并工程成果当经营现实。
4. 当前公司的工作主线不变：先稳定灵生采集/正式验收/结算与回款；AI清洗标注暂缓。

## 本轮操作界限
本次只读审核并更新GitHub脱敏知识文档，不改生产环境、不下载/外发客户原始Ego视频、不合并PR、不启用自动开发或监控任务。
