"""Actual installed OpenAI SDK retry over mocked HTTPX: zero external requests."""
import contextvars
import datetime
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import httpx
from openai import OpenAI, RateLimitError
from feishu_meter import GatewayMeter,gateway_pacer,DAILY_PACING
from feishu_progress import FeishuProgress
from provider_pacing import ModelPacer
from request_budget import RequestAudit
from traffic_guard import TrafficAudit,TrafficPolicy,install_traffic_guard


class Clock:
    now=0.
    def __call__(self):return self.now
    def sleep(self,value):self.now+=value


ERROR={'message':'RateLimitError: OpenAIException - max connections reached: 450; synthetic-private-id'}
SUCCESS={'id':'fixture','object':'chat.completion','created':0,'model':'fixture',
         'choices':[{'index':0,'message':{'role':'assistant','content':'fixture'},'finish_reason':'stop'}]}


class NativeRetryParity(unittest.TestCase):
    def run_sdk(self, *, fail_all=False, retry_after=None):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);clock=Clock();audit=RequestAudit.create(root/'audit.sqlite');audit.arm()
            meter=GatewayMeter(root,audit);turn,token=meter.begin(True)
            progress=FeishuProgress(None,None,root,clock=clock);turn['progress']=progress
            pacer=gateway_pacer(meter,root/'responses.jsonl',{'daily_pacing':DAILY_PACING},continuous=True)
            pacer.clock,pacer.sleep=clock,clock.sleep;pacer.utcnow=lambda:datetime.datetime(2026,10,31,tzinfo=datetime.timezone.utc)
            seen=[]
            class Body(httpx.SyncByteStream):
                def __init__(self,data):self.data=json.dumps(data).encode()
                def __iter__(self):yield self.data
            def wire(_t,request):
                seen.append(clock())
                if fail_all or len(seen)==1:
                    return httpx.Response(429,headers={'Retry-After':retry_after} if retry_after else {},stream=Body(ERROR))
                return httpx.Response(200,stream=Body(SUCCESS))
            failure=False
            with patch.object(httpx.HTTPTransport,'handle_request',wire),patch('socket.socket.connect',side_effect=AssertionError('No external network')):
                restore=install_traffic_guard(meter,TrafficAudit(root/'traffic.sqlite'),TrafficPolicy(),pacer=pacer)
                try:
                    with patch('openai._base_client.time.sleep',clock.sleep),httpx.Client(trust_env=False) as http:
                        client=OpenAI(api_key='synthetic',base_url='https://fixture.invalid/v1',max_retries=2,http_client=http)
                        try:client.chat.completions.create(model='fixture',messages=[{'role':'user','content':'fixture'}])
                        except RateLimitError:failure=True
                finally:restore();meter.finish(turn,token)
            events=[json.loads(x) for x in (root/'responses.jsonl').read_text().splitlines()]
            self.assertEqual(audit.status()['reserved_network_attempts'],len(seen));self.assertIsNone(audit.status()['limit'])
            self.assertFalse(pacer.lock.locked());self.assertNotIn('synthetic-private-id',str(events))
            return seen,events,progress,failure

    def test_actual_native_sdk_429_then_success_has_no_extra_minute(self):
        seen,events,_,failed=self.run_sdk()
        self.assertFalse(failed);self.assertEqual(len(seen),2);self.assertGreater(seen[1],0);self.assertLess(seen[1],5)
        headers=next(x for x in events if x['event']=='model_response_headers')
        self.assertEqual(headers['scheduled_cooldown_seconds'],0);self.assertEqual(headers['retry_policy'],'native_sdk')
        self.assertEqual(next(x for x in events if x['event']=='model_stream_closed')['provider_error_class'],'reported_connection_capacity_limit')

    def test_actual_native_sdk_exhausts_its_existing_retries_and_does_not_loop(self):
        seen,_,progress,failed=self.run_sdk(fail_all=True)
        self.assertTrue(failed);self.assertEqual(len(seen),3);self.assertLess(seen[-1],10)
        self.assertIn('连接数达到上限',progress.text());self.assertNotIn('原任务仍在处理',progress.text())

    def test_explicit_server_retry_after_90_is_not_shortened_or_double_added(self):
        seen,_,_,failed=self.run_sdk(retry_after='90')
        self.assertFalse(failed);self.assertEqual(seen,[0,90])

    def test_error_shape_classification_does_not_blame_all_429_on_RPM(self):
        cases=[({'error':{'message':'max connections reached: 450','code':'rate_limit_exceeded'}},'reported_connection_capacity_limit'),
               ({'message':'max connections reached: 450'},'reported_connection_capacity_limit'),
               ({'detail':'max connections reached: 450'},'reported_connection_capacity_limit'),
               ({'error':'max connections reached: 450'},'reported_connection_capacity_limit'),
               ({'error':{'code':'rate_limit_exceeded'}},'reported_rate_limit'),
               ({'error':{'message':'requests per minute exceeded'}},'reported_request_rate_limit'),
               ({'error':{'message':'tokens per minute exceeded'}},'reported_token_rate_limit'),
               ({'error':{'message':'unexplained'}},'unclassified_429')]
        for body,expected in cases:self.assertEqual(ModelPacer.error_classification(429,json.dumps(body).encode())[0],expected)

    def test_late_closed_stream_cannot_update_a_finished_owner_turn(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);audit=RequestAudit.create(root/'audit.sqlite');meter=GatewayMeter(root,audit)
            turn,token=meter.begin(True);progress=FeishuProgress(None,None,root);turn['progress']=progress
            pacer=gateway_pacer(meter,root/'events.jsonl',{'daily_pacing':DAILY_PACING},continuous=True)
            pacer.started('chat_completions');pacer.response(httpx.Response(429));obs=pacer.observation
            pacer.body_piece(obs,json.dumps(ERROR).encode());meter.finish(turn,token)
            pacer.stream_finished(obs,True)
            self.assertIsNone(progress.error_category);self.assertEqual(progress.state,'response_headers')

    def test_next_request_clears_old_error_and_unknown_category_not_displayed(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=FeishuProgress(None,None,Path(tmp))
            p.note('provider_error',status=429,category='reported_connection_capacity_limit')
            self.assertIn('连接数达到上限',p.text())
            p.note('request_started');self.assertIsNone(p.error_category);self.assertNotIn('连接数达到上限',p.text())
            p.note('provider_error',status=429,category='untrusted raw provider text')
            self.assertEqual(p.state,'request_started')


if __name__=='__main__':unittest.main()
