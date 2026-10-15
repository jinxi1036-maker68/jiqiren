# Phase 02A 隔离模拟运行说明

本目录是审计和模拟验收工具，不是生产管理系统。须先确认当前 Issue、Owner 授权与本机路径；禁止对真实后台套用演示脚本。

顺序：

1. 只读核实活动目录、配置及原环境指纹。`gate0_probe.py`生成本地备份清单；`protected_state.py`记录敏感指纹，输出仅布尔汇总。原目录正在变化时不能宣称全环境冻结。
2. 私有输出目录须限制ACL到当前Windows用户和SYSTEM。`encrypted_backup.py build`生成DPAPI封装密钥的AES-256-GCM加密包，`verify`隔离恢复并验证全部文件hash、SQLite完整性、认证解密和修改tag拒绝。SQLite使用只读online backup，包含已提交WAL；排除缓存、安装依赖、历史备份/测试树、锁、IPC与原WAL/SHM。`source_supplement.py`另存安装版本及非忽略的本地源码增补。两个备份均须通过恢复。
3. 不把任何private目录、加密包、恢复文件、路径清单、原.env或完整指纹提交GitHub。备份只在同一Windows DPAPI用户上下文验证；未证明跨电脑登录恢复或灾难恢复。浏览器/Electron资料只验证字节恢复和SQLite，未启动还原的旧身份或验证其LevelDB/登录可用性。
4. Gate 0通过后才运行`setup_profile.py`。它调用现有Hermes的`create_profile(..., no_alias=True, no_skills=True)`，使用新根，不clone、不切换全局profile。不继承旧任务、Skills、MCP、Cookie或旧记忆。新身份仅有岗位、最小偏好和knowledge入口。没有启动gateway/cron，工具集也不含调度工具；配置禁用字段只是补充，不作为唯一安全措施。
5. 模型调用前必须有Owner对具体服务的授权。当前授权仅本轮模拟复用Agnes.ai一项凭据；新.env仅留本机。`agent_session.py`每次清空继承的业务环境变量，再加载新profile的一项模型凭据。
6. `policy_test.mjs`单独验证MCP工具允许列表和外部导航拒绝，它不算Hermes本人实测。`run_sessions.py`启动仅监听127.0.0.1的虚拟页面，分别在新进程调用已安装Hermes AIAgent和SessionDB。任务是自然语言；导航、DOM读取与点击均由模型自主生成MCP调用。各会话的工具列表必须全部属于demo_browser，否则在模型调用前失败。
7. `browser_bridge.mjs`只暴露navigate/snapshot/click/close，校验精确origin；`loopback_guard.cjs`对页面请求补充origin拦截。既有Edge无账号隔离内存会话，不使用旧CDP/用户资料。Python写入保护只约束本测试Python进程，不是操作系统沙箱；子浏览器的请求拦截也不是全机网络隔离。
8. 人工核对真实工具轨迹与最终汇报；访问失败必须与无新增区分，虚拟QA通过不能当作业务验收。`protected_state.py after`复核原文件；只发布明确允许的脱敏证据，运行`publish_safety.py`检查已知本地秘密、令牌模式、完整本机路径及禁传类型。

回退只涉及本轮新实例：停止测试自己启动的进程，撤下新profile的临时模型凭据，保留新profile以供复核；原启动入口与配置保持原样。不得未经批准将恢复文件覆盖回原环境。需要原环境恢复时，先由Owner批准停止写入窗口，再审核一致恢复文件集和认证/调度边界。

备份演练是文件及数据库级验证；没有宣称旧业务登录、旧调度投递或生产应用全量恢复已验收。安装包、venv和可再生成缓存未复制，安装源码以固定Git版本和本地增补文件登记。
