# `platform/` 开发 Agent 强制约束

所有后续接手开发、改版或部署凌矩代理资源平台（`platform/`）的 AI / 开发者必须遵守以下底线：

1. **先读定版规范**：改动业务逻辑前，必须先读 `knowledge/strategy/2026-11-26_AGENT_PLATFORM_V1_FINAL_SPEC_AND_FIRST_PRINCIPLES_AUDIT.md` 与 `platform/CHANGELOG.md`，不得私自推翻 Owner 已锁定的六大模块规则。
2. **严禁破坏五条系统级红线**：
   - 严禁放开 `/api/auth/register` 公开注册；
   - 严禁在 `/api/agent/*` 接口返回 `upstream_name_internal`、`upstream_base_rate_cny`、`lingju_pre_overhead_margin_cny`、`S1_BENCHMARK` 场景或未锁单场景的真实店名/电话/地址；
   - 严禁允许任何代理（含 `ACQUAINTANCE_WAIVED` 熟人特批）跳过 `FIRST_PIECE_TRIAL → BATCH_GREEN_LIGHT` 直接提交 `BATCH` 批量日报；
   - 严禁在未填写 `payout_receipt_ref` 公户回单号时将账单标记为 `SETTLED_PAID`；
   - 严禁将 `DRAFT_INTERNAL_ONLY` 任务暴露给代理大厅。
3. **保持极简低内存（适配 1.83GiB 宿主机）**：非必要不引入重型 npm 依赖、消息队列或视频存储；保持 `npm test` 零外部依赖快速通过。
4. **隐私与版本纪律**：严禁提交真实 `.db`、`.secret`、`.env`、真实客户单价表或实名老板联系方式到 GitHub；每次改版同步更新 `platform/CHANGELOG.md` 并附自动化测试验证结果。
