# 凌矩 S2B 协同平台 `v2.0` 架构升级方案｜整包项目制 ＋ 小优上游数据回流隔离墙

- **日期**：2026-11-26 23:06
- **状态**：`BLUEPRINT_READY_FOR_OWNER_BUILD_APPROVAL`
- **上位依据**：[整包项目制与 AI 小优协同演进方案](2026-11-26_PROJECT_BASED_DELIVERY_AND_AI_BRIDGE_EVOLUTION.md) · [V1.0 定版规范与深清查报告](2026-11-26_AGENT_PLATFORM_V1_FINAL_SPEC_AND_FIRST_PRINCIPLES_AUDIT.md)
- **核心目标**：在保留 `v1.2.0` 零第三方依赖低内存架构与专业 SaaS 视觉系统的基础上，将业务底座从“零散任务包”全面重构为**“整包项目制（1,000h–10,000h 总池）＋ 设备/子账号归因映射 ＋ 小优读取甲方后台脱敏回流 ＋ 规则变更广播 ＋ 专属小优一线/人工异常升级台”**。

---

## 一、核心数据模型升级（SQLite Schema `v2.0`）

保留现有 `users`（认证代理/管理员）、`scenes`（`S1/S2` 全国场景池）、`audit_logs`（全链路审计），重点升级/新增以下 **5 张核心表**：

### 1. `projects`（替代原 `task_packs`，整包项目管理）
| 字段 | 类型与约束 | 业务含义 |
|---|---|---|
| `id`, `code` (`PRJ-...`) | 主键 / 唯一码 | 项目对外脱敏编号 |
| `title`, `modality`, `scene_category`, `city_scope` | 文本 | 项目标题、模态（EGO/双目/夹爪）、适配场景与地域 |
| `upstream_name_internal`, `upstream_base_rate_cny`, `upstream_platform_name` | **内部绝密字段** | 甲方真实公司名、含税底价、甲方平台名称（代理接口严格剥离） |
| `upstream_portal_mode` | `SUBACCOUNT_UPLOAD_ONLY` \| `LINGJU_RELAY_SHIELDED` | **甲方平台隔离模式**：仅开受限传片子账号 ｜ 完全屏蔽由凌矩中转 |
| `total_quota_hours` | REAL | 项目总盘子体量（如 `1000.0` 或 `10000.0` 小时） |
| `allocated_hours`, `delivered_valid_hours` | REAL | 已切分给各代理的总额度 / 累计甲方确认有效小时 |
| `current_rule_version` | TEXT (`v1.0`, `v1.1`...) | 当前最新已确认发布的规则版本号 |
| `compliance_path` | ENUM | 延续三态合规路径锁（`DRAFT_INTERNAL_ONLY` 对代理不可见） |
| `agent_rate_own_scene_cny`, `agent_rate_platform_scene_cny` | REAL | 代理自带场景净价 / 用平台场景净价 |
| `first_piece_min_hours`, `first_piece_max_hours`, `settlement_days_after_client_pay` | REAL / INT | `1–2h` 首件门槛与回款后结算工作日 |

### 2. `project_rule_revisions` & `rule_acknowledgements`（动态规则变更广播与强签收）
- `project_rule_revisions`：`project_id`, `version_code`, `raw_client_notice`（甲方原始通知，保密）, `ai_structured_diff`（AI 提炼后的变更对照卡）, `change_summary`（人类审核后的正式对外公告）, `effective_at`, `published_by_admin_id`, `created_at`。
- `rule_acknowledgements`：`revision_id`, `agent_user_id`, `acked_at`, `ack_ip`。**凡有未签收新规的项目，代理提交日常批量日志时顶部强提示必勾确认**。

### 3. `assignments`（项目配额切分 ＋ 设备/子账号归因映射）
在原有字段基础上新增 4 个核心落地字段：
- `quota_hours_requested` / `quota_hours_approved`：该代理团队在该项目下承接的子配额（如 `300h`）；
- `upstream_upload_account`：凌矩为其分配的受限上传子账号名（仅传片，不可看 QA/价格）；
- `bound_device_ids_json`：绑定给该代理的设备号或批次前缀列表（如 `["LS-PDS-01","LS-PDS-02"]`），作为小优从甲方总后台拉数时**精准归因到代理团队的唯一钥匙**；
- **硬锁延续**：押金可分级特批，但 `first_piece_status !== 'APPROVED'` 时仍以 HTTP `403` 禁止批量上报。

### 4. `xiaoyou_qa_reports`（小优上游 QA 抓取回流中心）
小优每天通过**甲方报表导入（CSV/Excel 解析）、只读 API 或受控后台巡检**读取甲方平台审核数据后，写入本表（对代理端彻底隐藏甲方原字段）：
- 归因字段：`project_id`, `assignment_id`（按 `upstream_upload_account` / `bound_device_ids` 自动匹配；未命中则进“待总控认领归因队列”）, `report_date`, `upstream_batch_ref`；
- 时长与分析：`uploaded_hours`, `valid_hours`, `invalid_hours`, `invalid_reasons_json`（JSON 数组：`[{ clip_ref, raw_tag, xiaoyou_plain_advice }]`，把甲方生涩报错翻译成能照改的大白话）；
- 预估与实结隔离：`estimated_agent_gross_cny`, `estimated_agent_tax_cny`, `estimated_agent_net_cny`（**前端强制标为“QA 预估·未决算”**）；
- 核对状态：`sync_source` (`CSV_PARSE` | `API_READONLY` | `XIAOYOU_RPA`)、`verify_status` (`AI_SYNCED_PENDING_CHECK` | `ADMIN_VERIFIED` | `DISPUTED`)；确认后可一键同步推进至财务对账台账。

