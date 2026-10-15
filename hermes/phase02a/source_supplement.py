"""Record installed Git identity and preserve non-ignored local source additions.
Tracked source is unchanged and recoverable by pinned commit; no venv copy.
"""
from pathlib import Path
import subprocess,os,json,sys

private=Path(sys.argv[1]).resolve();folder=private/'source-supplement';folder.mkdir(exist_ok=False)
source=Path.home()/'AppData/Local/hermes/hermes-agent'
env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
def git(*args):return subprocess.check_output(['git','-C',str(source),*args],env=env)
head=git('rev-parse','HEAD').decode().strip()
tracked=git('diff','--name-only','HEAD','-z').decode().strip('\0').split('\0')
if any(tracked):raise RuntimeError('Tracked original source has changes; preserve and review before continuing')
files=[x for x in git('ls-files','--others','--exclude-standard','-z').decode().split('\0') if x]
metadata=folder/'installed-source-local-only.json';metadata.write_text(json.dumps({'head':head,'tracked_changes':0,'untracked_files':files},indent=2),encoding='utf-8')
rows=[]
for name in files:
    p=(source/name).resolve()
    if not p.is_relative_to(source.resolve()) or p.is_symlink():raise ValueError('Unsafe source file')
    rows.append({'scope':'installation_custom','relative':name,'source':str(p),'bytes':p.stat().st_size})
rows.append({'scope':'installation_metadata','relative':metadata.name,'source':str(metadata),'bytes':metadata.stat().st_size})
(folder/'backup_plan_local_only.json').write_text(json.dumps({'files':rows}),encoding='utf-8')
print(json.dumps({'source_head':head,'tracked_changes':0,'custom_files_preserved':len(files),'custom_bytes':sum(x['bytes'] for x in rows)}))
