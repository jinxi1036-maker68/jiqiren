from pathlib import Path
import sys
import json
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from training_browser import chrome_args,main,ORIGIN,PATHS,resume_record,wait_owned_debugger

class TrainingBrowserTests(unittest.TestCase):
 def test_launch_is_blank_owned_profile_and_loopback_not_business_or_old_profile(self):
  args=chrome_args(Path('owned-chrome.exe'),Path('new-training-profile'))
  self.assertEqual(args[-1],'about:blank');self.assertIn('--remote-debugging-address=127.0.0.1',args)
  self.assertIn('--user-data-dir=new-training-profile',args);self.assertFalse(any(ORIGIN in x for x in args))
  self.assertFalse(any('profile-directory' in x for x in args))
 def test_direct_route_changes_only_owned_browser_arguments(self):
  normal=chrome_args(Path('owned-chrome.exe'),Path('owned-profile'))
  direct=chrome_args(Path('owned-chrome.exe'),Path('owned-profile'),direct_network=True)
  self.assertNotIn('--no-proxy-server',normal);self.assertIn('--no-proxy-server',direct)
  self.assertEqual([a for a in direct if a!='--no-proxy-server'],normal)
 def test_open_without_Owner_confirmation_is_rejected_before_any_browser(self):
  with mock.patch.object(sys,'argv',['training_browser.py','--open']),mock.patch('training_browser.open_browser') as start:
   with self.assertRaises(RuntimeError):main()
   start.assert_not_called()
 def test_default_status_does_not_open_or_create_anything(self):
  with mock.patch.object(sys,'argv',['training_browser.py']),mock.patch('training_browser.open_browser') as start:
   main();start.assert_not_called()
  self.assertEqual(PATHS,['/statistics'])
 def record(self,folder):
  folder.mkdir(parents=True);(folder/'chrome-profile').mkdir()
  record=folder/'preparation.json';data={'kind':'lingju.readonly-teaching.preparation.v1','profile':str(folder/'chrome-profile'),'origin':ORIGIN,'paths':PATHS}
  record.write_text(json.dumps(data),'utf-8');return record,data
 def test_resume_preserves_owned_profile_without_reading_profile_contents(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);record,data=self.record(root/'work-entry/owner-training-test')
   before=record.read_bytes()
   with mock.patch('training_browser.ordinary_path',side_effect=Path),mock.patch('psutil.process_iter',return_value=[]):
    folder,profile,old=resume_record(root,record)
   self.assertEqual(profile,record.parent/'chrome-profile');self.assertEqual(old,data);self.assertEqual(before,record.read_bytes())
 def test_resume_rejects_outside_record_wrong_profile_and_duplicate_process(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);record,data=self.record(root/'work-entry/owner-training-test')
   with mock.patch('training_browser.ordinary_path',side_effect=Path):
    with self.assertRaises(RuntimeError):resume_record(root,root/'elsewhere/preparation.json')
    data['profile']=str(root/'unrelated');record.write_text(json.dumps(data),'utf-8')
    with self.assertRaises(RuntimeError):resume_record(root,record)
    data['profile']=str(record.parent/'chrome-profile');record.write_text(json.dumps(data),'utf-8')
    fake=mock.Mock();fake.name.return_value='chrome.exe';fake.cmdline.return_value=['--user-data-dir='+data['profile']]
    with mock.patch('psutil.process_iter',return_value=[fake]):
     with self.assertRaises(RuntimeError):resume_record(root,record)
 def test_stale_debugger_marker_requires_current_owned_process_listener(self):
  with tempfile.TemporaryDirectory() as tmp:
   profile=Path(tmp);(profile/'DevToolsActivePort').write_text('12345\nold-marker','utf-8')
   proc=mock.Mock(pid=123);proc.poll.return_value=None
   with mock.patch('training_browser.time.monotonic',side_effect=[0,0,2]),mock.patch('training_browser.time.sleep'),mock.patch('psutil.Process') as ps:
    ps.return_value.net_connections.return_value=[]
    with self.assertRaises(RuntimeError):wait_owned_debugger(proc,profile,1)
   connection=SimpleNamespace(status='LISTEN',laddr=SimpleNamespace(ip='127.0.0.1',port=12345))
   with mock.patch('psutil.Process') as ps:
    ps.return_value.net_connections.return_value=[connection]
    self.assertEqual(wait_owned_debugger(proc,profile),12345)

if __name__=='__main__':unittest.main()
