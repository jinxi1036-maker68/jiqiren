"""Explicit experimental Ego dispatch; no config/identity mutation or model call."""
import json
from pathlib import Path
from safety import ordinary_path, sha256


def validate_ego_runtime(runtime, root):
    root = ordinary_path(root)
    runtime = ordinary_path(runtime)
    if root / 'runs' not in runtime.parents:
        raise RuntimeError('Ego runtime outside owned runs')
    c = json.loads(runtime.read_text('utf-8'))
    home = Path.home() / '.hermes'
    if (c.get('schema') != 'lingju.ego-browser.v1'
            or c.get('toolRoot') != str(root)
            or c.get('home') != str(home)
            or c.get('workspace') != str(home / 'company-workspace')
            or c.get('mode') != 'synthetic'
            or c.get('productionEnabled') is not False):
        raise RuntimeError('Ego candidate identity/synthetic-only scope differs')
    for key, digest in [('cli', 'cliSha256'), ('officialGuide', 'guideSha256')]:
        if sha256(ordinary_path(c[key])) != c[digest]:
            raise RuntimeError('Pinned vendor artifact changed')
    sources = c.get('sourceSha256', {})
    if set(sources) != {'bridge.mjs', 'worker.mjs', 'policy.mjs', 'native_guard.mjs'}:
        raise RuntimeError('Complete adapter pin required')
    for name, digest in sources.items():
        if sha256(ordinary_path(root / 'ego' / name)) != digest:
            raise RuntimeError('Ego source changed')
    return c
