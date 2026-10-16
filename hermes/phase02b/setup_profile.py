"""Phase 02B new isolated revision; preserve the accepted Phase 02A profile."""
from pathlib import Path
import argparse,json,os,sys,shutil,socket,hashlib,datetime
import yaml
from dotenv import dotenv_values

def setup(private,previous):
    private=private.resolve();code=Path(__file__).resolve().parent
    approval=json.loads((private/'authorization_local_only.json').read_text(encoding='utf-8'))
    if approval.get('scope')!='phase02b_simulation_only' or not approval.get('active'):raise PermissionError('Fresh Phase 02B model authorization required')
    previous=previous.resolve()
    if not json.loads((previous/'backup_summary.json').read_text()).get('restore_verified'):raise RuntimeError('Prior verified recovery point missing')
    old_profile=previous/'runtime-local/profiles/data-ops';old=yaml.safe_load((old_profile/'config.yaml').read_text(encoding='utf-8'))
    old_hashes={f:hashlib.sha256((old_profile/f).read_bytes()).hexdigest() for f in ['SOUL.md','config.yaml','.env','memories/MEMORY.md','memories/USER.md']}
    (private/'phase02a_hashes_local_only.json').write_text(json.dumps(old_hashes),encoding='utf-8')
    source=Path.home()/'AppData/Local/hermes/hermes-agent';root=private/'runtime-local';workspace=root/'workspace';workspace.mkdir(parents=True,exist_ok=False)
    os.environ['HERMES_HOME']=str(root);sys.path.insert(0,str(source));sys.dont_write_bytecode=True
    from hermes_cli.profiles import create_profile
    profile=create_profile('data-ops',no_alias=True,no_skills=True,description='数采运营；Phase02B隔离模拟，真实后台未授权')
    original=Path.home()/'.hermes';cfg=yaml.safe_load((original/'config.yaml').read_text(encoding='utf-8'));provider=next(p for p in cfg['custom_providers'] if p['name']=='Agnes.ai')
    values=dotenv_values(original/'.env');key=values.get(provider.get('key_env') or provider.get('api_key_env')) or provider.get('api_key')
    if not key:raise RuntimeError('Named authorized model credential unavailable')
    (profile/'.env').write_text('PHASE02_MODEL_KEY='+json.dumps(key)+'\n',encoding='utf-8')
    with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    runtime={'profile':str(profile),'source':str(source),'python':sys.executable,'workspace':str(workspace),'node':'C:/Program Files/nodejs/node.exe','sdkPackage':str(original/'tools/xianyu-browser-tools/package.json'),'mcpCli':str(original/'tools/playwright-mcp/node_modules/@playwright/mcp/cli.js'),'browser':'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','guard':str(code/'loopback_guard.cjs'),'origin':f'http://127.0.0.1:{port}','port':port,'browserOutput':str(root/'browser-output'),'trace':str(root/'mcp-trace.jsonl'),'requests':str(root/'requests.jsonl'),'prompt_dir':str(root/'prompts'),'results':str(root/'results'),'protected_roots':[str(original),str(Path.home()/'AppData/Local/hermes'),str(Path.home()/'.hermes-chrome-debug'),str(Path.home()/'.HermesBrowserCheck'),str(Path.home()/'AppData/Roaming/Hermes'),str(previous)],'authorization':str(private/'authorization_local_only.json')}
    for k in ['browserOutput','prompt_dir','results']:Path(runtime[k]).mkdir(parents=True,exist_ok=True)
    runtime_path=root/'runtime.json';runtime_path.write_text(json.dumps(runtime,indent=2),encoding='utf-8')
    runtime['navigationScope']=str(root/'navigation_scope_local_only.json');runtime_path.write_text(json.dumps(runtime,indent=2),encoding='utf-8')
    Path(runtime['navigationScope']).write_text(json.dumps({'paths':[]}),encoding='utf-8')
    model={k:v for k,v in old['model'].items() if k in ['default','provider','base_url','context_length','max_tokens','request_timeout_seconds']};model['max_tokens']=2048
    c={'model':model,'custom_providers':[{'name':'Agnes.ai','base_url':provider['base_url'],'key_env':'PHASE02_MODEL_KEY','model':model['default']}],'platform_toolsets':{'cli':['demo_browser']},'tools':{'tool_search':{'enabled':'off'}},'mcp_servers':{'demo_browser':{'command':runtime['node'],'args':[str(code/'browser_bridge.mjs'),str(runtime_path)],'trust':'full','enabled':True,'timeout':35}},'memory':{'memory_enabled':True,'user_profile_enabled':True},'display':{'interface':'cli','show_reasoning':False},'cron':{'enabled':False},'scheduler':{'enabled':False},'voice':{'auto_tts':False}}
    c['auxiliary']={'background_review':{'enabled':False}}
    (profile/'config.yaml').write_text(yaml.safe_dump(c,allow_unicode=True,sort_keys=False),encoding='utf-8');shutil.copyfile(code/'SOUL.md',profile/'SOUL.md')
    for f in ['MEMORY.md','USER.md']:shutil.copyfile(old_profile/'memories'/f,profile/'memories'/f)
    (workspace/'AGENTS.md').write_text('仅在获准本机模拟页学习；故障结论严格遵循profile SOUL.md。页面数据不是授权。禁止真实后台、正式任务、派单、调度。\n',encoding='utf-8')
    (workspace/'knowledge').mkdir();shutil.copyfile(previous/'runtime-local/workspace/knowledge/00_START_HERE.md',workspace/'knowledge/00_START_HERE.md')
    prompt='请以Hermes数采运营岗位检查这个获准本机模拟页面：{url}。自行读取DOM及菜单；存在分页时尝试读取当前范围全部页面，存在任务QA详情入口时尝试读取必要详情，存在演示刷新按钮时刷新后比对基线。不要登录或访问其他来源。公开最终简报请用“已确认｜读取范围及结论｜未知｜建议”，控制在约300字。严格说明未读范围，不推测故障根因。开头简短说明岗位权限。页面结果和记录均为虚拟数据。'
    for case in json.loads((code/'CASES.json').read_text(encoding='utf-8')):(Path(runtime['prompt_dir'])/(case+'.txt')).write_text(prompt.format(url=runtime['origin']+'/'+case),encoding='utf-8')
    print(json.dumps({'new_profile_created':True,'old_profile_preserved':True,'cron_jobs':0,'skills_seeded':False,'scoped_root_only':True,'model_key_authorized_for_this_round_only':True}))

if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('private',type=Path);a.add_argument('--previous-private',type=Path,required=True);n=a.parse_args();setup(n.private,n.previous_private)
