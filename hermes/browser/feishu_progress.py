"""Visible, event-based Owner receipts; no generation or private reasoning.

One status bubble per admitted turn. Sending/editing is best-effort and never
blocks the native answer. Native tool/interim messages remain untouched.
"""
import asyncio
import threading
import time
import uuid

from qq_runtime import event


PROGRESS_OPTIONS = {'interval_seconds': 30, 'io_timeout_seconds': 4,
                    'one_status_bubble': True, 'reasoning_or_arguments': False}


def approved_progress(gate):
    value = gate.get('owner_progress')
    if value is not None and value != PROGRESS_OPTIONS:
        raise RuntimeError('Unreviewed Owner progress settings')
    return value


class FeishuProgress:
    def __init__(self, adapter, message, output, *, interval=30, io_timeout=4,
                 clock=time.monotonic):
        self.adapter, self.message, self.output = adapter, message, output
        self.interval, self.io_timeout, self.clock = interval, io_timeout, clock
        self.started = clock()
        self.lock = threading.Lock()
        self.state, self.status, self.outcome = 'accepted', None, None
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

    def note(self, state, *, status=None):
        # Called by the existing HTTP transport worker thread, not the model.
        if state not in {'request_started', 'response_headers'}:
            return
        with self.lock:
            if self.outcome is None:
                self.state = state
                self.status = status if isinstance(status, int) else None

    def finish(self, outcome):
        if outcome not in {'returned', 'error', 'cancelled'}:
            raise ValueError('Unknown native turn outcome')
        with self.lock:
            self.outcome = outcome
        self.done.set()

    def text(self):
        with self.lock:
            state, status, outcome = self.state, self.status, self.outcome
        elapsed = max(0, int(self.clock() - self.started))
        if outcome == 'returned':
            return '本次处理已返回，具体结果请看正式答复；这条状态不代表业务操作成功。'
        if outcome == 'cancelled':
            return '本次处理已中断；尚未完成的事项不能当作已完成。'
        if outcome == 'error':
            return '本次处理出现异常，具体原因以错误提示和日志为准；未确认的结果仍然未知。'
        if state == 'request_started':
            detail = '正在等待模型服务返回，尚未取得本次请求结果。'
        elif state == 'response_headers' and status is not None and status >= 400:
            detail = f'模型接口返回 HTTP {status}，原因尚未确认；原任务仍在处理。'
        elif state == 'response_headers':
            detail = '模型服务已返回响应头，Hermes仍在继续处理；这还不是最终结果。'
        else:
            detail = '任务仍在处理中，暂时没有可确认的新结果。'
        return f'已处理 {elapsed} 秒。{detail}'

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
            # A very short native/control completion must not receive a stale
            # "working" message after its final answer.
            if self.done.is_set():
                return
            res = await self._call(self.adapter.send(
                self.message.source.chat_id,
                '收到，开始处理这条消息。需要较久时，我会更新这条状态；具体工具进展和最终结果另行回复。',
                reply_to=self.message.message_id,
                metadata={'_interim_send': True}))
            success = bool(res and getattr(res, 'success', False))
            mid = getattr(res, 'message_id', None) if success else None
            self.record('owner_progress_ack', success=success, editable=bool(mid))
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
