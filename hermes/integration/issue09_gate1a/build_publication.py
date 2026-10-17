"""Explicit non-sensitive export. Private contents never become upload inputs."""
from pathlib import Path
import datetime, hashlib, json, shutil
import yaml

B = Path(__file__).resolve().parent
P = B / 'private'
OUT = B.parent / 'hermes_issue09_gate1a_publication'
H = Path.home() / '.hermes'
D = Path.home() / 'AppData/Roaming/Hermes'
I = Path.home() / 'AppData/Local/hermes/hermes-agent'
W = H / 'company-workspace'
S = H / 'tools/company-browser-sdk'
T = H / 'tools/company-browser-simulation'
CODE = OUT / 'hermes/integration/issue09_gate1a'
EVIDENCE = OUT / 'hermes/evidence/issue09_gate1a'
CODE.mkdir(parents=True, exist_ok=True)
EVIDENCE.mkdir(parents=True, exist_ok=True)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read(name):
    return json.loads((P / name).read_text(encoding='utf-8'))


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def redact(value):
    if isinstance(value, list):
        return [redact(v) for v in value]
    if isinstance(value, dict):
        return {k: redact(v) for k, v in value.items()}
    if isinstance(value, str):
        for original, alias in ((str(B), '<DEV>'), (str(H), 'H'), (str(D), 'D'), (str(I), 'I'), (str(Path.home()), '<USER_HOME>')):
            value = value.replace(original, alias).replace(original.replace('\\', '/'), alias)
    return value


auth = read('authorization_local_only.json')
save(EVIDENCE / 'AUTHORIZATION.json', {'authorization_id': auth['auth']['id'], 'url': auth['auth']['url'], 'updated_at': auth['auth']['updated_at'], 'review_id': auth['reviews'][-1]['id'], 'review_url': auth['reviews'][-1]['url'], 'reviewed_commit': auth['reviews'][-1]['commit'], 'scope': 'Gate 1A only; original SOUL, workspace, minimal project directory, additive neutral synthetic MCP, maximum 3 original-Desktop model dialogues', 'dialogues_used': 0, 'not_authorized': ['MEMORY/USER rewrite or disable', 'old files/profiles/backups deletion', 'old MCP removal/disable', 'task/gateway modification', 'new model credentials', 'real LingSyn/backend/business/dispatch', 'PR merge/close/base change', 'Gate1B/Gate2']})
tx = read('transaction_local_only.json')
pre = read('preflight_local_only.json')
protection = read('protection_summary.json')
protection['rollback_readiness'] = read('rollback_readiness.json')
native = read('native_loading_result.json')
installed = read('component_installed_result.json')
development = read('component_development_result.json')
old_config = yaml.safe_load((P / 'isolated-restore-check/1').read_bytes())
current_config = yaml.safe_load((H / 'config.yaml').read_bytes())
new_binding = current_config['mcp_servers'].pop('company_browser_simulation')
assert old_config == current_config
manifest = json.loads((W / 'SNAPSHOT_MANIFEST.json').read_text(encoding='utf-8'))
new_files = []
for root in (W, S, T):
    for path in sorted(root.rglob('*')):
        if path.is_file():
            data = path.read_bytes()
            new_files.append({'path': redact(str(path)), 'bytes': len(data), 'sha256': digest(data)})
