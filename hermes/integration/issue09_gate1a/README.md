# Gate 1A 最小原身份接入组件

见[本轮报告](../../reports/ISSUE_09_GATE_1A_MINIMAL_ORIGINAL_INTEGRATION.md)、[精确变更](../../evidence/issue09_gate1a/EXACT_CHANGES.json)与[验证记录](../../evidence/issue09_gate1a/VALIDATION.json)。这里是本次受授权维护的源码快照，不是第二个用户入口或通用一键迁移产品。Owner 日常入口仍是原 Hermes Desktop。

## 部署边界

- SOUL.md 是 PR #11 固定版本批准草案原字节；HERMES.md 是 W 的知识入口。
- 原 H 新增 tools/company-browser-sdk（SDK1.30.0/93包闭包）和 tools/company-browser-simulation。vendor 源码不入库，版本/许可证/内容摘要在 SDK_DEPENDENCY_LOCK.json。
- 原 MCP 绑定使用原 Python `-I -B launch_bridge.py template.json`。template 只含已有 Node、Playwright MCP、Edge、原 H、W、中性 SDK anchor 和 guard 路径；精确脱敏字段见 EXACT_CHANGES。
- TEMPLATE.redacted.json / GATE_1A_STATUS.redacted.json 保存本次非敏感配置内容；H/D/I 是报告中的路径别名，不是可以直接执行的路径。
- launch_bridge 每次启动合成 server、随机 loopback 端口和四工具 bridge；stdin EOF 结束 invocation，Windows Job 回收其子树。浏览器 isolated/headless，不使用原真实登录资料。
- 没有模型、调度、通知、账号授权或后台任务代码。URL/页面 guard 是模拟限制，不可拿来当生产只读方案。

## 源码与测试如何复核

browser_bridge/sdk_resolver/navigation_policy/loopback_guard 继承 PR #11；owned_job 和合成页面继承 PR #8，修改限于中性启动、可发现模拟 URL、明确 stdout 和 EOF 回收。测试以实际 MCP 的 target 参数和 browser_snapshot 内联 DOM 为依据。没有要求 Hermes 的思考/操作走固定路线。

test_component.mjs 是**脚本探针**：显式选择既有 Python 和某个已准备 template，验证真实浏览器 DOM、503、拒绝与退出；不要将它写作 Agent 自主验收。verify_native_loading.py 只调用安装源码的加载函数，没有 Desktop、新会话或模型。原入口目标验收仍受阻，0/3 对话。

gate1a.py 和 build_publication.py 是本轮维护操作/脱敏导出源码，依赖 Owner 本机私有交接布局（private inputs、固定版本源、PR #11 neutral-sdk/dependency graph、PR #6 encrypted_backup.py 的 DPAPI 实现），这些输入/恢复包不会入库。它们不是可对任意电脑直接运行的安装器，也不会在日常 Hermes 中自动执行。preflight/protect/stage/deploy 是已执行步骤，check-rollback 为只读，rollback 必须单独显式调用；保护版本/哈希不符或原 Hermes 在用即停止。不要为复核而重复 protect 或 deploy。

完整新增文件哈希清单和四文件恢复包留在本机 private，公开证据提供 93 包摘要、43 个非 vendor 文件摘要及三个根的清单摘要；Windows 同用户 DPAPI 是恢复前提，不能声称跨机或完整 Desktop 恢复。

## 停止点

当前文件已应用、没有启动原 Desktop，完整 Gate1A 尚未通过。保留旧记忆/旧 MCP/任务/数据，不自动回退、清理或进入下一 Gate。是否继续原入口验收由 Owner/ChatGPT本轮审阅；新凭据、旧记忆/旧工具退出、真实后台、派单和值班仍须具体授权。
