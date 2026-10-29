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
    company = c.get('schema') in ('lingju.ego-browser.v2','lingju.ego-browser.v3')
    business = c.get('schema') == 'lingju.ego-browser.v3'
    if (c.get('schema') not in ('lingju.ego-browser.v1', 'lingju.ego-browser.v2','lingju.ego-browser.v3')
            or c.get('toolRoot') != str(root)
            or c.get('home') != str(home)
            or c.get('workspace') != str(home / 'company-workspace')
            or c.get('mode') != ('company-business' if business else 'company-readonly' if company else 'synthetic')
            or c.get('productionEnabled') is not business):
        raise RuntimeError('Ego candidate identity/synthetic-only scope differs')
    if business:
        grant=c.get('businessAuthorization',{})
        if (grant.get('schema')!='lingju.browser-business-grant.v1'
                or grant.get('ownerApproved') is not True or grant.get('scopeOrigin')!=c.get('origin')
                or grant.get('scope')!='all-company-browser-ui-business-actions'
                or not grant.get('reference') or grant.get('highImpactRequiresSpecificOwnerTask') is not True):
            raise RuntimeError('Explicit Owner browser business authorization required')
    for key, digest in [('cli', 'cliSha256'), ('officialGuide', 'guideSha256')]:
        if sha256(ordinary_path(c[key])) != c[digest]:
            raise RuntimeError('Pinned vendor artifact changed')
    sources = c.get('sourceSha256', {})
    required = {'bridge.mjs', 'worker.mjs', 'policy.mjs', 'native_guard.mjs', 'lifecycle.mjs'}
    if company:
        required.add('extension_guard.mjs')
        required.add('table_readback.mjs')
        if (c.get('origin') != 'https://ldp.lingrobotics.com'
                or c.get('businessWritesEnabled') is not business
                or not c.get('approvalReference') or not c.get('profileId')):
            raise RuntimeError('Explicit company browser scope required')
        state = ordinary_path(c['stateFile'])
        if state != runtime.parent / 'workplace-state.json':
            raise RuntimeError('Owned workplace state required')
        extension = c['extension']
        if (extension.get('id') != 'fpifglepgaacbbabakmcjmkinlpnconi'
                or extension.get('ruleset') != 'company_readonly'):
            raise RuntimeError('Approved extension identity required')
        payload = ordinary_path(extension['directory'])
        for name, key in [('manifest.json', 'manifestSha256'), ('rules.json', 'rulesSha256')]:
            if sha256(ordinary_path(payload / name)) != extension[key]:
                raise RuntimeError('Installed extension payload changed')
    if set(sources) != required:
        raise RuntimeError('Complete adapter pin required')
    for name, digest in sources.items():
        if sha256(ordinary_path(root / 'ego' / name)) != digest:
            raise RuntimeError('Ego source changed')
    return c
