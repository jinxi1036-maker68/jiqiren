"""Fixed local support RPC. No model, shell, arbitrary path or private-memory reader."""
import hashlib,json,sys
from pathlib import Path
# -I deliberately ignores startup hooks; only this pinned owned directory is added.
sys.path.insert(0,str(Path(__file__).resolve().parent))
from safety import ordinary_path,sha256
from company_tasks import TaskStore
from ego_lease import recover_dead_ego_lease

SUPPORT_NAMES=['company_support.py','company_tasks.py','ego_lease.py','safety.py']

def support_config(cfg,root):
    s=cfg.get('employeeSupport',{})
    if (s.get('schema')!='lingju.employee-support.v1' or s.get('ownerApproved') is not True
        or not s.get('approvalReference') or s.get('taskDatabase')!=str(root/'private-state/company-tasks.sqlite')
        or s.get('python')!=str(Path.home()/'AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe')
        or set(s.get('sourceSha256',{}))!=set(SUPPORT_NAMES)):
        raise ValueError('Explicit same-employee support grant required')
    for name,digest in s['sourceSha256'].items():
        if sha256(ordinary_path(root/name))!=digest:raise ValueError('Support source changed')
    ordinary_path(s['taskDatabase'],allow_missing=True)
    return s

def knowledge(cfg,args):
    w=ordinary_path(cfg['workspace']);mf=ordinary_path(w/'SNAPSHOT_MANIFEST.json')
    doc=json.loads(mf.read_text('utf-8'));entries={e['path']:e['sha256'] for e in doc['files']}
    entries['HERMES.md']=doc['protected_HERMES_sha256']
    base={'release':doc['release_id'],'manifest_sha256':sha256(mf),'count':len(doc['files']),
          'authority':'Deployed snapshot; later GitHub changes are not implicitly deployed'}
    if args['action']=='list':return {**base,'files':sorted(entries)}
    name=args.get('path')
    if name not in entries:raise ValueError('Only exact deployed company knowledge paths allowed; MEMORY/USER/private files excluded')
    p=ordinary_path(w/name)
    if w not in p.parents or sha256(p)!=entries[name]:raise ValueError('Knowledge path or deployed hash differs')
    raw=p.read_text('utf-8');offset=args.get('offset',0);limit=args.get('limit',12000)
    if not isinstance(offset,int) or isinstance(offset,bool) or offset<0 or not isinstance(limit,int) or isinstance(limit,bool) or not 1<=limit<=20000:raise ValueError('Invalid read range')
    return {**base,'path':name,'sha256':entries[name],'offset':offset,'total_characters':len(raw),
            'text':raw[offset:offset+limit],'more':offset+limit<len(raw)}

def dispatch(cfg,root,request):
    s=support_config(cfg,root);op=request['op'];args=request.get('args',{})
    if op=='lease':return {'released_proven_dead_lease':recover_dead_ego_lease(Path(request['runtime']),root)}
    store=TaskStore(s['taskDatabase'])
    if op=='event':return store.browser_event(**args)
    if op=='notes':
        # Reads are allowed only in the same authorized native turn as writes.
        with store.connection() as c:store._active(c)
        if args['action']=='list':return {'tasks':store.list(),'basis':'Private operational notes; completion items are Agent reports, not independently verified business facts'}
        if args['action']=='read':return store.read(args['task_id'])
        if args['action']=='checkpoint':return store.checkpoint(args)
    if op=='knowledge':
        with store.connection() as c:store._active(c)
        return knowledge(cfg,args)
    raise ValueError('Unknown fixed support operation')

if __name__=='__main__':
    sys.stdin.reconfigure(encoding='utf-8');sys.stdout.reconfigure(encoding='utf-8')
    try:
        runtime=ordinary_path(sys.argv[1]);root=ordinary_path(Path(__file__).parent)
        if root!=Path.home()/'.hermes/tools/company-browser' or root/'runs' not in runtime.parents:raise ValueError('Original owned runtime required')
        cfg=json.loads(runtime.read_text('utf-8'))
        if cfg['toolRoot']!=str(root) or cfg['workspace']!=str(Path.home()/'.hermes/company-workspace'):raise ValueError('Original company workspace required')
        request=json.loads(sys.stdin.read(65537))
        result=dispatch(cfg,root,{**request,'runtime':str(runtime)})
        print(json.dumps({'ok':True,'result':result},ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({'ok':False,'error':type(exc).__name__,'detail':str(exc)[:400]},ensure_ascii=False));sys.exit(1)
