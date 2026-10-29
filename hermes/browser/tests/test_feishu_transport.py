import asyncio
import contextlib
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import types
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from feishu_transport import (is_control_request, validate_websocket,
                              FeishuTrafficPolicy, tag_sdk_transport)
from qq_browser_task import BrowserExercise, validate_browser_grant, AUTHORIZATION, FEISHU_TRANSFER, PREFIX
from qq_runtime import verify_unused_thread
from request_budget import BudgetBlocked, RequestBudget
from safety import sha256
from feishu_session_fence import SessionFence


class FeishuPreparationTests(unittest.TestCase):
    def test_first_task_can_keep_five_conservatively_reconciled_startup_attempts_without_reset(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d).resolve();run=root/'runs/fixture';grant_dir=root/'runs/grant'
            run.mkdir(parents=True);grant_dir.mkdir()
            SessionFence(root/'runs/exercise-sessions.sqlite',create=True)
            ledger=grant_dir/'requests.sqlite';b=RequestBudget.create(ledger,30,armed=False)
            with contextlib.closing(sqlite3.connect(ledger)) as c,c:
                c.execute('update state set used=5')
                for _ in range(5):c.execute("insert into events(pid,at,outcome,family) values(1,'synthetic','reconciled_unknown_startup_after_send','other_httpx')")
            proof=grant_dir/'startup-traffic-reconciliation.json'
            proof.write_text(json.dumps({'ledger':str(ledger),'accounted_unknown_attempts':5,
                                         'grant_limit_unchanged':30,'post_send_reconciliation':True}),'utf-8')
            runtime=run/'runtime.json';runtime.write_text(json.dumps({'toolRoot':str(root),'case':'recovery',
                'taskScope':'recovery','route':'playwright','roundBudget':str(ledger)}),'utf-8')
            preflight=run/'continuation-preflight.json';preflight.write_text(json.dumps({'passed':True,'SDK_tools':13,'model_calls':0}),'utf-8')
            db=root/'synthetic-state.sqlite'
            with contextlib.closing(sqlite3.connect(db)) as c,c:c.execute('create table sessions(source text,thread_id text)')
            g=dict(owner_authorization=AUTHORIZATION,channel='feishu',channel_transfer_authorization=FEISHU_TRANSFER,
                   request_limit=30,task_limit=1,case='recovery',message_prefix=PREFIX,zero_model_checks_passed=True,
                   runtime=str(runtime),ledger=str(ledger),runtime_sha256=sha256(runtime),preflight_sha256=sha256(preflight),
                   old_ledger_sha256={},initial_accounted_startup_attempts=5,reconciliation_sha256=sha256(proof))
            x=BrowserExercise(g,root,db,channel='feishu')
            self.assertEqual(x.budget.status()['reserved_network_attempts'],5)
            self.assertEqual(x.intake.count(),0)
            with self.assertRaises(RuntimeError):BrowserExercise({**g,'initial_accounted_startup_attempts':0},root,db,channel='feishu')
            with self.assertRaises(RuntimeError):BrowserExercise({**g,'reconciliation_sha256':'wrong'},root,db,channel='feishu')

    def test_transfer_preserves_original_30_1_and_cannot_be_reused_by_QQ(self):
        grant = dict(owner_authorization=AUTHORIZATION, channel='feishu',
                     channel_transfer_authorization=FEISHU_TRANSFER,
                     request_limit=30, task_limit=1, case='recovery',
                     message_prefix=PREFIX, zero_model_checks_passed=True)
        validate_browser_grant(grant, 'feishu')
        with self.assertRaises(RuntimeError): validate_browser_grant(grant, 'qqbot')
        with self.assertRaises(RuntimeError): validate_browser_grant({**grant, 'request_limit':31}, 'feishu')
        with self.assertRaises(RuntimeError): validate_browser_grant({**grant, 'channel_transfer_authorization':''}, 'feishu')

    def test_fresh_thread_check_uses_actual_platform(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'synthetic.sqlite'
            with contextlib.closing(sqlite3.connect(p)) as c, c:
                c.execute('create table sessions(source text,thread_id text)')
                c.execute("insert into sessions values('feishu','already-used')")
            verify_unused_thread(p, 'already-used', 'qqbot')
            with self.assertRaises(RuntimeError): verify_unused_thread(p, 'already-used', 'feishu')
            verify_unused_thread(p, 'fresh', 'feishu')
            with self.assertRaises(ValueError): verify_unused_thread(p, 'fresh', 'all')

    def test_no_hostwide_or_verbwide_control_exemption(self):
        self.assertTrue(is_control_request('POST','https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id'))
        self.assertTrue(is_control_request('POST','https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal'))
        for method,url in [
            ('POST','https://open.feishu.cn/v1/chat/completions'),
            ('GET','https://open.feishu.cn/open-apis/drive/v1/files'),
            ('DELETE','https://open.feishu.cn/open-apis/im/v1/messages/x'),
            ('POST','https://open.feishu.cn/open-apis/im/v1/messages?unexpected=x'),
            ('POST','https://open.feishu.cn.evil.example/open-apis/im/v1/messages'),
            ('POST','http://open.feishu.cn/open-apis/im/v1/messages'),
            ('POST','https://user:secret@open.feishu.cn/open-apis/im/v1/messages')]:
            self.assertFalse(is_control_request(method,url))

    def test_actual_installed_SDK_update_method_is_classified_as_control_sync_and_async(self):
        from lark_oapi.api.im.v1 import UpdateMessageRequest, UpdateMessageRequestBody
        from lark_oapi.core.http.transport import _build_url
        request=UpdateMessageRequest.builder().message_id('om_synthetic').request_body(
            UpdateMessageRequestBody.builder().msg_type('text').content('{"text":"synthetic"}').build()).build()
        # The SDK import may allocate a default loop; asyncio.run below uses
        # a separate loop. Close the unused one at test teardown only.
        try:sdk_loop=asyncio.get_event_loop()
        except RuntimeError:sdk_loop=None
        if sdk_loop is not None and not sdk_loop.is_running():self.addCleanup(sdk_loop.close)
        self.assertEqual(request.http_method.name,'PUT')
        conf=types.SimpleNamespace(domain='https://open.feishu.cn')
        policy=FeishuTrafficPolicy();seen=[]
        class SDK:
            @staticmethod
            def execute(conf,req):
                url=_build_url(conf.domain,req.uri,req.paths)
                seen.append(policy.category(httpx.Request(req.http_method.name,url)))
                return 'local-no-network'
            @staticmethod
            async def aexecute(conf,req):return SDK.execute(conf,req)
        restore=tag_sdk_transport(SDK)
        try:
            self.assertEqual(SDK.execute(conf,request),'local-no-network')
            self.assertEqual(asyncio.run(SDK.aexecute(conf,request)),'local-no-network')
            self.assertEqual(seen,['feishu','feishu'])
        finally:restore()
        for method,url in [('PUT','https://open.feishu.cn/open-apis/drive/v1/files/x'),
            ('PUT','https://open.feishu.cn/open-apis/im/v1/messages'),
            ('PUT','https://open.feishu.cn/open-apis/im/v1/messages/om_synthetic?unexpected=x'),
            ('DELETE','https://open.feishu.cn/open-apis/im/v1/messages/om_synthetic')]:
            self.assertFalse(is_control_request(method,url))

    def test_websocket_only_expected_official_destination(self):
        validate_websocket('wss://msg-frontier.feishu.cn/ws/v2?device_id=synthetic&service_id=1')
        for url in ['wss://evil.example/ws/v2','wss://msg-frontier.feishu.cn/other',
                    'ws://msg-frontier.feishu.cn/ws/v2','wss://msg-frontier.feishu.cn.evil.example/ws/v2']:
            with self.assertRaises(BudgetBlocked):validate_websocket(url)

    def test_sync_async_SDK_tagging_exempts_only_control_and_restores_context(self):
        policy=FeishuTrafficPolicy()
        control=httpx.Request('POST','https://open.feishu.cn/open-apis/im/v1/messages')
        model=httpx.Request('POST','https://apihub.agnes-ai.com/v1/chat/completions')
        self.assertEqual(policy.category(control),'model')
        observed=[]
        class SDK:
            @staticmethod
            def execute(conf,req):
                observed.append((policy.category(control),policy.category(model)))
                return 'synthetic'
            @staticmethod
            async def aexecute(conf,req):
                observed.append((policy.category(control),policy.category(model)))
        conf=types.SimpleNamespace(domain='https://open.feishu.cn')
        req=types.SimpleNamespace(uri='/open-apis/im/v1/messages',paths={},http_method=types.SimpleNamespace(name='POST'))
        restore=tag_sdk_transport(SDK, build_url=lambda domain,uri,paths: domain+uri)
        try:
            self.assertEqual(SDK.execute(conf,req),'synthetic')
            asyncio.run(SDK.aexecute(conf,req))
            self.assertEqual(observed,[('feishu','model'),('feishu','model')])
            self.assertEqual(policy.category(control),'model')
            req.uri='/v1/chat/completions'
            with self.assertRaises(BudgetBlocked):SDK.execute(conf,req)
            with self.assertRaises(RuntimeError):tag_sdk_transport(SDK)
        finally:restore()
        self.assertEqual(policy.category(control),'model')


if __name__=='__main__':unittest.main()
