# 原Hermes浏览器业务UI能力整体接通

Owner要求一次接通浏览器写入能力。原公司身份、H/W、Ego Profile1/现存Space2不变，切换至 **company-business / businessWritesEnabled=true / productionEnabled=true**。仅提供能力，由Hermes依Owner目标自主操作；没有替Owner分组、创建记录或发送业务消息。

## 已证实

1. 自有接入支持显式v3授权模式，完整日常飞书路由识别business-daily；v1模拟/v2只读仍保留。实际工具状态与岗位指南均报告业务能力，旧只读引导不再作为现行模式。原8项UI工具即可填写、选择、点击、确认和保存，无创建/分组/绑定逐项白名单。
2. 公司资料中原扩展文件和安装权限未改变。新增动态规则10001/10002仅放行灵生同站正常方法及WSS，静态规则仍启用。浏览器原生testMatchOutcome在**不发送网络请求**的条件下确认POST/PUT/PATCH/DELETE命中同站allow，外站和旧合成端口的POST仍命中block。原生结果是规则匹配证据，不是实际生产写入收据。
3. 原活动Python→dispatch→MCP实际status及guide通过：ego-native、company-business、Space2、原H/W、8工具、实际guard/extensionMode均正常，businessWritesEnabled=true。stderr0，客户端关闭无残留lease；工具可写与平台服务端账户权限分开说明。
4. 原网关空闲正常重载一次，实际READY为2026-10-29 20:18:49.940121Z（北京时间10月30日04:18:49）。飞书、微信、QQ和企业微信主通道connected；原wecom_callback问题保留。没有强杀、强制新会话、第二身份、额外模型消息或新的人工额度。
5. 19 Node、17 Python Ego、10 Python网关，共46项检查通过；原CLI零模型探测通过。新增检查覆盖显式Owner授权、旧标志不能隐式升级、同站全写方法/外站拒绝、动态模式错配和非空session规则拒绝、真实日常路由匹配。

## 实际变更和保护

自有8份源码：ego/policy、extension_guard、bridge、worker，ego_runtime.py、dispatch.py、ego_task.py、feishu_gateway.py；更新自有runtime授权/模式、gate源码及runtime pin、私有交接记录。原扩展内增加2条持久动态规则，作用于公司资料，不影响其他资料。未改扩展静态文件、manifest权限、原注册项或原安装源码。

59项原保护及保护基线匹配；SOUL、HERMES.md、MEMORY/USER、R3/Manifest、模型、凭据、原配置、语音QQ、cron和旧profile未改。11份必要自有文件前像及1份本扩展规则前态仅保存在已验证的私有恢复根下，无回退；没有无限备份原环境。脱敏SHA、原生匹配结果、PID及计数见[证据](../evidence/ego-business-enabled-2026-10-30.json)。

回退仅针对本轮：空闲停止自有入口；如本扩展动态规则仍精确匹配本轮10001/10002且无并发变化，移除这两条，保留全部静态规则；按实际写后SHA逐文件恢复本轮8源码/runtime/gate/交接前像，再空闲启动原只读入口。任何目标存在并发差异则停止，不覆盖SOUL/配置/记忆或整份工作区。此操作不是业务数据回退，不能撤销将来Hermes真正执行的业务保存。

## 尚未证实与下一步

- Codex新增Hermes消息/模型请求0、真实业务UI提交0；没有读取业务名单/截图。当前页面自身后台请求未审计，不声称整个浏览器没有任何后台网络行为。
- 不把权限开启当成所有表单/业务保存已测试；平台账号权限、字段校验、真实保存和跨页关系由Hermes具体任务中据实回读。不要为验证权限而创建正式记录。
- 未新增通用文件上传/下载、私人文件、凭据、任意JS/终端或原始网络接口能力。当前授权针对浏览器页面业务操作；不借此扩张本机或其他网站权限。
- 不启动巡检/派单/cron，不代Owner补充6台设备目标组。关键业务归属缺失时需询问业务目标，不要求Owner遥控点击。
- 浏览器/OS完全重启、工作窗口关闭后的持久接续未本轮重测；原provider时延/限流与wecom_callback独立保留。

下一步直接由原Hermes承接Owner正常业务目标，在授权范围自主执行并报告实际保存结果，不另安排一轮模型验收。正式业务信息不入GitHub。


## 后续实际任务：页面操作错误误触发MCP不可达，已修正分类（0.4.1）

Owner发来04:37截图。仅定位该轮必要工具收据，未读取私人记忆、完整提示词或查询生产表格。原会话20261029_223507_80eb1ab4中，04:36:23保存点击被div拦截；04:36:40目标不可见；04:36:46旧subtree根不存在；04:36:59返回“3 consecutive failures，~47s”。原安装tools/mcp_tool.py的_make_tool_handler把全部MCP isError累计成server错误，3次触发60秒熔断，47秒是剩余冷却；三次实际RPC错误响应已完成，不能拿此条提示当作网络掉线证据。初查原网关/worker/桥接进程活着、飞书connected、business模式/保护pin未变。

同一轮已返回、初查active_agents=0。冷却只允许后续调用，不调度新任务；Hermes“等约半分钟会自行继续”的承诺没有运行依据。第一台是否实际保存仍未知，其余五台未操作只有Hermes自述，Codex没有独立查表或重复提交。

修复只在自有接入：完成的worker RPC用正常MCP结果携带**结构化真实错误**，operationSucceeded=false、error/code保留、savedBusinessState=unverified；不把页面失败包装为服务器断线，也不把它当业务成功。结构化字段保证原Hermes错误显示和重复失败识别仍检测到失败；真实传输异常仍走原isError/熔断路径。缺参明确标记未派发且指出缺失字段，不再泛报EGO_UNAVAILABLE。新增浏览器使用说明：弹层变化后旧ref可能失效，可用不带root的全页观察重新选择方法；Escape可能关闭整个弹窗；保存不明先查结果，不盲目重提。不规定业务点击流程，不自动补发模型消息或创建定时任务。

使用原安装实际_make_tool_handler/_bump/_reset、错误显示及重复失败分类函数做隔离I/O回放：复现旧三错误→~47s；修复后页面失败仍显示/识别为失败但不误开服务熔断；真正MCP错误仍熔断。原安装源码未改。24 Node+20 Python共44项检查通过，其中3项为这一原处理器兼容回放。实际MCP组件检查中，3次缺参均返回明确失败且未派发浏览器动作，随后status正常，业务模式/原H/W/实际扩展保持，关闭后无残留lease。该组件检查不是Hermes新模型任务。

本轮自有3模块（lifecycle/bridge/policy）及相应runtime源码pin/gate/交接更新，必要6份前像私有保存，无回退。为补足原错误显示/重复失败识别兼容，完成结构化错误后第二次空闲正常重载，合计2次，无强杀或隐瞒中间版。最终READY/通道状态/SHA见同一证据JSON.page_error_classification_repair。59原保护、原安装MCP源码、既有业务授权/动态规则均保持；身份/记忆/R3/配置/模型/凭据/语音QQ/cron不改。Codex新增模型/消息/业务UI动作0、生产正文/截图读取0。

**本轮修复的是错误分类和恢复说明，不能冒称分组已保存或具体弹窗操作已经成功。** 接续Owner正常目标时，Hermes应先核实第一项当前保存状态，再决定是否继续余项；依实际页面自主选方法，仍需报告已完成/未完成/未知。旧注册名company_browser_simulation保留，实际driver是ego-native/company-business，不能因旧名称说本次在模拟后台。
