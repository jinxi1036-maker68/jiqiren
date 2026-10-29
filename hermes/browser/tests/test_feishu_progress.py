import asyncio
import contextvars
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from feishu_progress import FeishuProgress, approved_progress, PROGRESS_OPTIONS
from feishu_meter import GatewayMeter, BrowserPacer
from request_budget import RequestAudit
from feishu_gateway import install_runner_hooks


class Adapter:
    def __init__(self):
        self.sent, self.edits = [], []
        self.ack = asyncio.Event()
        self.fail_send = self.fail_edit = False

    async def send(self, chat, text, **kwargs):
        self.sent.append((chat, text, kwargs))
        self.ack.set()
        return types.SimpleNamespace(success=not self.fail_send, message_id='synthetic')

    async def edit_message(self, chat, mid, text):
        self.edits.append((chat, mid, text))
        return types.SimpleNamespace(success=not self.fail_edit)


class ProgressTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.adapter = Adapter()
        self.msg = types.SimpleNamespace(message_id='private-message',
            source=types.SimpleNamespace(chat_id='private-chat'))

    async def asyncTearDown(self):
        self.tmp.cleanup()

    def create(self, **kw):
        return FeishuProgress(self.adapter, self.msg, self.root,
                              interval=.015, io_timeout=.05, **kw)

    async def test_receipt_precedes_long_wait_and_one_bubble_is_edited(self):
        p = self.create().start()
        await self.adapter.ack.wait()
        p.note('request_started')
        await asyncio.sleep(.04)
        self.assertIn('等待模型服务', self.adapter.edits[-1][2])
        p.finish('returned')
        await p.task
        self.assertEqual(len(self.adapter.sent), 1)
        self.assertIn('不代表业务操作成功', self.adapter.edits[-1][2])
        self.assertTrue(self.adapter.sent[0][2]['metadata']['_interim_send'])

    async def test_http_error_is_fact_not_cause_and_200_is_not_business_success(self):
        p = self.create()
        p.note('response_headers', status=503)
        self.assertIn('HTTP 503', p.text())
        self.assertIn('原因尚未确认', p.text())
        self.assertNotIn('瞬时', p.text())
        p.note('response_headers', status=200)
        self.assertIn('响应头', p.text())
        self.assertNotIn('成功', p.text())

    async def test_failed_send_is_not_retried_or_allowed_to_break_task(self):
        self.adapter.fail_send = True
        p = self.create().start()
        await p.task
        p.finish('returned')
        self.assertEqual(len(self.adapter.sent), 1)
        self.assertEqual(self.adapter.edits, [])

    async def test_failed_edit_never_creates_duplicate_bubble(self):
        self.adapter.fail_edit = True
        p = self.create().start()
        await self.adapter.ack.wait()
        await p.task
        self.assertEqual(len(self.adapter.sent), 1)
        self.assertEqual(len(self.adapter.edits), 1)

    async def test_receipt_network_timeout_is_bounded_no_resend(self):
        async def blocked(*a, **kw):
            await asyncio.Event().wait()
        self.adapter.send = blocked
        p = self.create().start()
        await asyncio.wait_for(p.task, .5)
        self.assertEqual(self.adapter.edits, [])

    async def test_fast_result_skips_stale_ack_and_late_note(self):
        p = self.create().start()
        p.finish('returned')
        p.note('request_started')
        await p.task
        self.assertEqual(self.adapter.sent, [])
        self.assertEqual(p.state, 'accepted')

    async def test_cancelled_or_failed_turn_never_reports_completed_business(self):
        for outcome, phrase in [('error', '异常'), ('cancelled', '中断')]:
            p = self.create().start()
            await asyncio.sleep(0)
            p.finish(outcome)
            await p.task
            self.assertIn(phrase, self.adapter.edits[-1][2])

    async def test_progress_receipts_do_not_persist_identifiers_or_message_body(self):
        p = self.create().start()
        await self.adapter.ack.wait()
        p.finish('returned')
        await p.task
        data = (self.root/'receipts.jsonl').read_text('utf-8')
        for value in ['private-chat', 'private-message', '收到，', '本次处理']:
            self.assertNotIn(value, data)

    async def test_real_pacer_events_update_only_same_live_turn_without_generation(self):
        audit = RequestAudit.create(self.root/'audit.sqlite')
        meter = GatewayMeter(self.root, audit)
        turn, token = meter.begin(True)
        p = self.create()
        turn['progress'] = p
        pacer = BrowserPacer(meter, self.root/'wire.jsonl')
        pacer.started('chat_completions')
        self.assertEqual(p.state, 'request_started')
        pacer.response(types.SimpleNamespace(status_code=504, headers={}))
        self.assertEqual(p.status, 504)
        pacer.started('other_httpx')
        pacer.response(types.SimpleNamespace(status_code=403, headers={}))
        self.assertEqual(p.status, 504)
        self.assertEqual(p.state, 'response_headers')
        copied = contextvars.copy_context()
        meter.finish(turn, token)
        copied.run(pacer.started, 'chat_completions')
        self.assertEqual(p.state, 'response_headers')
        contextvars.Context().run(pacer.started, 'other_httpx')
        self.assertEqual(p.state, 'response_headers')
        self.assertEqual(audit.status()['reserved_network_attempts'], 0)

    async def test_flag_is_explicit_and_original_absence_stays_disabled(self):
        self.assertIsNone(approved_progress({}))
        self.assertEqual(approved_progress({'owner_progress': PROGRESS_OPTIONS}), PROGRESS_OPTIONS)
        with self.assertRaises(RuntimeError):
            approved_progress({'owner_progress': {'interval_seconds': 1}})

    async def test_native_integration_owner_only_controls_and_original_result_preserved(self):
        budget = RequestAudit.create(self.root/'integration.sqlite')
        meter = GatewayMeter(self.root, budget)
        exercise = types.SimpleNamespace(continuous=True, budget=budget,
            pause=lambda: None, session_initialized=True, catalog_ready=True)
        source = types.SimpleNamespace(platform=types.SimpleNamespace(value='feishu'),
            chat_type='dm', user_id='synthetic-owner', chat_id='synthetic-chat')
        binding = {'user_sha256': hashlib.sha256(source.user_id.encode()).hexdigest(),
                   'chat_sha256': hashlib.sha256(source.chat_id.encode()).hexdigest()}
        observed = []
        adapter = self.adapter

        class Runner:
            def _primary_message_handler(self):
                return self._handle_message
            async def _handle_message(self, msg):
                from feishu_meter import CURRENT_TURN
                observed.append(CURRENT_TURN.get().get('progress'))
                if msg.text == 'raise':
                    await asyncio.sleep(.01)
                    raise ValueError('synthetic native failure')
                await asyncio.sleep(.01)
                return 'unchanged native result'
            def _is_user_authorized(self, src):
                return True
            def _adapter_for_source(self, src):
                return adapter
            def _resolve_enabled_toolsets_for_source(self, *a):
                return []
            def _create_adapter(self, *a):
                return None
            async def start(self):
                return True

        native = types.SimpleNamespace(GatewayRunner=Runner, _current_max_iterations=lambda:32)
        restore = install_runner_hooks(native, exercise, meter, self.root, {'files': {}},
            binding, self.root, progress_options=PROGRESS_OPTIONS)
        try:
            handler = Runner()._primary_message_handler()
            def msg(text, src=source):
                return types.SimpleNamespace(text=text, source=src, message_id='synthetic')
            self.assertEqual(await handler(msg('normal')), 'unchanged native result')
            await observed[-1].task
            self.assertEqual(await handler(msg('/status')), 'unchanged native result')
            self.assertIsNone(observed[-1])
            other = types.SimpleNamespace(**{**source.__dict__, 'user_id': 'other-user'})
            self.assertEqual(await handler(msg('normal', other)), 'unchanged native result')
            self.assertIsNone(observed[-1])
            with self.assertRaises(ValueError):
                await handler(msg('raise'))
            await observed[-1].task
            self.assertIn('异常', adapter.edits[-1][2])
            self.assertEqual(len(adapter.sent), 2)
            self.assertIsNone(meter.browser_turn)
        finally:
            restore()


if __name__ == '__main__':
    unittest.main()
