# 剩余验收的只读取证源码

本目录只保存本轮实际使用的两个取证脚本，不是新员工、启动器、业务系统或替代 Desktop 的控制通道。

- inspect_session_metadata.py：用 SQLite mode=ro/query_only，最多各取一条 Desktop 会话元数据（按 started_at / id），不读 messages、提示正文、model_config 或凭据，不作 DML/修复。历史元数据不能证明前台会话和实际新岗位上下文。
- collect_findings.py：从已明确的本轮私有输入和继承哈希中导出白名单证据；只对6个原目标作哈希，提取3个指定开发日志的少数匹配行并生成摘要，不上传原日志/堆栈/私人正文。

这是 Owner 本机原工作区的源码快照。运行依赖本机既有的 hermes_issue09_gate1a_acceptance/private、前轮私有交接布局及明确日志路径；这些输入不会公开，不是对任意电脑可直接运行的通用工具。不要为了复核重复运行旧审计/备份/SDK/浏览器矩阵。

本轮只有语法、JSON、相对引用及脱敏发布检查；没有新模型/浏览器组件测试，也没有使用这些脚本发 Desktop 请求。原Desktop人工目标与停止条件见[手动步骤](../../tasks/gate1a_remaining/OWNER_DESKTOP_STEPS.md)。
