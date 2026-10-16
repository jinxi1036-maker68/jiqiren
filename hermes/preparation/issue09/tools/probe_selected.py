"""Approved, bounded read-only preparation. Never imports or starts Hermes.

Only the three named identity files, one config/job definition, 12 candidate
Skill directories (metadata), 17 candidate scripts and related process paths.
No credential file, browser storage, session body or bulk memory scan.
"""
from pathlib import Path
import argparse,datetime,hashlib,json,os,re,sys,sqlite3
import yaml,psutil

BASE=Path(__file__).resolve().parent
PRIVATE=BASE/'private'
H=Path.home()/'.hermes'; P=Path.home()/'AppData/Local/hermes'; I=P/'hermes-agent'
PROTECTED=[H.resolve(),P.resolve(),(Path.home()/'AppData/Roaming/Hermes').resolve()]
def guard(event,args):
    values=[]
    if event=='open':
        target,mode,flags=args
        if (isinstance(mode,str) and any(c in mode for c in 'wax+')) or (isinstance(flags,int) and flags & (os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC)):values=[target]
    elif event in ['os.remove','os.rmdir','os.mkdir','os.rename','os.chmod','os.utime']:values=args[:2] if event=='os.rename' else args[:1]
    for value in values:
        if isinstance(value,(str,bytes,os.PathLike)) and any(Path(os.fsdecode(value)).resolve().is_relative_to(p) for p in PROTECTED):raise PermissionError('Original Hermes write denied')
sys.addaudithook(guard)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
def alias(value):
    s=str(value)
    for old,new in [(str(BASE.parent.parent.parent),'<CODEX_WORKSPACE>'),(str(Path.home()),'<USER_HOME>')]:
        s=s.replace(old,new).replace(old.replace('\\','/'),new)
    return s
def safe_text(value):
    s=alias(value)
    s=re.sub(r'(?i)([?&](?:token|key|auth|secret|password)[^=\s]*=)[^&\s]+',r'\1<REDACTED>',s)
    s=re.sub(r'(?i)((?:--?|/)(?:token|password|secret|api-key)\s+)[^\s]+',r'\1<REDACTED>',s)
    s=re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b','<EMAIL>',s)
    s=re.sub(r'(?<!\d)1[3-9]\d{9}(?!\d)','<PHONE>',s)
    s=re.sub(r'(?i)(?:sk-[a-z0-9_-]{20,}|gh[pousr]_[a-z0-9]{20,}|github_pat_[a-z0-9_]{20,}|Bearer\s+[^\s]+)','<SECRET>',s)
    return s
def topics(text):
    patterns={'old_marketplace':'闲鱼|xianyu|淘宝|1688|电商','old_tuoguan':'托管|tuoguan|暑托|学员|家长','company_robot_data':'灵生|数采|数据采集|EGO|livsyn|lingrobotics','general_method_or_preference':'中文|偏好|自主|确认|权限|证据|核实|工作方法|汇报'}
    return [key for key,pat in patterns.items() if re.search(pat,text,re.I)]
def entries(path):
    lines=path.read_text(encoding='utf-8-sig').splitlines();blocks=[];start=None;buf=[]
    for n,line in enumerate(lines+[''],1):
        if line.strip() and line.strip()!='§':
            if start is None:start=n
            buf.append(line)
        elif buf:
            value='\n'.join(buf);blocks.append({'entry_id':f'{path.stem}-{len(blocks)+1:03}','start_line':start,'end_line':n-1,'characters':len(value),'topics':topics(value),'private_content_sha256':hashlib.sha256(value.encode()).hexdigest(),'body_not_exported':True});buf=[];start=None
    return {'path':alias(path),'sha256':digest(path),'bytes':path.stat().st_size,'characters':len('\n'.join(lines)),'entries':blocks}
