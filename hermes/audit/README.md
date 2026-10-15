# Phase 01审计辅助脚本

这些脚本只用于经Owner授权的本机盘点和虚拟演示。不要把本地原始输出自动提交GitHub。

## 本地盘点

```powershell
& '<Hermes安装目录>/venv/Scripts/python.exe' -I -B hermes/audit/local_inventory.py --output work/hermes-audit/before
& '<Hermes安装目录>/venv/Scripts/python.exe' -I -B hermes/audit/local_inventory.py --output work/hermes-audit/after --compare work/hermes-audit/before/fingerprints_local_only.json
```

输出目录必须在原Hermes数据根之外。脚本不导入Hermes运行模块，不调用聊天Agent，不执行任务或安装依赖。Git只运行只读命令并禁用可选锁。PyYAML与psutil可选，缺失时如实记录；不要为运行审计自动安装它们。

写入保护针对本Python进程，不会冻结后台Hermes，也不能约束其余进程。SQLite使用immutable只读视图，故意不读活动WAL；记录计数不是实时总量。文件名、插件名称、模型标识和完整指纹清单仍应按本地敏感材料处理。报告应人工选择和脱敏后单独发布。

## 浏览器组件测试

```powershell
node hermes/audit/browser_smoke_test.mjs work/hermes-audit/browser-demo
```

前置条件为本机已有`.hermes/tools/playwright-mcp`及`.hermes/tools/xianyu-browser-tools`中的依赖，以及已有Edge或Chrome。脚本复用已安装的MCP SDK和Playwright MCP包，不安装软件、不连接原CDP或已登录浏览器、不读取原Cookie。依赖缺失时直接失败。

测试新建isolated、headless会话、仅监听127.0.0.1的演示页面和50字节虚拟CSV。验证MCP初始化、DOM、输入点击、虚拟状态变化、表格、上传、截图、下载和返回导航；结束后关闭本次MCP客户端及演示服务器。

当前验证版本是Playwright MCP0.0.78：交互参数用`target`，截图包含`scale`。版本变化后先读取实际tools/list schema，不应为修复测试而重装或改原工具。隔离测试成功不证明Hermes Agent自主调用或生产业务链已经通过验收。

## 本次实测

- Windows11，Agent源码/安装元数据0.20.4，Python3.11.15。
- 最终浏览器演示9项全部通过，30项MCP工具schema。
- 选定1469份原文件前后检查；记忆、Skills等一致；config.yaml出现1字节未归因变化及两个运行心跳变化。未覆盖或还原配置。
- 读写保护用合成`sys.audit`事件测试，不真正打开或写入原配置。
- 本阶段未登录灵生、未执行生产业务、未重装、未清空记忆或创建新调度。
