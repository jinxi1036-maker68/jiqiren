"""Original installed adapter delivery/queue integration; no real model/network.

The Agent result and browser fixture are synthetic. This proves the runtime
handoff, not that a real model independently completed business work.
"""
import asyncio,contextlib,hashlib,json,os,sys,tempfile,types,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
sys.path.insert(0,str(Path.home()/'AppData/Local/hermes/hermes-agent'))
from gateway.config import Platform,PlatformConfig
from gateway.session import SessionSource,build_session_key
from gateway.platforms.base import BasePlatformAdapter,MessageEvent,SendResult
from feishu_gateway import install_runner_hooks
from feishu_meter import GatewayMeter
from request_budget import RequestAudit
from task_continuation import TaskContinuation
from company_tasks import TaskStore
from company_support import task_page
from runtime_guard import ProtectionView
from safety import sha256
from company_gateway_entry import build_context,matching_ready,GatewayEntry
from feishu_meter import BrowserPacer
from request_budget import BudgetBlocked

class LocalAdapter(BasePlatformAdapter):
    def __init__(self):
        super().__init__(PlatformConfig(enabled=True,typing_indicator=False),Platform.FEISHU);self.deliveries=[]
    async def connect(self,**kwargs):return True
    async def disconnect(self):pass
    async def send(self,chat_id,content,reply_to=None,metadata=None):
        self.deliveries.append(content)
        if getattr(self,'fail_delivery',False):return SendResult(success=False,error='synthetic send failure',retryable=False)
        return SendResult(success=True,message_id='synthetic-'+str(len(self.deliveries)))
    async def get_chat_info(self,chat_id):return {'name':'synthetic','type':'dm'}
    async def send_typing(self,*args,**kwargs):pass

