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
