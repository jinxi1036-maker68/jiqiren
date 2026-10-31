import json
from pathlib import Path
import sys
import tempfile
import unittest
import subprocess
import types
from unittest.mock import patch,MagicMock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from ego_lease import recover_dead_ego_lease,_port_closed
from dispatch import wait_bridge_shutdown

class LeaseRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);(self.root/'ego').mkdir();self.run=self.root/'runs/owned';self.run.mkdir(parents=True)
        self.runtime=self.run/'runtime.json';self.runtime.write_text('{}')
        self.lock=self.root/'ego/active-worker.lock';self.meta=self.run/'worker-private.json'
        self.lock.write_text(json.dumps({'pid':10,'nonce':'private','runtime':str(self.runtime)}))
        self.meta.write_text(json.dumps({'pid':20,'port':12345,'token':'private','ownerNonce':'private'}))
    def call(self,**kw):
        return recover_dead_ego_lease(self.runtime,self.root,owned_nonce=kw.get('owned_nonce'),parent_pid=kw.get('parent_pid',-1),alive=kw.get('alive',lambda _:False),port_closed=kw.get('port_closed',lambda _:True))
    def test_dead_same_runtime_recovers_without_secrets_in_receipt(self):
        self.assertTrue(self.call());self.assertFalse(self.lock.exists())
        text=(self.run/'lease-recovery-events.jsonl').read_text()
        self.assertNotIn('private',text);self.assertFalse(self.lock.with_suffix('.recovery').exists())
    def test_any_live_or_unknown_endpoint_preserves_lease(self):
        for kw in [{'alive':lambda pid:pid==10},{'alive':lambda pid:pid==20},{'port_closed':lambda _:False}]:
            with self.subTest(kw=kw):self.assertFalse(self.call(**kw));self.assertTrue(self.lock.exists())
    def test_absent_worker_or_foreign_runtime_or_malformed_lock_is_not_reclaimed(self):
        self.meta.unlink();self.assertFalse(self.call())
        self.meta.write_text(json.dumps({'pid':20,'port':12345}))
        self.lock.write_text(json.dumps({'pid':10,'runtime':'foreign'}));self.assertFalse(self.call())
        self.lock.write_text('broken');self.assertFalse(self.call());self.assertTrue(self.lock.exists())
    def test_concurrent_recovery_owner_is_not_overwritten(self):
        mutex=self.lock.with_suffix('.recovery');mutex.write_text('another recovery')
        self.assertFalse(self.call());self.assertEqual(mutex.read_text(),'another recovery');self.assertTrue(self.lock.exists())
    def test_recheck_detects_ownership_change(self):
        n=0
        def alive(pid):
            nonlocal n
            n+=1
            if n==3:self.lock.write_text(json.dumps({'pid':30,'nonce':'new-owner','runtime':str(self.runtime)}))
            return False
        self.assertFalse(self.call(alive=alive));self.assertIn('new-owner',self.lock.read_text())
    def test_live_bridge_can_release_only_its_own_proven_dead_worker(self):
        self.assertTrue(self.call(alive=lambda pid:pid==10,owned_nonce='private',parent_pid=10))
        self.assertFalse(self.lock.exists())
    def test_nonce_alone_cannot_impersonate_another_live_bridge(self):
        self.assertFalse(self.call(alive=lambda pid:pid==10,owned_nonce='private',parent_pid=30))
        self.assertTrue(self.lock.exists())
    def test_own_live_worker_or_listening_unknown_port_blocks_recovery(self):
        for args in [dict(alive=lambda pid:True),dict(alive=lambda pid:pid==10,port_closed=lambda _:False)]:
            self.assertFalse(self.call(owned_nonce='private',parent_pid=10,**args))
            self.assertTrue(self.lock.exists())
    def test_mismatched_worker_metadata_never_releases_a_lease(self):
        d=json.loads(self.meta.read_text());d['ownerNonce']='another-generation';self.meta.write_text(json.dumps(d))
        self.assertFalse(self.call());self.assertTrue(self.lock.exists())
    def test_loopback_timeout_requires_os_no_listener_proof(self):
        mock=MagicMock();mock.__enter__.return_value.connect_ex.return_value=10060
        with patch('ego_lease.socket.socket',return_value=mock),patch('ego_lease.psutil.net_connections',return_value=[]):
            self.assertTrue(_port_closed(12345))
        listener=types.SimpleNamespace(status='LISTEN',laddr=types.SimpleNamespace(port=12345))
        with patch('ego_lease.socket.socket',return_value=mock),patch('ego_lease.psutil.net_connections',return_value=[listener]):
            self.assertFalse(_port_closed(12345))
        with patch('ego_lease.socket.socket',return_value=mock),patch('ego_lease.psutil.net_connections',side_effect=OSError('unknown')):
            self.assertFalse(_port_closed(12345))
    def test_wrapper_waits_for_normal_cleanup_without_forcing_job_close(self):
        calls=[]
        child=types.SimpleNamespace(wait=lambda timeout:calls.append(('wait',timeout)) or 0)
        job=types.SimpleNamespace(close=lambda:calls.append(('close',)))
        self.assertEqual(wait_bridge_shutdown(child,job),0);self.assertEqual(calls,[('wait',12)])
    def test_stuck_wrapper_still_enforces_existing_orphan_prevention(self):
        calls=[]
        def wait(timeout):
            calls.append(('wait',timeout))
            if len(calls)==1:raise subprocess.TimeoutExpired('synthetic-child',timeout)
            return 7
        child=types.SimpleNamespace(wait=wait);job=types.SimpleNamespace(close=lambda:calls.append(('close',)))
        self.assertEqual(wait_bridge_shutdown(child,job),7)
        self.assertEqual(calls,[('wait',12),('close',),('wait',10)])

if __name__=='__main__':unittest.main()
