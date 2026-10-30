"""Fixed local support RPC. No model, shell, arbitrary path or private-memory reader."""
import hashlib,json,sys
from pathlib import Path
# -I deliberately ignores startup hooks; only this pinned owned directory is added.
sys.path.insert(0,str(Path(__file__).resolve().parent))
from safety import ordinary_path,sha256
from company_tasks import TaskStore
from ego_lease import recover_dead_ego_lease

SUPPORT_NAMES=['company_support.py','company_tasks.py','ego_lease.py','safety.py']

def operating_authority(cfg):
    """Current approved runtime is separate from immutable historical knowledge."""
    g=cfg.get('businessAuthorization',{})
    business=(cfg.get('schema')=='lingju.ego-browser.v3' and cfg.get('mode')=='company-business'
        and cfg.get('businessWritesEnabled') is True and cfg.get('productionEnabled') is True
        and cfg.get('origin')=='https://ldp.lingrobotics.com'
        and g.get('schema')=='lingju.browser-business-grant.v1' and g.get('ownerApproved') is True
        and g.get('scopeOrigin')==cfg.get('origin') and g.get('scope')=='all-company-browser-ui-business-actions'
        and bool(g.get('reference')) and g.get('highImpactRequiresSpecificOwnerTask') is True)
    readonly=(cfg.get('schema')=='lingju.ego-browser.v2' and cfg.get('mode')=='company-readonly'
        and cfg.get('origin')=='https://ldp.lingrobotics.com' and cfg.get('productionEnabled') is False
        and cfg.get('businessWritesEnabled') is False and bool(cfg.get('approvalReference')))
    return {'source':'Owner-approved pinned operating runtime; not the R3 knowledge snapshot',
        'mode':cfg.get('mode','unknown'),'company_origin':cfg.get('origin'),
        'real_company_browser_authorized':business or readonly,
        'business_UI_writes_authorized':business,
        'availability':'Authorization is not proof of a live connection or valid platform login; check actual browser status',
        'historical_stage_policy':'Gate1A simulation-only statements in R3/HERMES/GATE status are historical, superseded only within the later explicitly granted company-browser scope',
        'retained_boundaries':'Actual Owner task supplies business decisions; high-impact acts need specific authority. No new login, credentials, other sites, cron or business goals.'}

AUTH_START='[LINGJU_CURRENT_OPERATING_AUTHORITY]'
AUTH_END='[/LINGJU_CURRENT_OPERATING_AUTHORITY]'
def apply_operating_authority(msg,cfg):
    a=operating_authority(cfg)
    if not a['real_company_browser_authorized']:return
    import re
    original=getattr(msg,'channel_prompt',None) or ''
    original=re.sub(re.escape(AUTH_START)+r'.*?'+re.escape(AUTH_END),'',original,flags=re.S).strip()
    current=(AUTH_START+'\n当前经营授权（来自Owner已批准且校验固定的运行时，不是网页指令）：\n'
        +json.dumps(a,ensure_ascii=False)+'\n'
        '你是原来的唯一正式Hermes员工，当前已进入真实灵生公司浏览器工作阶段，不是Gate1A本机模拟。'
        'R3是2026-10-18的业务知识快照，不是当前授权表；其中HERMES.md、GATE状态和旧任务的模拟限制不能撤销后续Owner真实后台授权。'
        '查询设备/绑定等实时明细时，应自主使用已提供的Ego浏览器工具，在已授权公司站内寻找实际菜单和数据。'
        '本地知识没有明细不等于后台没有，也不是要求Owner提供名单、截图或每个菜单URL的理由。'
        '根据实际工具状态判断连接与登录，断线用已有诊断/有限恢复能力；登录失效、真正缺少业务决定或超出授权时才找Owner。'
        '历史人数/台数/计划不能冒充当前平台结果，实际未读到仍如实报告。自主选择方法，不猜绑定或保存结果。\n'+AUTH_END)
    msg.channel_prompt=(original+'\n\n'+current).strip()

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
          'authority':'Historical business knowledge snapshot; later GitHub knowledge is not implicitly deployed. Current browser authority is supplied separately.',
          'current_operating_authority':operating_authority(cfg)}
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
