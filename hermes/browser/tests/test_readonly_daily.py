import asyncio
import contextlib
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import types
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from request_budget import RequestAudit,RequestBudget,BudgetBlocked
from feishu_meter import GatewayMeter,CURRENT_TURN
from feishu_gateway import install_runner_hooks
from readonly_task import validate_continuous_grant,CONTINUOUS_KIND,ORIGIN,READ_NAVIGATION_TOOLS
from qq_browser_task import FEISHU_TRANSFER


class DailyReadonlyTests(unittest.TestCase):
 def test_more_than_old_quota_is_counted_without_resetting_history(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);old=root/'old.sqlite';RequestBudget.create(old,30,armed=False)
   before=hashlib.sha256(old.read_bytes()).hexdigest()
   b=RequestAudit.create(root/'daily.sqlite')
   with self.assertRaises(BudgetBlocked):b.take()
   b.arm()
   for _ in range(151):b.take('chat_completions')
   self.assertEqual(b.status()['reserved_network_attempts'],151)
   self.assertIsNone(b.status()['limit']);self.assertFalse(b.status()['quota_enforced'])
   self.assertEqual(hashlib.sha256(old.read_bytes()).hexdigest(),before)
   with self.assertRaises(BudgetBlocked):RequestAudit(old).take()
   with self.assertRaises(BudgetBlocked):RequestBudget(b.path).take()
 def test_no_idle_generation_or_control_message_model_bypass(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);b=RequestAudit.create(root/'daily.sqlite');meter=GatewayMeter(root,b)
   with self.assertRaises(BudgetBlocked):meter.take()
   t,token=meter.begin(True,control=True)
   try:
    with self.assertRaises(BudgetBlocked):meter.take()
   finally:meter.finish(t,token)
   self.assertEqual(b.status()['reserved_network_attempts'],0)
 def test_daily_permission_does_not_expand_page_or_accept_old_test_grant(self):
  g={'kind':CONTINUOUS_KIND,'channel':'feishu','channel_transfer_authorization':FEISHU_TRANSFER,'request_limit':None,'task_limit':None,'Owner_removed_test_quotas':True,'origin':ORIGIN,'paths':['/statistics'],'zero_model_checks_passed':True,'approval_reference':'synthetic explicit Owner quota-removal'}
  validate_continuous_grant(g)
  for change in ({'Owner_removed_test_quotas':False},{'request_limit':30},{'task_limit':1},{'paths':['/']},{'origin':'https://unapproved.test'},{'approval_reference':''}):
   with self.assertRaises(RuntimeError):validate_continuous_grant({**g,**change})
  wide={**g,'paths':['*'],'same_site_read_navigation':True,'Owner_read_navigation_authorization':'Owner asks employee to find device bindings in this same site'}
  validate_continuous_grant(wide)
  with self.assertRaises(RuntimeError):validate_continuous_grant({**wide,'Owner_read_navigation_authorization':''})
  self.assertEqual(len(READ_NAVIGATION_TOOLS),10)
 def test_two_natural_messages_share_native_conversation_without_quota_or_prefix(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);db=root/'state.db'
   with contextlib.closing(sqlite3.connect(db)) as c,c:
    c.execute('create table sessions(id text,api_call_count integer,message_count integer,tool_call_count integer)')
    c.execute("insert into sessions values('fresh',0,0,0)")
   budget=RequestAudit.create(root/'daily.sqlite');meter=GatewayMeter(root,budget)
   def pause():
    with contextlib.closing(budget._connection()) as c,c:c.execute('update state set armed=0 where id=1')
   exercise=types.SimpleNamespace(continuous=True,budget=budget,pause=pause,session_initialized=False,catalog_ready=True,toolsets=['company_browser_simulation'])
   source=types.SimpleNamespace(platform=types.SimpleNamespace(value='feishu'),chat_type='dm',user_id='test-owner',chat_id='test-chat')
   binding={k:hashlib.sha256(v.encode()).hexdigest() for k,v in [('user_sha256',source.user_id),('chat_sha256',source.chat_id)]};fresh=[];calls=[]
   class Runner:
    def __init__(self):self.session_store=types.SimpleNamespace(get_or_create_session=self.new,_generate_session_key=lambda src:'native-key',peek_session_id=lambda key:'existing-real-page-session')
    def new(self,src,force_new=False):fresh.append(force_new);return types.SimpleNamespace(session_id='fresh')
    def _is_user_authorized(self,src):return True
    def _primary_message_handler(self):return self._handle_message
    async def _handle_message(self,msg):
     if msg.text=='/status':return 'native status'
     calls.append(self._resolve_enabled_toolsets_for_source({},msg.source,'feishu'))
     for _ in range(35):meter.take('chat_completions')
     return 'natural native answer'
    def _resolve_enabled_toolsets_for_source(self,*a):return ['files','company_browser_simulation']
    def _create_adapter(self,*a):return None
    async def start(self):return True
   native=types.SimpleNamespace(GatewayRunner=Runner,_current_max_iterations=lambda:32)
   restore=install_runner_hooks(native,exercise,meter,root,{'files':{}},binding,root)
   try:
    handler=Runner()._primary_message_handler()
    async def receive():
     for text in ('帮我看看统计页','继续解释你刚才的判断'):
      self.assertEqual(await handler(types.SimpleNamespace(text=text,source=source)),'natural native answer')
     self.assertEqual(await handler(types.SimpleNamespace(text='/status',source=source)),'native status')
    asyncio.run(receive())
    self.assertEqual(fresh,[]);self.assertEqual(calls,[['company_browser_simulation']]*2)
    self.assertEqual(budget.status()['reserved_network_attempts'],70);self.assertFalse(budget.status()['armed'])
    self.assertEqual(native._current_max_iterations(),32)
   finally:restore()


if __name__=='__main__':unittest.main()