class NativeAdapterChain(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
        self.audit={'active':True,'network_attempts':0,'private_reads':0}
        private_home=Path.home()/'.hermes'
        def boundary(kind,args,guard=self.audit):
            if not guard['active']:return
            if kind=='socket.connect':
                caller=sys._getframe(1)
                if caller.f_code.co_name=='_fallback_socketpair' and caller.f_globals.get('__name__')=='socket':return
                guard['network_attempts']+=1;raise RuntimeError('Integration test cannot connect to any external/model/channel service')
            if kind=='subprocess.Popen':raise RuntimeError('Integration test cannot start an Agent or browser process')
            if kind=='open' and isinstance(args[0],(str,bytes,os.PathLike)):
                path=Path(os.fsdecode(args[0])).absolute()
                if path==private_home or private_home in path.parents:
                    guard['private_reads']+=1;raise RuntimeError('Integration test cannot read original private employee files')
        sys.addaudithook(boundary)
        self.addCleanup(lambda:self.audit.update(active=False))
        self.env=patch.dict(os.environ,{'HERMES_HOME':str(self.root),'HERMES_HUMAN_DELAY_MODE':'off'});self.env.start();self.addCleanup(self.env.stop)
        self.source=SessionSource(platform=Platform.FEISHU,chat_id='synthetic-chat',user_id='synthetic-owner')
        self.adapter=LocalAdapter();self.truth={'creates':0,'rows':[]};self.turns=[]
        async def recovery(name,args):
            return {'ready':True,'operationSucceeded':True,'workerBusy':False,'queuedOperations':0}
        self.c=TaskContinuation(self.root/'tasks.sqlite',self.root,lambda:[],call=recovery,delays=(.02,.02,.02))
        audit=RequestAudit.create(self.root/'audit.sqlite');meter=GatewayMeter(self.root,audit);test=self
        class Exercise:
            continuous=True;catalog_ready=True;session_initialized=True;budget=audit;toolsets=['company_browser_simulation']
            cfg=dict(schema='lingju.ego-browser.v3',mode='company-business',productionEnabled=True,businessWritesEnabled=True,origin='https://ldp.lingrobotics.com',
                businessAuthorization=dict(schema='lingju.browser-business-grant.v1',ownerApproved=True,scopeOrigin='https://ldp.lingrobotics.com',scope='all-company-browser-ui-business-actions',reference='synthetic approval',highImpactRequiresSpecificOwnerTask=True))
            def pause(self):
                with contextlib.closing(self.budget._connection()) as db,db:db.execute('UPDATE state SET armed=0 WHERE id=1')
        class Runner:
            def __init__(self):self.session_store=types.SimpleNamespace(_generate_session_key=lambda s:build_session_key(s),peek_session_id=lambda key:'synthetic-session')
            def _primary_message_handler(self):return self._handle_message
            def _is_user_authorized(self,s):return True
            def _resolve_enabled_toolsets_for_source(self,*args):return ['native']
            def _adapter_for_source(self,s):return test.adapter
            def _session_key_for_source(self,s):return build_session_key(s)
            def _create_adapter(self,*args):return test.adapter
            async def start(self):return True
            async def _handle_message(self,msg):
                if (msg.text or '').startswith('/') or msg.text=='new Owner instruction':return 'synthetic Owner command received'
                test.turns.append({'internal':msg.internal,'prompt':msg.channel_prompt,'tools':self._resolve_enabled_toolsets_for_source({},msg.source,'feishu')})
                if not msg.internal:
                    test.truth['creates']+=1;test.truth['rows'].append({'unique':'SYNTHETIC-1'})
                    test.c.store.browser_event('ego_browser_actions',False,'EGO_TRANSPORT_FAILED','unknown-save','digest')
                    return 'synthetic uncertain submission; query before retry'
                test.assertEqual(len(test.truth['rows']),1)
                test.c.store.browser_event('ego_browser_observe',True,None,'fresh-query','digest')
                test.c.store.checkpoint({'action':'checkpoint','status':'completed','verification_ref':'fresh-query',
                    'items':[{'key':'one-record','state':'done','evidence_ref':'fresh-query'}]})
                return 'synthetic saved state verified, one row, no repeated create'
        native=types.SimpleNamespace(GatewayRunner=Runner,_current_max_iterations=lambda:32)
        binding={k:hashlib.sha256(v.encode()).hexdigest() for k,v in [('user_sha256',self.source.user_id),('chat_sha256',self.source.chat_id)]}
        self.restore=install_runner_hooks(native,Exercise(),meter,self.root,{'files':{}},binding,self.root,continuation=self.c)
        self.runner=Runner();self.runner._create_adapter(Platform.FEISHU,PlatformConfig())
        self.adapter.set_message_handler(self.runner._primary_message_handler())
    async def asyncTearDown(self):
        await self.c.close()
        jobs=list(self.adapter._background_tasks)
        for job in jobs:job.cancel()
        if jobs:await asyncio.gather(*jobs,return_exceptions=True)
        self.restore()
        self.assertEqual(self.audit['network_attempts'],0);self.assertEqual(self.audit['private_reads'],0)
    async def drain(self,predicate,seconds=4):
        async with asyncio.timeout(seconds):
            while not predicate():await asyncio.sleep(.01)
    async def test_actual_native_delivery_resumes_same_task_and_never_replays_uncertain_create(self):
        await self.adapter.handle_message(MessageEvent(text='Synthetic create exactly one, verify saved result',source=self.source,message_id='owner-1'))
        await self.drain(lambda:len(self.adapter.deliveries)==2 and not self.adapter._active_sessions)
        self.assertEqual(self.truth['creates'],1);self.assertEqual([t['internal'] for t in self.turns],[False,True])
        self.assertTrue(all('不是Gate1A本机模拟' in t['prompt'] for t in self.turns))
        self.assertTrue(all(t['tools']==['company_browser_simulation'] for t in self.turns))
        self.assertEqual(self.c.store.list()[0]['status'],'completed');self.assertEqual(self.c.store.pending(),[])
    async def test_new_owner_input_at_native_ingress_invalidates_resume_before_dispatch(self):
        self.c.delays=(.1,.1,.1)
        await self.adapter.handle_message(MessageEvent(text='Synthetic existing task',source=self.source,message_id='owner-1'))
        await self.drain(lambda:len(self.adapter.deliveries)>=1)
        await self.adapter.handle_message(MessageEvent(text='new Owner instruction',source=self.source,message_id='owner-2'))
        await self.drain(lambda:len(self.adapter.deliveries)==2 and not self.adapter._active_sessions)
        await asyncio.sleep(.15)
        self.assertEqual(len(self.turns),1);self.assertEqual(self.c.store.pending(),[])
        self.assertEqual(self.c.store.list()[0]['status'],'paused')
    async def test_native_failed_delivery_does_not_activate_business_continuation(self):
        self.adapter.fail_delivery=True
        await self.adapter.handle_message(MessageEvent(text='Synthetic existing task',source=self.source,message_id='owner-1'))
        await self.drain(lambda:bool(self.adapter.deliveries) and not self.adapter._active_sessions)
        await asyncio.sleep(.1)
        self.assertEqual(len(self.turns),1);self.assertEqual(self.c.store.pending(),[])
        self.assertEqual(self.c.store.list()[0]['last_failure']['code'],'NATIVE_RESULT_DELIVERY_FAILED_OR_UNKNOWN')

class EdgeCases(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
    def test_long_notes_list_is_compact_and_read_is_losslessly_paginated(self):
        s=TaskStore(self.root/'tasks.sqlite');s.begin_owner({'platform':'feishu','chat_type':'dm','chat_id':'test','user_id':'test'},'s','m','g'*30000)
        t=s.checkpoint({'action':'checkpoint','note':'n'*12000,'items':[{'key':str(i),'state':'pending','description':'d'*1000} for i in range(80)]})
        self.assertLess(len(json.dumps(s.list(summaries=True))),3000)
        chunks=[];offset=0
        while True:
            p=task_page(s,{'task_id':t['id'],'offset':offset,'limit':20000});chunks.append(p['text'])
            if not p['more']:break
            offset=p['next_offset']
        self.assertEqual(json.loads(''.join(chunks))['note'],'n'*12000)
    def test_ingress_preemption_survives_gateway_crash_and_cannot_be_rearmed_by_old_turn(self):
        s=TaskStore(self.root/'tasks.sqlite');s.begin_owner({'platform':'feishu','chat_type':'dm','chat_id':'test','user_id':'test'},'s','m','goal')
        s.browser_event('ego_browser_actions',False,'EGO_TRANSPORT_FAILED','r','d');s.preempt_pending()
        s.checkpoint({'action':'checkpoint','status':'blocked_tool','resume_after_recovery':True})
        self.assertEqual(TaskStore(s.path).restart_candidates(),[])
    def test_native_auth_rotation_observed_only_other_changes_still_block(self):
        auth=self.root/'auth.json';role=self.root/'HERMES.md';auth.write_text('synthetic before');role.write_text('protected')
        baseline={'home':str(self.root),'files':{str(p):{'exists':True,'sha256':sha256(p)} for p in [auth,role]}}
        policy={'schema':'lingju.protection-lifecycle.v1','ownerApprovedTechnicalRepair':True,'reference':'synthetic repair','volatile_native_auth_only':True}
        notices=[];g=ProtectionView(baseline,self.root,policy,notices.append)
        auth.write_text('synthetic rotated');self.assertEqual(g.blocking(),[]);self.assertEqual(len(notices),1)
        self.assertEqual(g.blocking(),[]);self.assertEqual(len(notices),1);self.assertEqual(auth.read_text(),'synthetic rotated')
        role.write_text('changed');self.assertEqual(g.blocking(),[str(role)])
        auth.unlink();self.assertEqual(set(g.blocking()),{str(auth),str(role)})
    def test_auth_lifecycle_policy_is_narrow_and_opt_in(self):
        auth=self.root/'auth.json';auth.write_text('before');baseline={'home':str(self.root),'files':{str(auth):{'exists':True,'sha256':sha256(auth)}}};auth.write_text('after')
        self.assertEqual(ProtectionView(baseline,self.root).blocking(),[str(auth)])
        with self.assertRaises(ValueError):ProtectionView(baseline,self.root,{'ignore_all':True})
    def test_launch_context_uses_same_original_cli_and_exact_runtime_paths(self):
        home=self.root/'user/.hermes';root=home/'tools/company-browser';entry={'schema':'lingju.original-gateway-entry.v1','ownerRepairReference':'synthetic','install':str(home.parent/'AppData/Local/hermes/hermes-agent'),'gate':str(root/'runs/live/gate.json'),'baseline':str(root/'runs/live/base.json')}
        cmd,env=build_context(root,home,entry,root/'runs/probe',{'HERMES_PROFILE':'old-test','LINGJU_BROWSER_BUDGET':'1'})
        self.assertEqual(cmd[-4:],['-m','hermes_cli.main','gateway','run']);self.assertNotIn('HERMES_PROFILE',env);self.assertEqual(env['HERMES_HOME'],str(home))
        with self.assertRaises(ValueError):build_context(root,home,entry,self.root/'outside',{})
    def test_unrelated_or_old_ready_receipt_never_blesses_a_gateway(self):
        rows=[{'event':'original_feishu_browser_ready','pid':10,'runtime_sha256':'right'}]
        self.assertTrue(matching_ready(rows,10,'right'));self.assertFalse(matching_ready(rows,11,'right'));self.assertFalse(matching_ready(rows,10,'old'))
    def test_fast_second_start_sees_existing_launcher_before_child_ready(self):
        h=self.root/'home';h.mkdir();r=h/'tools/company-browser';(r/'private-state').mkdir(parents=True)
        (r/'private-state/gateway-active.json').write_text(json.dumps({'launcher_pid':111,'launcher_created':10}))
        entry=object.__new__(GatewayEntry);entry.home=h;entry.root=r;entry.active=r/'private-state/gateway-active.json'
        process=types.SimpleNamespace(create_time=lambda:10,cmdline=lambda:['python','-m','hermes_cli.main','gateway','run'])
        with patch('company_gateway_entry.psutil.pid_exists',return_value=True),patch('company_gateway_entry.psutil.Process',return_value=process):
            self.assertEqual(entry.status()['state'],'starting')
    def test_daily_provider_long_cooldown_expires_without_shortening_or_permanent_lock(self):
        clock=[0.0];budget=types.SimpleNamespace(check=lambda:None)
        p=BrowserPacer(budget,self.root/'response.jsonl',clock=lambda:clock[0],daily_auto_unfreeze=True)
        p.response(types.SimpleNamespace(status_code=429,headers={'retry-after':'1200'}))
        with self.assertRaises(BudgetBlocked):p.check()
        clock[0]=1199
        with self.assertRaises(BudgetBlocked):p.check()
        clock[0]=1200;p.check();self.assertFalse(p.frozen)
    def test_legacy_exercise_long_wait_still_requires_its_original_review(self):
        clock=[0.0];p=BrowserPacer(types.SimpleNamespace(check=lambda:None),self.root/'response.jsonl',clock=lambda:clock[0])
        p.response(types.SimpleNamespace(status_code=429,headers={'retry-after':'1200'}));clock[0]=1201
        with self.assertRaises(BudgetBlocked):p.check()
