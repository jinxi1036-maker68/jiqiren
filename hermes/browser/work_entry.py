"""Read-only policy for a stable MCP entry; never grants a new model task.

The catalog stays available while a workplace is closed. Active work still
needs an existing, explicitly approved exercise grant and an armed ledger.
This version deliberately supports synthetic workplaces only.
"""
import argparse
import contextlib
import json
from pathlib import Path
import sqlite3
import sys
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
from safety import ordinary_path, sha256

ENTRY_SCHEMA = 'lingju.browser.work-entry.v1'
STATE_SCHEMA = 'lingju.browser.work-state.v1'
TOOLS = frozenset(('browser_navigate', 'browser_navigate_back', 'browser_snapshot',
    'browser_click', 'browser_type', 'browser_fill_form', 'browser_select_option',
    'browser_press_key', 'browser_tabs', 'browser_wait_for', 'browser_handle_dialog',
    'browser_take_screenshot', 'browser_close'))


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def validate_entry(path, root):
    root = ordinary_path(root)
    path = ordinary_path(path)
    if path != root / 'work-entry' / 'entry.json':
        raise RuntimeError('Stable entry must be the owned fixed path')
    cfg = read_json(path)
    if (cfg.get('schema') != ENTRY_SCHEMA or cfg.get('toolRoot') != str(root)
            or cfg.get('route') != 'playwright' or cfg.get('mode') != 'synthetic-only'):
        raise RuntimeError('Stable entry identity/scope mismatch')
    for key, name in [('state', 'state.json'), ('catalog', 'catalog.json')]:
        if ordinary_path(cfg[key]) != path.parent / name:
            raise RuntimeError('Entry metadata escaped the fixed owned paths')
    catalog = read_json(cfg['catalog'])
    if sha256(cfg['catalog']) != cfg['catalog_sha256']:
        raise RuntimeError('Pinned tool catalog changed')
    if (len(catalog.get('tools', [])) != len(TOOLS)
            or {t['name'] for t in catalog['tools']} != TOOLS):
        raise RuntimeError('Unexpected browser tools')
    required = {'work_entry.py', 'work_broker.mjs', 'work_broker_core.mjs',
                'bridge.mjs', 'safety.py', 'qq_browser_task.py'}
    if not required <= set(cfg.get('source_sha256', {})):
        raise RuntimeError('Stable entry sources are not pinned')
    for name, digest in cfg['source_sha256'].items():
        p = ordinary_path(root / name)
        if root not in p.parents or sha256(p) != digest:
            raise RuntimeError('Stable entry source changed')
    python = ordinary_path(cfg['python'])
    expected = Path.home() / 'AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe'
    if python != expected:
        raise RuntimeError('Original installed Python required')
    if not Path(cfg['node']).is_absolute() or not ordinary_path(cfg['node']).is_file():
        raise RuntimeError('Explicit existing Node executable required')
    return cfg, catalog


def owned_run_file(value, root):
    p = ordinary_path(value)
    if root / 'runs' not in p.parents:
        raise RuntimeError('Workplace proof escaped owned runs')
    return p


