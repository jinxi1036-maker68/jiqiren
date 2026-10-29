# 原Hermes 512K上下文与压缩设置调整

2026-10-29（Asia/Shanghai）。Owner在得知官方规格与本机读取位置问题后明确指示“按照你的建议继续”。已配置、原读取函数零模型验证通过，原飞书网关一次空闲重载取得实际READY；未发送模型任务或长提示压力测试。详见同名JSON。

## 实际变化

仅修改原`H/config.yaml`两个YAML节点，按源码位置做文本编辑，保留其他内容、注释、换行、凭据和配置语义，不整份重序列化：

| 位置 | 原值 | 新值 |
| --- | --- | --- |
| custom_providers中Agnes.ai → models → agnes-3.0-flash → context_length | 空/未指定 | 524288（512K） |
| compression.threshold | 0.24 | 0.50 |

全局model.context_length继续未指定，provider层历史1,048,576继续保留，其他模型不新增context pin。原源码的get_custom_provider_context_length读取每个模型的字段，不使用provider层历史值作为这次明确模型覆盖。模型仍agnes-3.0-flash，供应商仍custom:Agnes.ai；输出上限32,000及压缩目标比例0.20不改。没有改变记忆、身份、凭据、模型地址或工具权限。

选择50%沿用原Hermes的通用默认比例，减少过早压缩并保留余量；不是要求模型装满整个窗口。原配置读取函数实测解析524,288，原静态压缩计算函数得出输入预算492,288、常规压缩阈值246,144 tokens；没有模型特定压缩覆盖或绝对threshold_tokens cap。运行时辅助模型可行性、恢复过程及实际用量仍可能调整触发，不能把此计算当作每次都在同一数字压缩的实测。

## 规格依据与限制

- 当前[官方API文档](https://wiki.agnes-ai.com/en/docs/agnes-30-flash)注明此模型512K上下文、65,536最大输出。
- [官方模型卡](https://huggingface.co/Agnes-AI/Agnes-3.0-Flash/blob/main/README.md)区分262,144的开放Preview与新版生产API 1M。两份官方资料不一致，本次采用面向实际API端点的512K值，不承诺Owner企业Key已获1M。
- 这次原配置读取/计算与启动检查通过，不等于企业Key已经实际接受512K长请求。没有发送合成大提示或模型消息，服务端容量、已有Desktop/飞书会话的生效值及质量/延迟变化仍未实测。
- 长期记忆的997/417字符与上下文窗口不是同一参数；这次没有扩写或覆盖两份记忆。

## 保护、恢复与权限异常

保存3份必要私有前像：原config.yaml及本次改变的自有gate/交接元数据，位于已验证私有恢复根的本次目录，路径和用户+SYSTEM私有ACL核对通过。原配置全文/凭据/恢复文件不入GitHub。原59项保护基线留存，派生基线只改变config.yaml预期SHA，其他58项逐项相同，包括刚整理的MEMORY/USER；gate仅改protected_baseline_sha256，启动采用派生路径。6份旧封存账本一致，浏览器源码/runtime及MCP登记不变。

**如实记录一次实施异常**：从私有恢复目录移动候选配置后，SHA已经正确，但权限检查失败。候选带入了私有目录的继承ACE，未自动重新计算目标父目录继承；后续步骤当时停止。随后只对config.yaml重新应用既有父目录继承，实际DACL与同目录现存文件的继承策略匹配；父目录和其他文件ACL未写，内容SHA未再变化。初始SDDL未持久化，因此不能声称已证明与修改前SDDL逐字一致。这是本轮替换方法引入并纠正的问题，不归因模型商或原Hermes故障。

没有进行配置内容回退；原内容前像和新SHA均可核对。需要恢复时仅当当前文件仍匹配本轮输出且无并发修改，才单文件恢复并同步保护引用；不能整份恢复H/W、接受所有新哈希或覆盖Owner后续修改。

## 原入口恢复与零模型结果

确认原网关空闲后正常planned-stop，旧venv启动器/原生子进程退出，无强杀。只启动一次原生入口，短轮询尚未READY时继续等待同一进程，实际随后发出original_feishu_browser_ready；未因等待到期再重启。

实际进程仍为原Python/正式身份、原H、公司W，8项Ego工具，飞书/QQ/微信/企业微信显示connected。既有企业微信回调在disconnected/retrying之间变化，本次最终记录为disconnected，未修；连接状态不是新发消息往返证明。没有重启Desktop、OpenClaw或其他无关服务。

本轮Hermes模型消息/请求0，原日常账本64→64、未armed，业务平台动作0。原读取函数和压缩静态函数、原CLI探测、59项派生保护、精确两字段语义差异、JSON/引用和无关经营字段不变核对通过。原岗位宪章、自主方法、SOUL/HERMES、两份记忆、R3/Manifest、模型/凭据/MCP/QQ语音/cron/profiles保持；不把配置成功说成模型推理或浏览器准确性已经提升。
