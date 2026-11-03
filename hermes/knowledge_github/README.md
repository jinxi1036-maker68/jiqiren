# 原 Hermes 的按需 GitHub 公司知识

这是原 Hermes 的只读工具，不创建第二身份。Feishu Owner 单聊可按任务需要调用；普通对话不会自动预载整库。现行资料只取私有仓库 `jinxi1036-maker68/jiqiren` 的 `main`、`knowledge/`，不把开放 PR 当已生效事实。本机 R3 仍是原有历史快照，未被改写。

## 工具

- `company_github_knowledge_search(query, limit)`：搜索 Markdown、JSON、CSV、XLSX；返回当前 `main` commit、路径、blob SHA、短片段。搜索结果只是线索，须 `read` 原文件。
- `company_github_knowledge_read(path, start_line, max_lines, sheet, start_row, max_rows)`：文本按行，XLSX 先列 sheet 再按行读取。不会执行公式或外链。每次返回 commit、路径、blob SHA 和读取时间。
- GitHub 不可达、权限不足、主分支移动、文件不存在时会报错；不把旧缓存冒充当前事实。内存中仅按 blob SHA 复用内容，不写入 W、MEMORY 或磁盘缓存。

## 只读凭据

Owner 在 GitHub 自行创建 **fine-grained PAT**：仅选择 `jinxi1036-maker68/jiqiren`，Repository permissions 中 Contents 设为 Read-only（Metadata 为 GitHub 隐含只读），设置合理到期时间。不得使用能写入仓库的旧凭据。Owner 在本机运行 `python -B hermes/knowledge_github/provision_credential.py`，仅在弹出的窗口粘贴一次。它保存在当前 Windows 用户的 Credential Manager，目标名 `LingjuHermesGitHubReadOnly`。不要把 token 粘贴到聊天、`.env`、GitHub Issue 或 PR。

## 接入和回退

在原 Hermes `mcp_servers` 中仅注册 `company_github_knowledge`，命令为原活动 Python `-I -B .../server.py`；Feishu 网关路由只给 Owner 单聊开放，浏览器任务中也可同时查知识。**先核对实际运行入口**：2026-11-03 观察到当前 Feishu 网关由旧安装目录启动、cwd 为 `.hermes`，并未加载受保护公司网关入口；该状态不能直接部署或声称 Owner 单聊隔离已生效。现有保护基线也与若干运行文件不一致，不得静默重置。需查明并恢复原正式入口后，在空闲时受控重载，验证工具收据、工作区和通道。回退删除新 MCP 注册项并恢复本轮 Feishu 路由改动，清除该 WinCred 条目；不动 SOUL、HERMES.md、MEMORY、USER、R3/Manifest、语音、QQ、浏览器或 Bitable 配置。

## 验收

先零模型验证工具目录、schema、仅读请求、越界拒绝、XLSX 分页、网络失败无旧答案和 Owner 单聊隔离。然后 Owner 在原飞书单聊发一条自然任务：请 Hermes 自主检索 GitHub 公司知识，说明当前决策与历史计划的区别，引用文件路径及 commit，并读取一份 XLSX。检查真实 MCP 收据和回复；仅回复内容相似不算实际读取证明。普通问候应无需 GitHub 调用。
