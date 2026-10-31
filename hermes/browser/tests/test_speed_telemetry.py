import json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import httpx
from request_budget import RequestBudget
from provider_pacing import ModelPacer
from traffic_guard import install_traffic_guard,TrafficAudit,TrafficPolicy

class Clock:
    now=0.
    def __call__(self):return self.now

class SpeedTelemetry(unittest.TestCase):
    def setup_case(self,root):
        clock=Clock();pacer=ModelPacer(RequestBudget.create(root/'b.sqlite',20),root/'events.jsonl',clock=clock,min_interval_seconds=0)
        return clock,pacer
    def test_real_stream_timing_and_request_counts_never_log_prompts_or_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);clock,pacer=self.setup_case(root)
            class Body(httpx.SyncByteStream):
                def __iter__(self):
                    clock.now=7.;yield b'private synthetic response'
                    clock.now=9.
            def wire(_t,_r):clock.now=4.;return httpx.Response(200,stream=Body())
            with patch.object(httpx.HTTPTransport,'handle_request',wire):
                restore=install_traffic_guard(pacer.budget,TrafficAudit(root/'a.sqlite'),TrafficPolicy(),pacer=pacer)
                try:
                    with httpx.Client(trust_env=False) as c:
                        r=c.post('https://synthetic.invalid/v1/chat/completions',headers={'authorization':'Bearer synthetic-secret'},
                            json={'model':'agnes-3.0-flash','messages':[{'role':'user','content':'private prompt secret'}],'tools':[{'private':'schema text'}]})
                        self.assertEqual(r.content,b'private synthetic response')
                finally:restore()
            raw=(root/'events.jsonl').read_text();events=[json.loads(x) for x in raw.splitlines()]
            meta=next(x for x in events if x['event']=='model_request_metadata')
            self.assertEqual((meta['model_id'],meta['message_count'],meta['tool_schema_count']),('agnes-3.0-flash',1,1))
            last=next(x for x in events if x['event']=='model_stream_closed')
            self.assertEqual((last['request_to_headers_seconds'],last['request_to_first_body_bytes_seconds'],last['total_request_seconds']),(4.,7.,9.))
            self.assertTrue(last['body_fully_iterated']);self.assertFalse(pacer.lock.locked())
            for private in ['private prompt secret','schema text','synthetic-secret','private synthetic response','synthetic.invalid']:self.assertNotIn(private,raw)
    def test_429_classification_preserves_error_body_and_original_backoff(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);clock,pacer=self.setup_case(root)
            body={'error':{'type':'AgnesAI_error','message':'You have reached the API rate limit for free users. private-request-id'}}
            expected=json.dumps(body).encode()
            class Body(httpx.SyncByteStream):
                def __iter__(self):yield expected
            with patch.object(httpx.HTTPTransport,'handle_request',lambda _t,_r:httpx.Response(429,stream=Body())):
                restore=install_traffic_guard(pacer.budget,TrafficAudit(root/'a.sqlite'),TrafficPolicy(),pacer=pacer)
                try:
                    with httpx.Client(trust_env=False) as c:self.assertEqual(c.post('https://synthetic.invalid/v1/chat/completions').content,expected)
                finally:restore()
            raw=(root/'events.jsonl').read_text();last=json.loads(raw.splitlines()[-1])
            self.assertEqual(last['provider_error_class'],'provider_reported_free_user_limit');self.assertEqual(pacer.next_start,60)
            self.assertNotIn('private-request-id',raw);self.assertNotIn(body['error']['message'],raw)
    def test_classifier_never_emits_arbitrary_provider_text_or_claims_all_429_are_rpm(self):
        cases=[(b'{"error":{"code":"quota_exceeded","message":"private"}}','explicit_quota_error'),
               (b'{"error":{"code":"rpm_limit_exceeded"}}','reported_request_rate_limit'),
               (b'{"error":{"code":"private-secret","message":"unknown"}}','unclassified_429'),
               (b'not JSON','unclassified_429')]
        for raw,expected in cases:
            kind,code=ModelPacer.error_classification(429,raw);self.assertEqual(kind,expected);self.assertNotEqual(code,'private-secret')

if __name__=='__main__':unittest.main()
