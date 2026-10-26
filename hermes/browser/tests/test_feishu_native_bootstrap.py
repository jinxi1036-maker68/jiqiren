import asyncio
import contextlib
import importlib
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

SRC=Path(__file__).resolve().parents[1];sys.path.insert(0,str(SRC))
from feishu_native_bootstrap import validate_native_argv,install_import_hook,validate_context
from safety import sha256


@contextlib.contextmanager
def native_fixture():
    saved={n:m for n,m in sys.modules.items() if n in ('gateway','hermes_cli','tools') or n.startswith(('gateway.','hermes_cli.','tools.'))}
    for n in saved:del sys.modules[n]
    with tempfile.TemporaryDirectory() as d:
        p=Path(d)
        for package in ('gateway','hermes_cli','tools'):
            (p/package).mkdir();(p/package/'__init__.py').write_text('','utf-8')
        (p/'gateway/run.py').write_text('calls=[]\nasync def start_gateway(config=None,replace=False,verbosity=0):\n calls.append((config,replace,verbosity));return True\n','utf-8')
        (p/'hermes_cli/gateway.py').write_text('calls=[]\ndef run_gateway(*args,**kwargs):\n calls.append("native services would start")\n','utf-8')
        (p/'tools/skills_sync.py').write_text('calls=[]\ndef sync_skills(quiet=False):calls.append("unexpected skill write")\n','utf-8')
        (p/'hermes_cli/plugins.py').write_text('calls=[]\ndef _persist_plugin_toolset_keys():calls.append("unexpected cache write")\ndef discover_plugins():return "still available"\n','utf-8')
        sys.path.insert(0,str(p));importlib.invalidate_caches()
        try:yield p
        finally:
            sys.path.remove(str(p))
            for n in list(sys.modules):
                if n in ('gateway','hermes_cli','tools') or n.startswith(('gateway.','hermes_cli.','tools.')):del sys.modules[n]
            sys.modules.update(saved)


