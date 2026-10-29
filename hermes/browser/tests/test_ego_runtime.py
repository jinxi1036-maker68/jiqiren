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
        for n in ['bridge.mjs','worker.mjs','policy.mjs','native_guard.mjs','lifecycle.mjs']:(self.root/'ego'/n).write_text('test fixture',encoding='utf-8')
        self.cli=self.root/'cli.exe';self.cli.write_bytes(b'verified fixture, never executed')
        self.guide=self.root/'guide.txt';self.guide.write_bytes(b'guide fixture')
        home=Path.home()/'.hermes'
        self.c=dict(schema='lingju.ego-browser.v1',toolRoot=str(self.root),home=str(home),workspace=str(home/'company-workspace'),mode='synthetic',productionEnabled=False,cli=str(self.cli),cliSha256=sha256(self.cli),officialGuide=str(self.guide),guideSha256=sha256(self.guide),sourceSha256={n:sha256(self.root/'ego'/n) for n in ['bridge.mjs','worker.mjs','policy.mjs','native_guard.mjs','lifecycle.mjs']})
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
    def company(self):
        payload=self.root/'payload';payload.mkdir()
        for name in ['manifest.json','rules.json']:(payload/name).write_bytes(b'approved fixture')
        (self.root/'ego/extension_guard.mjs').write_bytes(b'fixture guard')
        (self.root/'ego/table_readback.mjs').write_bytes(b'fixture reader')
        self.c.update(schema='lingju.ego-browser.v2',mode='company-readonly',origin='https://ldp.lingrobotics.com',businessWritesEnabled=False,approvalReference='Owner fixture',profileId='Profile 1',stateFile=str(self.runtime.parent/'workplace-state.json'),extension=dict(id='fpifglepgaacbbabakmcjmkinlpnconi',ruleset='company_readonly',directory=str(payload),manifestSha256=sha256(payload/'manifest.json'),rulesSha256=sha256(payload/'rules.json')))
        self.c['sourceSha256']['extension_guard.mjs']=sha256(self.root/'ego/extension_guard.mjs')
        self.c['sourceSha256']['table_readback.mjs']=sha256(self.root/'ego/table_readback.mjs')
        Path(self.c['stateFile']).write_text('{}')
        self.save()
        return payload
    def test_company_route_requires_installed_payload_pin(self):
        payload=self.company();self.assertEqual(dispatch_target(self.runtime,self.root)[1],'ego/bridge.mjs')
        (payload/'rules.json').write_bytes(b'changed')
        with self.assertRaises(RuntimeError):dispatch_target(self.runtime,self.root)
    def test_company_state_must_stay_in_this_run(self):
        self.company();self.c['stateFile']=str(self.root/'guide.txt');self.save()
        with self.assertRaises(RuntimeError):dispatch_target(self.runtime,self.root)
    def business(self):
        self.company()
        self.c.update(schema='lingju.ego-browser.v3',mode='company-business',productionEnabled=True,businessWritesEnabled=True,
            businessAuthorization=dict(schema='lingju.browser-business-grant.v1',ownerApproved=True,
                scopeOrigin=self.c['origin'],scope='all-company-browser-ui-business-actions',
                reference='Owner 2026-10-30',highImpactRequiresSpecificOwnerTask=True))
        self.save()
    def test_business_runtime_uses_original_pinned_route_and_requires_owner_grant(self):
        self.business();cfg,target=dispatch_target(self.runtime,self.root)
        self.assertEqual(target,'ego/bridge.mjs');self.assertTrue(cfg['businessWritesEnabled'])
        self.c['businessAuthorization']['ownerApproved']=False;self.save()
        with self.assertRaises(RuntimeError):dispatch_target(self.runtime,self.root)
    def test_business_origin_and_legacy_flag_cannot_expand_implicitly(self):
        self.business();self.c['origin']='https://example.com';self.save()
        with self.assertRaises(RuntimeError):dispatch_target(self.runtime,self.root)
        self.c.update(origin='https://ldp.lingrobotics.com',schema='lingju.ego-browser.v2');self.save()
        with self.assertRaises(RuntimeError):dispatch_target(self.runtime,self.root)
    def test_daily_gateway_accepts_whole_business_capability_but_not_mismatched_readonly_gate(self):
        from ego_task import EgoReadonlyExercise
        from request_budget import RequestAudit
        self.business();ledger=self.runtime.parent/'audit.sqlite';RequestAudit.create(ledger)
        g=dict(kind='lingju-ego-business-daily',channel='feishu',approval_reference='Owner fixture',
            request_limit=None,task_limit=None,Owner_removed_test_quotas=True,zero_model_checks_passed=True,
            runtime=str(self.runtime),runtime_sha256=sha256(self.runtime),ledger=str(ledger))
        e=EgoReadonlyExercise(g,self.root,self.root/'state.db')
        self.assertTrue(e.continuous);self.assertIn('完整业务页面操作',e.summary())
        with self.assertRaises(RuntimeError):EgoReadonlyExercise(dict(g,kind='lingju-ego-readonly-daily'),self.root,self.root/'state.db')

if __name__=='__main__':unittest.main()
