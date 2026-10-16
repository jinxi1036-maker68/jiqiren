# 中性SDK解耦准备代码

状态：只在独立开发区验证；没有改原Hermes或其旧业务目录。

- 来源：PR #8固定head `7d900d3a39c1e77f6a159347f6cd7d5207a709dd` 的受限桥。
- 原依赖：旧业务目录package.json → @modelcontextprotocol/sdk 1.30.0。
- 新接入：显式sdkAnchorPackage → 中性node_modules；实际模块路径及版本校验，无旧业务fallback。第三方运行库通过本机离线依赖闭包建立，版本/许可和摘要见evidence。
- 未变化的安全范围：本机loopback与明确模拟路径、四工具过滤、子进程最小环境。此边界不是生产只读策略，也不是OS沙箱。

## 文件
sdk/包含sdk_resolver、继承改造的browser_bridge、navigation_policy、loopback_guard，以及mock_mcp/test_sdk。tools/保留本次定点探查与依赖闭包准备的源码快照；其中相对路径对应这一次Codex工作区布局，**不是正式部署器，不需在原Hermes重复运行**。没有自动应用或删除程序。

本机复现新增组件验证（须已有本轮中性副本；不调用模型）：
```powershell
$env:HERMES_PREP_TEST_ROOT = '<本轮private目录>'
node --test sdk/test_sdk.mjs
```

不要将真实HOME、账号或Cookie交给mock。测试只使用自己生成的stdio夹具，无浏览器、HTTP或业务连接。旧SDK不可作为缺省回退；切换原MCP绑定、正式中性库落盘或移除原目录，都需另行批准。SDK升级也需显式版本与兼容性复核。

本轮第一轮夹具连接失败的原因与修复保留在PREPARATION_VALIDATION.json。最终4项通过不等于原Hermes自主浏览器/生产权限验收通过。

