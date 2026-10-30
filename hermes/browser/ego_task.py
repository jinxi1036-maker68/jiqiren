"""Original-employee daily Ego tools; no task prefix or artificial quotas."""
import json
import contextlib
from pathlib import Path
from safety import ordinary_path, sha256
from ego_runtime import validate_ego_runtime
from request_budget import RequestAudit

EGO_TOOLS={'ego_browser_guide','ego_browser_status','ego_browser_window',
           'ego_browser_observe','ego_browser_actions','ego_browser_screenshot',
           'ego_browser_pages','ego_browser_handoff'}

class EgoReadonlyExercise:
    continuous=True
    expected_tools=EGO_TOOLS
    toolsets=['company_browser_simulation']
    def __init__(self,g,root,state_db,channel='feishu'):
        if (g.get('kind') not in ('lingju-ego-readonly-daily','lingju-ego-business-daily') or channel!='feishu'
                or g.get('channel')!='feishu' or not g.get('approval_reference')
                or g.get('request_limit') is not None or g.get('task_limit') is not None
                or g.get('Owner_removed_test_quotas') is not True
                or g.get('zero_model_checks_passed') is not True):
            raise RuntimeError('Explicit same-employee daily Ego handoff required')
        root=ordinary_path(root);self.runtime=ordinary_path(g['runtime'])
        if sha256(self.runtime)!=g['runtime_sha256']:raise RuntimeError('Ego runtime changed')
        self.cfg=validate_ego_runtime(self.runtime,root)
        if self.cfg.get('employeeSupport',{}).get('ownerApproved') is True:
            self.expected_tools=EGO_TOOLS|{'ego_browser_diagnostics','ego_browser_recover','company_task_notes','company_knowledge'}
        expected='company-business' if g['kind']=='lingju-ego-business-daily' else 'company-readonly'
        if self.cfg['mode']!=expected:raise RuntimeError('Company runtime and daily authority differ')
        self.ledger=ordinary_path(g['ledger'])
        if root/'runs' not in self.ledger.parents:raise RuntimeError('Daily audit outside owned runs')
        self.budget=RequestAudit(self.ledger)
        self.budget.status()
        self.channel='feishu';self.state_db=state_db
        self.catalog_ready=False;self.session_initialized=False
    def pause(self):
        with contextlib.closing(self.budget._connection()) as c, c:
            c.execute('BEGIN IMMEDIATE')
            c.execute('UPDATE state SET armed=0 WHERE id=1')
    def summary(self):
        mode='完整业务页面操作（含创建、编辑、分组、绑定及提交）；依Owner工作目标自主执行' if self.cfg['mode']=='company-business' else '只读'
        return '原Hermes公司Ego'+mode+'；无任务前缀或人为次数名额，登录由Owner完成。'
