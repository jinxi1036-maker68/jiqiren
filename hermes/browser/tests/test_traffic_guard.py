import asyncio
import contextlib
import http.server
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from request_budget import RequestBudget, BudgetBlocked
from traffic_guard import TrafficPolicy, TrafficAudit, install_traffic_guard


class TrafficGuardTests(unittest.TestCase):
    def test_qq_messages_are_not_mistaken_for_model_messages(self):
        p = TrafficPolicy(qq_users=['SYNTHETIC_OWNER'])
        self.assertEqual(p.category(httpx.Request('POST', 'https://api.sgroup.qq.com/v2/users/SYNTHETIC_OWNER/messages')), 'qq')
        for url in ['https://api.sgroup.qq.com.evil.test/v2/users/SYNTHETIC_OWNER/messages',
                    'https://api.sgroup.qq.com/v2/users/UNAUTHORIZED/messages',
                    'http://api.sgroup.qq.com/v2/users/SYNTHETIC_OWNER/messages',
                    'https://api.sgroup.qq.com/v2/users/SYNTHETIC_OWNER/messages?x=1',
                    'https://model.invalid/v1/messages']:
            self.assertEqual(p.category(httpx.Request('POST', url)), 'model')

    def test_only_exact_get_catalog_is_metadata(self):
        p = TrafficPolicy(metadata_urls=['https://model.invalid/v1/models'])
        self.assertEqual(p.category(httpx.Request('GET', 'https://model.invalid/v1/models')), 'metadata')
        for method, url in [('POST','https://model.invalid/v1/models'),
                            ('GET','https://model.invalid/v1/models?prompt=x'),
                            ('POST','https://model.invalid/v1/chat/completions'),
                            ('GET','https://model.invalid/v1/models/foo:generateContent')]:
            self.assertEqual(p.category(httpx.Request(method, url)), 'model')
        self.assertEqual(p.category(httpx.Request('GET','https://model.invalid/v1/models',json={'prompt':'synthetic'})), 'model')
        bad=TrafficPolicy(metadata_urls=['https://model.invalid/v1/chat/completions'])
        self.assertEqual(bad.category(httpx.Request('GET','https://model.invalid/v1/chat/completions')), 'model')

    def test_catalog_redirect_to_generation_cannot_bypass_exhausted_cap(self):
        with tempfile.TemporaryDirectory() as d:
            b=RequestBudget.create(Path(d)/'model.sqlite',1);b.take()
            audit=TrafficAudit(Path(d)/'traffic.sqlite');seen=[]
            def wire(transport,req):
                seen.append(req.url.path)
                return httpx.Response(302,headers={'Location':'/v1/chat/completions'},request=req)
            with patch.object(httpx.HTTPTransport,'handle_request',wire):
                restore=install_traffic_guard(b,audit,TrafficPolicy(metadata_urls=['https://model.invalid/v1/models']))
                try:
                    with httpx.Client(trust_env=False,follow_redirects=True) as c:
                        with self.assertRaises(BudgetBlocked):c.get('https://model.invalid/v1/models')
                    self.assertEqual(seen,['/v1/models'])
                    self.assertEqual(audit.counts(),{'metadata':1})
                    self.assertEqual(b.status()['reserved_network_attempts'],1)
                finally:restore()

    def test_exhausted_model_budget_stays_exhausted_while_qq_is_audited(self):
        with tempfile.TemporaryDirectory() as d:
            b = RequestBudget.create(Path(d)/'model.sqlite', 1)
            b.take()
            audit = TrafficAudit(Path(d)/'traffic.sqlite')
            # Stub only the wire layer; no real QQ or model network request.
            def wire(transport, req):
                return httpx.Response(200, json={'ok':True}, request=req)
            with patch.object(httpx.HTTPTransport, 'handle_request', wire):
                restore = install_traffic_guard(b, audit, TrafficPolicy(qq_users=['SYNTHETIC_OWNER']))
                try:
                    with httpx.Client(trust_env=False) as c:
                        self.assertEqual(c.post('https://api.sgroup.qq.com/v2/users/SYNTHETIC_OWNER/messages').status_code,200)
                        with self.assertRaises(BudgetBlocked):
                            c.post('https://model.invalid/v1/chat/completions')
                    self.assertEqual(b.status()['reserved_network_attempts'],1)
                    self.assertEqual(audit.counts(),{'qq':1})
                finally:
                    restore()

    def test_real_sdk_main_retry_and_async_aux_share_model_cap(self):
        from openai import OpenAI, AsyncOpenAI
        import json
        seen=[]
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                self.rfile.read(int(self.headers.get('Content-Length',0)))
                seen.append(self.path)
                status=503 if len(seen)==1 else 200
                body={'error':{'message':'synthetic'}} if status==503 else {'id':'synthetic','object':'chat.completion','created':0,'model':'synthetic','choices':[{'index':0,'message':{'role':'assistant','content':'synthetic'},'finish_reason':'stop'}]}
                data=json.dumps(body).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
            def log_message(self,*a):pass
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:
            with tempfile.TemporaryDirectory() as d:
                b=RequestBudget.create(Path(d)/'model.sqlite',3)
                audit=TrafficAudit(Path(d)/'traffic.sqlite')
                restore=install_traffic_guard(b,audit,TrafficPolicy())
                try:
                    url=f'http://127.0.0.1:{server.server_port}/v1'
                    with OpenAI(api_key='synthetic',base_url=url,max_retries=1) as c:
                        c.chat.completions.create(model='synthetic',messages=[{'role':'user','content':'synthetic'}])
                    async def aux():
                        async with AsyncOpenAI(api_key='synthetic',base_url=url,max_retries=0) as c:
                            await c.chat.completions.create(model='synthetic',messages=[{'role':'user','content':'synthetic'}])
                    asyncio.run(aux())
                    with httpx.Client(trust_env=False) as c:
                        with self.assertRaises(BudgetBlocked):c.get(url+'/unknown-generation-route')
                    self.assertEqual(len(seen),3)
                    self.assertEqual(b.status()['reserved_network_attempts'],3)
                    self.assertEqual(audit.counts(),{'model':3})
                finally:restore()
        finally:server.shutdown();server.server_close()

    def test_control_traffic_cannot_loop_without_limit(self):
        with tempfile.TemporaryDirectory() as d:
            audit=TrafficAudit(Path(d)/'traffic.sqlite')
            for _ in range(40):audit.reserve('metadata','other_httpx')
            with self.assertRaises(BudgetBlocked):audit.reserve('metadata','other_httpx')
            self.assertEqual(audit.counts(),{'metadata':40})


if __name__=='__main__':unittest.main()
