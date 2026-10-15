"""Private fingerprints of original configuration/memory/jobs; output booleans only."""
from pathlib import Path
import argparse,hashlib,json,datetime
import yaml

def state():
    roots={'active':Path.home()/'.hermes','platform':Path.home()/'AppData/Local/hermes'}
    result={}
    for alias,root in roots.items():
        for relative in ['config.yaml','.env','SOUL.md','active_profile','memories/MEMORY.md','memories/USER.md','cron/jobs.json']:
            p=root/relative;result[alias+'/'+relative]=hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
        for dirname in ['memories','skills']:
            folder=root/dirname
            if folder.is_dir():
                for p in folder.rglob('*'):
                    if p.is_file() and not p.is_symlink():result[alias+'/'+p.relative_to(root).as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
    return result

def drift(private):
    current=Path.home()/'.hermes/config.yaml'
    old=current.parent/'backups/config/config.yaml.good.20261015-224956'
    expected='a22351cd8b964eaac8db75d220c9f8a01b9af1ea0ea9802d4e8a99bc44b8423b'
    before=old.read_bytes();after=current.read_bytes()
    if hashlib.sha256(before).hexdigest()!=expected:raise ValueError('Old backup hash does not match Phase 01 baseline')
    differences=[]
    def compare(a,b,path=''):
        if isinstance(a,dict) and isinstance(b,dict):
            for k in set(a)|set(b):compare(a.get(k),b.get(k),path+'/'+str(k))
        elif a!=b:
            differences.append({'path':path,'before':a if path=='/voice/auto_tts' else '<redacted>','after':b if path=='/voice/auto_tts' else '<redacted>'})
    compare(yaml.safe_load(before),yaml.safe_load(after))
    result={'baseline_sha256':expected,'baseline_bytes':len(before),'current_sha256':hashlib.sha256(after).hexdigest(),'current_bytes':len(after),'current_mtime_utc':datetime.datetime.fromtimestamp(current.stat().st_mtime,datetime.timezone.utc).isoformat(),'exact_baseline_backup_found':True,'yaml_valid':True,'parsed_differences':differences,'net_byte_delta':len(after)-len(before),'writer_attribution':'Unknown: no historical per-process write event trace. Desktop voice preferences source can write this field, which is not proof of who wrote it.','original_config_restored_or_rewritten':False}
    (private/'drift_confirmed_sanitized.json').write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8');return result

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('action',choices=['before','after','drift']);p.add_argument('private',type=Path);a=p.parse_args()
    if a.action=='drift':print(json.dumps(drift(a.private),ensure_ascii=False))
    elif a.action=='before':
        result=state();(a.private/'protected_hashes_local_only.json').write_text(json.dumps(result),encoding='utf-8');print(json.dumps({'fingerprinted_files':len(result)}))
    else:
        before=json.loads((a.private/'protected_hashes_local_only.json').read_text());after=state();changed=[k for k in before.keys()|after.keys() if before.get(k)!=after.get(k)]
        result={'files_compared':len(before),'unchanged':not changed,'changed_count':len(changed),'changed_categories':list(set('/'.join(k.split('/')[:2]) for k in changed))}
        (a.private/'original_protection_sanitized.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
