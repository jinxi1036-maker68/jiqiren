"""Bounded SELECT of latest Desktop session metadata; no messages or prompt text.

This does not drive the Desktop or submit a model request. Read-only SQLite
includes committed WAL state, unlike the earlier immutable-base historical view.
"""
from pathlib import Path
import datetime, hashlib, json, sqlite3

base = Path(__file__).resolve().parent
home = Path.home() / '.hermes'
db_path = home / 'state.db'
conn = sqlite3.connect(db_path.as_uri() + '?mode=ro', uri=True, timeout=2)
try:
    conn.execute('PRAGMA query_only=ON')
    columns = {r[1] for r in conn.execute('PRAGMA table_info(sessions)')}
    safe = [k for k in ('id', 'source', 'cwd', 'started_at', 'created_at', 'last_activity_at') if k in columns]
    assert 'source' in safe and 'id' in safe
    order = 'started_at' if 'started_at' in safe else 'created_at' if 'created_at' in safe else 'id'
    rows = []
    for selection, ordering in [('by_started_at', order), ('by_id', 'id')]:
        for row in conn.execute('SELECT ' + ','.join(safe) + " FROM sessions WHERE source='desktop' ORDER BY " + ordering + ' DESC LIMIT 1'):
            rows.append(dict(zip(safe, row), selection=selection))
finally:
    conn.close()
result = {'checked_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'kind': 'two_bounded_readonly_metadata_views_not_ui_acceptance', 'readable_original_db': True, 'committed_wal_included': True, 'rows': rows, 'message_or_prompt_body_read': False, 'model_calls': 0, 'limitation': 'Different ordering can select different historical records; neither proves which conversation is visible, current OS cwd, effective prompt or tool availability. No broader history scan or repair is attempted.'}
serialized = json.dumps(result, ensure_ascii=False, indent=2)
(base / 'private/latest_desktop_session_local_only.json').write_text(serialized, encoding='utf-8')
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
(base / ('private/session-metadata-' + stamp + '.json')).write_text(serialized, encoding='utf-8')
public = dict(result)
public['rows'] = [{k: ('sha256:' + hashlib.sha256(v.encode()).hexdigest() if k == 'id' else v.replace(str(Path.home()), '<USER_HOME>') if isinstance(v, str) else v) for k, v in r.items()} for r in rows]
print(json.dumps(public, ensure_ascii=False))
