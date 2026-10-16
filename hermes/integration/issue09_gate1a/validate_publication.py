"""Validate only the explicit public export; never scans original memories/Skills."""
from pathlib import Path
import ast, hashlib, json, re, subprocess

B = Path(__file__).resolve().parent
ROOT = B.parent / 'hermes_issue09_gate1a_publication'
INTEGRATION = 'hermes/integration/issue09_gate1a/'
EVIDENCE = 'hermes/evidence/issue09_gate1a/'
code = ['gate1a.py', 'verify_native_loading.py', 'test_component.mjs', 'launch_bridge.py', 'owned_job.py', 'browser_bridge.mjs', 'sdk_resolver.mjs', 'navigation_policy.mjs', 'loopback_guard.cjs', 'demo_server.mjs', 'HERMES.md', 'SOUL.md', 'build_publication.py', 'validate_publication.py', 'TEMPLATE.redacted.json', 'GATE_1A_STATUS.redacted.json', 'README.md']
allowed = [INTEGRATION + x for x in code] + [EVIDENCE + x for x in ['AUTHORIZATION.json', 'EXACT_CHANGES.json', 'KNOWLEDGE_SNAPSHOT.json', 'SDK_DEPENDENCY_LOCK.json', 'VALIDATION.json', 'PUBLICATION_VALIDATION.json']] + ['hermes/reports/ISSUE_09_GATE_1A_MINIMAL_ORIGINAL_INTEGRATION.md', 'hermes/README.md', 'hermes/CHANGELOG.md', 'knowledge/CURRENT_WORK.json', 'knowledge/PROJECT_INDEX.json', 'knowledge/history/HERMES_PRODUCT_EVOLUTION_2026-10-16.md']
known_existing = ['hermes/README.md', 'hermes/CHANGELOG.md', 'knowledge/CURRENT_WORK.json', 'knowledge/PROJECT_INDEX.json', 'knowledge/history/HERMES_PRODUCT_EVOLUTION_2026-10-16.md']
for rel in known_existing:
    p = ROOT / rel
    p.write_bytes(p.read_text(encoding='utf-8').encode('utf-8'))
observed = {p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*') if p.is_file()}
assert observed <= set(allowed), 'Unexpected export file'
assert observed | {EVIDENCE + 'PUBLICATION_VALIDATION.json'} == set(allowed), 'Missing explicit deliverable'
findings = []
python_count = node_count = json_count = 0
for rel in sorted(observed):
    p = ROOT / rel
    content = p.read_text(encoding='utf-8')
    assert str(Path.home()) not in content and str(Path.home()).replace('\\', '/') not in content, 'Unredacted local root'
    for pattern in (r'github_pat_[A-Za-z0-9_]{20,}', r'gh[pousr]_[A-Za-z0-9]{30,}', r'\bsk-[A-Za-z0-9_-]{24,}', r'Bearer\s+[A-Za-z0-9._-]{24,}'):
        assert not re.search(pattern, content), 'Potential credential-like value'
    assert not p.is_symlink()
    if p.suffix == '.py':
        ast.parse(content);python_count += 1
    if p.suffix in ('.mjs', '.cjs'):
        subprocess.check_call(['node', '--check', str(p)], stdout=subprocess.DEVNULL);node_count += 1
    if p.suffix == '.json':
        json.loads(content);json_count += 1

# The seven actually installed component sources and two role/entry files are
# uploaded as their exact bytes, including any existing line endings.
home = Path.home() / '.hermes'
runtime_names = ['launch_bridge.py', 'owned_job.py', 'browser_bridge.mjs', 'sdk_resolver.mjs', 'navigation_policy.mjs', 'loopback_guard.cjs', 'demo_server.mjs']
for name in runtime_names:
    assert (ROOT / INTEGRATION / name).read_bytes() == (home / 'tools/company-browser-simulation' / name).read_bytes()
assert (ROOT / INTEGRATION / 'SOUL.md').read_bytes() == (home / 'SOUL.md').read_bytes()
assert (ROOT / INTEGRATION / 'HERMES.md').read_bytes() == (home / 'company-workspace/HERMES.md').read_bytes()
summary = {'files': len(allowed), 'explicit_allowlist': sorted(allowed), 'python_ast_files': python_count, 'node_syntax_files': node_count, 'json_files_before_this_summary': json_count, 'installed_component_and_identity_exact_bytes_matched': len(runtime_names) + 2, 'existing_repo_files_use_LF_for_clean_diff': True, 'credential_pattern_and_local_root_scan': 'passed; heuristic plus manual review, not a proof of all secrets absent', 'no_private_archive_raw_memory_credentials_browser_storage_vendor_source_or_binary_exported': True, 'real_agent_acceptance_claimed': False}
(ROOT / EVIDENCE / 'PUBLICATION_VALIDATION.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
manifest = []
for rel in sorted(allowed):
    raw = (ROOT / rel).read_bytes()
    manifest.append({'path': rel, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'git_blob_sha': hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()})
(B / 'private/publication_manifest_local_only.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k:v for k,v in summary.items() if k!='explicit_allowlist'}, ensure_ascii=False))
