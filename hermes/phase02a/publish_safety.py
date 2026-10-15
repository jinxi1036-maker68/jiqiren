"""Scan an explicit publication directory; never return secret values."""
from pathlib import Path
import argparse,json,re
import yaml
from dotenv import dotenv_values

def secret_values():
    root=Path.home()/'.hermes';found=set()
    for k,v in dotenv_values(root/'.env').items():
        if re.search(r'(?i)key|token|secret|password|credential|cookie|auth',k) and isinstance(v,str) and len(v)>=8:found.add(v)
    def walk(v):
        if isinstance(v,dict):
            for k,x in v.items():
                if any(y in str(k).lower() for y in ['api_key','token','password','secret']) and isinstance(x,str) and len(x)>=8:found.add(x)
                else:walk(x)
        elif isinstance(v,list):
            for x in v:walk(x)
    walk(yaml.safe_load((root/'config.yaml').read_text(encoding='utf-8')))
    return found

def scan(folder):
    known=secret_values();findings=[];count=0
    forbidden=re.compile(r'(?i)(?:gh[pousr]_[a-z0-9]{25,}|github_pat_[a-z0-9_]{25,}|sk-[a-z0-9_-]{25,}|Bearer\s+[a-z0-9_.-]{25,}|C:[\\/]Users[\\/]Administrator)')
    for f in folder.rglob('*'):
        if not f.is_file():continue
        count+=1
        if f.suffix.lower() in ['.db','.enc','.mp4','.sqlite','.xlsx','.png'] or f.name.startswith('.env') or 'private' in f.relative_to(folder).parts:
            findings.append({'file':f.relative_to(folder).as_posix(),'reason':'prohibited artifact type/path'});continue
        value=f.read_text(encoding='utf-8')
        if any(s in value for s in known) or forbidden.search(value):findings.append({'file':f.relative_to(folder).as_posix(),'reason':'known local secret, token pattern, or full local user path'})
    return {'passed':not findings,'files_scanned':count,'known_secret_values_checked_without_disclosure':len(known),'findings':findings,'limits':'Credential-like fields from local .env/config and token/path patterns; non-secret policy enums are not treated as keys. Not a proof against every possible sensitive string. Publication is additionally an explicit allowlist of synthetic evidence, code and redacted docs.'}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('folder',type=Path);a=p.parse_args();r=scan(a.folder);print(json.dumps(r,ensure_ascii=False));raise SystemExit(0 if r['passed'] else 1)
