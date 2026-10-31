"""Candidate accounting: model attempts capped; narrow control traffic audited.

Not activated by importing this module. Existing exhausted ledgers are never
reset, reinterpreted or replaced. Unknown HTTPX routes count against the model
budget. No bodies, URLs, account IDs, headers or credentials are persisted.
"""
import contextlib
import datetime
from pathlib import Path
import re
import sqlite3

from request_budget import (BudgetBlocked, _inside_metered_transport,
                            _transport_ready, network_audit, request_family)


class TrafficPolicy:
    def __init__(self, metadata_urls=(), qq_users=()):
        # Exact URLs are held only in memory; generation routes are not inferred
        # to be metadata from a hostname or an HTTP verb alone.
        self.metadata_urls = frozenset(str(u).rstrip('/') for u in metadata_urls)
        self.qq_users = frozenset(qq_users)

    def category(self, request):
        u = request.url
        clean = (u.scheme == 'https' and u.port in (None, 443)
                 and not u.username and not u.password and not u.query)
        if clean:
            if (u.host == 'bots.qq.com' and u.path == '/app/getAppAccessToken'
                    and request.method == 'POST'):
                return 'qq'
            if u.host == 'api.sgroup.qq.com':
                if u.path == '/gateway' and request.method == 'GET':
                    return 'qq'
                m = re.fullmatch(r'/v2/users/([A-Za-z0-9_-]+)/messages', u.path)
                if m and m[1] in self.qq_users and request.method == 'POST':
                    return 'qq'
            try:
                empty_body = not request.content
            except Exception:
                empty_body = False
            if (request.method == 'GET' and empty_body and u.path.rstrip('/').endswith('/models')
                    and str(u).rstrip('/') in self.metadata_urls):
                return 'metadata'
        return 'model'


class TrafficAudit:
    def __init__(self, path):
        self.path = Path(path)
        with contextlib.closing(sqlite3.connect(self.path)) as c, c:
            c.execute('CREATE TABLE IF NOT EXISTS traffic (at TEXT, category TEXT, family TEXT)')

    def reserve(self, category, family):
        # These are conservative control-plane limits, not extra model tokens.
        caps = {'qq': 200, 'metadata': 40}
        with contextlib.closing(sqlite3.connect(self.path)) as c, c:
            c.execute('BEGIN IMMEDIATE')
            if category in caps:
                count = c.execute('SELECT count(*) FROM traffic WHERE category=?', (category,)).fetchone()[0]
                if count >= caps[category]:
                    raise BudgetBlocked('Control traffic limit reached; no request sent')
            c.execute('INSERT INTO traffic VALUES(?,?,?)', (
                datetime.datetime.now(datetime.timezone.utc).isoformat(), category, family))

    def counts(self):
        with contextlib.closing(sqlite3.connect(self.path)) as c:
            return dict(c.execute('SELECT category,count(*) FROM traffic GROUP BY category'))


def install_traffic_guard(model_budget, audit, policy, add_network_audit=False, pacer=None):
    import httpx
    if httpx.__version__ != '0.28.1':
        raise BudgetBlocked('Unreviewed HTTPX version')
    old_sync = httpx.HTTPTransport.handle_request
    old_async = httpx.AsyncHTTPTransport.handle_async_request
    if any(getattr(old_sync, k, False) for k in ['_lingju_budget', '_lingju_traffic_guard']):
        raise BudgetBlocked('Another guard is already installed; do not reset it')

    def reserve(transport, request):
        _transport_ready(transport)
        category = policy.category(request)
        family = request_family(request)
        if category == 'model':
            model_budget.take(family)  # main, retries, auxiliary and unknown routes
        audit.reserve(category, family)

    def should_pace(request):
        # The Feishu integration preserves native, unrelated gateway traffic.
        # Ordinary traffic must not inherit a simulation pause or hard quota.
        selector = getattr(model_budget, 'requires_pacing', None)
        return (pacer is not None and policy.category(request) == 'model'
                and (selector is None or selector()))

    def send(transport, request):
        paced = should_pace(request)
        if paced:
            pacer.enter()
        token = _inside_metered_transport.set(True)
        try:
            reserve(transport, request)
            if paced:
                pacer.started(request_family(request))
                if callable(getattr(pacer,'observe_request',None)):pacer.observe_request(request)
            response = old_sync(transport, request)
            if paced:
                try:
                    pacer.response(response)
                except BaseException:
                    response.close()
                    raise
                from provider_pacing import paced_sync_stream
                if response.is_closed:
                    if getattr(pacer,'observation',None) is not None:
                        pacer.body_piece(pacer.observation,response.content)
                        pacer.stream_finished(pacer.observation,True)
                    pacer.leave()
                else:
                    response.stream = paced_sync_stream(response.stream, pacer)
            return response
        except BaseException:
            if paced:
                pacer.leave()
            raise
        finally:
            _inside_metered_transport.reset(token)

    async def asend(transport, request):
        paced = should_pace(request)
        if paced:
            await pacer.aenter()
        token = _inside_metered_transport.set(True)
        try:
            reserve(transport, request)
            if paced:
                pacer.started(request_family(request))
                if callable(getattr(pacer,'observe_request',None)):pacer.observe_request(request)
            response = await old_async(transport, request)
            if paced:
                try:
                    pacer.response(response)
                except BaseException:
                    await response.aclose()
                    raise
                from provider_pacing import paced_async_stream
                if response.is_closed:
                    if getattr(pacer,'observation',None) is not None:
                        pacer.body_piece(pacer.observation,response.content)
                        pacer.stream_finished(pacer.observation,True)
                    pacer.leave()
                else:
                    response.stream = paced_async_stream(response.stream, pacer)
            return response
        except BaseException:
            if paced:
                pacer.leave()
            raise
        finally:
            _inside_metered_transport.reset(token)

    send._lingju_traffic_guard = asend._lingju_traffic_guard = True
    httpx.HTTPTransport.handle_request = send
    httpx.AsyncHTTPTransport.handle_async_request = asend
    if add_network_audit:
        import sys
        sys.addaudithook(network_audit)

    def restore_for_test():
        httpx.HTTPTransport.handle_request = old_sync
        httpx.AsyncHTTPTransport.handle_async_request = old_async
    return restore_for_test
