"""Real installed Hermes AIAgent conversation; no scripted browser calls here.

Run in a fresh process. Only its model-driven MCP calls reach browser_bridge.
Local runtime path/credential file and raw session output must stay private.
"""
from pathlib import Path
import argparse, json, os, sys, logging

def run(runtime_path,case,output_dir):
    runtime=json.loads(runtime_path.read_text(encoding='utf-8'))
    profile=Path(runtime['profile']).resolve();source=Path(runtime['source']).resolve()
    minimal={k:v for k,v in os.environ.items() if k.upper() in {'PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','USERNAME','USERDOMAIN','HOMEDRIVE','HOMEPATH'}}
    os.environ.clear();os.environ.update(minimal)
    # This is a Python write guard, not an OS security sandbox.
    protected=[Path(p).resolve() for p in runtime['protected_roots']]
    def audit(event,args):
        if event=='open':
            target,mode,flags=args
            writing=(isinstance(mode,str) and any(x in mode for x in 'wax+')) or isinstance(flags,int) and flags & (os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC)
            if writing and isinstance(target,(str,bytes,os.PathLike)):
                resolved=Path(os.fsdecode(target)).resolve()
                if any(resolved.is_relative_to(p) for p in protected):raise PermissionError('Original Hermes roots are write-protected by test harness')
        if event in ['os.remove','os.rmdir','os.mkdir','os.rename','os.chmod','os.utime']:
            for arg in args[:2] if event=='os.rename' else args[:1]:
                if isinstance(arg,(str,bytes,os.PathLike)):
                    resolved=Path(os.fsdecode(arg)).resolve()
                    if any(resolved.is_relative_to(p) for p in protected):raise PermissionError('Original Hermes mutation denied')
    os.environ['HERMES_HOME']=str(profile);os.environ['HERMES_CWD']=runtime['workspace']
    os.environ['PYTHONDONTWRITEBYTECODE']='1';os.environ['PYTHONUTF8']='1'
    os.chdir(runtime['workspace']);sys.path.insert(0,str(source));sys.addaudithook(audit)
    logging.basicConfig(level=logging.WARNING)
    from dotenv import load_dotenv
    load_dotenv(profile/'.env',override=True)
    from hermes_cli.config import load_config
    from hermes_cli.runtime_provider import resolve_runtime_provider
    from hermes_cli.mcp_startup import ensure_mcp_discovery_before_agent_build
    from hermes_state import SessionDB
    from hermes_constants import get_hermes_home
    from run_agent import AIAgent
    if get_hermes_home().resolve()!=profile:raise RuntimeError('Installed Hermes resolved an unexpected home; refusing model call')
    cfg=load_config();model=cfg['model']['default']
    provider=resolve_runtime_provider(requested=cfg['model']['provider'],target_model=model)
    ensure_mcp_discovery_before_agent_build(logger=logging.getLogger(__name__),single_query=True)
    db=SessionDB();agent=None
    try:
        approval=json.loads(Path(runtime['authorization']).read_text(encoding='utf-8'))
        if approval.get('scope')!='phase02b_simulation_only' or not approval.get('active'):raise PermissionError('Phase02B authorization not active')
        agent=AIAgent(api_key=provider.get('api_key'),base_url=provider.get('base_url'),provider=provider.get('provider'),requested_provider=provider.get('requested_provider'),api_mode=provider.get('api_mode'),model=model,enabled_toolsets=['demo_browser'],max_iterations=18,max_tokens=2048,run_budget_seconds=240,quiet_mode=True,platform='cli',session_db=db,skip_background_review=True)
        names=[t['function']['name'] for t in agent.tools]
        expected={'mcp__demo_browser__browser_'+x for x in ['click','close','navigate','snapshot']}
        if set(names)!=expected:raise RuntimeError('Unexpected tool access; refusing model call: '+str(names))
        built_prompt=agent._build_system_prompt()
        identity_loaded='你是 Hermes，Owner 的专职数采运营助手' in built_prompt
        baseline_loaded='DEMO-001 待审' in built_prompt
        policy_loaded='已经收到HTTP响应' in built_prompt and '部分分页失败' in built_prompt
        if not identity_loaded or not baseline_loaded or not policy_loaded:raise RuntimeError('New profile identity/memory/fault rules did not load; refusing model call')
        prompt=(Path(runtime['prompt_dir'])/(case+'.txt')).read_text(encoding='utf-8')
        result=agent.run_conversation(prompt)
        payload={'case':case,'home_is_isolated':os.environ['HERMES_HOME']==str(profile),'identity_loaded_before_model_call':identity_loaded,'synthetic_memory_loaded_before_model_call':baseline_loaded,'tool_names':names,'final_response':result.get('final_response'),'failed':result.get('failed',False),'session_id':agent.session_id,'messages':getattr(agent,'_session_messages',[]),'api_calls':result.get('api_calls')}
        payload['fault_policy_loaded_before_model_call']=policy_loaded
        (output_dir/(case+'.json')).write_text(json.dumps(payload,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
        print(json.dumps({'case':case,'failed':payload['failed'],'response_present':bool(payload['final_response']),'api_calls':payload['api_calls']},ensure_ascii=False))
    finally:
        if agent:agent.close()
        db.close()
        from tools.mcp_tool import shutdown_mcp_servers
        shutdown_mcp_servers()

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('runtime',type=Path);p.add_argument('case',choices=list(json.loads(Path(__file__).with_name('CASES.json').read_text())));p.add_argument('output',type=Path);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True);run(a.runtime,a.case,a.output)