def build():
    old_matrix=json.loads((BASE.parent/'hermes_issue09_gate0_publication/hermes/plans/issue09_gate0/CHANGE_CLEANUP_MATRIX.json').read_text(encoding='utf-8'))
    selected_skills=next(x for x in old_matrix['rows'] if x['id']=='M11')['targets']
    selected_scripts=next(x for x in old_matrix['rows'] if x['id']=='M21')['targets']
    identity=[H/'SOUL.md',H/'memories/MEMORY.md',H/'memories/USER.md']
    watched=identity+[H/'config.yaml',H/'cron/jobs.json',H/'tools/xianyu-browser-tools/package.json',H/'tools/xianyu-browser-tools/node_modules/@modelcontextprotocol/sdk/package.json']
    skills=[]
    for target in selected_skills:
        path=H/target.removeprefix('H/');desc=[]
        if path.exists() and not path.is_symlink():
            for p in path.rglob('*'):
                if p.is_file() and not p.is_symlink():desc.append({'path':alias(p),'bytes':p.stat().st_size})
                if len(desc)>=256:break
        skill=path/'SKILL.md';watched.append(skill)
        skills.append({'target':target,'exists':path.exists(),'is_symlink':path.is_symlink(),'files':desc,'expansion_truncated':len(desc)>=256,'ownership':'candidate_only_not_decided'})
    scripts=[]
    for target in selected_scripts:
        path=H/target.removeprefix('H/');watched.append(path)
        text=path.read_text(encoding='utf-8-sig',errors='replace') if path.is_file() else ''
        scripts.append({'target':target,'exists':path.is_file(),'sha256':digest(path),'topics':topics(text),'referenced_selected_script_names':[Path(x).name for x in selected_scripts if Path(x).name in text and Path(x).name!=path.name]})
    config=yaml.safe_load((H/'config.yaml').read_text(encoding='utf-8'))
    jobs=json.loads((H/'cron/jobs.json').read_text(encoding='utf-8')).get('jobs',[])
    cron=[]
    for job in jobs:
        # The inherited audit established exactly one job; do not broaden scope.
        if len(jobs)!=1:raise RuntimeError('Cron set changed: review scope before reading new jobs')
        private={k:job.get(k) for k in ['id','name','prompt','schedule','schedule_display','script','monitor_script','workdir','skills','skill','enabled','deliver','enabled_toolsets','context_from']}
        (PRIVATE/'cron_selected_local_only.json').write_text(json.dumps(private,ensure_ascii=False,indent=2),encoding='utf-8')
        cron.append({'id':job.get('id'),'enabled':job.get('enabled'),'schedule':job.get('schedule'),'schedule_display':job.get('schedule_display'),'prompt_topics':topics(job.get('prompt','')),'prompt_characters':len(job.get('prompt','')),'script':safe_text(job.get('script')),'monitor_script':safe_text(job.get('monitor_script')),'workdir':safe_text(job.get('workdir')),'skills':job.get('skills'),'skill':job.get('skill'),'enabled_toolsets':job.get('enabled_toolsets'),'context_from':job.get('context_from'),'delivery_value_not_published':True,'delivery_shape':type(job.get('deliver')).__name__})
    mcp={}
    for name,item in config.get('mcp_servers',{}).items():
        mcp[name]={'command':safe_text(item.get('command')),'args':[safe_text(x) for x in item.get('args',[])],'env_key_names':list((item.get('env') or {}).keys()),'trust':item.get('trust'),'enabled':item.get('enabled')}
    fields={}
    paths=['terminal.cwd','terminal.backend','terminal.persistent_shell','memory.memory_enabled','memory.user_profile_enabled','memory.memory_char_limit','memory.user_char_limit','tools.tool_search.enabled','display.interface','security.redact_secrets','security.allow_lazy_installs','auxiliary.background_review.enabled','context_file_max_chars','model.context_length']
    for key in paths:
        value=config
        for part in key.split('.'):value=value.get(part) if isinstance(value,dict) else None
        fields[key]=safe_text(value) if isinstance(value,str) else value
    processes=[]
    for proc in psutil.process_iter(['pid','name','exe']):
        if proc.pid==os.getpid():continue
        try:
            exe=proc.info['exe'] or '';name=(proc.info['name'] or '').lower()
            if name=='hermes.exe' or (name.startswith('python') and str(I).lower() in exe.lower()):
                cmd=proc.cmdline()
                if name.startswith('python') and not any('hermes_cli' in x or 'hermes'==x for x in cmd):continue
                env=proc.environ();processes.append({'pid':proc.pid,'exe':alias(exe),'cwd':alias(proc.cwd()),'home_and_cwd_env':{k:alias(env[k]) for k in ['HERMES_HOME','HERMES_CWD','TERMINAL_CWD'] if k in env},'command_flags':[x for x in cmd if x.startswith('--') and '=' not in x],'renderer':any('--type=renderer' in x for x in cmd)})
        except (psutil.AccessDenied,psutil.NoSuchProcess):pass
    snapshot={'checked_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'approved preparation only; 3 identity files, 1 config/job definition, 12 selected Skill directories metadata, 17 selected scripts, known processes','identity_entry_metadata':[entries(p) for p in identity],'selected_fields':fields,'mcp':mcp,'cron':cron,'selected_skill_candidates':skills,'selected_script_candidates':scripts,'process_paths':processes,'original_credential_files_read':False,'old_session_or_browser_body_read':False}
    (PRIVATE/'selected_probe_local_only.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2),encoding='utf-8')
    fingerprints={str(p):digest(p) for p in watched}
    (PRIVATE/'watched_hashes_local_only.json').write_text(json.dumps(fingerprints),encoding='utf-8')
    print(json.dumps({'selected_identity_metadata':snapshot['identity_entry_metadata'],'fields':fields,'mcp':mcp,'cron':cron,'selected_skill_files':sum(len(x['files']) for x in skills),'selected_scripts':len(scripts),'process_paths':processes,'watched_files':len(watched)},ensure_ascii=False))
def after():
    before=json.loads((PRIVATE/'watched_hashes_local_only.json').read_text(encoding='utf-8'));changed=[alias(p) for p,value in before.items() if digest(Path(p))!=value]
    result={'selected_files_compared':len(before),'unchanged':not changed,'changed':changed,'scope':'selected approved preparation targets, not a full audit'}
    (PRIVATE/'protection_sanitized.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('mode',choices=['before','after','entries']);a=p.parse_args()
    if a.mode=='before':build()
    elif a.mode=='after':after()
    else:
        file=PRIVATE/'selected_probe_local_only.json';j=json.loads(file.read_text(encoding='utf-8'));j['identity_entry_metadata']=[entries(H/p) for p in ['SOUL.md','memories/MEMORY.md','memories/USER.md']];file.write_text(json.dumps(j,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({x['path']:len(x['entries']) for x in j['identity_entry_metadata']},ensure_ascii=False))
