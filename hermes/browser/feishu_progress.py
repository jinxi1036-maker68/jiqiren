"""Visible, event-based Owner receipts; no generation or private reasoning.

One status bubble per admitted turn. Sending/editing is best-effort and never
blocks the native answer. Native tool/interim messages remain untouched.
"""
import asyncio
import threading
import time
import uuid

from qq_runtime import event


PROGRESS_OPTIONS = {'first_notice_after_seconds': 30,
                    'interval_seconds': 30, 'io_timeout_seconds': 4,
                    'one_status_bubble': True, 'reasoning_or_arguments': False}

NATIVE_RATE_LIMIT_REPLY='⏱️ The model provider is rate-limiting requests. Please wait a moment and try again.'


def explain_native_rate_failure(result, turn):
    """Explain only an exact native error with this live turn's last wire evidence.

    A successful model's answer quoting the same sentence must remain unchanged.
    No raw provider message, retry, task replay or business-success inference.
    """
    if not isinstance(result,str) or result!=NATIVE_RATE_LIMIT_REPLY:return result
    info=turn.get('model_last_result') or {}
    if info.get('status')!=429:return result
    reasons={'reported_connection_capacity_limit':'模型接口报告连接数达到上限',
             'reported_request_rate_limit':'模型接口报告请求频率限制',
             'reported_token_rate_limit':'模型接口报告Token速率限制',
             'explicit_quota_error':'模型接口报告额度限制'}
    reason=reasons.get(info.get('category'),'模型接口拒绝了本次请求')
    unknown='具体限制归属尚未确认' if info.get('category')=='reported_connection_capacity_limit' else '具体限额或账号权益尚待核实'
    return (f'{reason}（HTTP 429），{unknown}。'
            '本轮未取得最终答复；如已执行保存或创建，需先核实结果，避免重复提交。')


def approved_progress(gate):
    value = gate.get('owner_progress')
    if value is not None and value != PROGRESS_OPTIONS:
        raise RuntimeError('Unreviewed Owner progress settings')
    return value


class FeishuProgress:
    def __init__(self, adapter, message, output, *, initial_delay=30, interval=30, io_timeout=4,
                 clock=time.monotonic):
        self.adapter, self.message, self.output = adapter, message, output
        self.interval, self.io_timeout, self.clock = interval, io_timeout, clock
        self.initial_delay = initial_delay
        self.started = clock()
        self.lock = threading.Lock()
        self.state, self.status, self.outcome = 'accepted', None, None
        self.error_category=None
        self.done = asyncio.Event()
        self.task = None
        self.key = uuid.uuid4().hex  # local correlation; no chat/user/message ID

    def record(self, kind, **fields):
        try:
            event(self.output, kind, progress_key=self.key, **fields)
        except Exception:
            pass  # An unavailable receipt disk must not break native delivery.

    def start(self):
        self.task = asyncio.create_task(self._run())
        return self

    def note(self, state, *, status=None, category=None):
        # Called by the existing HTTP transport worker thread, not the model.
        if state not in {'request_started', 'response_headers','provider_error'}:
            return
        categories={'reported_connection_capacity_limit','reported_request_rate_limit','reported_token_rate_limit',
                    'reported_rate_limit','explicit_quota_error','provider_reported_free_user_limit',
                    'reported_model_channel_error','unclassified_429','unclassified_http_error'}
        if state=='provider_error' and (not isinstance(category,str) or category not in categories or not isinstance(status,int) or status<400):return
        with self.lock:
            if self.outcome is None:
                self.state = state
                self.status = status if isinstance(status, int) else None
                self.error_category=category if state=='provider_error' else None

    def finish(self, outcome):
        if outcome not in {'returned', 'error', 'cancelled'}:
            raise ValueError('Unknown native turn outcome')
        with self.lock:
            self.outcome = outcome
        self.done.set()

    def text(self):
        with self.lock:
            state, status, outcome,category = self.state, self.status, self.outcome,self.error_category
        elapsed = max(0, int(self.clock() - self.started))
        if outcome == 'returned':
            return '【系统状态】本次处理已结束。'
        if outcome == 'cancelled':
            return '【系统状态】本次处理已中断。'
        if outcome == 'error':
            return '【系统状态】本次处理出现异常，请看错误提示。'
        if state == 'request_started':
            detail = '正在等待模型服务返回，尚未取得本次请求结果。'
        elif state=='provider_error' and category=='reported_connection_capacity_limit':
            detail = '模型接口报告连接数达到上限（HTTP 429），限制归属尚未确认；尚未取得本轮答复。'
        elif state=='provider_error' and category in {'reported_request_rate_limit','reported_token_rate_limit','explicit_quota_error'}:
            reason={'reported_request_rate_limit':'请求频率限制','reported_token_rate_limit':'Token速率限制','explicit_quota_error':'额度限制'}[category]
            detail = f'模型接口报告{reason}（HTTP {status}）；尚未取得本轮答复。'
        elif state in {'response_headers','provider_error'} and status is not None and status >= 400:
            detail = f'模型接口返回 HTTP {status}，原因尚未确认；尚未取得本轮答复。'
        elif state == 'response_headers':
            detail = '模型接口已开始响应，尚未得到最终答复。'
        else:
            detail = '任务仍在处理中，暂时没有可确认的新结果。'
        return f'【系统状态】已等待 {elapsed} 秒。{detail}'

    async def _call(self, awaitable):
        try:
            return await asyncio.wait_for(awaitable, self.io_timeout)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self.record('owner_progress_io_failed', error_type=type(exc).__name__)
            return None

    async def _run(self):
        try:
            # No per-message canned acknowledgement. Let native replies and
            # tool progress speak; only delayed waits get a labelled status.
            if self.initial_delay > 0:
                try:
                    await asyncio.wait_for(self.done.wait(), self.initial_delay)
                except asyncio.TimeoutError:
                    pass
            if self.done.is_set():
                return
            res = await self._call(self.adapter.send(
                self.message.source.chat_id,
                self.text(),
                reply_to=self.message.message_id,
                metadata={'_interim_send': True}))
            success = bool(res and getattr(res, 'success', False))
            mid = getattr(res, 'message_id', None) if success else None
            self.record('owner_progress_notice', success=success, editable=bool(mid),
                        first_notice_after_seconds=self.initial_delay)
            if not mid:
                return  # No resend: failed/ambiguous sends must not duplicate.
            while True:
                try:
                    await asyncio.wait_for(self.done.wait(), self.interval)
                except asyncio.TimeoutError:
                    pass
                final = self.done.is_set()
                res = await self._call(self.adapter.edit_message(
                    self.message.source.chat_id, mid, self.text()))
                success = bool(res and getattr(res, 'success', False))
                self.record('owner_progress_edit', success=success, final=final)
                if final or not success:
                    return  # Never spam new bubbles as an edit fallback.
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self.record('owner_progress_stopped', error_type=type(exc).__name__)
