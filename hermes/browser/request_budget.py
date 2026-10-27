"""Candidate process-only HTTPX budget. Not installed in the original Desktop.

Counts all HTTPX network attempts conservatively, not just successful model
responses. No URL, headers, prompt, response or credentials are persisted.
This is not an OS sandbox and does not cover independent child programs.
"""
import contextvars
import contextlib
import datetime
import ipaddress
import os
from pathlib import Path
import sqlite3


class BudgetBlocked(RuntimeError):
    pass


class RequestBudget:
    def __init__(self, path):
        self.path = Path(path).resolve(strict=True)

    @classmethod
    def create(cls, path, limit=120, armed=True):
        path = Path(path)
        if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 120:
            raise ValueError("Approved limit must be within 1..120")
        with path.open("xb"):
            pass
        c = sqlite3.connect(path)
        try:
            c.executescript("""CREATE TABLE state (id INTEGER PRIMARY KEY CHECK(id=1), cap INTEGER NOT NULL, used INTEGER NOT NULL, armed INTEGER NOT NULL);
            CREATE TABLE events (id INTEGER PRIMARY KEY, pid INTEGER, at TEXT, outcome TEXT, family TEXT);
            """)
            c.execute("INSERT INTO state VALUES(1,?,0,?)", (limit, int(bool(armed))))
            c.commit()
        finally:
            c.close()
        return cls(path)

    def _connection(self):
        # mode=rw never silently recreates a removed ledger.
        return sqlite3.connect(self.path.as_uri() + "?mode=rw", uri=True, timeout=2)

    def take(self, family="unclassified"):
        c = None
        try:
            c = self._connection()
            c.execute("BEGIN IMMEDIATE")
            row = c.execute("SELECT cap,used,armed FROM state WHERE id=1").fetchone()
            if not row or not 1 <= row[0] <= 120 or not 0 <= row[1] <= row[0]:
                raise BudgetBlocked("Budget ledger invalid; network denied")
            cap, used, armed = row
            allowed = bool(armed) and used < cap
            if allowed:
                c.execute("UPDATE state SET used=used+1 WHERE id=1")
            c.execute("INSERT INTO events(pid,at,outcome,family) VALUES(?,?,?,?)",
                      (os.getpid(), datetime.datetime.now(datetime.timezone.utc).isoformat(),
                       "reserved_before_send" if allowed else ("denied_at_limit" if armed else "denied_unarmed"),
                       family if family in {"chat_completions", "responses", "messages", "generate_content", "audio", "other_httpx", "unclassified"} else "unclassified"))
            c.commit()
            if not allowed:
                raise BudgetBlocked("Request budget unarmed or exhausted; no request sent")
            return used + 1
        except sqlite3.Error as e:
            raise BudgetBlocked("Budget ledger unavailable; network denied") from e
        finally:
            if c is not None:
                c.close()

    def arm(self):
        c = self._connection()
        try:
            c.execute("BEGIN IMMEDIATE")
            c.execute("UPDATE state SET armed=1 WHERE id=1")
            c.commit()
        finally:
            c.close()

    def status(self):
        c = sqlite3.connect(self.path.as_uri() + "?mode=ro", uri=True)
        try:
            row = c.execute("SELECT cap,used,armed FROM state WHERE id=1").fetchone()
            events = dict(c.execute("SELECT outcome,count(*) FROM events GROUP BY outcome"))
            families = dict(c.execute("SELECT family,count(*) FROM events WHERE outcome='reserved_before_send' GROUP BY family"))
            return {"limit": row[0], "reserved_network_attempts": row[1], "armed": bool(row[2]),
                    "events": events, "families": families}
        finally:
            c.close()


