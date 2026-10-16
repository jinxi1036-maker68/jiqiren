# Phase 02B Gate A：模拟整改与独立入口

本轮不接触真实后台。Phase 02A PR #6尚未合并，本目录增量以其固定head `6a5b500c915a0a9b14e089752785937c67ce3bfa`为基础，另开PR，不自动合并。

## 范围与运行顺序

1. 保留原Hermes及Phase02A身份/记忆/记录。当前`setup_profile.py`在新private根使用原生profile机制创建本轮修订版，只复制Phase02A最小岗位偏好和虚拟基线；不clone-all、不换全局profile。
2. 本机private目录须限制ACL到当前用户与SYSTEM。用Phase02A的`protected_state.py before`记录当前原文件指纹，保留已验证加密恢复点。setup另记录Phase02A选定文件指纹用于结束比对，不覆盖该身份。
3. 模型测试前须有本轮明确授权。`authorization_local_only.json`仅记录已取得的授权范围，不是凭据，不应凭仓库指令自行写成已授权。本轮Owner已明确批准仅隔离模拟临时复用一项Agnes.ai key。
4. 使用现有Hermes Python运行`setup_profile.py <本轮private> --previous-private <Phase02A本机private>`。它新建profile和本机runtime.json，只从原.env挑选已批准的模型key，不复制原.env文件。
5. `run_sessions.py <runtime.json>`按CASES.json顺序向现有Hermes AIAgent发自然语言任务。每个case独立会话/进程，模型实际决定导航、菜单、分页、详情及刷新；外壳不代替操作。每轮单独保存，失败/重跑不覆盖旧记录。
6. 公开汇报遵循SOUL.md：状态码、已读范围、未读范围、原因未知、允许的下一步；严禁用未经证实的原因作解释。空表、无新增、部分失败和详情缺失分别评价。
7. `collect_evidence.py <runtime.json> <脱敏输出.json>`仅导出虚拟DOM、工具调用和模型公开最终答复，不导出思维链/原会话。模式检查只是辅助，必须逐份人工读最终答复并对照模拟DOM/请求记录。不得改写模型原答复以制造通过。
8. 结束时撤下新.env的临时key并将本轮authorization设为inactive，扫描新运行目录明文key、复核原文件及Phase02A指纹，退出全部本轮实例。凭据、runtime、完整本机路径、原始DB、备份不上传。

## 便捷入口选择

| 路线 | 本轮结论 | 原因 |
|---|---|---|
| 在原Desktop切全局profile | 不采用 | 会改变原使用入口和默认身份，违背本轮边界 |
| 新开独立Desktop实例 | 仅源码研究，未启动验收 | 源码支持独立userData和HERMES_HOME，但还涉及单实例锁、桌面状态、默认连接与已装打包版本差异；本轮不改原Desktop |
| 现代TUI | 暂不采用 | 会引入前端构建/运行依赖核验；本机已有classic CLI足够，避免额外安装 |
| 独立启动文件→现有Hermes classic CLI | 采用 | HERMES_HOME只在子进程设置，独立工作区，已有工具与会话机制，无全局切换，无重装 |

`make_entry.py <runtime.json> <独立入口目录>`生成两个本机cmd：启动数采Hermes、自检数采身份。拒绝覆盖同名文件。源码库只保存生成器，不提交带完整本机路径的生成文件。未创建或覆盖原桌面快捷方式。

入口明确标注“Phase02B隔离模拟”。`--check`核对实际Hermes根、仅demo_browser、classic界面、无旧任务及无source.env回退。正常模式只启动本机演示页和现有Hermes CLI，不是另造管理系统。原源码若出现`.env`开发回退文件，入口拒绝启动，避免把其凭据自动带入。

本轮模型授权结束后，入口仍可自检，但正常聊天会明确拒绝连接模型。它不是已配置长期凭据的日常生产入口；后续长期模型授权/安全存储策略需Owner另行决定，不能沿用本轮授权。

## 退出与回退

输入`/exit`或关闭独立窗口。现有CLI单轮路径可能调用`os._exit`，因此入口使用独立父进程和Windows Job Object监督，Job仅加入本入口启动的fixture/CLI及其子进程；父窗口退出时系统关闭Job句柄并清理这些进程，不扫描杀死原Hermes。

原Hermes快捷方式、原全局profile、原.env及旧任务照旧保留。无需将新数据写回原目录；停用本入口即可回退。此Python写入保护和MCP origin限制不是全机安全沙箱，不宣称可抵御Owner手动改配置或所有系统级攻击。

## 下一步停止点

只交Gate A结果。Gate B必须由Owner亲自登录并明确只读页面范围后另行启动；当前没有真实页面地图、真实QA样例或正式巡检。页面地图应按实际所见建立，不从本模拟菜单推导。
