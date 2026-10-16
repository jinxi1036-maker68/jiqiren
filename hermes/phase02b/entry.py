"""Dedicated launcher for the existing Hermes classic CLI, scoped to Gate A.

No global profile switch, desktop setting, installation or scheduler change.
The optional query-file mode tests the exact native CLI startup path.
"""
from pathlib import Path
import argparse,json,os,sys,subprocess,time
import yaml
from dotenv import dotenv_values

def enter(r):
    safe={k:v for k,v in os.environ.items() if k.upper() in {'PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','USERNAME','USERDOMAIN','HOMEDRIVE','HOMEPATH'}}
    os.environ.clear();os.environ.update(safe)
    profile=Path(r['profile']).resolve();source=Path(r['source']).resolve()
    protected=[Path(p).resolve() for p in r['protected_roots']]
    if any(profile.is_relative_to(p) for p in protected):raise PermissionError('Profile overlaps a protected original root')
    def audit(event,args):
        targets=[]
        if event=='open':
            target,mode,flags=args
            if isinstance(mode,str) and any(x in mode for x in 'wax+') or isinstance(flags,int) and flags & (os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC):targets=[target]
        if event in ['os.remove','os.rmdir','os.mkdir','os.rename','os.chmod','os.utime']:targets=args[:2] if event=='os.rename' else args[:1]
        for target in targets:
            if isinstance(target,(str,bytes,os.PathLike)) and any(Path(os.fsdecode(target)).resolve().is_relative_to(p) for p in protected):raise PermissionError('Original Hermes mutation denied by launcher')
    os.environ['HERMES_HOME']=str(profile);os.environ['HERMES_CWD']=r['workspace'];os.environ['PYTHONUTF8']='1';os.environ['PYTHONDONTWRITEBYTECODE']='1'
    sys.dont_write_bytecode=True;os.chdir(r['workspace']);sys.path.insert(0,str(source));sys.addaudithook(audit)
    return profile,source

def validate(r,profile,source):
    c=yaml.safe_load((profile/'config.yaml').read_text(encoding='utf-8'))
    from hermes_constants import get_hermes_home
    approval=json.loads(Path(r['authorization']).read_text(encoding='utf-8'))
    exact_server=set(c.get('mcp_servers',{}))=={'demo_browser'}
    checks={'resolved_home_is_new_profile':get_hermes_home().resolve()==profile,'classic_cli_selected':(c.get('display') or {}).get('interface')=='cli','only_demo_browser_configured':exact_server,'toolsets_allowlist':c.get('platform_toolsets',{}).get('cli')==['demo_browser'],'no_source_dotenv_fallback':not (source/'.env').exists(),'no_cron_files':not any((profile/'cron').iterdir()),'bundled_skills_opt_out':(profile/'.no-bundled-skills').exists(),'automatic_background_review_disabled':c.get('auxiliary',{}).get('background_review',{}).get('enabled') is False}
    return checks,approval.get('scope')=='phase02b_simulation_only' and approval.get('active') is True and bool(dotenv_values(profile/'.env').get('PHASE02_MODEL_KEY'))

def main():
    p=argparse.ArgumentParser();p.add_argument('runtime',type=Path);p.add_argument('--check',action='store_true');p.add_argument('--native-help',action='store_true');p.add_argument('--query-file',type=Path);p.add_argument('--worker',action='store_true',help=argparse.SUPPRESS);a=p.parse_args()
    runtime=a.runtime.resolve();query=a.query_file.resolve() if a.query_file else None;r=json.loads(runtime.read_text(encoding='utf-8'));profile,source=enter(r)
    checks,authorized=validate(r,profile,source)
    if a.check:
        print(json.dumps({'identity':'Hermes 数采运营｜Phase02B隔离模拟','checks':checks,'entry_checks_passed':all(checks.values()),'model_chat_authorized_now':authorized,'global_profile_changed':False,'real_backend_authorized':False},ensure_ascii=False));return
    if not all(checks.values()):raise RuntimeError('入口自检未通过：'+','.join(k for k,v in checks.items() if not v))
    if not authorized and not a.native_help:
        print('身份入口自检通过。当前没有有效的本轮模型授权/临时凭据，未连接模型。\n请先由Owner明确授权后再启用；不要把key粘贴到聊天或代码。原Hermes未受影响。')
        raise SystemExit(3)
    if a.worker:
        sys.argv=['hermes','--cli','chat','--toolsets','demo_browser','--max-turns','18']
        if a.native_help:sys.argv+=['--help']
        elif query:sys.argv+=['--query-file',str(query),'--quiet']
        from hermes_cli.main import main as hermes_main
        hermes_main();return
    sys.path.insert(0,str(Path(__file__).parent))
    from owned_job import OwnedJob
    job=OwnedJob()
    server=None;out=err=None
    try:
        if not a.native_help:
            Path(r['navigationScope']).write_text(json.dumps({'paths':['/'+x for x in json.loads(Path(__file__).with_name('CASES.json').read_text(encoding='utf-8'))]}),encoding='utf-8')
            folder=runtime.parent/'native-entry';folder.mkdir(exist_ok=True)
            out=(folder/'fixture_stdout.txt').open('w',encoding='utf-8');err=(folder/'fixture_stderr.txt').open('w',encoding='utf-8')
            server=subprocess.Popen([r['node'],str(Path(__file__).with_name('demo_server.mjs')),str(runtime)],stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
            job.add(server)
            for _ in range(40):
                if (folder/'fixture_stdout.txt').read_text(encoding='utf-8').strip():break
                if server.poll() is not None:raise RuntimeError('模拟页面未能启动；不复用未知端口服务')
                time.sleep(.25)
            else:raise TimeoutError('模拟页面未就绪')
            print('Hermes 数采运营｜隔离模拟（不会切换原身份）\n只允许本机虚拟页面，真实灵生后台未授权。\n退出请输入 /exit；关闭此窗口不影响原Hermes。\n演示页面：'+r['origin']+'/http503',flush=True)
        command=[r['python'],'-I','-B',str(Path(__file__).resolve()),str(runtime),'--worker']
        if a.native_help:command+=['--native-help']
        elif query:command+=['--query-file',str(query)]
        worker=subprocess.Popen(command)
        job.add(worker);raise SystemExit(worker.wait())
    finally:
        try:
            if server:
                try:server.terminate();server.wait(timeout=5)
                except subprocess.TimeoutExpired:server.kill();server.wait()
            if out:out.close()
            if err:err.close()
        finally:job.close()

if __name__=='__main__':main()
