# 凌矩小程序知识库｜唯一专属入口

> 新聊天/新Codex/新开发者：先读此页，再按任务选择具体资料。不要依靠旧聊天或口头摘要覆盖此处Owner已确认的定义。

## 最新界面决定：双身份入口首页（Owner已同意）
- [界面设计记录](SCREEN_DESIGN.md)：首次进入首页选择“我是商家”或“我是采集员”，后续记住选择、可切换身份。已由Owner 2026-11-08明确同意；仅UI理念确认，尚无实际登录或可运行代码。

## 新的推进方式（2026-11-09）
- Owner明确要求停止对第61、62……项逐条征求意见；在不改变已确认原则的前提下，由AI一次性补齐常规页面、流程、异常和模拟验收。
- [全功能批量细化工作方案 V1](FUNCTIONAL_RULES_BATCH_V1_20261109.md)：**AI可调整工作默认方案，不是Owner逐项批准的真实商业价目表或生产上线许可**。
- 仅对真实定价、合同/支付、客户授权、设备安全与正式上线保留关键门槛；演示仍受Issue #24既有批准范围约束。

## 微信小程序原生体验版（2026-11-09确认）
- Owner已拥有微信小程序账号，明确同意直接使用微信小程序原生载体制作模拟体验版，不先制作独立网页版。
- 开发任务：[GitHub Issue #25](https://github.com/jinxi1036-maker68/jiqiren/issues/25)；主代码路径 `miniapp/apps/wechat/`；旧Issue #24的网页交付路径已由新决定替代，历史保留。
- **当前仍是需求文档和任务准备状态；不能据此说Codex已开始编码、微信端已编译或体验版已上传。** 不批准真实客户QA、设备、支付或正式上线。

## 当前状态
- **商业模式定位：Owner已确认（2026-11-08）**：商家申请部署设备和管理开放时段；社会个人采集员看附近站点、任务流程、小时规则与报酬到店接单；凌矩负责城市运营、设备及任务质量对账。**不是采集团队接单平台。**
- **2026-11-08新要求**：将小程序的全部知识、未来源码、测试、每次改版历史、Codex交接统一沉淀在本仓库独立 `miniapp/` 下；**GitHub是源头，任何一次改版都应在原有底座上迭代，不做多套真源**。
- **演示版**：Owner以前已批准纯前端模拟样机（Issue #24）；Codex实际运行/PR与源码进仓库尚无核验证据。正式微信小程序、后台、实时QA、支付、设备和人员真实连接未批准。

## 资料导航
1. [PRODUCT_CHARTER.md](PRODUCT_CHARTER.md)：**最权威的Owner已确认产品定位**及安全边界。
2. [REQUIREMENTS.json](REQUIREMENTS.json)：带编号的商家版/采集员版/凌矩后台功能需求及确认程度。
3. [PROJECT_STATE.json](PROJECT_STATE.json)：目前到底实现/测试/部署了什么，下一步是什么。
4. [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)：需要Owner逐步拍板的规则与设计空白。
5. [DECISION_LOG.md](DECISION_LOG.md)：谁确认了什么、哪些旧思路已否定、今后为什么改版。
6. [EVOLUTION.md](EVOLUTION.md)：从V0.1误解到V0.5城市运营和今天双端产品的历史。
7. [ARCHITECTURE.md](ARCHITECTURE.md)：逻辑关系和技术选型未定事项，不冒充已实现架构。
8. [ROADMAP.md](ROADMAP.md)：演示→验收→再定功能，批准与建议分开。
9. [CHANGE_PROTOCOL.md](CHANGE_PROTOCOL.md)：Codex每次改代码与知识库须同步的规则。
10. [../CHANGELOG.md](../CHANGELOG.md)：可核验的GitHub提交/版本变化。

## 原公司知识与本项目关系
- [最初模式与Owner确认](../../knowledge/strategy/2026-11-08_LINGJU_MERCHANT_COLLECTOR_MINIPROGRAM_VISION.md)
- [城市运营合作V0.5](../../knowledge/strategy/2026-11-08_LIVSYN_PINGDINGSHAN_CITY_STATION_CO_PILOT_V0_5.md)
- [共享设备社会采集V0.2](../../knowledge/strategy/2026-11-08_DISTRIBUTED_CROWDSOURCED_CAPTURE_STATION_MODEL_V0_2.md)
- [多门店不同场景V0.3](../../knowledge/strategy/2026-11-08_DISTRIBUTED_REAL_SCENE_CROWDSOURCING_NETWORK_V0_3.md)
- [演示版批准与既有Codex任务](../../knowledge/operations/2026-11-08_CITY_STATION_DEMO_APPROVAL_AND_CODEX_HANDOFF.md)，[Issue #24](https://github.com/jinxi1036-maker68/jiqiren/issues/24)
- [公司发展记录制度](../../knowledge/COMPANY_EVOLUTION_CHARTER.md)

**阅读优先级**：Owner最新明确确认的产品原话及本项目宪章＞历史草案＞AI建议。若新Owner决定与产品宪章冲突，请写新决策并更新宪章，而不是静默把旧决定改没。
