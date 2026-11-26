# 凌矩具身数据资源与代理协同平台（`platform/` · v2.0.0）

- **定位**：凌矩 S2B 整包项目配额集成、小优上游 QA 隔离回流与标准化交付平台（区别于面向门店商家＋个人兼职采集员的 `miniapp/`）。
- **上位规范**：[v2.0 整包项目制与小优回流设计规范](../knowledge/strategy/2026-11-26_PLATFORM_V2_PROJECT_AND_XIAOYOU_SPEC.md) · [V1.0 六大模块定版与深清查报告](../knowledge/strategy/2026-11-26_AGENT_PLATFORM_V1_FINAL_SPEC_AND_FIRST_PRINCIPLES_AUDIT.md)
- **技术特点**：基于 **Node.js 22.13+ / 24 原生内置 `node:http` + `node:sqlite` + `node:crypto`**，**零第三方 npm 依赖**，运行时内存约 `30–50 MiB`，可直接在本机 Windows 或阿里云 `Alibaba Cloud Linux 3` 服务器稳定运行。

## 核心业务闭环（已系统级硬编码保护）
1. **无公开自主注册**：仅凌矩总控核验资质后后台发号（彻底堵死 C 类二道贩子乱注册），支持总控一键重置密码与个人自助改密。
2. **整包项目配额池 ＋ 动态规则广播**：支持 `1,000–10,000h` 项目总池、多代理切分进度条、甲方平台权限隔离模式（受限传片子账号 vs 全屏蔽中转）、以及 `规则版本变更提炼 + 代理必读回执`（未签收新规系统拦截批量日报）。
3. **设备/子账号绑定归因 ＋ 小优上游 QA 隔离回流墙**：审批锁单时强制绑定 `设备号清单 / 上传子账号`；小优抓回甲方评估后自动匹配代理、翻译 Bad 失格原因并算出 `QA 预估净收益（未决算）` 隔离回显给代理，代理无需也不能直登甲方后台看账看结算。
4. **专属项目小优一线 ＋ 人工异常升级台**：逻辑上每对 `(项目 × 代理)` 隔离上下文答疑，涉改价、QA 申诉、损赔或连续异常自动生成工单升级给凌矩人工督导（支持配置 `FEISHU_WEBHOOK_URL` 推飞书提醒）。
5. **全国场景双层池 ＋ 首件 1–2h 绿灯硬锁 ＋ 背靠背三方对账与 CSV 导出**：保留 `S1/S2` 隔离、首件试采 HTTP `403` 拦截及公户回单号校验，新增 UTF-8 BOM CSV 对账单导出。

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
