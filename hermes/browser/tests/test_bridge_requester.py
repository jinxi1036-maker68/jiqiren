"""Exact native helper parent proof; no original Home or model access."""
import sys,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from company_support import requesting_bridge_pid

class BridgeRequester(unittest.TestCase):
    def setUp(self):
        self.root=Path('C:/synthetic-company-tool');self.runtime=str(self.root/'runs/test/runtime.json')
        self.cfg={'node':'C:/synthetic/node.exe','employeeSupport':{'python':'C:/synthetic/venv/Scripts/python.exe'}}
        self.bridge=SimpleNamespace(pid=12,exe=lambda:self.cfg['node'],cmdline=lambda:[self.cfg['node'],str(self.root/'ego/bridge.mjs'),self.runtime])
    def test_direct_fixed_bridge_parent(self):
        with patch('company_support.psutil.Process',return_value=self.bridge):
            self.assertEqual(requesting_bridge_pid(self.cfg,self.root,self.runtime),12)
    def test_windows_venv_redirector_requires_exact_command(self):
        wrapper=SimpleNamespace(pid=13,exe=lambda:self.cfg['employeeSupport']['python'],
            cmdline=lambda:[self.cfg['employeeSupport']['python'],'-I','-B',str(self.root/'company_support.py'),self.runtime],parent=lambda:self.bridge)
        with patch('company_support.psutil.Process',return_value=wrapper):
            self.assertEqual(requesting_bridge_pid(self.cfg,self.root,self.runtime),12)
        wrapper.cmdline=lambda:[self.cfg['employeeSupport']['python'],'unrelated script']
        with patch('company_support.psutil.Process',return_value=wrapper):
            self.assertEqual(requesting_bridge_pid(self.cfg,self.root,self.runtime),-1)
    def test_another_runtime_or_executable_cannot_claim_live_ownership(self):
        self.bridge.cmdline=lambda:[self.cfg['node'],str(self.root/'ego/bridge.mjs'),'another-runtime']
        with patch('company_support.psutil.Process',return_value=self.bridge):
            self.assertEqual(requesting_bridge_pid(self.cfg,self.root,self.runtime),-1)

if __name__=='__main__':unittest.main()
