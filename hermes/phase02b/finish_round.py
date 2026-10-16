"""Withdraw only the temporary new-profile credential and compare preserved state."""
from pathlib import Path
import argparse,json,hashlib,datetime,os,sys
import yaml,psutil
from dotenv import dotenv_values

def finish(private,previous):
    private=private.resolve();r=json.loads((private/'runtime-local/runtime.json').read_text(encoding='utf-8'));runtime_arg=str((private/'runtime-local/runtime.json').resolve()).lower()
    active=[]
    for process in psutil.process_iter(['pid','cmdline']):
        try:
            args=process.info['cmdline'] or []
            if process.pid!=os.getpid() and any(str(x).lower()==runtime_arg for x in args) and any(str(x).endswith(('agent_session.py','entry.py','run_sessions.py','native_smoke.py')) for x in args):active.append(process.pid)
        except (psutil.AccessDenied,psutil.NoSuchProcess):pass
    if active:raise RuntimeError('Own tests are still active; do not finalize yet')
    root=Path(r['profile']);original=Path.home()/'.hermes';c=yaml.safe_load((original/'config.yaml').read_text(encoding='utf-8'));provider=next(p for p in c['custom_providers'] if p['name']=='Agnes.ai');values=dotenv_values(original/'.env');key=values.get(provider.get('key_env') or provider.get('api_key_env')) or provider.get('api_key')
    (root/'.env').write_text('# Phase02B temporary model credential withdrawn after the approved simulation round.\n# Future model use requires separate Owner authorization.\n',encoding='utf-8')
    authorization=Path(r['authorization']);a=json.loads(authorization.read_text(encoding='utf-8'));a['active']=False;a['ended_at_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat();authorization.write_text(json.dumps(a,ensure_ascii=False,indent=2),encoding='utf-8')
    hits=[];unreadable=0;checked=0
    for p in Path(r['profile']).parent.parent.rglob('*'):
        if p.is_file() and not p.is_symlink():
            try:
                checked+=1
                if key and key.encode() in p.read_bytes():hits.append(p.name)
            except OSError:unreadable+=1
    old=previous.resolve()/'runtime-local/profiles/data-ops';before=json.loads((private/'phase02a_hashes_local_only.json').read_text());after={f:hashlib.sha256((old/f).read_bytes()).hexdigest() for f in before}
    memory_unchanged=all((root/'memories'/f).read_bytes()==(old/'memories'/f).read_bytes() for f in ['MEMORY.md','USER.md'])
    result={'credential_withdrawn':True,'authorization_active':False,'files_scanned_for_exact_authorized_key':checked,'unreadable_files':unreadable,'remaining_exact_key_matches':len(hits),'new_env_has_model_credentials':bool(dotenv_values(root/'.env')),'phase02a_selected_files_checked':len(before),'phase02a_unchanged':before==after,'new_profile_minimal_memory_preserved':memory_unchanged,'own_active_test_processes':len(active),'finished_at_utc':a['ended_at_utc']}
    (private/'CLEANUP_sanitized.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result))
    if hits or unreadable or before!=after or not memory_unchanged:raise RuntimeError('Review cleanup/protection exception before reporting completion')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('private',type=Path);p.add_argument('--previous-private',type=Path,required=True);a=p.parse_args();finish(a.private,a.previous_private)
