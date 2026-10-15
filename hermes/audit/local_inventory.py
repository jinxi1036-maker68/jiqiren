"""Read-only Hermes inventory. Never imports Hermes or prints stored secrets.

Outputs sanitized facts and a local-only fingerprint manifest beneath --output.
No login, model call, scheduler invocation, package installation or config write.
"""
from __future__ import annotations
import argparse, collections, hashlib, importlib.util, json, os, re, sqlite3
import subprocess, sys
from pathlib import Path
from datetime import datetime, timezone

TOPICS = {
    'robot_data_operations': r'灵生|数采|数据采集|质检|lingrobotics|livsyn',
    'other_marketplace_work': r'闲鱼|xianyu|淘宝|拼多多|电商',
    'other_content_work': r'抖音|douyin|小红书|短视频|公众号|漫画',
    'general_operator_preferences': r'偏好|习惯|称呼|沟通|回复|语言|自主|确认|权限',
    'historical_machine_maintenance': r'360|杀毒|重装|注册表|清理系统',
}

def read(p):
    try: return p.read_text(encoding='utf-8-sig', errors='replace')
    except OSError: return ''

def fingerprint(p):
    try:
        st=p.stat()
        return {'bytes':st.st_size, 'mtime_ns':st.st_mtime_ns,
                'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
    except OSError as e: return {'error':type(e).__name__}

def redact(s, user):
    s=str(s).replace(str(user), '<USER_HOME>').replace(str(user).replace('\\','/'), '<USER_HOME>')
    s=re.sub(r'https?://[^/@\s]+:[^/@\s]+@', 'https://<REDACTED>@', s)
    s=re.sub(r'([?&](?:token|key|secret|password|auth)[^=]*=)[^&\s]+', r'\1<REDACTED>', s, flags=re.I)
    s=re.sub(r'(?<!\d)1[3-9]\d{9}(?!\d)', '<PHONE>', s)
    return s

def git_facts(p, user):
    env=dict(os.environ, GIT_OPTIONAL_LOCKS='0')
    def run(*args):
        r=subprocess.run(['git','--no-optional-locks','-C',str(p),*args],capture_output=True,text=True,encoding='utf-8',errors='replace',env=env,timeout=25)
        return r.returncode, r.stdout.strip()
    code, root=run('rev-parse','--show-toplevel')
    if code: return {'is_git_checkout':False}
    result={'is_git_checkout':True, 'root':redact(root,user)}
    for key,cmd in [('branch',['branch','--show-current']),('head',['rev-parse','HEAD']),('description',['describe','--tags','--always','--dirty']),('origin',['remote','get-url','origin'])]:
        code,value=run(*cmd);result[key]=redact(value,user) if code==0 else None
    code,status=run('status','--porcelain=v1','--untracked-files=normal')
    lines=status.splitlines() if code==0 else []
    result['tracked_changed_count']=sum(not l.startswith('??') for l in lines)
    result['untracked_count']=sum(l.startswith('??') for l in lines)
    result['changed_source_paths']=[redact(l[3:],user) for l in lines if not l.startswith('??')][:35]
    return result

def yaml_config(p):
    try:
        import yaml
        d=yaml.safe_load(read(p)) or {}
        if not isinstance(d,dict): return {}, 'root_not_mapping'
        return d, None
    except Exception as e: return {}, type(e).__name__

def config_summary(p, user):
    d,error=yaml_config(p)
    out={'present':p.is_file(),'parse_error':error,'top_level_keys':list(d)}
    # Only allowlisted values. Never return arbitrary config/credential content.
    selections={
        'memory':['memory_enabled','user_profile_enabled','memory_char_limit','user_char_limit','provider','enabled'],
        'browser':['enabled','backend','provider','engine','headless','timeout','timeout_seconds','profile','profile_name'],
        'terminal':['backend','timeout','timeout_seconds','sandbox','persistent_shell'],
        'agent':['max_turns','max_iterations','toolsets','disabled_tools','memory_enabled','execution_guidance'],
        'skills':['enabled','disabled','disabled_skills','auto_load','external_dirs'],
        'security':['redact_secrets','approval_mode','enabled'],
        'cron':['enabled','max_concurrent','max_concurrent_jobs'],
        'memory_provider':['name','enabled','provider'],
    }
    for section,keys in selections.items():
        value=d.get(section)
        if isinstance(value,dict):
            out[section]={'keys':list(value),'selected':{k:redact(value[k],user) if isinstance(value[k],str) else value[k] for k in keys if k in value}}
        elif value is not None and isinstance(value,(bool,str,list)):
            out[section]=redact(value,user) if isinstance(value,str) else value
    for key in ['toolsets','disabled_tools','enabled_toolsets','mcp_servers','mcp','plugins','scheduler','platforms','gateway','permissions','approvals']:
        value=d.get(key)
        if isinstance(value,dict):
            out[key]={'keys':list(value)}
            if key in ['mcp_servers','mcp']:
                out[key]['configured_server_count']=len(value)
        elif value is not None: out[key]=value if not isinstance(value,str) else redact(value,user)
    if isinstance(d.get('model'),dict):
        out['model']={k:d['model'][k] for k in ['default','provider'] if k in d['model']}
        out['model']['custom_endpoint_present']=bool(d['model'].get('base_url'))
    return out

def manifest(roots):
    result={}
    for alias,root in roots.items():
        if not root.is_dir():continue
        targets=[]
        for name in ['config.yaml','.env','auth.json','SOUL.md','MEMORY.md','USER.md','active_profile','profiles.json','.skills_prompt_snapshot.json']:
            p=root/name
            if p.is_file(): targets.append(p)
        for dirname in ['memories','skills','profiles','config','cron','hooks','plugins','desktop-plugins','tools','scripts','providers']:
            base=root/dirname
            if not base.is_dir():continue
            for p in base.rglob('*'):
                if not p.is_file() or any(x in p.parts for x in ['__pycache__','node_modules','.git','output','browser-profiles']):continue
                if p.suffix.lower() in ['.db','.sqlite','.sqlite3','.log','.jsonl'] or p.name.endswith(('-wal','-shm','.lock')):continue
                targets.append(p)
        for p in targets:
            result[alias+'/'+p.relative_to(root).as_posix()]=fingerprint(p)
    return result

def install_write_guard(roots):
    """Deny Python-side mutation of original Hermes homes during inspection.

    This cannot freeze other already-running processes or govern child programs.
    Git subprocesses separately use --no-optional-locks and read-only commands.
    """
    protected=[p.resolve() for p in roots.values()]
    def is_protected(value):
        if not isinstance(value,(str,bytes,os.PathLike)):return False
        try:
            p=Path(os.fsdecode(value)).resolve()
            return any(p==root or p.is_relative_to(root) for root in protected)
        except (OSError,ValueError):return False
    def guard(event,args):
        if event=='open':
            name,mode,flags=args
            writing=any(c in (mode or '') for c in 'wax+') or bool(flags & (os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC|os.O_APPEND))
            if writing and is_protected(name):raise PermissionError('Phase 01 prohibits writes to original Hermes homes')
        elif event in ['os.remove','os.rmdir','os.mkdir','os.rename','os.chmod','os.truncate']:
            candidates=args[:2] if event=='os.rename' else args[:1]
            if any(is_protected(v) for v in candidates):raise PermissionError('Phase 01 prohibits mutation of original Hermes homes')
    sys.addaudithook(guard)
    # A synthetic audit event tests enforcement without opening or touching a file.
    try:sys.audit('open',str(protected[0]/'config.yaml'),'w',os.O_WRONLY)
    except PermissionError:return True
    raise RuntimeError('Read-only guard self-test failed')

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,required=True);ap.add_argument('--compare',type=Path);args=ap.parse_args()
    user=Path.home(); install=user/'AppData/Local/hermes/hermes-agent'
    roots={'legacy_home':user/'.hermes','platform_home':user/'AppData/Local/hermes'}
    guard_verified=install_write_guard(roots)
    for root in roots.values():
        if args.output.resolve().is_relative_to(root.resolve()):raise SystemExit('Output must be outside protected Hermes roots')
    args.output.mkdir(parents=True,exist_ok=True)
    snapshot=manifest(roots)
    (args.output/'fingerprints_local_only.json').write_text(json.dumps(snapshot,indent=2),encoding='utf-8')
    if args.compare:
        old=json.loads(args.compare.read_text(encoding='utf-8'))
        changes=[k for k in old if k not in snapshot or old[k].get('sha256')!=snapshot[k].get('sha256')]
        out={'baseline_files':len(old),'current_files':len(snapshot),'changed_or_missing':changes,'added':[k for k in snapshot if k not in old],'python_write_guard_self_test_passed':guard_verified}
        (args.output/'fingerprint_comparison.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
        print(json.dumps(out,ensure_ascii=False));return
    facts={'checked_at':datetime.now(timezone.utc).isoformat(),'platform':sys.platform,'protected_fingerprint_file_count':len(snapshot),'python_write_guard_self_test_passed':guard_verified,'roots':{},'install':{}}
    facts['install']['path']='<LOCALAPPDATA>/hermes/hermes-agent'
    facts['install']['git']=git_facts(install,user)
    for filename in ['pyproject.toml','hermes_cli/__init__.py','apps/desktop/package.json']:
        text=read(install/filename)
        match=re.search(r'(?m)^(?:version|__version__)\s*=\s*[\x22\x27]([^\x22\x27]+)',text)
        if filename.endswith('package.json'):
            try: value=json.loads(text).get('version')
            except Exception:value=None
        else:value=match.group(1) if match else None
        facts['install'][filename]={'present':bool(text),'version':value}
    facts['install']['python_metadata']=[p.name for p in (install/'venv/Lib/site-packages').glob('hermes_agent*.dist-info')]
    facts['install']['installed_browser_packages']={}
    for rel in ['node_modules/agent-browser/package.json','node_modules/playwright/package.json','node_modules/playwright-core/package.json','node_modules/@playwright/test/package.json']:
        p=install/rel
        if p.is_file():
            try: facts['install']['installed_browser_packages'][rel]=json.loads(read(p)).get('version')
            except Exception:pass
    facts['install']['old_version_directory_count']=len(list(user.glob('hermes-agent-v*')))
    facts['process_environment']={k:redact(os.environ[k],user) for k in ['HERMES_HOME','HERMES_PROFILE','HERMES_BROWSER_PROVIDER','BROWSER_ENGINE','BROWSER_BACKEND'] if k in os.environ}
    facts['available_audit_libraries']={k:bool(importlib.util.find_spec(k)) for k in ['yaml','psutil','playwright']}
    for alias,root in roots.items():
        info={'exists':root.is_dir(),'path':redact(root,user)}
        if not root.is_dir():facts['roots'][alias]=info;continue
        info['top_level_entries']=[{'name':p.name,'kind':'directory' if p.is_dir() else 'file','bytes':p.stat().st_size if p.is_file() else None} for p in sorted(root.iterdir()) if p.name!='hermes-agent']
        info['config']=config_summary(root/'config.yaml',user)
        info['secrets']={name:{'present':(root/name).is_file(),'bytes':(root/name).stat().st_size if (root/name).is_file() else None} for name in ['.env','auth.json','.env.bak']}
        envtext=read(root/'.env')
        info['env_key_names']=[m.group(1) for m in re.finditer(r'(?m)^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=',envtext)]
        info['memory_files']=[]
        for rel in ['SOUL.md','memories/MEMORY.md','memories/USER.md','MEMORY.md','USER.md']:
            p=root/rel
            if not p.is_file():continue
            s=read(p)
            info['memory_files'].append({'path':rel,'bytes':p.stat().st_size,'characters':len(s),'lines':len(s.splitlines()),'topic_signal_counts':{k:len(re.findall(pattern,s,re.I)) for k,pattern in TOPICS.items()},'possible_secret_patterns_present':bool(re.search(r'(?:sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,})',s))})
        info['skills']=[]
        base=root/'skills'
        if base.is_dir():
            for p in sorted(base.rglob('SKILL.md')):
                s=read(p);rel=p.relative_to(base).as_posix()
                info['skills'].append({'path':rel,'bytes':p.stat().st_size,'topic_signal_counts':{k:len(re.findall(pattern,s,re.I)) for k,pattern in TOPICS.items()},'has_scripts':(p.parent/'scripts').is_dir()})
        info['skill_count']=len(info['skills'])
        for sub in ['plugins','desktop-plugins','tools','scripts','hooks','providers','browser-profiles','profiles','sessions','backups','checkpoints']:
            p=root/sub
            if p.is_dir():
                entries=list(p.iterdir())
                info[sub+'_inventory']={'top_level_count':len(entries),'child_directory_count':sum(x.is_dir() for x in entries),'child_file_count':sum(x.is_file() for x in entries)}
                if sub in ['plugins','desktop-plugins','tools','scripts','hooks','providers','profiles']:
                    info[sub+'_inventory']['names']=[x.name for x in entries]
        jobs=root/'cron/jobs.json'
        if jobs.is_file():
            try:
                jd=json.loads(read(jobs)); jl=jd if isinstance(jd,list) else jd.get('jobs',[])
                if isinstance(jl,dict):jl=list(jl.values())
                info['cron_jobs']={'count':len(jl),'root_keys':list(jd) if isinstance(jd,dict) else None,'jobs':[]}
                for i,j in enumerate(jl):
                    js=json.dumps(j,ensure_ascii=False)
                    info['cron_jobs']['jobs'].append({'audit_alias':'job-'+str(i+1),'enabled':j.get('enabled',j.get('active')),'paused':j.get('paused'),'keys':list(j),'topic_signal_counts':{k:len(re.findall(pattern,js,re.I)) for k,pattern in TOPICS.items()}})
            except Exception as e:info['cron_jobs']={'error':type(e).__name__}
        info['databases']=[]
        for p in root.glob('*.db'):
            db={'name':p.name,'bytes':p.stat().st_size,'wal_present':Path(str(p)+'-wal').exists(),'read_mode':'immutable read-only; live WAL deliberately not read'}
            try:
                conn=sqlite3.connect(p.as_uri()+'?mode=ro&immutable=1',uri=True)
                names=[r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
                db['tables']=names
                db['record_counts']={}
                for name in names:
                    if name in ['sessions','messages','jobs','tasks','projects']:
                        db['record_counts'][name]=conn.execute('SELECT COUNT(*) FROM "'+name+'"').fetchone()[0]
                conn.close()
            except Exception as e:db['error']=type(e).__name__
            info['databases'].append(db)
        facts['roots'][alias]=info
    if facts['available_audit_libraries'].get('psutil'):
        import psutil
        procs=[]
        process_list=list(psutil.process_iter(['pid','name','exe','ppid']))
        related={p.pid for p in process_list if p.pid!=os.getpid() and 'hermes' in str(p.info.get('exe','')).lower()}
        for _ in range(3):
            related.update(p.pid for p in process_list if p.pid!=os.getpid() and p.info.get('ppid') in related)
        for proc in process_list:
            if proc.pid not in related:continue
            item={k:redact(v,user) if isinstance(v,str) else v for k,v in proc.info.items()}
            try:
                env=proc.environ(); item['hermes_environment']={k:redact(env[k],user) for k in ['HERMES_HOME','HERMES_PROFILE','HERMES_BROWSER_PROVIDER','BROWSER_ENGINE','BROWSER_BACKEND'] if k in env}
            except Exception as e:item['environment_read_error']=type(e).__name__
            procs.append(item)
        facts['hermes_processes']=procs
    outpath=args.output/'inventory_sanitized.json'
    outpath.write_text(json.dumps(facts,ensure_ascii=False,indent=2),encoding='utf-8')
    summary={k:v for k,v in facts.items() if k!='roots'}
    summary['roots']={key:{k:v for k,v in val.items() if k not in ['top_level_entries','skills','databases','env_key_names']} for key,val in facts['roots'].items()}
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
