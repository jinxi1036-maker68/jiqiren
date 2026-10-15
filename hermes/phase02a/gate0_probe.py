"""Exploratory Phase 02A metadata probe; no Hermes import or secret output.

Historical insertion-only search below is not the authoritative drift result.
A negative insertion search does not identify the change or its writer.
Use protected_state.py drift and GATE_0.json for the exact backup comparison.
"""
from pathlib import Path
import hashlib, json, os, datetime, importlib.metadata, collections
import psutil, yaml

root=Path.home()/'.hermes'
out=Path(__file__).parent/'private'
out.mkdir(parents=True,exist_ok=True)
before_sha='a22351cd8b964eaac8db75d220c9f8a01b9af1ea0ea9802d4e8a99bc44b8423b'
phase1_after='d9a6fd4cf0c87cf6cd6d4c118138e19fad2af7d6c668c510acdfeafb0979c0f9'
p=root/'config.yaml'; b=p.read_bytes(); current=hashlib.sha256(b).hexdigest(); st=p.stat()
drift={'current_sha256':current,'bytes':len(b),'mtime_utc':datetime.datetime.fromtimestamp(st.st_mtime,datetime.timezone.utc).isoformat(),'matches_phase1_after':current==phase1_after,'yaml_valid':isinstance(yaml.safe_load(b),dict),'writer_attribution':'unknown; no historical per-process file-write trace collected'}
if current==phase1_after and len(b)==49710:
    matches=[]
    for i in range(len(b)):
        candidate=b[:i]+b[i+1:]
        if hashlib.sha256(candidate).hexdigest()==before_sha:
            old=yaml.safe_load(candidate);new=yaml.safe_load(b)
            def diff(a,c,path=''):
                if isinstance(a,dict) and isinstance(c,dict):
                    result=[]
                    for k in set(a)|set(c):result.extend(diff(a.get(k),c.get(k),path+'/'+str(k)))
                    return result
                return [] if a==c else [path]
            matches.append({'offset_zero_based':i,'line_number':b[:i].count(b'\n')+1,'inserted_byte_class':'whitespace' if b[i:i+1].isspace() else 'non-whitespace (value not disclosed)','config_value_paths_changed':diff(old,new),'parsed_yaml_equal':old==new})
    drift['single_byte_insertion_proof']={'matched_candidate_count':len(matches),'matches':matches[:8],'before_hash_reconstructed':bool(matches)}
(out/'drift_probe_sanitized.json').write_text(json.dumps(drift,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'drift':drift},ensure_ascii=False),flush=True)

data_roots={
 'active_home':root,
 'platform_home':Path.home()/'AppData/Local/hermes',
 'legacy_browser_debug':Path.home()/'.hermes-chrome-debug',
 'legacy_browser_check':Path.home()/'.HermesBrowserCheck',
 'desktop_preferences':Path.home()/'AppData/Roaming/Hermes',
}
excluded_dirs={'node_modules','__pycache__','Cache','Code Cache','GPUCache','DawnGraphiteCache','DawnWebGPUCache','GrShaderCache','ShaderCache','Crashpad','cache','audio_cache','image_cache','backups','.curator_backups','windows-staging-home','tuoguan-data-staging'}
plan={'scope':{},'files':[],'excluded_regenerable_dirs':sorted(excluded_dirs),'installation_source_excluded':True}
for alias,base in data_roots.items():
    info={'exists':base.is_dir(),'file_count':0,'total_bytes':0,'unreadable_count':0,'unreadable_aliases':[],'sqlite_file_count':0}
    if base.is_dir():
        for dirpath,dirs,names in os.walk(base,followlinks=False):
            dirs[:]=[d for d in dirs if d not in excluded_dirs and not (alias=='platform_home' and Path(dirpath)==base and d=='hermes-agent')]
            for name in names:
                f=Path(dirpath)/name
                if f.is_symlink() or not f.is_file() or name.endswith(('.lock','-shm','-wal')) or name in ['LOCK','SingletonLock','SingletonCookie','SingletonSocket','ticker_heartbeat','ticker_last_success']:continue
                try:
                    size=f.stat().st_size
                    # Metadata scan only. Special files/IPC are never opened.
                    sqlite=f.suffix.lower() in ['.db','.sqlite','.sqlite3'] or name in ['Cookies','History','Login Data','Web Data','Favicons']
                    info['file_count']+=1;info['total_bytes']+=size;info['sqlite_file_count']+=int(sqlite)
                    plan['files'].append({'scope':alias,'relative':f.relative_to(base).as_posix(),'source':str(f),'bytes':size,'sqlite':sqlite})
                except (OSError,PermissionError):
                    info['unreadable_count']+=1
                    # Relative filenames are local-only; report counts only.
                    info['unreadable_aliases'].append(f.relative_to(base).as_posix())
    plan['scope'][alias]=info
    print(json.dumps({'scope':alias,'file_count':info['file_count'],'bytes':info['total_bytes']},ensure_ascii=False),flush=True)
processes=[]
for process in psutil.process_iter(['pid','ppid','name','exe']):
    if 'hermes' not in str(process.info.get('exe','')).lower() or process.pid==os.getpid():continue
    try:
        env=process.environ(); active=env.get('HERMES_HOME')
        processes.append({'name':process.info['name'],'active_home_matches':bool(active and Path(active).resolve()==root.resolve())})
    except (psutil.AccessDenied,psutil.NoSuchProcess):processes.append({'name':process.info['name'],'environment_unavailable':True})
result={'checked_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'drift':drift,'active_process_environment':processes,'backup_plan_summary':{k:{x:v for x,v in val.items() if x!='unreadable_aliases'} for k,val in plan['scope'].items()},'libraries':{}}
for name in ['cryptography','PyYAML','psutil']:
    try:result['libraries'][name]=importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:result['libraries'][name]=None
(out/'backup_plan_local_only.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'gate0_probe_sanitized.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
