"""Issue #9 Gate 1A bounded transaction. Never loads credentials or runs models.

Protection reuses Phase 02A DPAPI implementation; the prior full backup stays intact.
No cleanup, service/task control, global profile switch, or MEMORY/USER write.
"""
from pathlib import Path
import argparse, base64, datetime, hashlib, importlib.util, json, os, re, shutil, subprocess, sys
import yaml
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

BASE = Path(__file__).resolve().parent
PRIVATE = BASE / 'private'
HOME = Path.home() / '.hermes'
DESKTOP = Path.home() / 'AppData/Roaming/Hermes'
INSTALL = Path.home() / 'AppData/Local/hermes/hermes-agent'
WORKSPACE = HOME / 'company-workspace'
SDK = HOME / 'tools/company-browser-sdk'
BRIDGE = HOME / 'tools/company-browser-simulation'
PROJECT = DESKTOP / 'project-dir.json'
PRIOR = BASE.parent / 'hermes_issue09_preparation/private'
PIN = '053b5b4cd2476fdf6df68e2c924a6b1c7d28e080'
APPROVED_SOUL_REF = '728de1b667de73c6c400d82c20d2ad3a9edc2807'
AUTH = 'https://github.com/jinxi1036-maker68/jiqiren/issues/9#issuecomment-6213175793'
PROTECTED = [HOME / p for p in ('SOUL.md', 'config.yaml', 'memories/MEMORY.md', 'memories/USER.md')]
COMPONENTS = ('launch_bridge.py', 'owned_job.py', 'browser_bridge.mjs', 'sdk_resolver.mjs', 'navigation_policy.mjs', 'loopback_guard.cjs', 'demo_server.mjs')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def original_running():
    # No command lines or environment values are emitted.
    # Exclude our own PID and ONLY a verified direct-parent venv redirector for
    # this exact script. An original Hermes/Desktop parent must still block.
    python_path = str(INSTALL / 'venv/Scripts/python.exe').replace("'", "''")
    script_name = Path(__file__).name.replace("'", "''")
    own_parent = "($_.ProcessId -eq " + str(os.getppid()) + " -and $_.Name -eq 'python.exe' -and $_.ExecutablePath -eq '" + python_path + "' -and $_.CommandLine -like '*" + script_name + "*')"
    script = "Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne " + str(os.getpid()) + " -and -not " + own_parent + " -and ($_.Name -eq 'Hermes.exe' -or ($_.Name -match '^python(w)?\\.exe$' -and $_.ExecutablePath -like '*hermes*')) } | Select-Object ProcessId,Name | ConvertTo-Json -Compress"
    result = subprocess.check_output(['powershell.exe', '-NoProfile', '-Command', script], creationflags=subprocess.CREATE_NO_WINDOW).decode('utf-8').strip()
    return json.loads(result) if result else []


def preflight():
    expected = json.loads((PRIOR / 'watched_hashes_local_only.json').read_text(encoding='utf-8'))
    selected = PROTECTED + [HOME / 'cron/jobs.json']
    rows = [{'path': str(p), 'sha256': sha(p.read_bytes()), 'matches_reviewed': sha(p.read_bytes()) == expected[str(p)]} for p in selected]
    if not all(x['matches_reviewed'] for x in rows):
        raise RuntimeError('A selected original file differs from PR #11; stop for review')
    running = original_running()
    if running:
        raise RuntimeError('Original Hermes is in use; no termination is permitted')
    if os.environ.get('HERMES_HOME') != str(HOME):
        raise RuntimeError('Effective HERMES_HOME differs from reviewed root')
    if (HOME / 'active_profile').exists():
        raise RuntimeError('Unexpected active profile override')
    for p in (PROJECT, WORKSPACE, SDK, BRIDGE):
        if p.exists():
            raise FileExistsError('Expected new target is occupied: ' + str(p))
    git_env = dict(os.environ, GIT_OPTIONAL_LOCKS='0')
    head = subprocess.check_output(['git', '-C', str(INSTALL), 'rev-parse', 'HEAD'], env=git_env).decode().strip()
    if head != '8794e5a21c980a0f26532cb4883284b786cb3f25':
        raise RuntimeError('Installed source version drift')
    subprocess.check_call(['git', '-C', str(INSTALL), 'diff', '--exit-code', '--quiet', 'HEAD', '--', 'agent/prompt_builder.py', 'tools/memory_tool.py', 'apps/desktop/electron/main.ts'], env=git_env)
    result = {'at_utc': now(), 'files': rows, 'original_running': running, 'source_head': head, 'new_targets_absent': True, 'home': str(HOME), 'model_calls': 0}
    dump(PRIVATE / 'preflight_local_only.json', result)
    print(json.dumps({'preflight': 'passed', 'selected_hashes': len(rows), 'new_targets_absent': True, 'original_running': False}))


