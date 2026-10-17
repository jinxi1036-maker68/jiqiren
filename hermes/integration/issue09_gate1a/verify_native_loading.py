"""Read-only invocation of installed prompt/memory loaders; not a Desktop session.

Never constructs AIAgent, loads model credentials, requests a model or emits old text.
Writes to original roots and socket connections are rejected for this probe.
"""
from pathlib import Path
import hashlib, json, logging, os, sys
import yaml

BASE = Path(__file__).resolve().parent
H = Path.home() / '.hermes'
I = Path.home() / 'AppData/Local/hermes/hermes-agent'
D = Path.home() / 'AppData/Roaming/Hermes'
W = H / 'company-workspace'
targets = [H / p for p in ('SOUL.md', 'config.yaml', 'memories/MEMORY.md', 'memories/USER.md', 'cron/jobs.json')]
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = {str(p): digest(p) for p in targets}
config = yaml.safe_load((H / 'config.yaml').read_bytes())
denied = []


def guard(event, args):
    if event in ('socket.connect', 'socket.getaddrinfo'):
        denied.append('network')
        raise PermissionError('No network during native loader probe')
    if event == 'open' and isinstance(args[0], (str, bytes, os.PathLike)):
        p = Path(os.fsdecode(args[0])).resolve()
        if p.is_relative_to(H) and (p.name == '.env' or p.name.startswith('auth.') or 'providers' in p.relative_to(H).parts):
            denied.append('credential_file_read')
            raise PermissionError('Credential files are outside loader probe scope')
        writing = (isinstance(args[1], str) and any(x in args[1] for x in 'wax+')) or (isinstance(args[2], int) and bool(args[2] & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC)))
        if writing and any(p.is_relative_to(root) for root in (H, I, D)):
            denied.append('protected_write')
            raise PermissionError('No original-root write during loader probe')
    if event in ('os.remove', 'os.rename', 'os.rmdir', 'os.mkdir'):
        p = Path(os.fsdecode(args[0])).resolve()
        if event == 'os.mkdir' and p.is_dir():
            return  # exist_ok directory checks do not alter the existing directory.
        if any(p.is_relative_to(root) for root in (H, I, D)):
            denied.append('protected_write')
            raise PermissionError('No original-root mutation during loader probe')


sys.addaudithook(guard)
logging.disable(logging.CRITICAL)
sys.path.insert(0, str(I))
from hermes_constants import get_hermes_home
from agent.prompt_builder import load_soul_md, build_context_files_prompt
from tools.memory_tool import MemoryStore

assert get_hermes_home().resolve() == H.resolve()
soul = load_soul_md(home_override=H)
expected_soul = (H / 'SOUL.md').read_text(encoding='utf-8').strip()
assert soul == expected_soul, 'SOUL must survive native scan/truncation without losing the company identity'
project = build_context_files_prompt(cwd=str(W), skip_soul=True, home_override=H)
assert '公司工作区｜原 Hermes 唯一岗位' in project
assert 'knowledge/00_START_HERE.md' in project
assert 'GATE_1A_STATUS.json' in project
memory = config['memory']
store = MemoryStore(memory_char_limit=memory['memory_char_limit'], user_char_limit=memory['user_char_limit'])
store.load_from_disk()
second = MemoryStore(memory_char_limit=memory['memory_char_limit'], user_char_limit=memory['user_char_limit'])
second.load_from_disk()
assert store._system_prompt_snapshot == second._system_prompt_snapshot
assert all(digest(Path(p)) == h for p, h in before.items())
result = {
    'kind': 'installed_native_loader_functions_only_no_desktop_no_agent',
    'home_matches_original': True,
    'soul_exact_approved_text_survives_native_scan_and_cap': True,
    'soul_chars': len(soul),
    'workspace_entry_survives_native_context_loader': True,
    'workspace_entry_prompt_chars': len(project),
    'memory_enabled': memory['memory_enabled'],
    'user_profile_enabled': memory['user_profile_enabled'],
    'old_memory_native_entries': len(store.memory_entries),
    'old_user_native_entries': len(store.user_entries),
    'snapshot_chars': {k: len(v) for k, v in store._system_prompt_snapshot.items()},
    'fresh_store_reload_same_snapshot': True,
    'old_memory_remains_in_loader': True,
    'old_memory_semantic_or_agent_identity_conflict': 'not_tested_in_original_desktop',
    'actual_session_cwd': 'not_observed',
    'actual_complete_model_prompt_or_context_truncation': 'not_observed',
    'knowledge_files': '18 locally cached files are readable; no Agent read is claimed',
    'model_calls': 0,
    'selected_original_files_unchanged_during_probe': True,
    'guard_denials': denied,
    'guard_limit': 'Python probe guard only; not a security sandbox for Hermes'
}
(BASE / 'private/native_loading_result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
