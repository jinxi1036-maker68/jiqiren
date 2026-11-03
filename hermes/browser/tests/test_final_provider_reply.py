import contextvars,json,hashlib,sys,tempfile,types,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import httpx
from feishu_meter import GatewayMeter,BrowserPacer
from feishu_progress import NATIVE_RATE_LIMIT_REPLY,explain_native_rate_failure
from request_budget import RequestAudit
from feishu_gateway import install_runner_hooks


class FinalProviderReply(unittest.TestCase):
    def test_capacity_explained_without_claiming_business_was_not_executed(self):
        text=explain_native_rate_failure(NATIVE_RATE_LIMIT_REPLY,{'model_last_result':{'status':429,'category':'reported_connection_capacity_limit'}})
        self.assertIn('连接数达到上限',text);self.assertIn('先核实结果',text)
        self.assertNotIn('每分钟',text);self.assertNotIn('任务未执行',text)

    def test_ordinary_answer_and_successful_quote_preserved(self):
        state={'model_last_result':{'status':429,'category':'reported_connection_capacity_limit'}}
        self.assertEqual(explain_native_rate_failure('normal model answer',state),'normal model answer')
        self.assertEqual(explain_native_rate_failure(NATIVE_RATE_LIMIT_REPLY,{'model_last_result':{'status':200}}),NATIVE_RATE_LIMIT_REPLY)
        self.assertIsNone(explain_native_rate_failure(None,state))

    def test_missing_or_new_request_evidence_does_not_reuse_old_failure(self):
        for info in [{},{'model_last_result':{'status':None}},{'model_last_result':{'status':403}}]:
            self.assertEqual(explain_native_rate_failure(NATIVE_RATE_LIMIT_REPLY,info),NATIVE_RATE_LIMIT_REPLY)

    def test_unknown_and_account_error_do_not_invent_key_type_or_450(self):
        for category in ['unclassified_429','provider_reported_free_user_limit','explicit_quota_error','reported_request_rate_limit','reported_token_rate_limit']:
            text=explain_native_rate_failure(NATIVE_RATE_LIMIT_REPLY,{'model_last_result':{'status':429,'category':category}})
            self.assertIn('HTTP 429',text);self.assertNotIn('免费用户',text);self.assertNotIn('450',text)

    def test_actual_pacer_wire_state_is_per_request_and_old_stream_cannot_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);meter=GatewayMeter(root,RequestAudit.create(root/'a.sqlite'));turn,token=meter.begin(True)
            try:
                pacer=BrowserPacer(meter,root/'events.jsonl');pacer.started('chat_completions');pacer.response(httpx.Response(429));old=pacer.observation
                pacer.body_piece(old,b'{"message":"max connections reached: 450"}')
                pacer.started('chat_completions');pacer.response(httpx.Response(200));pacer.stream_finished(old,True)
                self.assertEqual(turn['model_last_result']['status'],200);self.assertIsNone(turn['model_last_result']['category'])
                self.assertEqual(explain_native_rate_failure(NATIVE_RATE_LIMIT_REPLY,turn),NATIVE_RATE_LIMIT_REPLY)
            finally:meter.finish(turn,token)


class FinalProviderHook(unittest.IsolatedAsyncioTestCase):
    async def test_original_owner_hook_explains_failure_without_progress_and_preserves_other_owner(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);audit=RequestAudit.create(root/'audit.sqlite');meter=GatewayMeter(root,audit)
            source=types.SimpleNamespace(platform=types.SimpleNamespace(value='feishu'),chat_type='dm',user_id='fixture-owner',chat_id='fixture-chat')
            binding={'user_sha256':hashlib.sha256(source.user_id.encode()).hexdigest(),'chat_sha256':hashlib.sha256(source.chat_id.encode()).hexdigest()}
            exercise=types.SimpleNamespace(continuous=True,budget=audit,pause=lambda:None,session_initialized=True,catalog_ready=True)
            class Runner:
                def _primary_message_handler(self):return self._handle_message
                async def _handle_message(self,msg):
                    pacer=BrowserPacer(meter,root/'wire.jsonl');pacer.started('chat_completions');pacer.response(httpx.Response(429))
                    pacer.body_piece(pacer.observation,b'{"message":"max connections reached: 450; synthetic-secret"}')
                    pacer.stream_finished(pacer.observation,True)
                    return NATIVE_RATE_LIMIT_REPLY
                def _is_user_authorized(self,source):return True
                def _resolve_enabled_toolsets_for_source(self,*a):return []
                def _create_adapter(self,*a):return None
                async def start(self):return True
            native=types.SimpleNamespace(GatewayRunner=Runner,_current_max_iterations=lambda:32)
            restore=install_runner_hooks(native,exercise,meter,root,{'files':{}},binding,root)
            try:
                handler=Runner()._primary_message_handler()
                def msg(src):return types.SimpleNamespace(text='fixture task',source=src,message_id='fixture-message')
                result=await handler(msg(source));self.assertIn('连接数达到上限',result)
                other=types.SimpleNamespace(**{**source.__dict__,'user_id':'different-owner'})
                self.assertEqual(await handler(msg(other)),NATIVE_RATE_LIMIT_REPLY)
                self.assertEqual(audit.status()['reserved_network_attempts'],0)
                self.assertNotIn('synthetic-secret',(root/'receipts.jsonl').read_text())
            finally:restore()


if __name__=='__main__':unittest.main()
