"""Durable exercise-session boundaries, stored only in the owned tools runtime.

No message bodies, account IDs or original state.db writes. A native /new can
leave a completed exercise, but prose such as 'continue' cannot change scope.
"""
import contextlib
import datetime
import hashlib
from pathlib import Path
import sqlite3
from safety import ordinary_path


class SessionFence:
    def __init__(self, path, *, create=False):
        self.path = ordinary_path(path, allow_missing=True)
        if create and not self.path.exists():
            with self.path.open('xb'):pass
        with contextlib.closing(self._connect()) as c, c:
            if create:c.execute('''CREATE TABLE IF NOT EXISTS exercise_sessions (
                session_id TEXT PRIMARY KEY, grant_sha256 TEXT NOT NULL,
                phase TEXT NOT NULL CHECK(phase IN ('running','closed')),
                updated_at TEXT NOT NULL)''')
            c.execute('SELECT session_id,grant_sha256,phase,updated_at FROM exercise_sessions LIMIT 0')

    def _connect(self, read_only=False):
        return sqlite3.connect(self.path.as_uri()+('?mode=ro' if read_only else '?mode=rw'),uri=True)

    def bind(self, session_id, grant_key):
        if not session_id or not isinstance(session_id, str):
            raise RuntimeError('Native exercise session ID required')
        with contextlib.closing(self._connect()) as c, c:
            c.execute('INSERT INTO exercise_sessions VALUES(?,?,?,?)', (
                session_id, hashlib.sha256(str(grant_key).encode()).hexdigest(),
                'running', datetime.datetime.now(datetime.timezone.utc).isoformat()))

    def close(self, session_id):
        with contextlib.closing(self._connect()) as c, c:
            if c.execute("UPDATE exercise_sessions SET phase='closed',updated_at=? WHERE session_id=?",
                         (datetime.datetime.now(datetime.timezone.utc).isoformat(), session_id)).rowcount != 1:
                raise RuntimeError('Exercise session fence missing')

    def phase(self, session_id):
        if session_id is None:
            return None
        with contextlib.closing(self._connect(True)) as c:
            row = c.execute('SELECT phase FROM exercise_sessions WHERE session_id=?', (session_id,)).fetchone()
        return row[0] if row else None

    def mentions_protected_session(self, text):
        # Block explicit resume/topic references without interpreting prose as
        # permission. Do not log text or read any old conversation body.
        with contextlib.closing(self._connect(True)) as c:
            return any(sid in text for (sid,) in c.execute('SELECT session_id FROM exercise_sessions'))


def resolve_native_session(store, source):
    """Resolve native routing before choosing the model meter, never bodies.

    A missing in-memory route is not proof of a fresh conversation: the native
    store may recover an old exercise from SQLite. Use its normal metadata
    resolution with touch_activity=False rather than treating a cache miss as
    permission. This can create normal session metadata, never another identity.
    """
    sid=store.peek_session_id(store._generate_session_key(source))
    if sid is not None:return sid
    return store.get_or_create_session(source,touch_activity=False).session_id


def local_session_command(message):
    # Commands that cannot resume an Agent task. Run even these under the
    # exercise meter: unexpected model calls remain blocked by a closed ledger.
    return ((message.text or '').strip() in ('/new', '/stop', '/help', '/status')
            and not getattr(message, 'media_urls', None))
