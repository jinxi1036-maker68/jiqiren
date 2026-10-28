import json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from ego_runtime import validate_ego_runtime
from dispatch import dispatch_target
from safety import sha256

class EgoRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);(self.root/'runs/probe').mkdir(parents=True);(self.root/'ego').mkdir()
        self.runtime=self.root/'runs/probe/runtime.json'
        for n in ['bridge.mjs','worker.mjs','policy.mjs','native_guard.mjs']:(self.root/'ego'/n).write_text('test fixture',encoding='utf-8')
        self.cli=self.root/'cli.exe';self.cli.write_bytes(b'verified fixture, never executed')
        self.guide=self.root/'guide.txt';self.guide.write_bytes(b'guide fixture')
        home=Path.home()/'.hermes'
        self.c=dict(schema='lingju.ego-browser.v1',toolRoot=str(self.root),home=str(home),workspace=str(home/'company-workspace'),mode='synthetic',productionEnabled=False,cli=str(self.cli),cliSha256=sha256(self.cli),officialGuide=str(self.guide),guideSha256=sha256(self.guide),sourceSha256={n:sha256(self.root/'ego'/n) for n in ['bridge.mjs','worker.mjs','policy.mjs','native_guard.mjs']})
    def save(self):self.runtime.write_text(json.dumps(self.c),encoding='utf-8')
    def test_explicit_candidate_route(self):
        self.save();cfg,target=dispatch_target(self.runtime,self.root);self.assertEqual(target,'ego/bridge.mjs')
    def test_production_not_an_implicit_upgrade(self):
        self.c['mode']='production';self.save()
        with self.assertRaises(RuntimeError):validate_ego_runtime(self.runtime,self.root)
    def test_tampered_source_stops_dispatch(self):
        self.save();(self.root/'ego/worker.mjs').write_bytes(b'changed')
        with self.assertRaises(RuntimeError):dispatch_target(self.runtime,self.root)
    def test_legacy_route_remains_explicit(self):
        self.c=dict(route='playwright',toolRoot=str(self.root));self.save()
        self.assertEqual(dispatch_target(self.runtime,self.root)[1],'bridge.mjs')
        self.c['route']='unknown';self.save()
        with self.assertRaises(RuntimeError):dispatch_target(self.runtime,self.root)

if __name__=='__main__':unittest.main()
