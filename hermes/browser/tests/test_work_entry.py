import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest import mock

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from work_entry import inspect_workplace,STATE_SCHEMA,validate_entry,ENTRY_SCHEMA,TOOLS
from safety import sha256
from qq_browser_task import REMAINING_AUTHORIZATION,REMAINING_PREFIX,FEISHU_TRANSFER
from dispatch import dispatch_target


class WorkEntryTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
  self.entry=self.root/'work-entry/entry.json';self.entry.parent.mkdir();self.state=self.entry.with_name('state.json')
  self.run=self.root/'runs/new';self.run.mkdir(parents=True);self.grantdir=self.root/'runs/grant';self.grantdir.mkdir()
  self.runtime=self.run/'runtime.json';self.ledger=self.grantdir/'requests.sqlite'
  c=sqlite3.connect(self.ledger);c.execute('create table state(id integer,cap integer,used integer,armed integer)');c.execute('insert into state values(1,30,2,1)');c.commit();c.close()
  self.write(self.runtime,dict(route='playwright',case='recovery',toolRoot=str(self.root),dependencyRoot=str(self.root),taskScope='remaining-readonly',origin='http://127.0.0.1:12345',roundBudget=str(self.ledger)))
  self.pf=self.run/'continuation-preflight.json';self.write(self.pf,dict(passed=True,SDK_tools=13,model_calls=0))
  self.write(self.run/'lifecycle.json',dict(child_pids=[1,2]))
  self.gate=self.grantdir/'gate.json';self.g=dict(owner_authorization=REMAINING_AUTHORIZATION,channel='feishu',channel_transfer_authorization=FEISHU_TRANSFER,request_limit=30,task_limit=1,case='remaining-pages',message_prefix=REMAINING_PREFIX,zero_model_checks_passed=True,runtime=str(self.runtime),runtime_sha256=sha256(self.runtime),ledger=str(self.ledger),preflight_sha256=sha256(self.pf),old_ledger_sha256={})
  self.publish();self.patch=mock.patch('work_entry.validate_entry',return_value=({'state':str(self.state)},{}));self.patch.start();self.addCleanup(self.patch.stop)
 def write(self,p,j):p.write_text(json.dumps(j),encoding='utf-8')
 def publish(self):
  self.write(self.gate,{'browser_exercise':self.g});self.s=dict(schema=STATE_SCHEMA,state='active',revision='unique-grant-1',runtime=str(self.runtime),runtime_sha256=sha256(self.runtime),grant=str(self.gate),grant_sha256=sha256(self.gate));self.write(self.state,self.s)
 def processes(self,pid):return (True,['node',str(self.root/'fixture.mjs'),str(self.run/'fixture-config.json')]) if pid==1 else (True,['chrome','--user-data-dir='+str(self.run/'chrome-profile')])
 def inspect(self):return inspect_workplace(self.entry,self.root,process_check=self.processes)
 def test_valid_armed_owned_runtime_is_observed_without_writes(self):
  before={p:sha256(p) for p in self.root.rglob('*') if p.is_file()};self.assertTrue(self.inspect()['available']);self.assertEqual(before,{p:sha256(p) for p in before})
 def test_closed_pointer_does_not_read_ledger_or_spawn(self):
  self.write(self.state,dict(schema=STATE_SCHEMA,state='closed',revision='R5-ended'));self.ledger.unlink();self.assertEqual(self.inspect()['code'],'WORKPLACE_CLOSED')
 def test_closed_budget_cannot_be_refunded_or_rearmed_by_entry(self):
  for used,armed in [(11,0),(30,1)]:
   c=sqlite3.connect(self.ledger);c.execute('update state set used=?,armed=?',(used,armed));c.commit();c.close();self.assertEqual(self.inspect()['code'],'WORKPLACE_NOT_ARMED')
 def test_missing_ledger_fails_without_creating_new_database(self):
  self.ledger.unlink()
  with self.assertRaises((FileNotFoundError,sqlite3.OperationalError)):self.inspect()
  self.assertFalse(self.ledger.exists())
 def test_changed_runtime_or_grant_fails(self):
  self.runtime.write_text('{}','utf-8')
  with self.assertRaises(RuntimeError):self.inspect()
 def test_no_real_origin_or_new_scope_can_be_activated(self):
  for field,value in [('origin','https://example.com'),('taskScope','binding')]:
   j=json.loads(self.runtime.read_text());old=j[field];j[field]=value;self.write(self.runtime,j);self.g['runtime_sha256']=sha256(self.runtime);self.publish()
   with self.assertRaises(RuntimeError):self.inspect()
   j[field]=old;self.write(self.runtime,j);self.g['runtime_sha256']=sha256(self.runtime);self.publish()
 def test_stopped_or_unowned_runtime_is_not_ready(self):
  self.write(self.run/'lifecycle.json',dict(closed_at='now',child_pids=[1,2]));self.assertEqual(self.inspect()['code'],'WORKPLACE_STOPPED')
  self.write(self.run/'lifecycle.json',dict(child_pids=[1,2]))
  with self.assertRaises(RuntimeError):inspect_workplace(self.entry,self.root,process_check=lambda _: (True,['unrelated normal service']))
 def test_legacy_dispatch_is_unchanged_and_entry_is_opt_in(self):
  cfg=json.loads(self.runtime.read_text());self.assertEqual(dispatch_target(self.runtime,self.root),(cfg,'bridge.mjs'))
  bad=self.root/'runtime.json';self.write(bad,cfg)
  with self.assertRaises(RuntimeError):dispatch_target(bad,self.root)
 def test_static_entry_rejects_catalog_changes_and_path_escape(self):
  # Exercise actual static validation separately from active-workplace checks.
  self.patch.stop()
  cat=self.entry.with_name('catalog.json');self.write(cat,{'tools':[{'name':n} for n in TOOLS]})
  cfg=dict(schema=ENTRY_SCHEMA,toolRoot=str(self.root),route='playwright',mode='synthetic-only',state=str(self.state),catalog=str(cat),catalog_sha256='wrong')
  self.write(self.entry,cfg)
  with self.assertRaises(RuntimeError):validate_entry(self.entry,self.root)
  cfg['catalog_sha256']=sha256(cat);cfg['state']=str(self.root/'not-owned-state.json');self.write(self.entry,cfg);(self.root/'not-owned-state.json').write_text('{}','utf-8')
  with self.assertRaises(RuntimeError):validate_entry(self.entry,self.root)

if __name__=='__main__':unittest.main()