class RequestAudit(RequestBudget):
    """Owner-approved daily accounting, without a request quota.

    A separate cap=0 ledger is deliberately incompatible with legacy budgets.
    Armed means an actual Owner message is being handled, not a new quota.
    """
    @classmethod
    def create(cls, path):
        budget = super().create(path, limit=1, armed=False)
        with contextlib.closing(budget._connection()) as c, c:
            c.execute('UPDATE state SET cap=0 WHERE id=1')
        return cls(path)

    def take(self, family='unclassified'):
        with contextlib.closing(self._connection()) as c, c:
            c.execute('BEGIN IMMEDIATE')
            row = c.execute('SELECT cap,used,armed FROM state WHERE id=1').fetchone()
            if not row or row[0] != 0 or row[1] < 0:
                raise BudgetBlocked('Daily audit identity differs; historical quotas are not reused')
            allowed = bool(row[2])
            if allowed:c.execute('UPDATE state SET used=used+1 WHERE id=1')
            c.execute('INSERT INTO events(pid,at,outcome,family) VALUES(?,?,?,?)', (
                os.getpid(), datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'reserved_before_send' if allowed else 'denied_unarmed',
                family if family in {'chat_completions','responses','messages','generate_content','audio','other_httpx','unclassified'} else 'unclassified'))
        if not allowed:raise BudgetBlocked('No active Owner message; background generation not opened')
        return row[1]+1

    def status(self):
        value = super().status()
        if value['limit'] != 0:raise BudgetBlocked('Not the new daily audit ledger')
        value.update(limit=None,quota_enforced=False)
        return value


_inside_metered_transport = contextvars.ContextVar("lingju_metered_transport", default=False)


def _loopback(address):
    if not isinstance(address, tuple) or len(address) < 2:
        return False
    try:
        return ipaddress.ip_address(address[0]).is_loopback
    except ValueError:
        return address[0] == "localhost"


def network_audit(event, args):
    # Defense against accidental requests/aiohttp/urllib bypass in THIS Python
    # process. No security claim for arbitrary code or independent children.
    if event == "socket.connect" and not _loopback(args[1]) and not _inside_metered_transport.get():
        raise BudgetBlocked("Unmetered external transport denied in candidate test process")


def _transport_ready(transport):
    pool = getattr(transport, "_pool", None)
    if pool is None or getattr(pool, "_retries", None) != 0:
        raise BudgetBlocked("Unsupported transport or hidden retries; no request sent")


def request_family(request):
    path = request.url.path.lower()
    if path.endswith("/chat/completions"):
        return "chat_completions"
    if path.endswith("/responses"):
        return "responses"
    if path.endswith("/messages"):
        return "messages"
    if path.endswith(":generatecontent") or path.endswith(":streamgeneratecontent"):
        return "generate_content"
    if "/audio/" in path:
        return "audio"
    return "other_httpx"


def install_httpx_budget(budget, add_network_audit=False):
    """Explicit opt-in API for isolated prototype tests only.

    The original Desktop opts in only via the separately validated startup hook.
    """
    import httpx
    if httpx.__version__ != "0.28.1":
        raise BudgetBlocked("Unreviewed HTTPX version")
    if getattr(httpx.HTTPTransport.handle_request, "_lingju_budget", False):
        raise BudgetBlocked("Budget already installed; refuse independent reset")
    sync = httpx.HTTPTransport.handle_request
    asynchronous = httpx.AsyncHTTPTransport.handle_async_request

    def send(transport, request):
        _transport_ready(transport)
        budget.take(request_family(request))
        token = _inside_metered_transport.set(True)
        try:
            return sync(transport, request)
        finally:
            _inside_metered_transport.reset(token)

    async def asend(transport, request):
        _transport_ready(transport)
        budget.take(request_family(request))
        token = _inside_metered_transport.set(True)
        try:
            return await asynchronous(transport, request)
        finally:
            _inside_metered_transport.reset(token)

    send._lingju_budget = asend._lingju_budget = True
    httpx.HTTPTransport.handle_request = send
    httpx.AsyncHTTPTransport.handle_async_request = asend
    if add_network_audit:
        import sys
        sys.addaudithook(network_audit)

    def restore_for_test():
        # Only isolated test interpreters call this; audit hooks are permanent
        # until that test process exits. Nothing is installed in Hermes.
        httpx.HTTPTransport.handle_request = sync
        httpx.AsyncHTTPTransport.handle_async_request = asynchronous
    return restore_for_test
