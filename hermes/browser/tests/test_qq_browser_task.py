import asyncio
import contextvars
import concurrent.futures
import json
from pathlib import Path
import sys
import tempfile
import threading
import http.server
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from qq_chat import OwnerMessageMeter,validate_chat_gate,OWNER_CHAT_AUTH
from qq_browser_task import validate_browser_grant,AUTHORIZATION,PREFIX
from request_budget import RequestBudget,BudgetBlocked


class QQBrowserRoutingTests(unittest.TestCase):
    def test_exact_new_grant_needed_not_ordinary_or_old_approval(self):
        grant={'owner_authorization':AUTHORIZATION,'request_limit':30,'task_limit':1,'case':'recovery','message_prefix':PREFIX,'zero_model_checks_passed':True}
        validate_browser_grant(grant)
        validate_chat_gate({'mode':'ordinary_owner_chat','owner_authorization':OWNER_CHAT_AUTH,
                            'browser_tasks_enabled':True,'business_tools_enabled':False,'browser_exercise':grant})
        for key,value in [('request_limit',31),('task_limit',2),('case','binding'),('message_prefix',''),('zero_model_checks_passed',False)]:
            with self.assertRaises(RuntimeError):validate_browser_grant({**grant,key:value})

    def test_ordinary_does_not_use_browser_budget_or_stop_after_it(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);budget=RequestBudget.create(p/'test.sqlite',limit=1)
            meter=OwnerMessageMeter(p,browser_budget=budget)
            meter.begin();meter.take();meter.finish()
            self.assertEqual(budget.status()['reserved_network_attempts'],0)
            meter.begin('browser');meter.take()
            with self.assertRaises(BudgetBlocked):meter.take()
            meter.finish();meter.begin();meter.take();meter.finish()
            self.assertEqual(budget.status()['reserved_network_attempts'],1)

    def test_late_browser_context_cannot_charge_new_ordinary_message(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);budget=RequestBudget.create(p/'test.sqlite',limit=3)
            meter=OwnerMessageMeter(p,browser_budget=budget)
            meter.begin('browser');old=contextvars.copy_context();meter.finish()
            meter.begin()
            with self.assertRaises(BudgetBlocked):old.run(meter.take)
            meter.take();meter.finish()
            self.assertEqual(budget.status()['reserved_network_attempts'],0)

    def test_worker_without_context_is_denied_but_copied_worker_uses_correct_budget(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);budget=RequestBudget.create(p/'test.sqlite',limit=3);meter=OwnerMessageMeter(p,budget)
            meter.begin('browser')
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                with self.assertRaises(BudgetBlocked):pool.submit(meter.take).result()
                self.assertEqual(pool.submit(contextvars.copy_context().run,meter.take).result(),1)
            meter.finish()
            self.assertEqual(budget.status()['reserved_network_attempts'],1)

    def test_parent_shutdown_clears_copied_worker_admission(self):
        with tempfile.TemporaryDirectory() as d:
            meter=OwnerMessageMeter(Path(d));meter.begin();saved=contextvars.copy_context()
            contextvars.Context().run(meter.finish)
            with self.assertRaises(BudgetBlocked):saved.run(meter.take)

    def test_real_SDK_retry_auxiliary_and_next_ordinary_message_are_isolated(self):
        from openai import OpenAI,AsyncOpenAI,APIConnectionError
        from traffic_guard import install_traffic_guard,TrafficPolicy
        from qq_chat import OrdinaryTrafficAudit
        seen=[]
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                self.rfile.read(int(self.headers.get('Content-Length',0)));seen.append(self.path)
                status=503 if len(seen)==1 else 200
                value={'error':{'message':'synthetic','type':'synthetic'}} if status==503 else {
                    'id':'synthetic','object':'chat.completion','created':0,'model':'synthetic',
                    'choices':[{'index':0,'message':{'role':'assistant','content':'ok'},'finish_reason':'stop'}]}
                data=json.dumps(value).encode();self.send_response(status);self.send_header('Content-Type','application/json')
                self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
            def log_message(self,*a):pass
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:
            with tempfile.TemporaryDirectory() as d:
                p=Path(d);budget=RequestBudget.create(p/'test.sqlite',limit=3);meter=OwnerMessageMeter(p,budget)
                restore=install_traffic_guard(meter,OrdinaryTrafficAudit(p/'traffic.sqlite'),TrafficPolicy())
                client=OpenAI(api_key='synthetic',base_url=f'http://127.0.0.1:{server.server_port}/v1',max_retries=1)
                try:
                    meter.begin('browser')
                    client.chat.completions.create(model='synthetic',messages=[{'role':'user','content':'synthetic'}])
                    async def auxiliary():
                        async with AsyncOpenAI(api_key='synthetic',base_url=f'http://127.0.0.1:{server.server_port}/v1',max_retries=0) as aux:
                            await aux.chat.completions.create(model='synthetic',messages=[{'role':'user','content':'synthetic'}])
                    asyncio.run(auxiliary())
                    with self.assertRaises(APIConnectionError):
                        client.chat.completions.create(model='synthetic',messages=[{'role':'user','content':'synthetic'}])
                    self.assertEqual(len(seen),3)
                    meter.finish();meter.begin()
                    client.chat.completions.create(model='synthetic',messages=[{'role':'user','content':'ordinary'}])
                    self.assertEqual(len(seen),4)
                    self.assertEqual(budget.status()['reserved_network_attempts'],3)
                finally:
                    meter.finish();client.close();restore()
        finally:server.shutdown();server.server_close()


if __name__=='__main__':unittest.main()
