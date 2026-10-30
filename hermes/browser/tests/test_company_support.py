import asyncio,json,sys,tempfile,types,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from company_tasks import TaskStore,recoverable
from company_support import knowledge
from task_continuation import TaskContinuation,unwrap
from safety import sha256

SOURCE={'platform':'feishu','chat_type':'dm','user_id':'synthetic-owner','chat_id':'synthetic-dm'}
class Tasks(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
  self.s=TaskStore(self.root/'tasks.sqlite');self.s.begin_owner(SOURCE,'s1','m1','Synthetic grouping task; unknown destinations must remain unknown')
 def fail(self):
  return self.s.browser_event('ego_browser_actions',False,'EGO_UNAVAILABLE','failure','digest')['task_id']
 def test_first_real_browser_read_records_original_goal_and_no_extra_task_for_status(self):
  self.assertFalse(self.s.browser_event('ego_browser_status',True,None,'status','d')['recorded']);self.assertEqual(self.s.list(),[])
  tid=self.s.browser_event('ego_browser_observe',True,None,'r1','d')['task_id'];self.assertIn('unknown destinations',self.s.read(tid)['owner_request'])
 def test_no_authorized_context_no_read_receipt_or_task_creation(self):
  self.s.end_turn();self.assertFalse(self.s.browser_event('ego_browser_actions',False,'EGO_UNAVAILABLE','r1','d')['recorded'])
  with self.assertRaises(ValueError):self.s.checkpoint({'action':'checkpoint','note':'forged'})
 def test_completion_requires_new_observation_after_failed_save(self):
  tid=self.s.browser_event('ego_browser_observe',True,None,'old','d')['task_id'];self.fail()
  for args in [{'status':'completed'},{'status':'completed','verification_ref':'old'},{'verification_ref':'missing'}]:
   with self.assertRaises(ValueError):self.s.checkpoint({'action':'checkpoint','task_id':tid,**args})
  self.s.browser_event('ego_browser_observe',True,None,'new','d')
  t=self.s.checkpoint({'action':'checkpoint','task_id':tid,'status':'completed','verification_ref':'new'})
  self.assertFalse(t['needs_verification']);self.assertEqual(t['status'],'completed')
 def test_single_use_source_bound_ticket_and_no_new_task_from_internal_turn(self):
  tid=self.fail();self.s.end_turn();ticket=self.s.ticket(tid)
  self.assertFalse(self.s.consume(tid,ticket,{**SOURCE,'chat_id':'foreign'}))
  self.assertTrue(self.s.consume(tid,ticket,SOURCE));self.assertFalse(self.s.consume(tid,ticket,SOURCE))
  self.assertEqual(self.s.checkpoint({'action':'checkpoint','note':'retained'})['id'],tid)
 def test_new_owner_input_invalidates_queued_internal_work_without_deleting_goal(self):
  tid=self.fail();self.s.end_turn();ticket=self.s.ticket(tid)
  self.s.begin_owner(SOURCE,'s1','m2','Stop for now')
  self.assertFalse(self.s.consume(tid,ticket,SOURCE));self.assertEqual(self.s.pending(),[])
  self.assertEqual(self.s.read(tid)['status'],'paused')
 def test_new_owner_clarification_preserves_original_and_is_not_agent_authority(self):
  tid=self.fail();self.s.end_turn();original=self.s.read(tid)['owner_request']
  self.s.begin_owner(SOURCE,'s2','m2','Synthetic clarification: all listed items belong to test group')
  t=self.s.checkpoint({'task_id':tid,'action':'checkpoint','status':'active'})
  self.assertEqual(t['owner_request'],original);self.assertEqual(len(t['owner_inputs']),2)
 def test_page_errors_and_login_do_not_schedule_transport_recovery(self):
  for code in ['HTTP_503','EGO_OPERATION_FAILED','EGO_INVALID_ARGUMENT','EGO_OWNER_LOGIN_REQUIRED','EGO_USER_CONTROL_REQUIRED']:
   self.assertFalse(recoverable(code));self.s.browser_event('ego_browser_actions',False,code,code,'d')
   self.assertEqual(self.s.pending(),[])
 def test_page_failure_remains_agent_work_and_is_not_a_request_for_owner_repair(self):
  tid=self.s.browser_event('ego_browser_actions',False,'EGO_PAGE_ACTION_FAILED','hidden','d')['task_id']
  self.assertEqual(self.s.read(tid)['status'],'active');self.assertTrue(self.s.read(tid)['needs_verification'])
  self.s.browser_event('ego_browser_actions',False,'EGO_OWNER_LOGIN_REQUIRED','login','d')
  self.assertEqual(self.s.read(tid)['status'],'needs_owner')
 def test_pending_recovers_across_reopen_without_old_private_memory(self):
  tid=self.fail();self.s.end_turn();other=TaskStore(self.root/'tasks.sqlite')
  self.assertEqual(other.pending()[0]['id'],tid)
 def test_hard_continuation_guard_cannot_be_reset_by_fabricated_progress_items(self):
  tid=self.fail();self.s.end_turn()
  for n in range(2):
   token=self.s.ticket(tid);self.assertTrue(self.s.consume(tid,token,SOURCE))
   self.s.checkpoint({'action':'checkpoint','status':'blocked_tool','resume_after_recovery':True,'items':[{'key':str(n),'state':'done'}]});self.s.end_turn()
  self.assertIsNone(self.s.ticket(tid));self.assertEqual(self.s.read(tid)['status'],'needs_owner')
 def test_secrets_redacted_input_limits_and_duplicate_items_fail_closed(self):
  for args in [{'resume_after_recovery':'true'},{'items':[{'key':'x','state':'done'},{'key':'x','state':'pending'}]},{'shell':'whoami'}]:
   with self.assertRaises(ValueError):self.s.checkpoint({'action':'checkpoint',**args})
  t=self.s.checkpoint({'action':'checkpoint','note':'password: fake-secret'});self.assertNotIn('fake-secret',t['note'])
 def test_knowledge_only_manifest_files_correct_hash_and_pagination(self):
  w=self.root/'company';w.mkdir();p=w/'CURRENT_WORK.json';p.write_text('synthetic knowledge')
  (w/'HERMES.md').write_text('synthetic role')
  (w/'SNAPSHOT_MANIFEST.json').write_text(json.dumps({'release_id':'synthetic','files':[{'path':p.name,'sha256':sha256(p)}],'protected_HERMES_sha256':sha256(w/'HERMES.md')}))
  cfg={'workspace':str(w)}
  self.assertEqual(knowledge(cfg,{'action':'list'})['count'],1)
  r=knowledge(cfg,{'action':'read','path':p.name,'limit':4});self.assertTrue(r['more']);self.assertEqual(r['text'],'synt')
  for name in ['../MEMORY.md','MEMORY.md','USER.md']:
   with self.assertRaises(ValueError):knowledge(cfg,{'action':'read','path':name})
  p.write_text('concurrent edit')
  with self.assertRaises(ValueError):knowledge(cfg,{'action':'read','path':p.name})

class Continuation(unittest.IsolatedAsyncioTestCase):
 async def asyncSetUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name);self.calls=[]
  async def call(name,args):self.calls.append((name,args));return {'error':'still unavailable'}
  self.c=TaskContinuation(self.root/'tasks.sqlite',self.root,lambda:[],call=call,delays=(0,0,0))
  self.c.store.begin_owner(SOURCE,'s','m','synthetic existing task')
  self.tid=self.c.store.browser_event('ego_browser_actions',False,'EGO_UNAVAILABLE','r','d')['task_id'];self.c.store.end_turn()
 async def test_recovery_probe_never_replays_clicks_or_creates_business_records(self):
  runner=types.SimpleNamespace(_adapter_for_source=lambda s:types.SimpleNamespace(_active_sessions={},_pending_messages={}),_session_key_for_source=lambda s:'key')
  await self.c.resume(runner,self.tid)
  self.assertEqual(len(self.calls),6)
  self.assertTrue(all(name in {'ego_browser_diagnostics','ego_browser_recover'} for name,_ in self.calls))
  self.assertEqual(self.c.store.read(self.tid)['status'],'needs_owner')
 async def test_new_owner_stop_cancels_pending_before_any_probe(self):
  self.c.store.begin_owner(SOURCE,'s','m2','stop');await self.c.resume(None,self.tid);self.assertEqual(self.calls,[])
 async def test_protection_change_prevents_probe_or_model_wakeup(self):
  self.c.check_protection=lambda:['protected'];await self.c.resume(None,self.tid);self.assertEqual(self.calls,[])
 async def test_success_routes_one_native_internal_event_and_consumes_ticket(self):
  async def call(name,args):return {'ready':True,'operationSucceeded':True}
  self.c.call=call;received=[]
  class Adapter:
   async def handle_message(_,msg):received.append(msg);self.assertTrue(self.c.admit_internal(msg))
  runner=types.SimpleNamespace(_adapter_for_source=lambda s:Adapter(),_session_key_for_source=lambda s:'key')
  # Fake only native transport types; no original Agent/model is started.
  class Event:
   def __init__(self,**kwargs):self.__dict__.update(kwargs)
  class Source:
   @staticmethod
   def from_dict(d):return types.SimpleNamespace(to_dict=lambda:d)
  from unittest.mock import patch
  with patch.dict(sys.modules,{'gateway.platforms.base':types.SimpleNamespace(MessageEvent=Event),'gateway.session':types.SimpleNamespace(SessionSource=Source)}):
   await self.c.resume(runner,self.tid)
  self.assertEqual(len(received),1);self.assertTrue(received[0].internal);self.assertFalse(received[0].allow_gateway_control)
  self.assertIn('不是新的Owner指令',received[0].text)
 def test_native_receipt_nested_json_is_parsed_without_page_text_guessing(self):
  self.assertTrue(unwrap(json.dumps({'result':json.dumps({'ready':True})+'\n'+json.dumps({'taskReceipt':{}})}))['ready'])
 async def test_delivery_callback_is_required_before_any_resume_is_scheduled(self):
  callbacks=[];scheduled=[]
  self.c.store.begin_owner(SOURCE,'s','m2','synthetic task');self.tid=self.c.store.browser_event('ego_browser_actions',False,'EGO_UNAVAILABLE','r2','d')['task_id']
  self.c.schedule=lambda runner,tid:scheduled.append(tid)
  adapter=types.SimpleNamespace(_active_sessions={},register_post_delivery_callback=lambda key,callback,**kw:callbacks.append(callback))
  runner=types.SimpleNamespace(_adapter_for_source=lambda source:adapter,_session_key_for_source=lambda source:'key')
  msg=types.SimpleNamespace(source=None);self.c.after_turn(runner,msg,'returned')
  self.assertEqual(scheduled,[]);self.assertEqual(len(callbacks),1)
  self.c.delivery_outcome(msg,'success');callbacks[0]();self.assertEqual(scheduled,[self.tid])
 async def test_forged_internal_metadata_cannot_admit_a_model_turn(self):
  source=types.SimpleNamespace(to_dict=lambda:SOURCE)
  for meta in [{'lingju_task_resume':{'task_id':'absent','ticket':'fake'}},{'lingju_task_resume':{}},{}]:
   self.assertFalse(self.c.admit_internal(types.SimpleNamespace(metadata=meta,source=source)))

