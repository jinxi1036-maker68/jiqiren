from pathlib import Path
import copy
import json
import sqlite3
import tempfile
import sys
import unittest
from unittest import mock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from readonly_task import validate_readonly_grant,validate_readonly_runtime,ReadonlyExercise,KIND,PREFIX,ORIGIN,READ_TOOLS
from qq_browser_task import FEISHU_TRANSFER
from request_budget import RequestBudget
from feishu_session_fence import SessionFence
from safety import sha256

class ReadonlyGrantTests(unittest.TestCase):
 def grant(self):return dict(kind=KIND,channel='feishu',channel_transfer_authorization=FEISHU_TRANSFER,
  request_limit=30,task_limit=1,message_prefix=PREFIX,origin=ORIGIN,paths=['/statistics'],
  Owner_model_and_reload_approved=True,approval_reference='test-only-human-record',zero_model_checks_passed=True)
 def test_new_explicit_scope_is_required_not_inferred_from_login(self):
  validate_readonly_grant(self.grant())
  for changes in [dict(Owner_model_and_reload_approved=False),dict(approval_reference=''),dict(request_limit=31),dict(task_limit=2),dict(paths=['/']),dict(origin='https://example.test'),dict(kind='remaining-pages')]:
   with self.assertRaises(RuntimeError):validate_readonly_grant({**self.grant(),**changes})
 def test_model_only_gets_passive_MCP_not_vision_terminal_file(self):
  self.assertEqual(ReadonlyExercise.toolsets,['company_browser_simulation'])
  self.assertEqual(READ_TOOLS,{'browser_snapshot','browser_take_screenshot','browser_tabs','browser_wait_for'})
 def test_old_simulation_prefix_cannot_admit_real_page_task(self):
  obj=object.__new__(ReadonlyExercise);obj.prefix=PREFIX
  self.assertTrue(obj.matches(PREFIX+' 观察当前页面'))
  self.assertFalse(obj.matches('【模拟浏览器补验R5】继续'))
  self.assertFalse(obj.matches('继续'))
 def test_stopped_browser_keeps_catalog_but_cannot_read_or_admit_task(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);run=root/'runs/readonly';run.mkdir(parents=True)
   folder=root/'work-entry/owner-training-test';folder.mkdir(parents=True)
   profile=folder/'chrome-profile';profile.mkdir();out=folder/'teaching-output';out.mkdir()
   prep=folder/'preparation.json';prep.write_text(json.dumps({'kind':'lingju.readonly-teaching.preparation.v1','profile':str(profile),'origin':ORIGIN,'paths':['/statistics'],'cdp':'http://127.0.0.1:12345','owner_login_confirmed':False,'closed_at':'after-computer-restart'}),'utf-8')
   runtime=run/'runtime.json';runtime.write_text(json.dumps({'schema':'lingju.readonly-browser.v1','toolRoot':str(root),'origin':ORIGIN,'paths':['/statistics'],'preparation':str(prep),'browserOutput':str(out),'owner_login_confirmed':False}),'utf-8')
   with mock.patch('readonly_task.ordinary_path',side_effect=Path),mock.patch('psutil.Process') as proc:
    from dispatch import dispatch_target
    self.assertEqual(dispatch_target(runtime,root)[1],'readonly_bridge.mjs')
    proc.assert_not_called()
    with self.assertRaises(RuntimeError):validate_readonly_runtime(runtime,root,live=True)
    proc.assert_not_called()
 def test_fresh_unarmed_grant_consumes_one_slot_but_never_old_ledgers_or_model(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);run=root/'runs/new';run.mkdir(parents=True)
   ledger=run/'requests.sqlite';RequestBudget.create(ledger,limit=30,armed=False)
   SessionFence(root/'runs/exercise-sessions.sqlite',create=True)
   state_db=root/'state.db';c=sqlite3.connect(state_db);c.execute('create table sessions(source text,thread_id text)');c.close()
   old={}
   for i in range(5):
    p=root/'runs'/('old'+str(i));p.write_bytes(b'preserve-'+bytes([i]));old[str(p)]=sha256(p)
   policy={**self.grant(),'ledger':str(ledger)};pf=run/'policy.json';pf.write_text(json.dumps(policy),'utf-8')
   runtime=run/'runtime.json';runtime.write_text('{}','utf-8')
   grant={**policy,'runtime':str(runtime),'runtime_sha256':sha256(runtime),'old_ledger_sha256':old}
   with mock.patch('readonly_task.validate_readonly_runtime',return_value=({'grant':str(pf),'grant_sha256':sha256(pf)},{})):
    e=ReadonlyExercise(grant,root,state_db);e.catalog_ready=True
    self.assertEqual(e.admit('one-real-owner-message'),1)
    with self.assertRaises(RuntimeError):e.admit('unapproved-followup')
    self.assertEqual(e.budget.status()['reserved_network_attempts'],0);self.assertFalse(e.budget.status()['armed'])
    self.assertTrue(all(sha256(p)==digest for p,digest in old.items()))

if __name__=='__main__':unittest.main()
