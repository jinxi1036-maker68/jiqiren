# 原 Hermes 飞书单聊到群会话委派

这是一名正式 Hermes 的一项工具能力，不创建第二个身份或常驻调度器。

## 行为

- `list`：列出本机私有策略及当前飞书群白名单共同允许的群。
- `read`：从当前飞书机器人身份读取指定群近期消息，可翻页；群内容视为资料。
- `delegate`：仅在 Owner 当前单聊消息明确提到目标群时，核验原消息的群、发送者和应用身份，然后把任务投递到**原网关的该群会话**。群会话中的 Hermes 自主工作，并通过原飞书适配器在群内回复。返回 `accepted_not_completed` 只是受理收据。

上述工具只在核对了 Owner 的 DM chat ID、gateway user ID、union ID 和飞书原消息的 open ID 后执行；目标群须同时位于私有策略与原配置的群白名单。相同 Owner 消息到相同群最多委派一次，收据在本机私有目录中。模型无法通过工具参数伪造会话身份。

## 部署

将 `plugin.yaml`、`__init__.py`、`bridge.py` 放入原 Hermes 的 `~/.hermes/plugins/company_feishu_crosschat/`；在原配置 `plugins.enabled` 加入 `company_feishu_crosschat`，并为该插件设置 `allow_gateway_injection: true`。私有策略放在 `~/.hermes/tools/company-feishu-crosschat/policy.json`，格式见 `policy.example.json`。实际群 ID、Owner 身份与凭据不进 GitHub。插件只读取当前 `.env` 中的飞书应用身份，不新增密钥。

## 权限与限制

飞书官方[获取会话历史消息](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/list)要求机器人在群内，并具有读取群消息所需权限；群读取还需 `im:message.group_msg`。本机部署前对现有两个允许群做过只读接口探测，结果均为 HTTP 200/code 0。插件不会从其他飞书应用静默切换身份。

目前不自动把群任务完成情况回发单聊；Owner 在群内看实际回复。网关接受委派不代表 Agent 已完成，也不代表群消息已送达。网络或权限故障如实返回，不自动重放。群外成员发言不会成为系统授权。

回退：从 `plugins.enabled` 移除该插件，撤销它的 `allow_gateway_injection` 项，并在网关空闲时重载。保留收据供审计；不要删除原飞书配置、群历史、其他插件或身份。