### 5. `agent_ai_threads` & `escalation_tickets`（专属小优一线 ＋ 人工异常升级工单）
- **1 套引擎逻辑隔离**：按 `(project_id, agent_user_id)` 建会话上下文，只注入该项目的最新规则版本、SOP 与该代理近期无效原因明细（不触碰其它代理或甲方底价）。
- **强制转人工红线（`escalation_tickets`）**：当提问或事件命中以下任一条件时，小优拒绝自行作主，自动创建高优工单推入总控「异常升级队列」并触发飞书 Webhook：
  1. 涉及**价格/结算周期调整、设备丢失赔付、违规免责或新场景变动**；
  2. 代理对甲方判定的**无效时长提出申诉**（需人工持证据与甲方沟通）；
  3. 同一代理同一类 QA 错误**连续 2 次以上**未能自纠；
  4. 上游后台读取遇到**验证码/2FA 阻塞或表头字段突变**。

---

## 二、同步并入本轮开发的 3 项上线刚需小工具

1. **飞书群机器人 Webhook 通知**：新老板 30s 场景备案、代理交首件样本、小优创建人工升级工单时自动推飞书提醒（配置项走环境变量 `FEISHU_WEBHOOK_URL`，未配时静默跳过，不影响本地测试）。
2. **账号改密与总控一键重置密码**：新增 `POST /api/auth/change-password` 与 `POST /api/admin/agents/:id/reset-password`。
3. **财务对账台账一键导出 CSV（Excel 兼容 BOM）**：新增 `GET /api/admin/logs/export.csv`（仅管理员可用，含三方完整金额拆解与公户回单号）。

---

## 三、三端页面结构重构（沿用 `v1.2.0` 专业 SaaS 视觉语言）

### 1. 凌矩总控台（左侧 5 大模块）
1. **经营总览**：4 张核心指标卡 ＋ 5 节点交付漏斗 ＋ **项目总配额消耗进度条列表** ＋ **待拍板事项队列（含小优升级工单）** ＋ 三方毛利核算。
2. **项目与场景中心**：
   - 二级 Tab `整包项目池`：展示总配额 `已有效 / 已分派 / 总池`、规则版本（点击 `+ 发布规则变更` 弹窗支持粘贴甲方通知一键生成变更卡）、权限隔离模式；
   - 二级 Tab `全国场景双层池`：保留 `S1/S2` 分层与 30s 线索初筛。
3. **派单与设备归因**：待审配额切分 · 首件绿灯审核 · **设备号/受限上传子账号绑定视图**。
4. **小优回流与对账**：
   - 二级 Tab `小优上游回流导入/核对`：支持粘贴/上传甲方导出的 CSV/报表文本（或接收小优同步推送），自动按绑定设备号匹配代理、生成逐条白话失格原因并算好预估净收益，人工 10 秒核对确认；
   - 二级 Tab `背靠背三方台账`：强制公户回单号校验 ＋ **右上角一键导出 CSV**。
5. **异常工单与代理库**：人工异常升级工单处理台 · 认证代理档案（含一键重置密码）。

### 2. 认证代理工作台（左侧 4 大模块，彻底隔绝甲方后台）
1. **工作台首页**：我承接的项目配额进度 ＋ **是否有最新未读规则变更** ＋ **小优昨日 QA 评估摘要与预估净收益** ＋ 快捷按钮。
2. **项目大厅与场景池**：展示公开合规项目（显示`项目剩余可接配额 / 总池`、两档净价、QA 红线，不露甲方名与底价）与全国脱敏场景池。
3. **我的交付与专属小优**：
   - 查看本项目配额、**我已绑定的设备号与受限传片子账号入口说明**、最新规则版本（一键“确认已读”）、提交首件/批量日报；
   - 右侧抽屉随时打开**「本项目专属小优助手」**：实时问答规则细节，解答不了可一键点击**「转凌矩人工督导升级处理」**。
4. **QA 评估与预估账单**（代理端核心新增页）：
   - **上半区 `小优实时同步 · QA 评估与预估收益`**：逐日逐批显示`上传时长`、`有效时长`、`无效时长`、**小优拆解的具体无效原因与整改建议**，以及带明确标识的 **`QA 预估净收益（未决算）`**；
   - **下半区 `背靠背已确认实结账单`**：严格展示甲方已回款并附公户回单号的实结金额。

---

## 四、实施顺序（建议分 2 步稳步落地并全量测试）

1. **后端底座重塑（`src/db.js`, `src/server.js`, `src/seed.js`, `tests/api.test.js`）**：完成 5 张核心表重构、设备归因自动匹配算法、小优报表解析/人工核对流、规则版本广播回执、异常工单、改密/重置密码、CSV 导出与飞书 Webhook，并编写覆盖全部新风控铁律的端到端自动化测试。
2. **前端三端升级与浏览器全流程实测（`public/index.html`, `public/styles.css`, `public/app.js`）**：按 `v1.2.0` 专业矢量 SaaS 设计语言完成界面改造，在内置浏览器逐页实测并修复所有交互细节后同步推送 GitHub。
