# 公司Ego只读保护扩展候选 v0.1.0

**2026-10-29：已获Owner批准，在公司Profile 1启用，本机合成请求验证通过。**
仍未开放生产入口，也未由Hermes本人使用Ego完成业务；不能把组件通过当成真实工作通过。

**后续当前状态（2026-10-29 10:41）：经Owner批准，已仅恢复原位置两文件，哈希与原生
启用状态重新核验通过；原Hermes飞书入口已加载Ego。Owner随后亲自登录，保护已恢复，
正常只读场所已active。** 先前目录消失原因仍未知，停止/恢复记录保留。
Codex没有读取业务正文或发送模型消息；实际Hermes本人Ego业务结果仍未验证。
这是原Hermes浏览器工具的候选保护层，不是另一个Hermes身份，也不是业务流程脚本。

## 为什么提出这个变更

当前主Page拦截有效，新弹窗存在先发请求的缺口。对照实验中服务器原生返回的
CSP生效，但通过当前CDP响应修改/替换添加的策略没有生效；具体底层原因未知。
因此不继续靠相同的主Page钩子宣布全面保护。DNR由浏览器按静态规则处理，
没有等Node脚本发现新窗口再安装规则的同一时序设计。是否适用于本机Ego，
现有实际服务器收据已证明下述被测通道，详见同一[执行报告](../../reports/2026-10-27_STATISTICS_READONLY_PREPARATION.md)最新节。

## 完整权限与文件

- 安装包仅`manifest.json`和`rules.json`，共5条静态规则。
- 唯一权限：`declarativeNetRequest`，安装会提示网络内容拦截权限。
- 无host_permissions、cookies、tabs、debugger、proxy、storage、scripting权限。
- 无后台/内容脚本、页面注入、远程代码、外部消息入口或云服务。
- 不导出请求正文/响应正文、Cookie、密码、账号或访问日志。
- 权限名允许浏览器处理网络规则，不代表任何真实业务写入授权。

## 覆盖范围与实际限制

扩展会作用于**所属浏览器资料**的页面、弹窗和Worker网络请求，不能假称只影响一个
TaskSpace。因此安装前必须由Owner批准并新建**凌矩公司工作**专用Ego资料：不导入、
不复制旧Cookie/密码、不选择私人资料。Owner已报告创建完成、未导入/登录；原生Space元数据和
版本路径已核实公司资料为Profile 1，未通过读取私人Cookie来证明无导入。
通过该资料的正常扩展管理入口安装；不能用默认profile或浏览器全局CDP安装代替。

规则意图：

1. 所有HTTP(S)请求先禁止GET/HEAD/OPTIONS之外的方法，包括表单顶层/子框架导航。
2. 禁止WebSocket、WebTransport、ping和CSP report通道。
3. 仅允许`https://ldp.lingrobotics.com/`的GET/HEAD/OPTIONS。
4. 仅允许固定本机合成检查端点`http://127.0.0.1:61987/`及其localhost别名的读请求；
   不是放行所有本机端口。端口占用时检查中止，不结束其他进程、不随意换端口。
5. 阻止其他HTTP(S)站点。扩展内部/chrome页面及操作系统不受这些HTTP规则约束；
   适配器仍必须限制页面URL和可调用工具，不开放任意Node/终端/本机文件。

`GET`是方法级判断，**不等于所有GET接口都是业务只读**。Hermes仍不得点击会产生
业务变化的控件；若发现GET写接口，必须补明确拒绝策略或使用平台只读角色。
若合法查询依赖POST或其他资源域名，结果标未知，不能自动放开POST、全部域名或
把本地拦截归因平台。此扩展暂时阻止登录POST，Owner登录必须在受控人工阶段处理。

Chrome官方说明：DNR影响进入网络栈的请求，包括Service Worker里的fetch；不会拦截
Worker自己生成或CacheStorage提供的本地响应。这不能用来宣称本地缓存状态没有变化。
同样，网络写入保护不等于Node/Python安全沙箱或平台服务端只读权限。

## 一次集中实测（已完成）

主页面、同源框架、跨源OOPIF、Worker、Service Worker、弹窗、新标签页和顶层表单的
测试POST被阻止，允许的读请求到达；WebSocket与未批准端口也被阻止。公司阶段服务器
仅14GET、0POST/UPGRADE；另经Owner批准的独立Profile 2对照为3GET/1POST/1UPGRADE，
说明这个被测资料未受公司保护影响。旧空白Space 1也属于Profile 1，未将其当成隔离证据。
WebTransport仅原生规则API匹配，未作实际QUIC端到端验证；不宣称覆盖所有可能通道。

实际未打包来源是`%USERPROFILE%/Desktop/凌矩浏览器保护`，不可随意删除或移动。
安装载荷两份SHA256与本目录一致。新测试Service Worker已注销，临时页面/对照Space及
模拟服务已收尾，正常Ego保留。浏览器/系统重启后的持久性、实际站点兼容及Agent操作仍未验证。

本轮没有禁用扩展；负对照采用Owner另外批准的独立Profile 2。
跨CLI调用/资料切换后仍启用已验证，原Hermes网关加载、浏览器或系统重启尚未验证。
若后续规则、资料绑定或启用状态不确定，应停止当前业务动作，不通过调试安全开关、
安装源码/系统策略或安全软件变更来绕过，不宣称兼容。

以上通过后，再制定原Hermes日常进程加载与Owner人工登录交接。
登录完成须重启用保护并用合成端点复验；保护的实际安装/启用证据、规则哈希、
公司资料身份和新目标Space对应关系齐全后，才开始真实查询。安装或存在本身不是验收。

## 恢复与不动范围

只禁用/移除此新增扩展、停止自己的合成端点，保留原驱动即可退回；不回放任何业务动作。
不删除公司资料及其登录信息，是否删除由Owner单独决定。原Hermes H/W、SOUL、HERMES.md、
MEMORY/USER、模型/凭据、R3/Manifest、MCP登记/权限、QQ/语音/cron不修改。
不安装系统证书、不改VPN/系统代理、系统策略或启动项，不更换Ego/Hermes版本。

依据：
- [Chrome DNR官方文档](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
- [原生子目标拦截问题 #586](https://github.com/citrolabs/ego-lite/issues/586)（用户问题报告，尚无维护者答复）
- [资源策略提案 #461](https://github.com/citrolabs/ego-lite/issues/461)（提案不等于已经实现）
- [扩展空间隔离请求 #262](https://github.com/citrolabs/ego-lite/issues/262)（不能据此断言本机隔离已验证）
- [Windows扩展重置报告 #591](https://github.com/citrolabs/ego-lite/issues/591)（本机未复现）