class NativeGatewayHook(unittest.IsolatedAsyncioTestCase):
 async def test_native_owner_tools_are_preserved_but_internal_browser_grant_requires_ticket(self):
  import hashlib
  from feishu_gateway import install_runner_hooks
  from feishu_meter import GatewayMeter,CURRENT_TURN
  from request_budget import RequestAudit
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);audit=RequestAudit.create(root/'audit.sqlite');meter=GatewayMeter(root,audit);called=[]
   class Exercise:
    continuous=True;catalog_ready=True;session_initialized=True;budget=audit;toolsets=['company_browser_simulation']
    cfg=dict(schema='lingju.ego-browser.v3',mode='company-business',productionEnabled=True,businessWritesEnabled=True,
      origin='https://ldp.lingrobotics.com',businessAuthorization=dict(schema='lingju.browser-business-grant.v1',ownerApproved=True,
      scopeOrigin='https://ldp.lingrobotics.com',scope='all-company-browser-ui-business-actions',reference='synthetic approval',highImpactRequiresSpecificOwnerTask=True))
    def pause(self):
     import contextlib
     with contextlib.closing(self.budget._connection()) as c,c:c.execute('UPDATE state SET armed=0 WHERE id=1')
   class Source:
    platform='feishu';chat_type='dm';user_id=SOURCE['user_id'];chat_id=SOURCE['chat_id']
    def to_dict(self):return SOURCE.copy()
   source=Source();callbacks=[]
   adapter=types.SimpleNamespace(_active_sessions={},register_post_delivery_callback=lambda k,c,**kw:callbacks.append(c))
   class Runner:
    def __init__(self):self.session_store=types.SimpleNamespace(_generate_session_key=lambda s:'key',peek_session_id=lambda key:'native-session')
    def _primary_message_handler(self):return self._handle_message
    def _is_user_authorized(self,s):return True
    def _resolve_enabled_toolsets_for_source(self,*a):return ['native']
    def _adapter_for_source(self,s):return adapter
    def _session_key_for_source(self,s):return 'key'
    def _create_adapter(self,*a):return None
    async def start(self):return True
    async def _handle_message(self,msg):
     if self._resolve_enabled_toolsets_for_source({},source,'feishu'):self_assert=msg.channel_prompt;assert '不是Gate1A本机模拟' in self_assert
     called.append(self._resolve_enabled_toolsets_for_source({},source,'feishu'))
     if not msg.internal:c.store.browser_event('ego_browser_actions',False,'EGO_UNAVAILABLE','receipt','digest')
     return 'native answer'
   c=TaskContinuation(root/'tasks.sqlite',root,lambda:[])
   binding={k:hashlib.sha256(v.encode()).hexdigest() for k,v in [('user_sha256',source.user_id),('chat_sha256',source.chat_id)]}
   native=types.SimpleNamespace(GatewayRunner=Runner,_current_max_iterations=lambda:32)
   restore=install_runner_hooks(native,Exercise(),meter,root,{'files':{}},binding,root,continuation=c)
   try:
    runner=Runner();msg=types.SimpleNamespace(text='real synthetic Owner task',source=source,message_id='owner',internal=False,metadata={})
    self.assertEqual(await runner._handle_message(msg),'native answer');self.assertFalse(audit.status()['armed'])
    pending=c.store.pending()[0];ticket=c.store.ticket(pending['id'])
    bad=types.SimpleNamespace(text='resume',source=source,internal=True,metadata={'lingju_task_resume':{'task_id':pending['id'],'ticket':'wrong'}})
    self.assertIsNone(await runner._handle_message(bad));self.assertEqual(len(called),1)
    bad.metadata['lingju_task_resume']['ticket']=ticket
    self.assertEqual(await runner._handle_message(bad),'native answer');self.assertEqual(called,[['company_browser_simulation']]*2)
    self.assertFalse(audit.status()['armed'])
   finally:restore();await c.close()
