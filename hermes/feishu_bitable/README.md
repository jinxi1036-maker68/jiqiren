# 原 Hermes 飞书多维表格工具（候选）

这是给原 Hermes 增加的一组 MCP 工具，不创建新的 Hermes 身份。凭据只在运行时从原 `~/.hermes/.env` 读取；源码和 GitHub 不包含 App Secret、Base 标识或表格记录。

## 运行边界

- 启动时必须指定 `COMPANY_FEISHU_BITABLE_APP_TOKEN`，只允许访问这一份 Base。
- 默认仅暴露列出数据表、字段、记录及读取单条记录四个工具。
- 只有 `COMPANY_FEISHU_BITABLE_WRITES=1` 时，才额外暴露单条记录新增、更新；没有删除、字段修改、权限变更或创建数据表工具。
- 新增使用稳定的 `operation_key` 生成飞书 `client_token`；不明结果不自动重试。更新要求刚读到的字段旧值；不匹配即拒绝。更新前检查不能代替平台原子并发控制，遇并发写入仍需回读核实。
- 财务、付款、工资等决定继续受 Owner 岗位授权约束；API 权限已开通不等于授权 Hermes 自行改写每项业务数据。

## 接入步骤（尚未部署原 Hermes）

1. 将 `client.py`、`server.py` 放到原 Hermes 的单一工具目录。
2. 在原 `config.yaml` 的 `mcp_servers` 下增加一个注册项，使用原活动 Python：`python.exe -I -B server.py`；只向该进程传入获准 Base 标识，写入开关初始为 `0`。凭据不放入命令行、配置或 GitHub。
3. 零模型检查 MCP `list_tools`，随后用原应用身份只读列出数据表、字段和一页记录；核对原配置其他项和现有通道不变。
4. 如 Owner 明确授予该 Base 的记录写入范围，再将写入开关设为 `1`，先在单独测试记录执行一次新增或更新并回读。不得用费用台账中的既有记录做试写。

单文件回退：移除新 MCP 注册项，停止新工具进程，恢复原 `config.yaml` 的私有前像；原飞书消息通道和其他 MCP 项不应受影响。部署前核对当前配置哈希，若有并发变化则停止，不整份覆盖。

本机候选已在原活动 Python 环境的 `mcp==2.0.0`、`httpx==0.28.1`、`python-dotenv==1.2.2` 下验证；本轮不向该环境安装或升级依赖。

## 已做验证

- 同一应用身份（App ID 仅记录末尾 `7adcba`）的实际令牌含 `base:table:read`、`base:record:read`、`base:record:create`、`base:record:update`。
- 对 Owner 给出的 Base：列出数据表成功，读取单页记录成功；未输出记录内容。
- 本地 MCP 握手、4 个只读工具注册和真实只读 `list_tables` 调用成功；单元测试使用合成响应，没有生产写入。
- 以上不等于原 Hermes 已加载这组工具，也不等于生产写操作通过。
