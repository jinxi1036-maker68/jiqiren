"""Reproducible entry to the ORIGINAL native gateway, never a second employee.

No autostart, scheduled task, original shortcut/config or credentials changes.
Repeated start reuses a proven managed gateway; an unrecognized live gateway
is left untouched. The fixed manifest contains paths and authorization only.
"""
import datetime,json,os,secrets,subprocess,sys,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import psutil
from safety import ordinary_path,sha256
from runtime_guard import ProtectionView

def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n','utf-8')
def build_context(root,home,entry,out,environ):
    root,home,out=Path(root),Path(home),Path(out)
    install=home.parent/'AppData/Local/hermes/hermes-agent'
    if (entry.get('schema')!='lingju.original-gateway-entry.v1' or not entry.get('ownerRepairReference')
        or root!=home/'tools/company-browser' or Path(entry.get('install',''))!=install
        or root/'runs' not in Path(entry.get('gate','')).parents or root/'runs' not in out.parents):
        raise ValueError('Original same-employee entry required')
    env=dict(environ)
    for key in ['HERMES_PROFILE','LINGJU_BROWSER_BUDGET','LINGJU_FEISHU_ZERO_MODEL_PROBE']:env.pop(key,None)
    env.update(PYTHONPATH=str(root/'startup'),PYTHONDONTWRITEBYTECODE='1',HERMES_HOME=str(home),
        LINGJU_FEISHU_NATIVE='1',LINGJU_FEISHU_INSTALL=str(install),LINGJU_FEISHU_GATE=entry['gate'],
        LINGJU_FEISHU_BASELINE=entry['baseline'],LINGJU_FEISHU_OUTPUT=str(out))
    return [str(install/'venv/Scripts/python.exe'),'-B','-u','-m','hermes_cli.main','gateway','run'],env

def matching_ready(rows,pid,runtime_hash,gate_hash=None):
    return any(r.get('event')=='original_feishu_browser_ready' and r.get('pid')==pid
        and r.get('runtime_sha256')==runtime_hash and (gate_hash is None or r.get('gate_sha256')==gate_hash) for r in rows)

