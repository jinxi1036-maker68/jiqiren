# 凌矩具身数据资源与代理协同平台（`platform/` · V1.0）

- **定位**：凌矩 S2B 代理资源集成与标准化交付平台（区别于面向门店商家＋个人兼职采集员的 `miniapp/`）。
- **上位规范**：[六大模块定版规范与第一性原理深清查报告](../knowledge/strategy/2026-11-26_AGENT_PLATFORM_V1_FINAL_SPEC_AND_FIRST_PRINCIPLES_AUDIT.md)
- **技术特点**：基于 **Node.js 22.13+ / 24 原生内置 `node:http` + `node:sqlite` + `node:crypto`**，**零第三方 npm 依赖**，运行时内存约 `30–50 MiB`，可直接在本机 Windows 或现有阿里云 `Alibaba Cloud Linux 3 (1.83GiB RAM)` 服务器稳定运行。

## 核心业务闭环（已系统级硬编码保护）
1. **无公开自主注册**：仅凌矩总控核验资质后后台发号（彻底堵死 C 类二道贩子乱注册）。
2. **任务合规路径锁**：仅 `WRITTEN_SUBCONTRACT_APPROVED` 或 `LINGJU_UNIFIED_TEAM_ACCOUNT` 路径任务对代理可见；`DRAFT_INTERNAL_ONLY` 系统隐藏；V1.0 代理接口严格剥离上游真实名称与底价，仅展示“自带场景 / 用平台场景”两档代理净价。
3. **全国场景双层池 ＋ 30 秒零承诺留资页**：抖音实体老板免登录备案 → 进后台 `PENDING_REVIEW` → 总控归入 `S2_RESERVE`（脱敏上架，锁单后解锁真联系）或 `S1_BENCHMARK`（仅总控可见，用于反向撬动大甲方）。
4. **首件 1–2h 熔断绿灯硬锁**：任何新单（即使熟人特批免押）在未提交 1–2 小时首件试采并经总控点亮 `BATCH_GREEN_LIGHT` 前，系统以 HTTP `403` 强制拦截批量日报提交。
5. **背靠背三方对账台**：按批次推进 `PENDING_QA → PENDING_CLIENT_PAYMENT → CLIENT_PAID_READY_TO_SETTLE → SETTLED_PAID（必填公户回单号）`，自动核算代理税点扣除、场景方场地费与凌矩费前留存毛利。

## 本地快速启动（Windows / Linux 通用）
```bash
cd platform

# 1. 运行自动化全流程测试（验证防跳单、首件熔断、权限脱敏与三方对账）
npm test

# 2. 方式 A：初始化带虚构演示数据的本地库（仅用于体验和测试）
npm run seed:demo

# 2. 方式 B：正式试行初始化（仅建管理员账号，不带演示数据；请先用环境变量改强密码）
# INIT_ADMIN_USER=admin INIT_ADMIN_PASS='你的强密码' npm run seed:prod

# 3. 启动服务（默认 http://127.0.0.1:3810）
npm start
```

## 阿里云 Linux 服务器部署提示
- 系统服务模板见 `deploy/lingju-platform.service`（已设 `MemoryMax=180M`，保护 1.83GiB 宿主机内存不 OOM）。
- Nginx 反向代理模板见 `deploy/nginx-lingju-platform.conf`。
- **备案红线**：若需绑国内正式域名面向抖音外部用户公开访问，请先以「平顶山凌矩信息科技有限责任公司」主体完成工信部 ICP 备案与 HTTPS 证书配置。
- **隐私红线**：`data/*.db`、`data/.secret`、`.env` 已在 `.gitignore` 严格忽略，**严禁将真实生产库、密码或客户/老板手机号提交至 GitHub**。
