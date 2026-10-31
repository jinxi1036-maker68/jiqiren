# 原Hermes浏览器效率首轮优化与配置阻断｜2026-10-31

## 当前结论

已完成并加载7份自有工具源码的效率增量，99项针对性检查、原CLI零模型探测和实际MCP通过；原网关空闲正常重载1次，飞书连接已恢复。**最终接收未通过：59项保护中原config.yaml发生未授权变化，58项仍一致。当前保护会拦截Owner任务，不能把通道connected表述为可以正常工作。** Codex未修改原配置、未接受新保护哈希、未强杀、未调用Hermes模型或试写真实业务。Owner明确回复没有改设置或让其他Agent改。

## 一、API限制和耗时

重新读取[Agnes当前官方说明](https://wiki.agnes-ai.com/zh-Hans/docs/tokenplan)与[FAQ](https://wiki.agnes-ai.com/en/docs/faqs)。当前enterprise/default RPM动态调整，以控制台为准；同类型Key共享池。历史20RPM不能证明当前Key实际权益。429可能涉及RPM或配额；本轮没有登录控制台、检查密钥值、请求模型或凭429推定用户套餐。

本轮此前正常网关记录25次物理请求，滚动60秒最高5次，403×1、429×11、200×13；这是一个进程，不是账号总使用。旧429未给Retry-After或数值限额，现有未知429兜底60秒会增加等待。未确认根因前保留服务端等待要求、并发1和兜底，不盲目提速重试。正常请求最小间隔0，本轮未新增总次数上限。

新增脱敏观测：规范Agnes模型名、消息/工具数量和请求字节；响应头、首批字节、流关闭时间。错误只保留白名单类别/代码；不保存prompt、凭据、生成正文、原始错误或请求ID。最多8KiB错误前缀仅在内存用于分类，SDK仍收到原始流。provider_reported_free_user_limit只是服务端陈述，不证明Owner真实套餐。首批响应字节不是首token，提前关闭流明确标为未完整迭代。尚无新模型工作样本，不能声称429解决或端到端提速已验证。

## 二、减少不必要的模型往返

保留原最多8动作短批次。当前授权上下文、工具描述和efficiency指南鼓励：现有信息充分时合并明确操作；需要新信息、遇到分支或核实保存结果时停下观察。目标和底线保持，不编写固定业务点击脚本。实际Agent能否少绕路仍待正常工作证据。

## 三、精简回读

动作默认返回完整页面snapshot及新refs，省去重复table_readback；需要时仍可显式tables/both。新增observation参数选择viewport或带当前root ref的subtree。局部root确实失效时仅补全页回读，不重放动作；用户接管/范围/权限错误不以fallback绕过。失败仍保留实际执行收据和全页状态，保存未知保持未知。

实际同页both11751字节、snapshot10601字节，减少9.8%，两次snapshot文本相同。这仅是一个工具结果样本，不是全任务速度提高9.8%。实际组件观察3次、1次不改页面的wait_text，无表单提交。局部回读/失效root回退/接管停止以实际worker本机合成协议验证，未拿真实业务表单试写。

## 四、复用实际工作经验

扩展现有company_task_notes.search，只在真实Owner轮次按同一路由查最多10条旧任务和经验片段、收据数量；再按id/range读全文。无Owner轮次实际拒绝，其他路由不返回；不新建记忆库、身份或数据库，不改MEMORY/USER。现有checkpoint可由Hermes自主记录方法与实际收据，经验不是当前事实、新权限或强制步骤。是否真正养成跨任务复用习惯尚未实测。

## 五、本轮配置异常：证据、推断和未证实

已证实：原config.yaml批准哈希5115085779f1ff574fab08def61549efaf733b5f00ba0401f9c247095694501f，当前054652022a71c4339cbc6a5120e7f85a35ae009785ec62253ce222a7a17c077a。仅两个语义字段不同：custom_providers[0].models.agnes-3.0-flash.context_length由524288变为缺失；voice.auto_tts由false变true。凭据字段未变，其他58项保护一致。批准前像+此前批准的单字段fallback变换仅在内存重建，SHA精确匹配原基线；没有整份恢复配置。

已证实的程序缺陷：I/hermes_cli/model_switch.py的_save_discovered_models_to_config，在models_discovered=true且模型列表/顺序变化时用每模型空字典重建目录，会丢掉手动context_length。本机两版都为discovered=true、模型数9，目录顺序确实变化。提取原函数AST，仅以内存模拟load/save回放，得到与当前完全一致的模型map；它不改变voice。**这是缺陷和状态特征吻合，不是历史调用者/写入进程已经取证。** 本地load_config读取路径本身没有此配置保存动作。

仅相关线索：Desktop会话两条用户记录为06:18:42/06:18:54UTC，首批Agent工具06:19:04；检查的工具参数没有config.yaml/auto_tts/context_length或config set。没有读取私人消息正文、私人记忆或完整system prompt。既有日志无该次配置写入PID/调用栈，无法证明语音由谁改，也不能因时间接近就认定Desktop自动保存是根因。

可审查的最小候选修复：原函数构建目录时，保留仍存在模型的旧字典元数据；仅新模型用空字典，例如：

```python
entry["models"] = {
    model_id: (dict(existing[model_id])
        if isinstance(existing, dict) and isinstance(existing.get(model_id), dict)
        else {})
    for model_id in model_ids
}
```

该候选仅在内存验证能保留524288且不改变voice，**未写入原Hermes源码或配置**。它不能证明解决所有配置并发写入问题。下一步需明确批准此原程序单函数修改、恢复已批准的一个上下文字段，以及voice当前true是否作为期望状态；不可只接受整个新哈希或恢复整份旧配置。语音来源继续标未知，不做凭猜测修复。

## 验证、文件与恢复

53 Python+46 Node=99项不同检查通过。首次本地检查发现旧简化Pacer缺可选遥测方法，兼容修正后完整相关套件通过；误写测试模块名亦纠正，不算Hermes故障。另有原安装函数内存复现与候选保留元数据验证，不混称线上修复通过。实际MCP12工具/新Schema/原H-W/company-business/原保护扩展通过，关闭无lease。READY时间与各通道状态见配套JSON；主通道连接不代表保护检查通过，旧wecom_callback异常独立保留。

本轮写入7自有源码及其runtime/gate/私有交接，10份必要前像仅本机私有保留；无回退。部署前59项一致，收尾时仅config.yaml变化，原保护基线没有更新。SOUL/HERMES/MEMORY/USER、R3/Manifest、原配置/模型/凭据/MCP/QQ语音/cron/旧profile均未由Codex写入；仅检查有争议配置的两个字段，未输出凭据。原Desktop会话是Owner正常使用，不能计为Codex新测试。

恢复仅针对本轮7源码/runtime/gate/交接，在空闲且写后SHA匹配时逐文件恢复；并发变化则停止，不整份覆盖工作区、配置或业务记录。配置问题未解决前不执行额外网关重载，不偷偷更新保护或派发模型任务。

下一步先批准并处理定点上下文保存缺陷与两个配置字段期望，再做零模型保护核验、必要的一次空闲加载。之后从正常Owner工作收据观察批次、回读和时延，不新增逐项模型验收。当前企业真实RPM、账号共享池、429原因及整体速度收益仍未知。

证据：[browser-efficiency-2026-10-31.json](../evidence/browser-efficiency-2026-10-31.json)。
