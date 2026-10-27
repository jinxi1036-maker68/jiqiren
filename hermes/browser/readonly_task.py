"""Finite first-page teaching grant, distinct from every historical simulation."""
import json
from pathlib import Path
import sqlite3
import contextlib
import sys
from urllib.parse import urlsplit

sys.path.insert(0,str(Path(__file__).resolve().parent))
from safety import ordinary_path,sha256
from qq_browser_task import BrowserExercise,FEISHU_TRANSFER
from qq_runtime import Intake,acceptance_thread_id,verify_unused_thread
from request_budget import RequestBudget,RequestAudit
from feishu_session_fence import SessionFence

KIND='livsyn-readonly-first-page'
CONTINUOUS_KIND='livsyn-readonly-daily'
PREFIX='【灵生只读带教R1】'
ORIGIN='https://ldp.lingrobotics.com'
READ_TOOLS={'browser_snapshot','browser_take_screenshot','browser_tabs','browser_wait_for'}


def validate_continuous_grant(g):
    if (g.get('kind')!=CONTINUOUS_KIND or g.get('channel')!='feishu'
            or g.get('channel_transfer_authorization')!=FEISHU_TRANSFER
            or g.get('request_limit') is not None or g.get('task_limit') is not None
            or g.get('Owner_removed_test_quotas') is not True
            or g.get('origin')!=ORIGIN or g.get('paths')!=['/statistics']
            or g.get('zero_model_checks_passed') is not True
            or not isinstance(g.get('approval_reference'),str) or not g['approval_reference'].strip()):
        raise RuntimeError('Explicit removal of artificial test quotas required; business scope is unchanged')


def validate_readonly_grant(g):
    if (g.get('kind')!=KIND or g.get('channel')!='feishu'
            or g.get('channel_transfer_authorization')!=FEISHU_TRANSFER
            or type(g.get('request_limit')) is not int or g.get('request_limit')!=30
            or type(g.get('task_limit')) is not int or g.get('task_limit')!=1
            or g.get('message_prefix')!=PREFIX or g.get('origin')!=ORIGIN
            or g.get('paths')!=['/statistics'] or g.get('Owner_model_and_reload_approved') is not True
            or not isinstance(g.get('approval_reference'),str) or not g['approval_reference'].strip()
            or g.get('zero_model_checks_passed') is not True):
        raise RuntimeError('Fresh explicit30/1 first-page authorization required; login is not model authorization')


def validate_readonly_runtime(path,root,*,live=False,require_ready=True):
    root=ordinary_path(root);path=ordinary_path(path)
    if root/'runs' not in path.parents:raise RuntimeError('Read-only runtime outside owned runs')
    r=json.loads(path.read_text('utf-8'))
    if (r.get('schema')!='lingju.readonly-browser.v1' or r.get('toolRoot')!=str(root)
            or r.get('origin')!=ORIGIN or r.get('paths')!=['/statistics']):raise RuntimeError('Read-only scope differs')
    prep=ordinary_path(r['preparation'])
    if root/'work-entry' not in prep.parents or not prep.parent.name.startswith('owner-training-'):
        raise RuntimeError('Not the owned Owner-operated training browser')
    p=json.loads(prep.read_text('utf-8'))
    if (p.get('kind')!='lingju.readonly-teaching.preparation.v1'
            or p.get('origin')!=ORIGIN or p.get('paths')!=['/statistics']
            or ordinary_path(p['profile'])!=prep.parent/'chrome-profile'):
        raise RuntimeError('Owned browser preparation identity differs')
    if require_ready and (r.get('owner_login_confirmed') is not True
                          or p.get('closed_at') or p.get('owner_login_confirmed') is not True):
        raise RuntimeError('Owner browser/login proof is not current')
    cdp=urlsplit(p['cdp'])
    if cdp.scheme!='http' or cdp.hostname!='127.0.0.1' or not cdp.port or cdp.path or cdp.query or cdp.fragment or cdp.username or cdp.password:
        raise RuntimeError('Only the private loopback CDP endpoint is allowed')
    if ordinary_path(r['browserOutput'])!=prep.parent/'teaching-output':raise RuntimeError('Private output path differs')
    if live:
        import psutil
        pr=psutil.Process(p['chrome_pid'])
        if not pr.is_running() or '--user-data-dir='+p['profile'] not in pr.cmdline():
            raise RuntimeError('Owned browser process is not verified')
    return r,p


def observation_status(path,root):
    r,p=validate_readonly_runtime(path,root,live=True)
    # Approval and budget are checked before browser DOM/metadata calls.
    gpath=ordinary_path(r['grant'])
    if Path(root)/'runs' not in gpath.parents or sha256(gpath)!=r['grant_sha256']:
        raise RuntimeError('Read-only model grant changed')
    g=json.loads(gpath.read_text('utf-8'))
    continuous=g.get('kind')==CONTINUOUS_KIND
    (validate_continuous_grant if continuous else validate_readonly_grant)(g)
    ledger=ordinary_path(g['ledger'])
    if Path(root)/'runs' not in ledger.parents:raise RuntimeError('Ledger outside owned runs')
    with contextlib.closing(sqlite3.connect(ledger.as_uri()+'?mode=ro',uri=True)) as c:
        row=c.execute('select cap,used,armed from state where id=1').fetchone()
    return {'available':bool(row and row[2] and ((row[0]==0 and row[1]>=0) if continuous else (row[0]==30 and 0<=row[1]<30))),
            'owner_login_confirmed':True,'cdp':p['cdp'],'origin':ORIGIN,'paths':['/statistics']}


