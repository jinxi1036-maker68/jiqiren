# Hermes最新知识整合与增量部署预案

2026-10-18｜状态：GitHub独立分支整合候选，待Owner与ChatGPT审查。**未部署原Hermes，未合并任何PR，未新增Hermes模型调用，未访问真实灵生。**

本版R3只回应[ChatGPT Review 5561385807](https://github.com/jinxi1036-maker68/jiqiren/pull/18#pullrequestreview-5561385807)的部署状态时效问题：CURRENT_WORK、PROJECT_INDEX及OPERATING_BRIEF不再以静态知识断言“当前未部署”。静态制品标识为`LINGJU-KNOWLEDGE-2026-10-18-R3`，生成背景带日期保留；实际部署以本机manifest及匹配的Owner授权部署核验记录为准，证据缺失或矛盾只能标未核实，不能自动推定已部署或未部署。32份源内容/manifest匹配只证明磁盘版本，不证明模型读取或权限。此规则也写入候选manifest及部署验收要求；未来完成记录放在Owner本机核验资料中，不额外计入35个W文件。本轮没有产生实际部署完成回执。

上一版R2已补录10月17日Owner报告的3人、18小时实际原始采集、人均6小时、可用10台异常0台及效率/上传问题；10月16日计划独立保留，上传完成、QA、结算/到账及日报发送仍未知。该业务事实和32源版本核对已获上述Review认可，本轮业务事实、团队/雇佣安排及岗位宪章全部保持不变。

## 1. 已完成的GitHub整合

基线main `053b5b4cd2476fdf6df68e2c924a6b1c7d28e080`；PR13 `0cbb692e3029b1e19662c62b0f7598ce2525f49e`；PR17 `ec612fbefe07dc71215d1f1f9b6162b2f15f465c`。整合后的知识内容固定在提交 **`812c9728c4a39e3451518392eb819c40efe334a5`**。本预案与后续报告提交不改变该提交的知识字节；未来只从这个固定提交取32份白名单源文件，不能用移动分支或目录全覆盖替代。

`CURRENT_WORK.json`、`PARTNER_LEDGER.json`、`PROJECT_INDEX.json`按三方字段合并；伙伴数组按id匹配，不靠数组位置。详见[逐字段来源与处理](FIELD_MERGE_LEDGER.json)、[固定源版本](SOURCE_BASIS.json)。保留其他伙伴与原唯一工作项；保留所有旧历史文件和源PR提交历史。旧50台模型保留为已被取代的历史，未删除。

32份拟缓存知识包含原18份、来自两PR的新主题/公司/日报/现行ADR、必要的原薪酬讨论和经营摘要。不是全仓镜像；品牌研究作为公司档案的既有引用保留，不授权设计Logo。GitHub候选不等于已纳入main或已被Hermes获取。

## 2. 共享字段冲突及处理

|冲突或缺口|采用方式|
|---|---|
|PR17缺PR13公司身份、场景/试采更新|保留PR13 company_identity、owner_reported_operational_update及3台历史计划，不因10月17日已过去推定已试采|
|PR13阶段信息与PR17旧phase并存|保留三场景/内测进度和10月16日计划历史；补录17日Owner报告3人、18原始小时、人均6小时、可用10台异常0台。上传完成、QA、结算/到账及日报发送仍未知|
|PR13日报四部分、PR17文字格式与历史引用|保留reporting_and_pilot和daily_reporting_requirement两组来源；明确文字消息，统一指向四部分结构化规范；CSV仅内部参考，不假称客户要Excel|
|PR17仍有早期独立B2B/队长经营余额措辞|入口、当前索引与经济模型适用说明按九位队长拟由凌矩直接签约、发薪、参保限定；其他人员与费用对象未定，旧独立经营演算不直接套用|
|10台、100台与旧50台|自营10台是最新Owner决定；每队10台、附近约100台是未来阶段规划；100是否包含自营10台保留null。50台只作历史|
|日期、工作项与技术状态|记录日期取较新，事件日期原样保留；work_item_id不变。Gate1A部分验收与知识版本分开；实际知识部署只依据本机manifest及授权部署核验记录，不从静态版本推定，不倒写全项通过或Gate2授权|

## 3. 仍需Owner/外部证据确认

- 约100台是否包含自营10台。17日Owner报告的可用10台异常0台、3人原始18小时已补录；独立设备盘点、其他日期实际数据、当日上传完成、平台QA、结算/回款及日报是否发送仍待证，不否定已取得的Owner报告。
- 九位队长具体工资及其他采集员用工主体、是否已实际签约/参保；30元/有效小时付给谁、25元设备费是否真实对外交易。
- 上游分包、设备转租/转借、第三方场景/数据处理、正式订单合同与结算、合作团队合同均不能标完成。
- 日报渠道/收件人/截止、人效及有效小时口径、T+1/T+3起点与自然/工作日规则仍未知；T+1/T+3不是付款日。
- 薪酬与税务旧材料只是带日期的来源和条件模型，本轮未复核法条时效/适用资格，不产生工资、收入或税收优惠承诺。

## 4. 唯一员工理念与保留对象

岗位宪章Git blob仍为`9471c5894e323461957e56f5594001207d4c1292`，与main逐字节一致；唯一员工ADR和原演变历史也保留原样。只给同一员工更新业务知识，不重建身份、不限制它采用合理工作方法。

W/HERMES.md必须保持SHA256 `0ae46293b8773631ceb3acf0da4a44ae6d361860e44c95926ccf322185374247`；H/SOUL.md保持既有岗位版本。MEMORY、USER、模型/凭据、浏览器/MCP权限、QQ/语音、任务与正常服务全部在写入白名单之外。voice关闭及企业微信错误见[部署清单独立待核项](DEPLOYMENT_PLAN.json)，不在本轮修复，也不把渠道错误当模型故障。

## 5. 明确的增量清单和计数

**9份更新、14份新增、9份源文件不写入**。源文件18→32；HERMES、GATE状态、manifest仍是3份部署文件；最终总数21→35。以下短哈希供扫读，**每一份文件的完整前后SHA256、固定GitHub URL、Git blob、目标和回退条件以[DEPLOYMENT_PLAN.json](DEPLOYMENT_PLAN.json)为准**。

|文件（均为W下相对路径）|动作|原SHA256前12位|新SHA256前12位|
|---|---|---|---|
|AGENTS.md|更新|be80d5445742|1052fe315983|
|hermes/AGENTS.md|不写入|943366142e85|943366142e85|
|hermes/identity/ROLE_BRIEF.md|不写入|9eecd961bd75|9eecd961bd75|
|knowledge/00_START_HERE.md|更新|94eff41af85e|0fec09160121|
|knowledge/01_NORTH_STAR.md|更新|b7f38a645113|eccfae63e33d|
|knowledge/04_SCENE_STRATEGY.md|不写入|acbdc3128fd7|acbdc3128fd7|
|knowledge/05_PEOPLE_TRAINING_AND_QA.md|更新|ec535f492f2c|7d59acddc50a|
|knowledge/07_RISK_COMPLIANCE_AND_CONTRACT.md|不写入|47456b3e2708|47456b3e2708|
|knowledge/10_UPDATE_PROTOCOL.md|新增|必须不存在|8feb4f4d14c8|
|knowledge/22_COLLECTION_WORKER_RECRUITMENT_PAY_DESIGN_2026-10-14.md|新增|必须不存在|cb166fa89e76|
|knowledge/26_LIVSYN_CONTROLLED_SCENES_TRIAL_PROGRESS_2026-10-15.md|更新|3d6d9204d8b3|69b296beda5f|
|knowledge/27_LIVSYN_RECORDING_EFFICIENCY_AND_DEVICE_REMINDERS_2026-10-17.md|新增|必须不存在|b44a557d05e7|
|knowledge/27_LIVSYN_THREE_SCENES_READY_AND_DAILY_REPORT_2026-10-16.md|新增|必须不存在|e46f43cc4474|
|knowledge/28_FIRST_WEEK_3_TO_10_DEVICE_CAPACITY_AND_MARGIN_2026-10-17.md|新增|必须不存在|4d21af25af6b|
|knowledge/28_LINGJU_BRAND_IDENTITY_RESEARCH_2026-10-16.md|新增|必须不存在|9c042713d2f7|
|knowledge/29_FIFTY_DEVICES_TEAM_LEADER_SCALE_THRESHOLD_2026-10-17.md|新增|必须不存在|5b2c2fceaee6|
|knowledge/COMPANY_PROFILE.json|新增|必须不存在|b8babbbca13e|
|knowledge/CURRENT_WORK.json|更新|a12cd29b3c51|6a5b8eb4d6ce|
|knowledge/ECONOMICS_MODEL.json|新增|必须不存在|d3e2548f0b21|
|knowledge/FRESHNESS_PROTOCOL.md|不写入|2862d7c4e53a|2862d7c4e53a|
|knowledge/HERMES_DIGITAL_EMPLOYEE_CHARTER.md|不写入|9b907998b296|9b907998b296|
|knowledge/KNOWLEDGE_HARNESS.json|不写入|4767797b3829|4767797b3829|
|knowledge/LIVSYN_PINGDINGSHAN_DAILY_REPORT_REQUIREMENTS_2026-10-16.json|新增|必须不存在|3695ba99fd7d|
|knowledge/OPERATING_BRIEF_2026-10-18.md|新增|必须不存在|4a0b510d73b1|
|knowledge/PARTNER_LEDGER.json|更新|fd9a5615656c|f7cda4ff7433|
|knowledge/PROJECT_INDEX.json|更新|72cbf0194219|dfef8e253297|
|knowledge/SCENE_PIPELINE.json|更新|2c0f8353b738|83439eb79b8e|
|knowledge/decisions/ADR-HERMES-SINGLE-EMPLOYEE-2026-10-16.md|不写入|117317f8f2ab|117317f8f2ab|
|knowledge/decisions/ADR-LOCAL_100_DEVICE_NETWORK_AND_TAX_CHECK_2026-10-18.md|新增|必须不存在|1bdbda35eadf|
|knowledge/decisions/ADR-SELF_OPERATED_10_CAP_10_DEVICE_PARTNER_TEAMS_2026-10-18.md|新增|必须不存在|8a9a4a5cab8c|
|knowledge/decisions/ADR-SELF_OPERATED_50_CAP_PARTNER_NETWORK_2026-10-17.md|新增|必须不存在|73b005044f4d|
|knowledge/history/HERMES_PRODUCT_EVOLUTION_2026-10-16.md|不写入|a833ece42c19|a833ece42c19|

manifest单独更新：旧SHA256 `8b4783d361b71cfe2b61c7b9949b57dbc11deeefa45f43fb31c8397159d7cf6e`，新SHA256 `db4b44b0f75b2ced679183aa6fb7f3eca37e6dd56942a0af0361b8297c1cc70c`；候选为[SNAPSHOT_MANIFEST.candidate.json](SNAPSHOT_MANIFEST.candidate.json)，只在全部源文件验好后替换。其ref固定为上述知识提交，区分32源与35总数，不把manifest列入自己的源列表形成循环hash。

本机GATE状态只提出可选字段补丁：[GATE_1A_STATUS.proposed_patch.json](GATE_1A_STATUS.proposed_patch.json)。旧SHA256 `b2a38d9d66ebce7442ff3ce3711d36fcae06f213cc726c34340f0ae911a48609`，按指定序列化方式应用后的预期SHA256 `eed206fbebc93c24c7ecb783bdb10c3cce1376a67231d7123a6e7a15c5f470a8`。保留所有未提及字段及私人home值，不把完整本机JSON上传；旧kernel故障移为历史，Gate1A仍部分验收。用带范围的1条Owner消息/4 API轮次替代无定义的model_dialogues_used=0占位，**没有新增或重置模型额度**。此补丁未应用，可独立否决而不改变35文件总数。

## 6. 安全部署、恢复和批准事项

本候选已具备固定来源与逐文件哈希，**仅准备好供审查，不表示已获本机写入授权**。将来执行前重新比对所有before哈希；新增项必须不存在；任何并发变化、未知文件或路径越出W均停止。只在实际部署授权后保存批准更新文件的私有前像，不做新全量备份；本轮没有制作原环境备份。

单文件出错先停止：旧文件仅在当前等于本清单after、前像等于before时恢复；新文件仅在路径明确位于W且当前等于after时，经明确回退授权逐个移除，不能递归清目录。恢复源文件集后再恢复匹配manifest，状态补丁独立回退；不触碰记忆和配置。细则在DEPLOYMENT_PLAN.json。

需要Owner具体批准：①清单中的23个源文件写入；②一个manifest更新；③是否另批一个GATE状态字段补丁；④这批文件必要的私有前像与受保护单文件回退。**SOUL/HERMES/记忆/配置/工具权限、模型消息、真实网站、旧profile清理与PR合并均不在本次批准对象内。**

## 7. 验证和停止

离线验证检查JSON/必需字段类型与语义、唯一工作项、PR13/17关键字段保留、伙伴id、计划与实际null边界、历史50台状态、宪章字节、32份payload哈希及相对引用。验证结果另见VALIDATION_RESULT.json。GitHub存在但未缓存W的旧按需引用单独列出；这不是整库缓存或本地所有引用已齐全的声明。

本轮执行结果（2026-10-18）：**GitHub R3制品已准备；本轮未执行本机部署或制作完成回执；Hermes实际获取R3未验证**。未来实际部署状态以本机manifest及匹配授权核验记录判定，不以此历史交付报告代替。新增静态语义验证检查三份知识的部署证据权威一致、缺证为未核实以及旧的当前未部署断言已移除。本轮不通过新增模型消息补证，不修改原W/GATE状态，不合并任何PR。更新原Draft PR后停止，等待Owner与ChatGPT审查。
