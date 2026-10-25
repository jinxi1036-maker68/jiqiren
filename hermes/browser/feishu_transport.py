"""Narrow Feishu SDK control-traffic tagging, opt-in and process-local only.

No credentials, recipient IDs, URLs, request bodies or replies are recorded.
This module does not connect, change configuration, or start a gateway.
"""
import contextvars
import functools
import re
from urllib.parse import urlsplit, parse_qsl

from request_budget import BudgetBlocked
from traffic_guard import TrafficPolicy

_sdk_control = contextvars.ContextVar('lingju_feishu_sdk_control', default=False)
_ID = r'[A-Za-z0-9_-]+'
_ROUTES = (
    ('POST', r'/callback/ws/endpoint', frozenset()),
    ('POST', r'/open-apis/auth/v3/(?:tenant|app)_access_token/internal', frozenset()),
    ('GET', r'/open-apis/bot/v3/info/?', frozenset()),
    ('GET', r'/open-apis/application/v6/applications/'+_ID, frozenset({'lang'})),
    ('GET', r'/open-apis/contact/v3/users/'+_ID, frozenset({'user_id_type', 'department_id_type'})),
    ('GET', r'/open-apis/im/v1/chats/'+_ID, frozenset({'user_id_type'})),
    ('POST', r'/open-apis/im/v1/messages', frozenset({'receive_id_type'})),
    ('GET', r'/open-apis/im/v1/messages', frozenset({'container_id_type', 'container_id', 'page_size', 'page_token', 'sort_type', 'start_time', 'end_time'})),
    ('GET', r'/open-apis/im/v1/messages/'+_ID, frozenset({'user_id_type'})),
    ('PATCH', r'/open-apis/im/v1/messages/'+_ID, frozenset()),
    ('POST', r'/open-apis/im/v1/messages/'+_ID+r'/reply', frozenset()),
    ('POST', r'/open-apis/im/v1/messages/'+_ID+r'/reactions', frozenset()),
    ('GET', r'/open-apis/im/v1/messages/'+_ID+r'/reactions', frozenset({'reaction_type', 'page_size', 'page_token'})),
    ('DELETE', r'/open-apis/im/v1/messages/'+_ID+r'/reactions/'+_ID, frozenset()),
    # Native chat attachments and voice delivery, not Drive or business APIs.
    ('POST', r'/open-apis/im/v1/(?:images|files)', frozenset()),
    ('GET', r'/open-apis/im/v1/(?:images|files)/'+_ID, frozenset()),
    ('GET', r'/open-apis/im/v1/messages/'+_ID+r'/resources/'+_ID, frozenset({'type'})),
)


def is_control_request(method, url):
    """Exact official Feishu communication routes; never an entire host exemption."""
    try:
        u = urlsplit(str(url))
        if (u.scheme != 'https' or u.hostname != 'open.feishu.cn'
                or u.port not in (None, 443) or u.username or u.password or u.fragment):
            return False
        if '%' in u.path or '..' in u.path:
            return False
        keys = {key for key, _ in parse_qsl(u.query, keep_blank_values=True)}
        return any(method.upper() == verb and re.fullmatch(pattern, u.path) and keys <= allowed
                   for verb, pattern, allowed in _ROUTES)
    except (TypeError, ValueError):
        return False


def validate_websocket(url):
    # Query contains opaque connection data; check it in memory, never log it.
    u = urlsplit(str(url))
    if (u.scheme != 'wss' or u.hostname != 'msg-frontier.feishu.cn'
            or u.port not in (None, 443) or u.username or u.password
            or u.path != '/ws/v2' or u.fragment):
        raise BudgetBlocked('Unreviewed Feishu WebSocket destination')


class FeishuTrafficPolicy(TrafficPolicy):
    def category(self, request):
        if _sdk_control.get() and is_control_request(request.method, request.url):
            return 'feishu'
        return super().category(request)


def tag_sdk_transport(transport, *, build_url=None):
    """Tag only a validated native SDK call, including its async HTTPX path.

    Used on an in-memory SDK transport class after native imports. Unknown
    routes fail closed; token/reply traffic cannot silently consume model quota.
    No network audit bypass is granted here.
    """
    if getattr(transport, '_lingju_feishu_control', False):
        raise RuntimeError('SDK control tagging already installed')
    sync, asynchronous = transport.execute, transport.aexecute
    if build_url is None:
        from lark_oapi.core.http.transport import _build_url
        build_url = _build_url

    def check(conf, req):
        url = build_url(conf.domain, req.uri, req.paths)
        if not is_control_request(req.http_method.name, url):
            raise BudgetBlocked('Feishu SDK route outside reviewed communication scope')

    @functools.wraps(sync)
    def execute(conf, req, *args, **kwargs):
        check(conf, req)
        token = _sdk_control.set(True)
        try:
            return sync(conf, req, *args, **kwargs)
        finally:
            _sdk_control.reset(token)

    @functools.wraps(asynchronous)
    async def aexecute(conf, req, *args, **kwargs):
        check(conf, req)
        token = _sdk_control.set(True)
        try:
            return await asynchronous(conf, req, *args, **kwargs)
        finally:
            _sdk_control.reset(token)

    transport.execute = staticmethod(execute)
    transport.aexecute = staticmethod(aexecute)
    transport._lingju_feishu_control = True

    def restore():
        transport.execute = staticmethod(sync)
        transport.aexecute = staticmethod(asynchronous)
        del transport._lingju_feishu_control
    return restore