class GatewayEntry:
    def __init__(self):
        self.root=ordinary_path(Path(__file__).parent);self.home=Path.home()/'.hermes'
        if self.root!=self.home/'tools/company-browser':raise ValueError('Original owned entry only')
        self.entry=json.loads(ordinary_path(self.root/'gateway-entry.json').read_text('utf-8'))
        self.gate=json.loads(ordinary_path(self.entry['gate']).read_text('utf-8'))
        exercise=self.gate.get('browser_exercise',{})
        if (exercise.get('kind') not in ['lingju-ego-business-daily','lingju-ego-readonly-daily']
            or exercise.get('Owner_removed_test_quotas') is not True
            or exercise.get('request_limit') is not None or exercise.get('task_limit') is not None
            or self.gate.get('source_sha256',{}).get('company_gateway_entry.py')!=sha256(__file__)):
            raise ValueError('Pinned current company gateway required; no legacy simulation fallback')
        self.runtime=ordinary_path(self.gate['browser_exercise']['runtime'])
        self.active=self.root/'private-state/gateway-active.json'
        self.install=ordinary_path(self.entry['install']);self.ready_hash=self.gate['browser_exercise']['runtime_sha256']
        # Paths/config are inputs, never commands. Check original source pins,
        # runtime, baseline and the actual installed executable before spawning.
        preview=self.root/'runs/entry-preview'
        build_context(self.root,self.home,self.entry,preview,os.environ)
        if sha256(self.runtime)!=self.ready_hash:raise ValueError('Runtime differs from approved gate')
        if sha256(self.entry['baseline'])!=self.gate['protected_baseline_sha256']:raise ValueError('Baseline changed')
        for name,digest in self.gate['source_sha256'].items():
            target=ordinary_path(self.root/name)
            if self.root not in target.parents or sha256(target)!=digest:raise ValueError('Owned source pin changed')
        baseline=json.loads(Path(self.entry['baseline']).read_text('utf-8'))
        if ProtectionView(baseline,self.home,self.gate.get('runtime_protection')).blocking():raise ValueError('Protected nonvolatile file changed')
    def status(self):
        p=self.home/'gateway_state.json'
        state=json.loads(p.read_text('utf-8')) if p.exists() else {}
        pid=state.get('pid');alive=bool(isinstance(pid,int) and psutil.pid_exists(pid))
        if not alive:
            if self.active.exists():
                a=json.loads(ordinary_path(self.active).read_text('utf-8'));launcher_pid=a['launcher_pid']
                if psutil.pid_exists(launcher_pid):
                    launcher=psutil.Process(launcher_pid);args=launcher.cmdline()
                    if abs(launcher.create_time()-a['launcher_created'])<.1 and all(x in args for x in ['-m','hermes_cli.main','gateway','run']):
                        return {'state':'starting','managed':True,'pid':launcher_pid,'starts_model':False}
            return {'state':'stopped','managed':False,'starts_model':False}
        proc=psutil.Process(pid);args=proc.cmdline()
        native=all(x in args for x in ['-m','hermes_cli.main','gateway','run']) and Path(proc.cwd())==self.home/'company-workspace'
        managed=False
        if native and self.active.exists():
            a=json.loads(ordinary_path(self.active).read_text('utf-8'));out=ordinary_path(a['output'])
            if self.root/'runs' not in out.parents:raise ValueError('Owned output path required')
            receipt=out/'receipts.jsonl';rows=[json.loads(x) for x in receipt.read_text('utf-8').splitlines()] if receipt.exists() else []
            managed=matching_ready(rows,pid,self.ready_hash,sha256(self.entry['gate']))
            # A just-launched original redirector may not yet have its child
            # READY; treat the exact surviving launcher as starting, not a
            # reason to start a second process.
            if not managed and psutil.pid_exists(a['launcher_pid']):
                launcher=psutil.Process(a['launcher_pid'])
                if abs(launcher.create_time()-a['launcher_created'])<.1 and (pid==launcher.pid or proc.ppid()==launcher.pid):
                    return {'state':'starting','managed':True,'pid':pid,'starts_model':False}
        return {'state':state.get('gateway_state','unknown'),'managed':managed,'pid':pid,
                'feishu':state.get('platforms',{}).get('feishu',{}).get('state'),'starts_model':False}
    def start(self,*,probe=False):
        if not probe:
            status=self.status()
            if status['state']!='stopped':
                if status['managed']:return {**status,'reused_existing':True}
                raise RuntimeError('An existing gateway is not proven to use this entry; leave it running, no duplicate or forced replacement')
        lock=self.root/'private-state/gateway-start.lock';nonce=secrets.token_hex(16)
        # Only this launcher lock, with a proven-dead previous owner, may be
        # released. It is not the browser lease or a native service lock.
        if lock.exists():
            recovery=lock.with_suffix('.recovery')
            with recovery.open('x',encoding='utf-8') as f:
                f.write(nonce)
            try:
                raw=ordinary_path(lock).read_bytes();old=json.loads(raw)
                if psutil.pid_exists(old['pid']):raise RuntimeError('Another owned launch is in progress')
                if lock.read_bytes()!=raw:raise RuntimeError('Launch lock changed')
                lock.unlink()
            finally:
                if recovery.read_text('utf-8')==nonce:recovery.unlink()
        with lock.open('x',encoding='utf-8') as f:json.dump({'pid':os.getpid(),'nonce':nonce},f)
        try:
            if not probe:
                s=self.status()
                if s['state']!='stopped':
                    if s['managed']:return {**s,'reused_existing':True}
                    raise RuntimeError('Concurrent native gateway appeared; no second launch')
            stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S')
            out=self.root/'runs'/('gateway-entry-'+stamp+'-'+secrets.token_hex(3));out.mkdir();ordinary_path(out)
            cmd,env=build_context(self.root,self.home,self.entry,out,os.environ)
            if probe:
                env['LINGJU_FEISHU_ZERO_MODEL_PROBE']='1'
                r=subprocess.run(cmd,cwd=self.install,env=env,capture_output=True,timeout=45,creationflags=subprocess.CREATE_NO_WINDOW)
                (out/'stdout.log').write_bytes(r.stdout);(out/'stderr.log').write_bytes(r.stderr)
                ok=r.returncode==0 and json.loads((out/'native-cli-probe.json').read_text('utf-8'))['native_CLI_probe_passed']
                if not ok:raise RuntimeError('Native CLI zero-model probe failed; private diagnostic retained')
                return {'probe_passed':True,'output':str(out),'models':0}
            with (out/'stdout.log').open('xb') as stdout,(out/'stderr.log').open('xb') as stderr:
                p=subprocess.Popen(cmd,cwd=self.install,env=env,stdin=subprocess.DEVNULL,stdout=stdout,stderr=stderr,creationflags=subprocess.CREATE_NO_WINDOW)
            save(self.active,{'schema':'lingju.gateway-active.v1','launcher_pid':p.pid,'launcher_created':psutil.Process(p.pid).create_time(),
                'output':str(out),'runtime_sha256':self.ready_hash,'model_messages_sent_by_entry':0})
            return {'state':'starting','launcher_pid':p.pid,'output':str(out),'starts_model':False}
        finally:
            if lock.exists() and json.loads(lock.read_text('utf-8')).get('nonce')==nonce:lock.unlink()

if __name__=='__main__':
    try:
        action=sys.argv[1] if len(sys.argv)>1 else 'status';entry=GatewayEntry()
        if action not in ['status','start','probe']:raise ValueError('Use status/start/probe only; no restart or force option')
        result=entry.status() if action=='status' else entry.start(probe=action=='probe')
        print(json.dumps(result,ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({'state':'blocked','error_type':type(exc).__name__,'detail':str(exc)[:250],'starts_model':False},ensure_ascii=False));raise SystemExit(1)
