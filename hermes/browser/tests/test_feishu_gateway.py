import asyncio
import contextlib
import contextvars
import hashlib
import http.server
from pathlib import Path
import json
import sqlite3
import sys
import tempfile
import threading
import types
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from feishu_meter import GatewayMeter, CURRENT_TURN, propagate_title_threads
from feishu_gateway import install_runner_hooks, is_owner, check_fresh_session, validate_gateway_handoff, native_connected
from qq_browser_task import BrowserExercise, PREFIX, FEISHU_TRANSFER
from qq_runtime import Intake
from request_budget import RequestBudget, BudgetBlocked


class FeishuGatewayTests(unittest.TestCase):
    def test_unadmitted_unknown_startup_requests_are_blocked_not_unlimited_normal_chat(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);b=RequestBudget.create(p/'budget.sqlite',limit=3,armed=False);m=GatewayMeter(p,b)
            with self.assertRaises(BudgetBlocked):m.take('other_httpx')
            self.assertEqual(b.status()['reserved_network_attempts'],0)
            self.assertEqual(b.status()['events'],{'denied_unarmed':1})

    def test_native_connected_is_a_property_not_a_callable(self):
        class Adapter:
            @property
            def is_connected(self):return True
        self.assertTrue(native_connected(Adapter()))
        self.assertFalse(native_connected(None))
        class Incompatible:
            def is_connected(self):return True
        with self.assertRaises(RuntimeError):native_connected(Incompatible())

    def test_prepared_entry_cannot_restart_gateway_without_separate_handoff_approval(self):
        gate=dict(channel_transfer_authorization=FEISHU_TRANSFER,
                  native_gateway_restart_approved=False,existing_other_platforms_not_disabled=True)
        for value in [False,None,'true']:
            with self.assertRaises(RuntimeError):validate_gateway_handoff({**gate,'native_gateway_restart_approved':value})
        validate_gateway_handoff({**gate,'native_gateway_restart_approved':True})

    def test_ordinary_and_browser_requests_have_independent_limits(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);b=RequestBudget.create(p/'budget.sqlite',limit=1);m=GatewayMeter(p,b)
            turn,token=m.begin(True);m.take();m.finish(turn,token)
            turn,token=m.begin(False)
            for _ in range(3):m.take()
            self.assertFalse(m.requires_pacing());m.finish(turn,token)
            self.assertEqual(b.status()['reserved_network_attempts'],1)

    def test_untagged_auxiliary_during_browser_is_conservatively_charged(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);b=RequestBudget.create(p/'budget.sqlite',limit=1);m=GatewayMeter(p,b)
            turn,token=m.begin(True)
            contextvars.Context().run(m.take)
            with self.assertRaises(BudgetBlocked):contextvars.Context().run(m.take)
            m.finish(turn,token)

    def test_late_copied_browser_cannot_borrow_a_later_ordinary_turn(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);b=RequestBudget.create(p/'budget.sqlite',limit=2);m=GatewayMeter(p,b)
            old,token=m.begin(True);ctx=contextvars.copy_context();m.finish(old,token)
            normal,token=m.begin()
            with self.assertRaises(BudgetBlocked):ctx.run(m.take)
            m.take();m.finish(normal,token)
            self.assertEqual(b.status()['reserved_network_attempts'],0)

    def test_title_worker_carries_context_and_cannot_send_after_turn_end(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);b=RequestBudget.create(p/'budget.sqlite',limit=2);m=GatewayMeter(p,b)
            module=types.SimpleNamespace(threading=threading);restore=propagate_title_threads(module)
            try:
                turn,token=m.begin(True);ready=threading.Event();resume=threading.Event();observed=[]
                def work():
                    observed.append(bool(CURRENT_TURN.get()['browser']));ready.set();resume.wait(2)
                    try:m.take()
                    except BudgetBlocked:observed.append('blocked')
                worker=module.threading.Thread(target=work,daemon=True);worker.start()
                self.assertTrue(ready.wait(2));m.finish(turn,token);resume.set();worker.join(2)
                self.assertEqual(observed,[True,'blocked'])
                self.assertEqual(b.status()['reserved_network_attempts'],0)
            finally:restore()
            self.assertIs(module.threading,threading)

    def test_real_SDK_retries_auxiliary_count_and_closed_quota_does_not_break_normal_chat(self):
        from openai import OpenAI,AsyncOpenAI,APIConnectionError
        from traffic_guard import install_traffic_guard,TrafficPolicy
        from qq_chat import OrdinaryTrafficAudit
        seen=[]
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                self.rfile.read(int(self.headers.get('Content-Length',0)));seen.append(self.path)
                status=503 if len(seen)==1 else 200
                data=json.dumps({'error':{'message':'synthetic'}} if status==503 else {
                    'id':'synthetic','object':'chat.completion','created':0,'model':'synthetic',
                    'choices':[{'index':0,'message':{'role':'assistant','content':'ok'},'finish_reason':'stop'}]}).encode()
                self.send_response(status);self.send_header('Content-Type','application/json')
                self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
            def log_message(self,*args):pass
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:
            with tempfile.TemporaryDirectory() as d:
                p=Path(d);b=RequestBudget.create(p/'budget.sqlite',limit=3);m=GatewayMeter(p,b)
                class Pacer:
                    def __init__(self):self.starts=0
                    def enter(self):m.check()
                    async def aenter(self):m.check()
                    def started(self,*a):self.starts+=1
                    def response(self,*a):pass
                    def leave(self):pass
                pacer=Pacer()
                restore=install_traffic_guard(m,OrdinaryTrafficAudit(p/'traffic.sqlite'),TrafficPolicy(),pacer=pacer)
                client=OpenAI(api_key='synthetic',base_url=f'http://127.0.0.1:{server.server_port}/v1',max_retries=1)
                try:
                    turn,token=m.begin(True)
                    client.chat.completions.create(model='synthetic',messages=[{'role':'user','content':'synthetic'}])
                    async def aux():
                        async with AsyncOpenAI(api_key='synthetic',base_url=client.base_url,max_retries=0) as c:
                            await c.chat.completions.create(model='synthetic',messages=[{'role':'user','content':'synthetic'}])
                    asyncio.run(aux())
                    with self.assertRaises((APIConnectionError,BudgetBlocked)):
                        client.chat.completions.create(model='synthetic',messages=[{'role':'user','content':'synthetic'}])
                    self.assertEqual(len(seen),3);m.finish(turn,token)
                    turn,token=m.begin(False)
                    client.chat.completions.create(model='synthetic',messages=[{'role':'user','content':'synthetic'}])
                    m.finish(turn,token)
                    self.assertEqual(len(seen),4);self.assertEqual(pacer.starts,3)
                    self.assertEqual(b.status()['reserved_network_attempts'],3)
                finally:client.close();restore()
        finally:server.shutdown();server.server_close()

    def test_native_handler_retained_and_one_fresh_Feishu_task_has_browser_tools(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);db=p/'state.db'
            with contextlib.closing(sqlite3.connect(db)) as c,c:
                c.execute('create table sessions(id text,source text,thread_id text,api_call_count integer,message_count integer,tool_call_count integer)')
                c.execute("insert into sessions values('fresh','feishu',null,0,0,0)")
            b=RequestBudget.create(p/'budget.sqlite',30)
            e=object.__new__(BrowserExercise);e.budget=b;e.intake=Intake(p/'intake.sqlite',cap=1)
            e.catalog_ready=True;e.thread_id='reserved-run';e.state_db=db;e.channel='feishu'
            m=GatewayMeter(p,b);observed=[];fresh=[]
            source=types.SimpleNamespace(platform=types.SimpleNamespace(value='feishu'),chat_type='dm',user_id='synthetic-owner',chat_id='synthetic-chat')
            binding={k:hashlib.sha256(v.encode()).hexdigest() for k,v in [('user_sha256',source.user_id),('chat_sha256',source.chat_id)]}
            class Runner:
                def __init__(self):self.session_store=types.SimpleNamespace(get_or_create_session=self.new)
                def new(self,src,force_new=False):fresh.append((src is source,force_new));return types.SimpleNamespace(session_id='fresh')
                def _is_user_authorized(self,src):return True
                def _primary_message_handler(self):
                    async def native(msg):
                        observed.append((CURRENT_TURN.get()['browser'],self._resolve_enabled_toolsets_for_source({},msg.source,'feishu')))
                        m.take();return 'native reply'
                    return native
                def _resolve_enabled_toolsets_for_source(self,*a):return ['files','company_browser_simulation']
                def _create_adapter(self,*a):return None
                async def start(self):return True
            native=types.SimpleNamespace(GatewayRunner=Runner,_current_max_iterations=lambda:32)
            restore=install_runner_hooks(native,e,m,p,{'files':{}},binding,p)
            try:
                runner=Runner();handler=runner._primary_message_handler()
                async def receive():
                    self.assertEqual(await handler(types.SimpleNamespace(text='你好',message_id='s0',source=source)),'native reply')
                    self.assertEqual(await handler(types.SimpleNamespace(text=PREFIX+'synthetic',message_id='s1',source=source)),'native reply')
                    self.assertIn('已接收',await handler(types.SimpleNamespace(text=PREFIX+'again',message_id='s2',source=source)))
                    self.assertEqual(await handler(types.SimpleNamespace(text='还在线吗',message_id='s3',source=source)),'native reply')
                asyncio.run(receive())
                self.assertEqual(observed,[(False,[]),(True,['company_browser_simulation','vision']),(False,[])])
                self.assertEqual(fresh,[(True,True)]);self.assertEqual(e.intake.count(),1)
                self.assertEqual(b.status()['reserved_network_attempts'],1)
                self.assertFalse(b.status()['armed'])
                self.assertFalse(is_owner(types.SimpleNamespace(platform='feishu',chat_type='group',user_id=source.user_id,chat_id=source.chat_id),binding))
            finally:restore()


if __name__=='__main__':unittest.main()
