# 公司Ego只读保护扩展候选 v0.1.0

**未安装、未获安装授权、未在Ego中验证。** 不能因JSON检查通过而开放真实资料。
这是原Hermes浏览器工具的候选保护层，不是另一个Hermes身份，也不是业务流程脚本。

## 为什么提出这个变更

当前主Page拦截有效，新弹窗存在先发请求的缺口。对照实验中服务器原生返回的
CSP生效，但通过当前CDP响应修改/替换添加的策略没有生效；具体底层原因未知。
因此不继续靠相同的主Page钩子宣布全面保护。DNR由浏览器按静态规则处理，
没有等Node脚本发现新窗口再安装规则的同一时序设计。是否适用于本机Ego，
仍要由获批后的实际服务器收据证明。

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
不复制旧Cookie/密码、不选择私人资料。本轮仅提出创建，不自行创建或查找其他资料。
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

## 获批后一次集中实测

1. 确认新公司资料名称/ID和版本；旧资料不改、不复制。不自动改变当前Space的profile。
2. 在该资料的正常UI安装此版本，只用合成页，不登录灵生。
3. 让同一个目标使用一个明确获准的新Space（因为新资料创建Space才生效，不能
   偷换现有Space资料，也不能将新Space当成失败重试手段）。
4. 用服务器事件同时验证：允许读取、根页写拒绝、立即运行的弹窗写拒绝、同源和
   跨进程框架写拒绝、Worker/Service Worker fetch拒绝、WebSocket拒绝、未批准
   端口/站点拒绝。验证新工具新建页、按正常UI打开的弹窗和网关接续均不漏。
   保留既有空白Space 1仅作同端口合成对照：不读其私人页面或Cookie，用假计数端点
   验证旧资料未被新资料扩展影响。若扩展实际跨资料生效，停止并撤回本次扩展。
5. 检查规则仍启用，关闭Agent工作进程后保护仍在；禁用扩展的负对照必须在独立
   合成阶段由Owner批准后执行，随后立即恢复并再次核验。不得在生产页面做负对照。
6. 若Ego拒绝资源枚举、规则、资料绑定不确定或被设置保护机制清除，停止，不开
   调试安全开关、不改安装源码/系统策略或安全软件，不宣称兼容。

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
