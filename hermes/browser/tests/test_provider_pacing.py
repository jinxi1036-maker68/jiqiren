import asyncio
import contextlib
import datetime
import http.server
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from request_budget import RequestBudget, BudgetBlocked
from provider_pacing import ModelPacer, approved_pacing
from traffic_guard import TrafficAudit, TrafficPolicy, install_traffic_guard


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


class PacingTests(unittest.TestCase):
    def setup_pacer(self, root, cap=30):
        clock = Clock()
        budget = RequestBudget.create(root/'budget.sqlite', cap)
        receipt = root/'responses.jsonl'
        pacer = ModelPacer(budget, receipt, clock=clock, sleep=clock.sleep,
                           utcnow=lambda: datetime.datetime(2026,10,25,tzinfo=datetime.timezone.utc))
        return clock, budget, receipt, pacer

    def test_opt_in_only_and_rejects_unverified_policy(self):
        self.assertIsNone(approved_pacing({}))
        settings={'min_interval_seconds':12,'cooldown_on_429_seconds':60,
                  'max_single_wait_seconds':600,'concurrency':1}
        self.assertEqual(approved_pacing({'provider_pacing':settings}),settings)
        for wrong in [{**settings,'concurrency':2},{**settings,'min_interval_seconds':0},{}]:
            with self.assertRaises(BudgetBlocked):approved_pacing({'provider_pacing':wrong})

    def test_sync_requests_are_spaced_and_retry_after_controls_next_start(self):
        with tempfile.TemporaryDirectory() as tmp:
            clock,budget,receipt,pacer=self.setup_pacer(Path(tmp));audit=TrafficAudit(Path(tmp)/'audit.sqlite')
            seen=[]
            def wire(_transport,req):
                seen.append(clock())
                return httpx.Response(429 if len(seen)==1 else 200,
                                      headers={'Retry-After':'90'} if len(seen)==1 else {},json={'synthetic':True})
            with patch.object(httpx.HTTPTransport,'handle_request',wire):
                restore=install_traffic_guard(budget,audit,TrafficPolicy(),pacer=pacer)
                try:
                    with httpx.Client(trust_env=False) as c:
                        for _ in range(3):c.post('https://synthetic.invalid/v1/chat/completions')
                finally:restore()
            self.assertEqual(seen,[0,90,102])
            self.assertEqual(budget.status()['reserved_network_attempts'],3)

    def test_fallback_cooldown_headers_privacy_and_long_wait_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            clock,budget,receipt,pacer=self.setup_pacer(Path(tmp))
            pacer.enter();pacer.started('chat_completions')
            pacer.response(httpx.Response(429,headers={'Authorization':'synthetic-secret','X-Request-ID':'synthetic-private-id',
                'X-RateLimit-Limit-Requests':'10','X-RateLimit-Remaining-Requests':'0'},json={'message':'private synthetic body'}))
            pacer.leave();self.assertEqual(pacer.next_start,60)
            data=receipt.read_text()
            for secret in ['synthetic-secret','synthetic-private-id','private synthetic body','synthetic.invalid']:
                self.assertNotIn(secret,data)
            events=[json.loads(x) for x in data.splitlines()]
            self.assertEqual(events[-1]['numeric_rate_headers']['x-ratelimit-limit-requests'],10)
            pacer.enter();self.assertEqual(clock(),60)
            pacer.response(httpx.Response(429,headers={'Retry-After':'900'}));pacer.leave()
            with self.assertRaises(BudgetBlocked):pacer.enter()
            self.assertFalse(pacer.lock.locked())
            self.assertEqual(budget.status()['reserved_network_attempts'],0)

    def test_HTTP_date_retry_after_is_respected(self):
        with tempfile.TemporaryDirectory() as tmp:
            _,_,_,pacer=self.setup_pacer(Path(tmp))
            pacer.enter();pacer.started('chat_completions')
            pacer.response(httpx.Response(429,headers={'Retry-After':'Sun, 25 Oct 2026 00:02:00 GMT'}));pacer.leave()
            self.assertEqual(pacer.next_start,120)

    def test_stream_permit_blocks_async_model_until_closed_but_not_QQ(self):
        with tempfile.TemporaryDirectory() as tmp:
            clock,budget,_,pacer=self.setup_pacer(Path(tmp));audit=TrafficAudit(Path(tmp)/'audit.sqlite');seen=[]
            def sync_wire(_t,req):
                seen.append(req.url.path)
                return httpx.Response(200,stream=httpx.ByteStream(b'synthetic'))
            async def async_wire(_t,req):
                seen.append(req.url.path)
                return httpx.Response(200,json={'ok':True})
            with patch.object(httpx.HTTPTransport,'handle_request',sync_wire),patch.object(httpx.AsyncHTTPTransport,'handle_async_request',async_wire):
                restore=install_traffic_guard(budget,audit,TrafficPolicy(qq_users=['SYNTHETIC_OWNER']),pacer=pacer)
                try:
                    with httpx.Client(trust_env=False) as c:
                        response=c.send(c.build_request('POST','https://synthetic.invalid/v1/chat/completions'),stream=True)
                        self.assertTrue(pacer.lock.locked())
                        self.assertEqual(c.post('https://api.sgroup.qq.com/v2/users/SYNTHETIC_OWNER/messages').status_code,200)
                        async def check():
                            async with httpx.AsyncClient(trust_env=False) as client:
                                waiting=asyncio.create_task(client.post('https://synthetic.invalid/v1/unknown-aux'))
                                await asyncio.sleep(.01)
                                self.assertFalse(waiting.done());waiting.cancel()
                                with self.assertRaises(asyncio.CancelledError):await waiting
                                self.assertTrue(pacer.lock.locked())
                                response.close();clock.now=12
                                self.assertEqual((await client.post('https://synthetic.invalid/v1/unknown-aux')).status_code,200)
                        asyncio.run(check())
                finally:restore()
            self.assertFalse(pacer.lock.locked())
            self.assertEqual(budget.status()['reserved_network_attempts'],2)
            self.assertEqual(audit.counts(),{'model':2,'qq':1})
            self.assertEqual(seen,['/v1/chat/completions','/v2/users/SYNTHETIC_OWNER/messages','/v1/unknown-aux'])

    def test_pause_budget_and_wire_error_release_permit_without_extra_send(self):
        with tempfile.TemporaryDirectory() as tmp:
            clock,budget,_,pacer=self.setup_pacer(Path(tmp),cap=1);audit=TrafficAudit(Path(tmp)/'audit.sqlite');seen=[]
            def wire(_t,req):seen.append(req.url.path);raise httpx.ConnectError('synthetic transport error')
            with patch.object(httpx.HTTPTransport,'handle_request',wire):
                restore=install_traffic_guard(budget,audit,TrafficPolicy(),pacer=pacer)
                try:
                    with httpx.Client(trust_env=False) as c:
                        with self.assertRaises(httpx.ConnectError):c.post('https://synthetic.invalid/v1/chat/completions')
                        self.assertFalse(pacer.lock.locked())
                        with self.assertRaises(BudgetBlocked):c.post('https://synthetic.invalid/v1/chat/completions')
                finally:restore()
            self.assertEqual(len(seen),1)
            self.assertEqual(budget.status()['reserved_network_attempts'],1)
            self.assertEqual(budget.status()['events']['denied_at_limit'],1)
            self.assertFalse(pacer.lock.locked())

    def test_async_stream_holds_permit_until_aclose(self):
        class Stream(httpx.AsyncByteStream):
            async def __aiter__(self):
                yield b'synthetic'
        with tempfile.TemporaryDirectory() as tmp:
            _,budget,_,pacer=self.setup_pacer(Path(tmp));audit=TrafficAudit(Path(tmp)/'audit.sqlite')
            async def wire(_transport,_request):return httpx.Response(200,stream=Stream())
            with patch.object(httpx.AsyncHTTPTransport,'handle_async_request',wire):
                restore=install_traffic_guard(budget,audit,TrafficPolicy(),pacer=pacer)
                try:
                    async def check():
                        async with httpx.AsyncClient(trust_env=False) as c:
                            r=await c.send(c.build_request('POST','https://synthetic.invalid/v1/aux'),stream=True)
                            self.assertTrue(pacer.lock.locked())
                            await r.aclose();await r.aclose()
                            self.assertFalse(pacer.lock.locked())
                    asyncio.run(check())
                finally:restore()
            self.assertEqual(budget.status()['reserved_network_attempts'],1)

    def test_real_SDK_retry_and_async_aux_share_pacing_and_hard_cap(self):
        from openai import OpenAI, AsyncOpenAI
        seen=[]
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                self.rfile.read(int(self.headers.get('Content-Length',0)))
                seen.append(clock())
                status=429 if len(seen)==1 else 200
                body={'error':{'message':'synthetic throttling','type':'throttling_error'}} if status==429 else {'id':'synthetic','object':'chat.completion','created':0,'model':'synthetic','choices':[{'index':0,'message':{'role':'assistant','content':'synthetic'},'finish_reason':'stop'}]}
                data=json.dumps(body).encode();self.send_response(status)
                self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)))
                if status==429:self.send_header('Retry-After','0.001')
                self.end_headers();self.wfile.write(data)
            def log_message(self,*args):pass
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
        import threading
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:
            with tempfile.TemporaryDirectory() as tmp:
                clock,budget,_,pacer=self.setup_pacer(Path(tmp),cap=3);audit=TrafficAudit(Path(tmp)/'audit.sqlite')
                restore=install_traffic_guard(budget,audit,TrafficPolicy(),pacer=pacer)
                try:
                    url=f'http://127.0.0.1:{server.server_port}/v1'
                    with OpenAI(api_key='synthetic',base_url=url,max_retries=1) as c:
                        c.chat.completions.create(model='synthetic',messages=[{'role':'user','content':'synthetic'}])
                    clock.now=24
                    async def aux():
                        async with AsyncOpenAI(api_key='synthetic',base_url=url,max_retries=0) as c:
                            await c.chat.completions.create(model='synthetic',messages=[{'role':'user','content':'synthetic'}])
                    asyncio.run(aux())
                    with httpx.Client(trust_env=False) as c:
                        with self.assertRaises(BudgetBlocked):c.get(url+'/unknown')
                finally:restore()
                self.assertEqual(seen,[0,12,24])
                self.assertEqual(budget.status()['reserved_network_attempts'],3)
                self.assertFalse(pacer.lock.locked())
        finally:server.shutdown();server.server_close()


if __name__=='__main__':unittest.main()
