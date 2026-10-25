"""One explicitly authorized browser goal beside ordinary QQ conversation."""
import contextlib
import json
from pathlib import Path

from qq_runtime import Intake, acceptance_thread_id, verify_unused_thread
from request_budget import RequestBudget
from safety import ordinary_path, sha256

AUTHORIZATION = '2026-10-25 Owner: new30 requests and1 QQ recovery task; ordinary chat separate'
PREFIX = '【模拟浏览器验收R4】'
FEISHU_TRANSFER = '2026-10-25 Owner: use Feishu instead of QQ; begin browser integration'


def validate_browser_grant(value, channel='qqbot'):
    if (not isinstance(value, dict) or value.get('owner_authorization') != AUTHORIZATION
            or value.get('request_limit') != 30 or value.get('task_limit') != 1
            or value.get('case') != 'recovery' or value.get('message_prefix') != PREFIX
            or value.get('zero_model_checks_passed') is not True):
        raise RuntimeError('Browser grant differs from Owner-approved30/1 recovery scope')
    if channel not in ('qqbot', 'feishu'):
        raise RuntimeError('Unsupported acceptance channel')
    if channel == 'feishu' and (value.get('channel') != 'feishu'
            or value.get('channel_transfer_authorization') != FEISHU_TRANSFER):
        raise RuntimeError('Feishu needs the explicit channel transfer; no extra allowance')
    if channel == 'qqbot' and value.get('channel', 'qqbot') != 'qqbot':
        raise RuntimeError('A transferred grant cannot also be used by QQ')


class BrowserExercise:
    def __init__(self, value, root, state_db, channel='qqbot'):
        validate_browser_grant(value, channel)
        self.channel = channel
        self.runtime = ordinary_path(value['runtime'])
        self.ledger = ordinary_path(value['ledger'])
        root = ordinary_path(root)
        if root / 'runs' not in self.runtime.parents or root / 'runs' not in self.ledger.parents:
            raise RuntimeError('Browser runtime or ledger outside owned tools')
        if self.runtime.parent == self.ledger.parent or sha256(self.runtime) != value['runtime_sha256']:
            raise RuntimeError('Browser runtime changed or exercise/ledger directories mixed')
        self.cfg = json.loads(self.runtime.read_text('utf-8'))
        if (self.cfg.get('toolRoot') != str(root) or self.cfg.get('case') != 'recovery'
                or self.cfg.get('taskScope') != 'recovery' or self.cfg.get('route') != 'playwright'
                or self.cfg.get('roundBudget') != str(self.ledger)):
            raise RuntimeError('Not the approved isolated recovery workplace')
        preflight = self.runtime.parent / 'continuation-preflight.json'
        if sha256(preflight) != value['preflight_sha256']:
            raise RuntimeError('Browser startup preflight changed')
        observed = json.loads(preflight.read_text('utf-8'))
        if (observed.get('passed') is not True or observed.get('SDK_tools') != 13
                or observed.get('model_calls') != 0):
            raise RuntimeError('Browser component did not pass zero-model preflight')
        self.budget = RequestBudget(self.ledger)
        if self.budget.status()['limit'] != 30:
            raise RuntimeError('Request cap changed')
        for name, digest in value['old_ledger_sha256'].items():
            if ordinary_path(name) == self.ledger or sha256(name) != digest:
                raise RuntimeError('Old ledger modified or reused')
        # One admission for this grant even if a stale launcher is presented
        # with the same ledger under another communication channel.
        self.intake = Intake(self.ledger.parent / 'owner-intake.sqlite', cap=1)
        self.thread_id = acceptance_thread_id(self.runtime, 1)
        self.state_db = state_db
        self.catalog_ready = False
        if not self.intake.count():
            initial=value.get('initial_accounted_startup_attempts',0)
            status=self.budget.status()
            if isinstance(initial,bool) or not isinstance(initial,int) or not 0<=initial<30:
                raise RuntimeError('Invalid existing startup spend')
            if status['reserved_network_attempts'] != initial:
                raise RuntimeError('New browser admission cannot reuse unaccounted requests')
            if initial:
                proof=self.ledger.parent/'startup-traffic-reconciliation.json'
                if sha256(proof)!=value.get('reconciliation_sha256'):
                    raise RuntimeError('Missing fixed reconciliation proof')
                detail=json.loads(proof.read_text('utf-8'))
                if (detail.get('ledger')!=str(self.ledger) or detail.get('accounted_unknown_attempts')!=initial
                        or detail.get('grant_limit_unchanged')!=30 or detail.get('post_send_reconciliation') is not True
                        or status['events'].get('reconciled_unknown_startup_after_send')!=initial
                        or status['events'].get('reserved_before_send',0)):
                    raise RuntimeError('Startup reconciliation or first-task scope inconsistent')
            verify_unused_thread(self.state_db, self.thread_id, self.channel)

    def matches(self, text):
        return text.lstrip().startswith(PREFIX)

    def admit(self, message_id):
        state = self.budget.status()
        if (not self.catalog_ready or not state['armed']
                or state['reserved_network_attempts'] >= state['limit'] or self.intake.count()):
            raise RuntimeError('This browser task is not open or its one message was consumed')
        verify_unused_thread(self.state_db, self.thread_id, self.channel)
        return self.intake.take(message_id)

    def pause(self):
        with contextlib.closing(self.budget._connection()) as c, c:
            c.execute('BEGIN IMMEDIATE')
            c.execute('UPDATE state SET armed=0 WHERE id=1')

    def summary(self):
        state = self.budget.status()
        label = '等待本轮指定任务' if not self.intake.count() and state['armed'] else '本轮任务已接收或结束'
        return f"模拟浏览器：{label}，消息{self.intake.count()}/1，请求{state['reserved_network_attempts']}/30。普通聊天不受此名额限制。"