def dpapi(data, decrypt=False):
    # Exact reviewed implementation, loaded without invoking its CLI/build.
    filename = BASE.parent / 'hermes_phase02a/encrypted_backup.py'
    spec = importlib.util.spec_from_file_location('inherited_protection', filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.dpapi(data, decrypt)


def protect():
    preflight()
    archive = PRIVATE / 'gate1a-before.aesgcm.json'
    if archive.exists():
        raise FileExistsError('Never overwrite a recovery point')
    rows = [{'path': str(p), 'sha256': sha(p.read_bytes()), 'data_b64': base64.b64encode(p.read_bytes()).decode()} for p in PROTECTED]
    payload = json.dumps({'files': rows, 'absent': [str(PROJECT)], 'new_directories_absent': [str(p) for p in (WORKSPACE, SDK, BRIDGE)]}).encode()
    key, nonce = os.urandom(32), os.urandom(12)
    aad = b'Issue9-Gate1A-minimal-2026-10-16-v1'
    cipher = AESGCM(key).encrypt(nonce, payload, aad)
    envelope = {'format': aad.decode(), 'algorithm': 'AES-256-GCM', 'key_wrap': 'Windows-DPAPI-CurrentUser', 'wrapped_key_b64': base64.b64encode(dpapi(key)).decode(), 'nonce_b64': base64.b64encode(nonce).decode(), 'ciphertext_b64': base64.b64encode(cipher).decode()}
    with archive.open('x', encoding='utf-8') as output:
        json.dump(envelope, output)
    restored_key = dpapi(base64.b64decode(envelope['wrapped_key_b64']), True)
    restored = json.loads(AESGCM(restored_key).decrypt(nonce, cipher, aad))
    restore = PRIVATE / 'isolated-restore-check'
    restore.mkdir(exist_ok=False)
    for i, row in enumerate(restored['files']):
        data = base64.b64decode(row['data_b64'])
        out = restore / str(i)
        out.write_bytes(data)
        if sha(out.read_bytes()) != row['sha256']:
            raise RuntimeError('Restored byte hash mismatch')
    (PRIVATE / 'SOUL.before.md').write_bytes(base64.b64decode(restored['files'][0]['data_b64']))
    try:
        AESGCM(restored_key).decrypt(nonce, cipher[:-1] + bytes([cipher[-1] ^ 1]), aad)
    except InvalidTag:
        pass
    else:
        raise RuntimeError('Tamper was not rejected')
    dump(PRIVATE / 'protection_summary.json', {'at_utc': now(), 'archive_sha256': sha(archive.read_bytes()), 'encrypted_bytes': archive.stat().st_size, 'files_verified': len(rows), 'decryption_and_byte_restore_verified': True, 'tamper_rejected': True, 'same_windows_user_required': True, 'state_db_or_desktop_runtime_backup': False, 'reason': 'No original Desktop/model conversation has been started; no state database is to be modified by this transaction.', 'retention': 'Review at acceptance+7d; Owner disposition required at +14d; never auto-destroy.'})
    print(json.dumps({'protection': 'verified', 'files': len(rows), 'encrypted_bytes': archive.stat().st_size, 'state_db_not_copied': True}))


def check_sdk(root):
    graph = json.loads((PRIOR / 'dependency_graph_local_only.json').read_text(encoding='utf-8'))
    expected = json.loads((PRIOR / 'dependency_bundle_sanitized.json').read_text(encoding='utf-8'))
    actual = []
    for pkg in graph['packages']:
        folder = root / 'node_modules' / pkg['relative']
        manifest = json.loads((folder / 'package.json').read_text(encoding='utf-8'))
        if (manifest['name'], manifest['version']) != (pkg['name'], pkg['version']):
            raise RuntimeError('Vendor package/version mismatch')
        digest, count = hashlib.sha256(), 0
        for p in sorted(folder.rglob('*')):
            # PR #11 digested each package before its separately locked nested
            # node_modules children were inserted. Count each package once.
            if 'node_modules' in p.relative_to(folder).parts:
                continue
            if p.is_symlink():
                raise RuntimeError('Link is not authorized in neutral dependency closure')
            if p.is_file():
                digest.update(p.relative_to(folder).as_posix().encode() + b'\0' + hashlib.sha256(p.read_bytes()).digest())
                count += 1
        actual.append({'name': pkg['name'], 'version': pkg['version'], 'license': pkg['license'], 'copied_files': count, 'content_manifest_sha256': digest.hexdigest()})
    if actual != expected['packages']:
        raise RuntimeError('Neutral vendor closure differs from verified PR #11 bundle')
    assert sum(p.is_file() for p in (root / 'node_modules').rglob('*')) == expected['copied_files']
    return {'packages': len(actual), 'vendor_files': sum(x['copied_files'] for x in actual), 'all_package_digests_match_reviewed_bundle': True}


def make_stage():
    stage = PRIVATE / 'stage'
    # Resume is limited to our own incomplete dev stage; no original path here.
    stage.mkdir(exist_ok=True)
    data = json.loads((PRIVATE / 'sources_exact_local_only.json').read_text(encoding='utf-8'))
    assert data['main_ref'] == PIN and data['soul_ref'] == APPROVED_SOUL_REF
    draft = BASE.parent / 'hermes_issue09_preparation_publication/hermes/preparation/issue09/drafts/SOUL.draft.md'
    assert draft.read_text(encoding='utf-8').strip() == data['soul'].strip()
    (stage / 'SOUL.md').write_bytes(data['soul'].encode('utf-8'))
    workspace = stage / 'workspace'
    workspace.mkdir(exist_ok=True)
    manifest = []
    for relative, content in data['files'].items():
        dest = (workspace / relative).resolve()
        if not dest.is_relative_to(workspace.resolve()):
            raise ValueError('Knowledge path traversal')
        dest.parent.mkdir(parents=True, exist_ok=True)
        raw = content.encode('utf-8')
        dest.write_bytes(raw)
        git_sha = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        manifest.append({'path': relative, 'bytes': len(raw), 'sha256': sha(raw), 'git_blob_sha': git_sha, 'source_url': 'https://github.com/jinxi1036-maker68/jiqiren/blob/' + PIN + '/' + relative})
    shutil.copyfile(BASE / 'HERMES.md', workspace / 'HERMES.md')
    dump(workspace / 'SNAPSHOT_MANIFEST.json', {'repository': 'jinxi1036-maker68/jiqiren', 'ref': PIN, 'files': manifest, 'not_a_full_repository': True, 'local_missing_links': 'Uncached references require an explicit later developer refresh; never assume their business content or acquire credentials.'})
    dump(workspace / 'GATE_1A_STATUS.json', {'authorization': AUTH, 'only_original_home': str(HOME), 'phase': 'gate1a_partial_install_pending_original_desktop_acceptance', 'memory_user_rewritten': False, 'real_backend_authorized': False, 'model_dialogues_used': 0, 'desktop_acceptance': 'blocked: Computer Use kernel asset path does not exist', 'repository_main_snapshot_is_not_latest_deployment_state': True, 'next_gate': 'Owner and ChatGPT review required'})
    sdk = stage / 'sdk'
    if not sdk.exists():
        shutil.copytree(PRIOR / 'neutral-sdk', sdk)
    sdk_result = check_sdk(sdk)
    bridge = stage / 'bridge'
    bridge.mkdir(exist_ok=True)
    for name in COMPONENTS:
        shutil.copyfile(BASE / name, bridge / name)
    template = {'node': r'C:\Program Files\nodejs\node.exe', 'mcpCli': str(HOME / 'tools/playwright-mcp/node_modules/@playwright/mcp/cli.js'), 'browser': r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', 'guard': str(BRIDGE / 'loopback_guard.cjs'), 'profile': str(HOME), 'workspace': str(WORKSPACE), 'sdkAnchorPackage': str(SDK / 'package.json')}
    dump(bridge / 'template.json', template)
    for path in (template['node'], template['mcpCli'], template['browser'], INSTALL / 'venv/Scripts/python.exe'):
        if not Path(path).is_file():
            raise FileNotFoundError('A reviewed required executable is unavailable')
    original = (HOME / 'config.yaml').read_bytes()
    original_config = yaml.safe_load(original)
    assert original_config['terminal']['cwd'] == '.'
    assert 'company_browser_simulation' not in original_config['mcp_servers']
    binding = {'command': str(INSTALL / 'venv/Scripts/python.exe'), 'args': ['-I', '-B', str(BRIDGE / 'launch_bridge.py'), str(BRIDGE / 'template.json')], 'enabled': True}
    marker = re.search(rb'(?m)^mcp_servers:[ \t]*\r?\n', original)
    if not marker:
        raise RuntimeError('Unexpected MCP yaml structure; refuse broad rewrite')
    newline = b'\r\n' if b'\r\n' in original else b'\n'
    insertion = b'  company_browser_simulation: ' + json.dumps(binding, ensure_ascii=False).encode('utf-8') + newline
    changed = original[:marker.end()] + insertion + original[marker.end():]
    after = yaml.safe_load(changed)
    assert after['mcp_servers'].pop('company_browser_simulation') == binding
    assert after == original_config
    (stage / 'config.yaml').write_bytes(changed)
    dump(stage / 'project-dir.json', {'dir': str(WORKSPACE)})
    dump(PRIVATE / 'stage_summary.json', {'at_utc': now(), 'soul_ref': APPROVED_SOUL_REF, 'knowledge_ref': PIN, 'knowledge_files': len(manifest), 'sdk': sdk_result, 'config_change_only_added_mcp_binding': True, 'terminal_cwd_unchanged': True, 'desktop_project_setting_only': True, 'binding': binding})
    print(json.dumps({'stage': 'ready', 'knowledge_files': len(manifest), **sdk_result}))


def deploy():
    preflight()
    summary = json.loads((PRIVATE / 'protection_summary.json').read_text())
    if not summary['decryption_and_byte_restore_verified']:
        raise RuntimeError('Verified protection is mandatory before original changes')
    stage = PRIVATE / 'stage'
    before = json.loads((PRIVATE / 'preflight_local_only.json').read_text(encoding='utf-8'))
    for row in before['files']:
        if sha(Path(row['path']).read_bytes()) != row['sha256']:
            raise RuntimeError('Concurrent change since protection')
    tx = {'started_at_utc': now(), 'authorization': AUTH, 'original_file_before': [], 'added_roots': [], 'status': 'in_progress'}
    dump(PRIVATE / 'transaction_local_only.json', tx)
    for src, dest in ((stage / 'workspace', WORKSPACE), (stage / 'sdk', SDK), (stage / 'bridge', BRIDGE)):
        tx['added_roots'].append(str(dest))
        dump(PRIVATE / 'transaction_local_only.json', tx)
        shutil.copytree(src, dest)
    check_sdk(SDK)
    for src, dest in ((stage / 'SOUL.md', HOME / 'SOUL.md'), (stage / 'config.yaml', HOME / 'config.yaml'), (stage / 'project-dir.json', PROJECT)):
        tx['original_file_before'].append({'path': str(dest), 'before_sha256': sha(dest.read_bytes()) if dest.exists() else None, 'after_sha256': sha(src.read_bytes())})
        dump(PRIVATE / 'transaction_local_only.json', tx)
        dest.write_bytes(src.read_bytes())
    tx.update(status='applied_pending_desktop_acceptance', completed_at_utc=now())
    dump(PRIVATE / 'transaction_local_only.json', tx)
    verify()


def verify():
    stage = PRIVATE / 'stage'
    tx = json.loads((PRIVATE / 'transaction_local_only.json').read_text(encoding='utf-8'))
    for row in tx['original_file_before']:
        assert sha(Path(row['path']).read_bytes()) == row['after_sha256']
    for stage_dir, target in ((stage / 'workspace', WORKSPACE), (stage / 'sdk', SDK), (stage / 'bridge', BRIDGE)):
        expected_names = {src.relative_to(stage_dir).as_posix() for src in stage_dir.rglob('*') if src.is_file()}
        actual_names = {p.relative_to(target).as_posix() for p in target.rglob('*') if p.is_file()}
        extras = actual_names - expected_names
        if target != BRIDGE:
            assert not extras, 'Unknown files in a newly added target require review'
        elif extras:
            result_file = PRIVATE / 'component_installed_result.json'
            assert result_file.is_file(), 'Unrecorded browser run needs review'
            owned_run = json.loads(result_file.read_text(encoding='utf-8'))
            assert owned_run['passed'] and all(p.startswith('runs/' + owned_run['run_id'] + '/') for p in extras)
        for src in stage_dir.rglob('*'):
            if src.is_file():
                assert sha(src.read_bytes()) == sha((target / src.relative_to(stage_dir)).read_bytes())
    expected = json.loads((PRIOR / 'watched_hashes_local_only.json').read_text(encoding='utf-8'))
    untouched = [HOME / p for p in ('memories/MEMORY.md', 'memories/USER.md', 'cron/jobs.json')]
    assert all(sha(p.read_bytes()) == expected[str(p)] for p in untouched)
    cached = json.loads((WORKSPACE / 'SNAPSHOT_MANIFEST.json').read_text(encoding='utf-8'))
    for row in cached['files']:
        assert sha((WORKSPACE / row['path']).read_bytes()) == row['sha256']
    index = json.loads((WORKSPACE / 'knowledge/PROJECT_INDEX.json').read_text(encoding='utf-8'))
    current = json.loads((WORKSPACE / 'knowledge/CURRENT_WORK.json').read_text(encoding='utf-8'))
    assert index['current']['active_work_item_id'] == current['work_item_id']
    required = ('knowledge/00_START_HERE.md', 'knowledge/CURRENT_WORK.json', 'knowledge/HERMES_DIGITAL_EMPLOYEE_CHARTER.md', 'knowledge/KNOWLEDGE_HARNESS.json')
    assert all((WORKSPACE / p).is_file() for p in required)
    result = {'at_utc': now(), 'applied_file_hashes_match_stage': True, 'old_memory_user_cron_unchanged': True, 'knowledge_readable_and_work_item_consistent': True, 'knowledge_files': len(cached['files']), 'sdk': check_sdk(SDK), 'real_desktop_model_acceptance': False, 'original_desktop_started': False, 'model_dialogues_used': 0}
    dump(PRIVATE / 'deployment_validation.json', result)
    print(json.dumps(result))


def check_rollback():
    # Non-mutating preconditions shared by the actual, explicitly invoked restore.
    if original_running():
        raise RuntimeError('Do not restore over a running original Hermes')
    tx = json.loads((PRIVATE / 'transaction_local_only.json').read_text(encoding='utf-8'))
    envelope = json.loads((PRIVATE / 'gate1a-before.aesgcm.json').read_text())
    payload = json.loads(AESGCM(dpapi(base64.b64decode(envelope['wrapped_key_b64']), True)).decrypt(base64.b64decode(envelope['nonce_b64']), base64.b64decode(envelope['ciphertext_b64']), envelope['format'].encode()))
    originals = {row['path']: row for row in payload['files']}
    inventory = PRIVATE / 'new_files_full_hash_manifest_local_only.json'
    if not inventory.is_file():
        raise RuntimeError('Final owned-file manifest is required before rollback')
    expected_new = json.loads(inventory.read_text(encoding='utf-8'))
    # Public aliases in this local manifest are expanded only against exact roots.
    expected_files = {str(HOME) + row['path'][1:]: row['sha256'] for row in expected_new}
    actual_files = {str(p): sha(p.read_bytes()) for root in (WORKSPACE, SDK, BRIDGE) for p in root.rglob('*') if p.is_file()}
    if actual_files != expected_files:
        raise RuntimeError('New roots changed or contain unknown files; no broad move permitted')
    for row in tx['original_file_before']:
        p = Path(row['path'])
        if not p.is_file() or sha(p.read_bytes()) != row['after_sha256']:
            raise RuntimeError('Rollback refuses a concurrent/unknown edit')
    for row in payload['files']:
        if sha(base64.b64decode(row['data_b64'])) != row['sha256']:
            raise RuntimeError('Recovery payload hash mismatch')
    dump(PRIVATE / 'rollback_readiness.json', {'at_utc': now(), 'encrypted_payload_authenticated': True, 'four_original_payload_hashes_valid': True, 'changed_targets_match_expected_after_hash': True, 'new_roots_exact_inventory_match': True, 'original_running': False, 'actual_rollback_executed': False, 'limitation': 'File-level restore only; no original Desktop/model/session recovery claimed.'})
    print(json.dumps({'rollback_preconditions': 'passed', 'original_writes': 0}))
    return tx, payload


def rollback():
    # Retains new artifacts by moving only the exact new roots into private holding.
    # No recursive deletion, no memory reset, no task/gateway/old-profile operation.
    tx, payload = check_rollback()
    originals = {row['path']: row for row in payload['files']}
    for row in tx['original_file_before']:
        p = Path(row['path'])
        if row['before_sha256'] is not None:
            assert p in (HOME / 'SOUL.md', HOME / 'config.yaml')
            data = base64.b64decode(originals[str(p)]['data_b64'])
            assert sha(data) == row['before_sha256']
            p.write_bytes(data)
        else:
            assert p == PROJECT
            p.rename(PRIVATE / 'project-dir.rolled-back.json')
    for raw in reversed(tx['added_roots']):
        p = Path(raw).resolve()
        if p not in (WORKSPACE.resolve(), SDK.resolve(), BRIDGE.resolve()):
            raise PermissionError('Rollback target outside exact owned roots')
        destination = PRIVATE / ('rolled-back-' + p.name)
        if destination.exists():
            raise FileExistsError('Refusing to overwrite rollback holding')
        shutil.move(str(p), str(destination))
    assert all(sha(Path(r['path']).read_bytes()) == r['sha256'] for r in payload['files'])
    tx.update(status='rolled_back_original_restored', rolled_back_at_utc=now())
    dump(PRIVATE / 'transaction_local_only.json', tx)
    print(json.dumps({'rollback': 'verified', 'old_memory_user_unchanged': True, 'new_artifacts_retained_private': True}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['preflight', 'protect', 'stage', 'deploy', 'verify', 'check-rollback', 'rollback'])
    args = parser.parse_args()
    {'preflight': preflight, 'protect': protect, 'stage': make_stage, 'deploy': deploy, 'verify': verify, 'check-rollback': check_rollback, 'rollback': rollback}[args.action]()
