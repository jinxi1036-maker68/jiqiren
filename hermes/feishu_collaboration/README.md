# Hermes 与 Pi 的飞书群协作入口

目标：在 Owner 指定的一个项目群里，让唯一正式数字员工 Hermes 自主向 Pi 请求技术协助，收到答复后由 Hermes 核实并汇总。Pi 是协作 Agent，不是第二名 Hermes 员工。这里不授予任何新的真实业务写入权限。

## 接入范围

- Hermes 原飞书适配器保持 `allow_bots=none`。仅 `platforms.feishu.extra.bot_peer_allowlist_by_chat` 指定的群与 Pi `open_id` 可以例外，且要求 Pi 真实 @Hermes；其它机器人、群、私聊仍拒绝。
- Pi 桥接打开 `includeRawEvent` 读取 `sender_type`。来自机器人的消息仅接受指定群、指定 Hermes `open_id`、真实 @Pi，且首部为 `【协作请求 TASKID 1/3】`，其中 TASKID 为 6 到 40 位字母、数字、`_`、`-`。同一任务后续只能依次 `2/3`、`3/3`；30 分钟最多三次请求。普通人的消息维持原有行为。
- Pi 对协作请求的答复会真实 @Hermes，标注 `【协作答复 TASKID n/3】`。Hermes 决定是否追问、核实和汇总，不按固定脚本决定业务。
- Hermes 可通过原 `send_message` 工具向该群发纯文本，使用真实飞书 `<at user_id="...">小派派</at>` 标记；该行为仍受 Owner 原有对外发送授权约束。

## 版本与验证

仓库保存无凭据的 `pi_peer_gate.js`、`pi_bridge.patch`、`hermes_adapter.patch` 和纯本地测试。运行中实例的群 ID、机器人 ID 只保留在本机私有配置。测试：

```powershell
node --test hermes/feishu_collaboration/pi_peer_gate.test.js
$env:HERMES_AGENT_ROOT = 'C:\path\to\active\hermes-agent'
& "$env:HERMES_AGENT_ROOT\.venv\Scripts\python.exe" hermes/feishu_collaboration/test_hermes_peer_gate.py
```

飞书真实验收需确认两端消息送达、Pi 被调用、Hermes 实际收到协作答复并汇总，以及没有循环、重复发送或权限扩大。静态测试不能代替这一验收。

## 回退

本轮安装源码、Pi 桥接、Pi `.env` 和 Hermes `config.yaml` 的修改前像保存在本机私有恢复目录。只有确认文件未被并发修改时才恢复单文件；不要整目录覆盖。先停止本轮自有 Pi 桥接，再恢复本轮文件，原 Hermes 网关空闲时重载。恢复不清除历史会话。