def inspect_workplace(entry, root, *, process_check=None):
    """No writes, network, process launch, credentials, prompts or memory reads."""
    root = Path(root)
    cfg, _ = validate_entry(entry, root)
    state = read_json(cfg['state'])
    if (state.get('schema') != STATE_SCHEMA or not isinstance(state.get('revision'), str)
            or not state['revision']):
        raise RuntimeError('Invalid workplace state')
    if state.get('state') == 'closed':
        return {'available': False, 'code': 'WORKPLACE_CLOSED',
                'revision': state['revision'], 'model_requests': 0}
    if state.get('state') != 'active':
        raise RuntimeError('Unknown workplace state; no implicit activation')
    runtime = owned_run_file(state['runtime'], root)
    grant_path = owned_run_file(state['grant'], root)
    if sha256(runtime) != state['runtime_sha256'] or sha256(grant_path) != state['grant_sha256']:
        raise RuntimeError('Pinned workplace or approval record changed')
    # Reuse the approved grant rules; constants alone are not human authority.
    from qq_browser_task import validate_browser_grant
    grant = read_json(grant_path)['browser_exercise']
    validate_browser_grant(grant, 'feishu')
    r = read_json(runtime)
    wanted = 'remaining-readonly' if grant['case'] == 'remaining-pages' else 'recovery'
    u = urlsplit(r.get('origin', ''))
    if (r.get('route') != 'playwright' or r.get('toolRoot') != str(root)
            or r.get('taskScope') != wanted or r.get('case') != 'recovery'
            or r.get('dependencyRoot') != str(root)
            or u.scheme != 'http' or u.hostname != '127.0.0.1' or not u.port
            or u.username or u.password or u.path or u.query or u.fragment
            or grant['runtime'] != str(runtime) or grant['runtime_sha256'] != sha256(runtime)):
        raise RuntimeError('Only the explicitly approved synthetic workplace is supported')
    ledger = owned_run_file(grant['ledger'], root)
    if r.get('roundBudget') != str(ledger):
        raise RuntimeError('Runtime/ledger mismatch')
    preflight = ordinary_path(runtime.parent / 'continuation-preflight.json')
    if sha256(preflight) != grant['preflight_sha256']:
        raise RuntimeError('Readiness proof changed')
    pf = read_json(preflight)
    if pf.get('passed') is not True or pf.get('SDK_tools') != 13 or pf.get('model_calls') != 0:
        raise RuntimeError('No verified zero-model browser catalog')
    for old, digest in grant['old_ledger_sha256'].items():
        if owned_run_file(old, root) == ledger or sha256(old) != digest:
            raise RuntimeError('A previous ledger changed or was reused')
    # Read-only URI: a missing or corrupt ledger never becomes a fresh budget.
    with contextlib.closing(sqlite3.connect(ledger.as_uri() + '?mode=ro', uri=True)) as c:
        row = c.execute('select cap,used,armed from state where id=1').fetchone()
    if not row or row[0] != grant['request_limit'] or row[1] < 0:
        raise RuntimeError('Invalid physical request ledger')
    if not row[2] or row[1] >= row[0]:
        return {'available': False, 'code': 'WORKPLACE_NOT_ARMED',
                'revision': state['revision'], 'used': row[1], 'limit': row[0], 'model_requests': 0}
    lifecycle = read_json(runtime.parent / 'lifecycle.json')
    if lifecycle.get('closed_at') or lifecycle.get('children_exited'):
        return {'available': False, 'code': 'WORKPLACE_STOPPED',
                'revision': state['revision'], 'model_requests': 0}
    if process_check is None:
        import psutil
        def process_check(pid):
            p = psutil.Process(pid)
            return p.is_running(), p.cmdline()
    children = [process_check(pid) for pid in lifecycle.get('child_pids', [])]
    chrome_marker = '--user-data-dir=' + str(runtime.parent / 'chrome-profile')
    if (len(children) != 2 or not all(alive for alive, _ in children)
            or not any(chrome_marker in argv for _, argv in children)
            or not any(str(root / 'fixture.mjs') in argv and
                       str(runtime.parent / 'fixture-config.json') in argv for _, argv in children)):
        raise RuntimeError('Owned synthetic browser/fixture processes are not verified')
    return {'available': True, 'code': 'WORKPLACE_READY', 'revision': state['revision'],
            'key': state['revision'] + ':' + sha256(runtime), 'runtime': str(runtime),
            'runtime_sha256': sha256(runtime), 'origin': r['origin'],
            'used': row[1], 'limit': row[0], 'model_requests': 0}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--entry', required=True)
    args = p.parse_args()
    root = Path.home() / '.hermes/tools/company-browser'
    try:
        result = inspect_workplace(args.entry, root)
    except Exception as exc:
        # Arbitrary exception strings could contain private paths or data.
        result = {'available': False, 'code': 'ENTRY_CHECK_FAILED',
                  'error_type': type(exc).__name__, 'model_requests': 0}
    print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