class NativeBootstrapTests(unittest.TestCase):
    def test_only_real_native_run_command_not_spoofed_wrapper_or_replacement(self):
        validate_native_argv(['python','-B','-u','-m','hermes_cli.main','gateway','run'])
        for argv in [
            ['python','feishu_gateway.py','hermes_cli.main','gateway','run'],
            ['python','-m','hermes_cli.main','gateway','run','--replace'],
            ['python','-m','hermes_cli.main','--profile','test','gateway','run'],
            ['python','-S','-m','hermes_cli.main','gateway','run'],
            ['python','-m','gateway.run']]:
            with self.assertRaises(RuntimeError):validate_native_argv(argv)

    def test_real_module_function_delegates_once_preserving_config_and_native_signature(self):
        with native_fixture() as p:
            seen=[]
            async def entry(original,values):
                seen.append(values);return await original(**values)
            restore=install_import_hook(p,entry)
            try:
                m=importlib.import_module('gateway.run');self.assertTrue(asyncio.run(m.start_gateway(config='unchanged',verbosity=2)))
                self.assertEqual(m.calls,[('unchanged',False,2)])
                self.assertEqual(seen,[{'config':'unchanged','replace':False,'verbosity':2}])
                with self.assertRaises(RuntimeError):asyncio.run(m.start_gateway(replace=True))
                self.assertEqual(len(m.calls),1)
            finally:restore()

    def test_probe_imports_cli_and_runner_without_native_services(self):
        with native_fixture() as p:
            observed=[]
            async def entry(original,values):observed.append('runner signature checked');return True
            def probe():
                m=importlib.import_module('gateway.run');return asyncio.run(m.start_gateway())
            restore=install_import_hook(p,entry,probe_run=probe)
            try:
                cli=importlib.import_module('hermes_cli.gateway');self.assertTrue(cli.run_gateway())
                self.assertEqual(cli.calls,[]);self.assertEqual(sys.modules['gateway.run'].calls,[])
                self.assertEqual(observed,['runner signature checked'])
                with self.assertRaises(RuntimeError):cli.run_gateway(force=True)
            finally:restore()

    def test_unknown_native_function_contract_fails_closed(self):
        with native_fixture() as p:
            (p/'gateway/run.py').write_text('async def start_gateway(config=None,replace=False,verbosity=0,new_flag=True):pass\n','utf-8')
            restore=install_import_hook(p,lambda *a:None)
            try:
                with self.assertRaises(RuntimeError):importlib.import_module('gateway.run')
            finally:restore()

    def test_temporary_CLI_skips_skill_writes_without_disabling_plugin_discovery(self):
        with native_fixture() as p:
            restore=install_import_hook(p,lambda *a:None)
            try:
                skills=importlib.import_module('tools.skills_sync');plugins=importlib.import_module('hermes_cli.plugins')
                self.assertTrue(skills.sync_skills(quiet=True)['skipped_temporary_exercise'])
                plugins._persist_plugin_toolset_keys()
                self.assertEqual(skills.calls,[]);self.assertEqual(plugins.calls,[])
                self.assertEqual(plugins.discover_plugins(),'still available')
            finally:restore()

    def test_gate_hashes_and_original_install_required_before_native_import(self):
        with tempfile.TemporaryDirectory() as d:
            home=Path(d).resolve();root=home/'.hermes/tools/company-browser';run=root/'runs/probe';run.mkdir(parents=True)
            install=home/'AppData/Local/hermes/hermes-agent';(install/'venv/Scripts').mkdir(parents=True)
            python=install/'venv/Scripts/python.exe';python.write_bytes(b'synthetic')
            for name in ['feishu_native_bootstrap.py','startup/sitecustomize.py','feishu_gateway.py','feishu_session_fence.py']:
                f=root/name;f.parent.mkdir(exist_ok=True);f.write_bytes(b'synthetic')
            baseline=run/'baseline.json';baseline.write_text('{"files":{}}','utf-8')
            runtime=run/'runtime.json';runtime.write_text('{}','utf-8')
            gate=run/'gate.json';value={'protected_baseline_sha256':sha256(baseline),
                'source_sha256':{str(f.relative_to(root)).replace('\\','/'):sha256(f) for f in root.rglob('*.py')},
                'browser_exercise':{'runtime':str(runtime),'runtime_sha256':sha256(runtime)}}
            gate.write_text(json.dumps(value),'utf-8')
            env={'LINGJU_FEISHU_INSTALL':str(install),'LINGJU_FEISHU_GATE':str(gate),'LINGJU_FEISHU_OUTPUT':str(run),'LINGJU_FEISHU_BASELINE':str(baseline)}
            argv=['python','-B','-m','hermes_cli.main','gateway','run']
            args,_=validate_context(root,env,argv,home=home,executable=python);self.assertEqual(args.install,str(install))
            with self.assertRaises(RuntimeError):validate_context(root,{**env,'HERMES_PROFILE':'second'},argv,home=home,executable=python)
            (root/'feishu_gateway.py').write_bytes(b'changed')
            with self.assertRaises(RuntimeError):validate_context(root,env,argv,home=home,executable=python)

    def test_unmarked_startup_has_no_new_behavior(self):
        with mock.patch.dict(os.environ,{'LINGJU_FEISHU_NATIVE':'','LINGJU_BROWSER_BUDGET':''}):
            runpy.run_path(str(SRC/'startup/sitecustomize.py'))

    def test_probe_blocks_network_subprocess_and_original_file_mutation(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);out=p/'owned-output';out.mkdir();outside=p/'protected.txt'
            script='''import sys,json,socket,subprocess,asyncio\nfrom pathlib import Path\nsys.path.insert(0,sys.argv[1])\nfrom feishu_native_bootstrap import install_probe_guards\ninstall_probe_guards(sys.argv[2])\nasyncio.run(asyncio.sleep(0))\nblocked=[]\nfor name,call in [('write',lambda:Path(sys.argv[3]).write_text('bad')),('network',lambda:socket.create_connection(('127.0.0.1',9))),('subprocess',lambda:subprocess.run([sys.executable,'-V']))]:\n try:call()\n except (RuntimeError,PermissionError):blocked.append(name)\nPath(sys.argv[2],'receipt.json').write_text(json.dumps(blocked))\nprint(json.dumps(blocked))\n'''
            result=subprocess.run([sys.executable,'-B','-c',script,str(SRC),str(out),str(outside)],capture_output=True,text=True,timeout=15)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual(json.loads(result.stdout),['write','network','subprocess']);self.assertFalse(outside.exists())


if __name__=='__main__':unittest.main()