class ReadonlyExercise(BrowserExercise):
    expected_tools=READ_TOOLS
    toolsets=['company_browser_simulation']  # No terminal/file/vision URL-fetch escape.
    def __init__(self,g,root,state_db,channel='feishu'):
        validate_readonly_grant(g)
        root=ordinary_path(root);self.runtime=ordinary_path(g['runtime']);self.ledger=ordinary_path(g['ledger'])
        if root/'runs' not in self.ledger.parents or root/'runs' not in self.runtime.parents:
            raise RuntimeError('New teaching ledger/runtime must be owned')
        if sha256(self.runtime)!=g['runtime_sha256']:raise RuntimeError('Teaching runtime changed')
        self.cfg,_=validate_readonly_runtime(self.runtime,root,live=True)
        policy_path=ordinary_path(self.cfg['grant'])
        if root/'runs' not in policy_path.parents or sha256(policy_path)!=self.cfg['grant_sha256']:
            raise RuntimeError('Pinned read-only policy differs')
        policy=json.loads(policy_path.read_text('utf-8'));validate_readonly_grant(policy)
        for key in ('kind','origin','paths','request_limit','task_limit','approval_reference','ledger'):
            if policy.get(key)!=g.get(key):raise RuntimeError('Native grant and tool policy differ')
        if len(g.get('old_ledger_sha256',{}))<5:raise RuntimeError('All five closed ledgers must be retained')
        for path,digest in g['old_ledger_sha256'].items():
            old=ordinary_path(path)
            if root/'runs' not in old.parents or old==self.ledger or sha256(old)!=digest:raise RuntimeError('Old ledger reused or changed')
        self.budget=RequestBudget(self.ledger)
        if self.budget.status()['limit']!=30:raise RuntimeError('Teaching cap differs')
        self.intake=Intake(self.ledger.parent/'owner-intake.sqlite',cap=1)
        if not self.intake.count() and self.budget.status()['reserved_network_attempts']:
            raise RuntimeError('Fresh teaching admission has unexplained spend')
        self.channel='feishu';self.prefix=PREFIX;self.state_db=state_db;self.fence=SessionFence(root/'runs/exercise-sessions.sqlite')
        self.thread_id=acceptance_thread_id(self.runtime,1);self.catalog_ready=False
        verify_unused_thread(state_db,self.thread_id,'feishu')
    def summary(self):
        return '灵生统计页只读带教：独立30次/1条，旧模拟额度不复用。'


class ContinuousReadonlyExercise(ReadonlyExercise):
    continuous=True
    def __init__(self,g,root,state_db,channel='feishu'):
        validate_continuous_grant(g);root=ordinary_path(root)
        self.runtime=ordinary_path(g['runtime']);self.ledger=ordinary_path(g['ledger'])
        if root/'runs' not in self.ledger.parents or sha256(self.runtime)!=g['runtime_sha256']:
            raise RuntimeError('New daily runtime/audit identity differs')
        self.cfg,_=validate_readonly_runtime(self.runtime,root,live=True)
        policy_path=ordinary_path(self.cfg['grant'])
        if root/'runs' not in policy_path.parents or sha256(policy_path)!=self.cfg['grant_sha256']:
            raise RuntimeError('Daily read-only policy changed')
        policy=json.loads(policy_path.read_text('utf-8'));validate_continuous_grant(policy)
        for key in ('kind','origin','paths','request_limit','task_limit','approval_reference','ledger'):
            if policy.get(key)!=g.get(key):raise RuntimeError('Daily gateway and tool scope differ')
        if len(g.get('old_ledger_sha256',{}))<6:raise RuntimeError('All prior audit ledgers must be preserved')
        for name,digest in g['old_ledger_sha256'].items():
            old=ordinary_path(name)
            if root/'runs' not in old.parents or old==self.ledger or sha256(old)!=digest:
                raise RuntimeError('Historical audit changed or reused')
        self.budget=RequestAudit(self.ledger);self.budget.status()
        self.channel='feishu';self.state_db=state_db;self.catalog_ready=False
        self.session_initialized=False

    def summary(self):
        return '原Hermes日常只读工作：请求仅记账，不设人为次数、单条名额或验收前缀。'


if __name__=='__main__':
    import argparse,sys
    parser=argparse.ArgumentParser();parser.add_argument('--runtime',required=True);a=parser.parse_args()
    try:status=observation_status(a.runtime,Path.home()/'.hermes/tools/company-browser')
    except Exception as e:status={'available':False,'code':'READ_ONLY_NOT_OPEN','error_type':type(e).__name__}
    print(json.dumps(status),flush=True)