save(P / 'new_files_full_hash_manifest_local_only.json', new_files)
groups = []
for root in (W, S, T):
    prefix = redact(str(root)) + '\\'
    rows = [r for r in new_files if r['path'].startswith(prefix)]
    groups.append({'root': redact(str(root)), 'files': len(rows), 'bytes': sum(r['bytes'] for r in rows), 'manifest_sha256': digest(json.dumps(rows, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode())})
exact = {'authorization': auth['auth']['url'], 'status': tx['status'], 'before_after': redact(tx['original_file_before']), 'field_changes': [
 {'id': 'M-SOUL', 'target': 'H/SOUL.md', 'before': 'old body retained only in encrypted/private local protection', 'after_ref': 'PR #11@728de1b667de73c6c400d82c20d2ad3a9edc2807 hermes/preparation/issue09/drafts/SOUL.draft.md', 'after_sha256': tx['original_file_before'][0]['after_sha256']},
 {'id': 'C02', 'target': 'D/project-dir.json:dir', 'before': 'file absent', 'after': 'H/company-workspace', 'reason': 'Desktop source gives project-dir precedence; actual Desktop new-session cwd remains unobserved'},
 {'id': 'C05', 'target': 'H/config.yaml:mcp_servers.company_browser_simulation', 'before': 'absent', 'after': redact(new_binding)},
 {'id': 'C06', 'target': ['H/tools/company-browser-sdk', 'H/tools/company-browser-simulation'], 'before': 'absent', 'after': 'pinned neutral SDK closure and synthetic-only bridge'}],
 'preserved': {'terminal.cwd': old_config['terminal']['cwd'], 'old_MCP_bindings_equal_before': True, 'all_other_config_values_equal_before': True, 'all_old_config_bytes_preserved_except_single_added_MCP_line': False, 'MEMORY_USER_cron_hashes': redact([r for r in pre['files'] if any(x in r['path'] for x in ('MEMORY.md', 'USER.md', 'jobs.json'))]), 'memory_and_user_enabled': True, 'old_data_deletion': False, 'old_tasks_or_MCP_disabled': False},
 'new_root_manifests': groups,
 'new_non_vendor_files': [r for r in new_files if not r['path'].startswith(redact(str(S)) + '\\')],
 'sdk_root_anchor_sha256': digest((S / 'package.json').read_bytes()),
 'sdk_vendor_lock': 'SDK_DEPENDENCY_LOCK.json',
 'full_new_file_inventory': 'Local only full hash inventory; public root digests cover it, 93 package content manifests cover vendor closure.',
 'rollback_executed': False,
 'not_modified': ['H/memories/MEMORY.md', 'H/memories/USER.md', 'H/cron/jobs.json', 'OpenClaw Gateway', 'old MCP directories/bindings', 'Skills/scripts/sessions/state.db/checkpoints/browser profiles', 'model .env/auth', 'temporary test profiles/CMDs', 'old valid backups']}
# A precise byte check: deleting only the new flow-style line recreates old bytes.
before_bytes = (P / 'isolated-restore-check/1').read_bytes()
after_bytes = (H / 'config.yaml').read_bytes()
new_lines = [line for line in after_bytes.splitlines(keepends=True) if line.startswith(b'  company_browser_simulation: ')]
assert len(new_lines) == 1 and after_bytes.replace(new_lines[0], b'', 1) == before_bytes
exact['preserved']['all_old_config_bytes_preserved_except_single_added_MCP_line'] = True
save(EVIDENCE / 'EXACT_CHANGES.json', exact)
save(EVIDENCE / 'KNOWLEDGE_SNAPSHOT.json', manifest)
sdk_lock = json.loads((B.parent / 'hermes_issue09_preparation/private/dependency_bundle_sanitized.json').read_text(encoding='utf-8'))
save(EVIDENCE / 'SDK_DEPENDENCY_LOCK.json', sdk_lock)
save(CODE / 'TEMPLATE.redacted.json', redact(json.loads((T / 'template.json').read_text(encoding='utf-8'))))
save(CODE / 'GATE_1A_STATUS.redacted.json', redact(json.loads((W / 'GATE_1A_STATUS.json').read_text(encoding='utf-8'))))
save(EVIDENCE / 'VALIDATION.json', {'preflight': redact(pre), 'protection': protection, 'deployment': read('deployment_validation.json'), 'native_loader_probe': native, 'development_component_probe': redact(development), 'installed_component_probe': redact(installed), 'computer_use': {'attempts': 3, 'after_kernel_reset_attempted': True, 'error': 'failed to write kernel assets: 系统找不到指定的路径。 (os error 3)', 'before_app_selection': True, 'original_desktop_launched': False, 'scope': 'Codex Computer Use runtime failure, not proof that original Hermes Desktop is broken', 'UI_or_CLI_model_substitute_used': False}, 'acceptance': {'original_desktop_session_home_cwd': 'blocked_not_observed', 'identity_knowledge_limits_agent_response': 'not_run', 'QA_change_agent_task': 'not_run', 'partial_failure_agent_task': 'not_run', 'reopen_desktop_session': 'not_run', 'automatic_memory_review_or_reflow': 'not_run', 'model_service_availability': 'not_probed_no_dialogues', 'dialogues_used': 0, 'limit': 3, 'Gate1A_complete': False, 'Gate1B_or_Gate2_entered': False}, 'failures_retained': [
 {'stage': 'preflight probe', 'failure': 'own Windows venv redirector was initially counted as an unrelated Hermes process', 'correction': 'exclude only own PID and verified immediate-parent redirector; independent external process check found no original Hermes'},
 {'stage': 'development SDK verifier', 'failure': 'nested package files counted again in parent package digest', 'correction': 'match PR11 per-package digest rule and assert 3496 unique vendor files; all 93 package digests match'},
 {'stage': 'component attempt 1 and 2', 'failure': 'probe expected inline DOM in navigation result; this version returns a snapshot file link', 'correction': 'explicit browser_snapshot obtains inline DOM; stdout option alone does not change navigation snapshot behavior'},
 {'stage': 'component attempt 3', 'failure': 'probe used ref argument; installed click schema requires target', 'correction': 'use actual advertised target schema'},
 {'stage': 'component attempt 4', 'failure': 'probe expected one-line row; DOM snapshot contains separate cells', 'correction': 'assert ordered cells for DEMO-001 before DEMO-002'},
 {'stage': 'original Desktop acceptance', 'failure': 'Computer Use failed before app discovery', 'correction': 'not resolved; stop and report no real Agent acceptance'}], 'lifecycle_improvement': 'Host stdin EOF now closes the invocation Job and writes completion metadata; initial forced-close run had no final lifecycle marker but selected PIDs were absent.'})
for name in ('gate1a.py', 'verify_native_loading.py', 'test_component.mjs', 'launch_bridge.py', 'owned_job.py', 'browser_bridge.mjs', 'sdk_resolver.mjs', 'navigation_policy.mjs', 'loopback_guard.cjs', 'demo_server.mjs', 'HERMES.md', 'build_publication.py', 'validate_publication.py'):
    shutil.copyfile(B / name, CODE / name)
shutil.copyfile(P / 'stage/SOUL.md', CODE / 'SOUL.md')
assert digest((CODE / 'SOUL.md').read_bytes()) == tx['original_file_before'][0]['after_sha256']

basis = read('publication_basis_local_only.json')
current = json.loads(basis['knowledge/CURRENT_WORK.json'])
track = current['parallel_development_track']
track.update(status='gate1a_minimal_original_files_applied_desktop_acceptance_blocked', issue='https://github.com/jinxi1036-maker68/jiqiren/issues/9', current_phase='Gate1A最小原身份接入已落盘；原Desktop真实Agent验收尚缺，停止待审', current_limits='原SOUL/工作区/新增模拟MCP已接入并经原生加载函数与浏览器组件验证；原Desktop未启动、模型对话0/3；旧MEMORY/USER仍加载且未改写；旧MCP与任务保留；没有真实后台、派单或值班。', next_gate='先审阅本轮实际变更及桌面控制工具阻塞；恢复后仍须原Desktop少量真实Agent验收。不得自动进入Gate1B/Gate2或清理旧资料。', gate1a_authorization=auth['auth']['url'], gate1a_report='hermes/reports/ISSUE_09_GATE_1A_MINIMAL_ORIGINAL_INTEGRATION.md', gate1a_desktop_acceptance='blocked_before_app_discovery', gate1a_model_dialogues_used=0, gate1a_old_memory_user='preserved_enabled_and_still_in_native_loader', gate1a_preparation_pr='https://github.com/jinxi1036-maker68/jiqiren/pull/11', gate0_plan_pr='https://github.com/jinxi1036-maker68/jiqiren/pull/10')
assert {k:v for k,v in current.items() if k!='parallel_development_track'} == {k:v for k,v in json.loads(basis['knowledge/CURRENT_WORK.json']).items() if k!='parallel_development_track'}
save(OUT / 'knowledge/CURRENT_WORK.json', current)
index = json.loads(basis['knowledge/PROJECT_INDEX.json'])
index['hermes_digital_employee'].update(implementation_state='gate1a_original_soul_workspace_synthetic_mcp_applied_pending_desktop_acceptance', implementation_report='hermes/reports/ISSUE_09_GATE_1A_MINIMAL_ORIGINAL_INTEGRATION.md', implementation_caveat='仅原生加载函数及真实浏览器组件验证；原Desktop模型对话0/3，旧记忆仍加载，未完成单身份运行验收，未进入Gate1B/Gate2。')
assert {k:v for k,v in index.items() if k!='hermes_digital_employee'} == {k:v for k,v in json.loads(basis['knowledge/PROJECT_INDEX.json']).items() if k!='hermes_digital_employee'}
save(OUT / 'knowledge/PROJECT_INDEX.json', index)
readme = basis['hermes/README.md']
a = readme.index('## 当前阶段')
z = readme.index('## 读取业务上下文', a)
readme = readme[:a] + '''## 当前阶段（2026-10-16）

**Gate1A最小原身份接入已落盘，完整验收未通过/尚未完成。** 原SOUL、18份可追溯知识、Desktop默认公司工作区及新增中性模拟MCP已放入原H；原生加载函数和已落盘的真实浏览器组件验证通过。Computer Use在应用发现前报资源路径不存在，原Desktop未启动、实际Agent对话0/3；未用CLI测试冒充原入口验收。旧MEMORY/USER保留并仍会加载，语义冲突与自动回流待真实会话验证。没有真实灵生访问、派单、自动值班或旧资料清理。

- [本轮实际实施、失败、回退和遗留事项](reports/ISSUE_09_GATE_1A_MINIMAL_ORIGINAL_INTEGRATION.md)
- [精确变更及哈希](evidence/issue09_gate1a/EXACT_CHANGES.json) / [验证记录](evidence/issue09_gate1a/VALIDATION.json)
- [本轮实现与使用限制](integration/issue09_gate1a/README.md)
- 继承[PR #10](https://github.com/jinxi1036-maker68/jiqiren/pull/10)和[PR #11](https://github.com/jinxi1036-maker68/jiqiren/pull/11)；二者及#6/#8仍未合并，未改base。
- 已有Phase01/02A/02B审计、备份和模型结果是历史证据，本轮没有重跑全量审计/备份/模型矩阵。

''' + readme[z:]
(OUT / 'hermes/README.md').write_text(readme, encoding='utf-8')
changelog = basis['hermes/CHANGELOG.md']
pos = changelog.index('## 2026-10-15')
entry = '''## 2026-10-16｜Issue #9 Gate1A最小接入（完整验收待审）

- 继承PR #10/#11及既有审计/备份/测试，按Owner评论6213175793实施原SOUL、最小公司知识工作区、C02及新增C05/C06；原MEMORY/USER与旧MCP、任务、资料保留。
- 四文件最小AES-GCM/DPAPI恢复包隔离解密/逐字节校验通过；93包3496文件依赖与已审中性副本一致。
- 已落盘的真实Playwright/Edge组件验证QA变化、部分分页503、越界拒绝与进程回收；原生加载函数读取新SOUL和工作区，旧40+27条记忆仍加载。
- 原Desktop未启动：Computer Use在应用发现前初始化失败。实际模型对话0/3，不能宣告原入口/自主任务/上下文截断/自动记忆回流通过；保留探针早期失败。
- [完整本轮报告](reports/ISSUE_09_GATE_1A_MINIMAL_ORIGINAL_INTEGRATION.md)。到此停止，不进入Gate1B/Gate2，不合并旧PR。

'''
(OUT / 'hermes/CHANGELOG.md').write_text(changelog[:pos] + entry + changelog[pos:], encoding='utf-8')
history = (B.parent / 'hermes_issue09_preparation_publication/knowledge/history/HERMES_PRODUCT_EVOLUTION_2026-10-16.md').read_text(encoding='utf-8').rstrip()
assert history.startswith(basis['knowledge/history/HERMES_PRODUCT_EVOLUTION_2026-10-16.md'].rstrip())
history += '''

## 13. Owner授权Gate1A，原环境最小接入已落盘，Desktop验收受阻

2026-10-16，PR #11第二轮审查指出旧记忆整写、可读知识路径、SDK正式落盘、原入口验收和PR整合风险；随后Owner在Issue #9评论6213175793正式批准最小可回退接入，仍未批准MEMORY/USER改写、旧资料删除、任务/旧MCP停用、新凭据或真实灵生操作。

本轮对少数目标预检，版本和5个原文件hash匹配已审基线。四文件加密增量在隔离位置解密和逐字节恢复验证通过；没有重做全量备份。原SOUL使用PR #11固定版本，增加18文件公司知识副本、仅Desktop项目目录C02及中性模拟MCP C05/C06；terminal.cwd、旧MCP和记忆开关保留。93包3496个第三方文件校验一致。

原生加载函数能读取新SOUL与工作区入口；旧MEMORY40条和USER27条仍加载，未清理，真实身份冲突/自动回流未验。开发区与正式落盘位置的真实浏览器组件验证通过（QA变化、部分分页503、外站/猜路由/evaluate拒绝、子进程回收），这是脚本组件验证。保留了进程过滤、依赖计数、DOM文件链接/参数/断言格式探针的早期失败。

Computer Use工具在应用发现前报“failed to write kernel assets / path not found”，有界重试和重置后仍失败；没有启动原Desktop，没有模型对话（0/3），未以CLI模型冒充原入口。原Desktop实际home/cwd/新会话/工具集/完整提示截断、Hermes自主QA判断及旧记忆回流尚未验收。原有程序是否有界面故障未知，不能由开发工具失败推断。

最小接入文件保持已应用、未自动回退：没有观察到原Hermes本身的身份冲突/入口失效或越界触发条件；也没有证据足以宣告运行验收成功。恢复点和逐项回退办法留本机，待Owner/ChatGPT审阅决定后续。同一员工、无第二日常入口；无真实后台、外发、派单或自动值班，PR #6/#8/#10/#11未合并/关闭/改base，停止在Gate1A。
'''
dest = OUT / 'knowledge/history/HERMES_PRODUCT_EVOLUTION_2026-10-16.md'
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(history, encoding='utf-8')
print(json.dumps({'publication_generated': True, 'new_root_groups': groups, 'non_vendor_new_files': len(exact['new_non_vendor_files']), 'governance_business_fields_preserved': True}))
