"""Request attribution for one browser exercise inside the original gateway.

Other native conversations keep their own routes. Unknown HTTPX model traffic
overlapping the exercise is conservatively charged. Known native worker and
title threads must propagate the context; this is not an arbitrary-code sandbox.
"""
import contextvars
import threading

from qq_runtime import event
from request_budget import BudgetBlocked
from provider_pacing import ModelPacer

CURRENT_TURN = contextvars.ContextVar('lingju_gateway_turn', default=None)

LEGACY_DAILY_PACING = {'kind':'adaptive-daily-v1','min_interval_seconds':0,
                'concurrency':1,'cooldown_on_429_seconds':60,
                'honor_retry_after_on':[429,500,502,503,504],
                'max_single_wait_seconds':600}
DAILY_PACING = {**LEGACY_DAILY_PACING,'kind':'native-retry-daily-v2',
                'cooldown_on_429_seconds':0}


def gateway_pacer(meter, receipt, gate, *, continuous):
    settings=gate.get('daily_pacing')
    if settings is None:
        return BrowserPacer(meter,receipt)  # Historical launches unchanged.
    if not continuous or settings not in (DAILY_PACING,LEGACY_DAILY_PACING):
        raise BudgetBlocked('Unreviewed daily pacing policy')
    return BrowserPacer(meter,receipt,min_interval_seconds=0,
                        daily_auto_unfreeze=True,
                        unknown_429_cooldown_seconds=settings['cooldown_on_429_seconds'],
                        retry_after_statuses=settings['honor_retry_after_on'])


class GatewayMeter:
    def __init__(self, output, budget):
        self.output, self.budget = output, budget
        self.lock = threading.RLock()
        self.browser_turn = None
        self.ordinary_attempts = 0

    def begin(self, browser=False, *, control=False):
        if control and not browser:
            raise ValueError('Session controls must retain exercise accounting')
        turn = {'browser': bool(browser), 'control': bool(control), 'live': threading.Event(), 'meter':self}
        with self.lock:
            if browser and not control and self.browser_turn is not None:
                raise BudgetBlocked('A browser task is already running')
            turn['live'].set()
            if browser and not control:self.browser_turn=turn
        return turn, CURRENT_TURN.set(turn)

    def finish(self, turn, token):
        with self.lock:
            turn['live'].clear()
            if self.browser_turn is turn:self.browser_turn=None
        CURRENT_TURN.reset(token)

    def _browser(self):
        turn=CURRENT_TURN.get()
        if turn is not None:
            if turn['meter'] is not self or not turn['live'].is_set():
                raise BudgetBlocked('Late or foreign gateway request denied')
            return turn['browser']
        # Only a real native message handler can mark ordinary Owner usage.
        # Untagged startup/background traffic never gets an unlimited bypass.
        # The unarmed ledger blocks it before the first exercise admission.
        return True

    def check(self):
        turn=CURRENT_TURN.get()
        if turn is not None and turn.get('control'):
            # A local /new or /status is never authorization for generation,
            # even when another newly approved exercise has unused budget.
            raise BudgetBlocked('Local session controls cannot issue model requests')
        if self._browser():
            state=self.budget.status()
            if not state['armed'] or (state['limit'] is not None and state['reserved_network_attempts']>=state['limit']):
                self.budget.take('unclassified')

    def requires_pacing(self):
        self.check()
        return self._browser()

    def take(self, family='unclassified'):
        with self.lock:
            self.check()
            if self._browser():return self.budget.take(family)
            self.ordinary_attempts+=1
            event(self.output,'native_non_exercise_HTTPX',family=family)
            return self.ordinary_attempts


class BrowserPacer(ModelPacer):
    def __init__(self, *args, daily_auto_unfreeze=False, **kwargs):
        super().__init__(*args, **kwargs)
        self.daily_auto_unfreeze=daily_auto_unfreeze
        self._progress_family=threading.local()

    def check(self):
        self.budget.check()
        if self.daily_auto_unfreeze and self.frozen and self.frozen_until is not None and self.clock()>=self.frozen_until:
            self.frozen=False;self.frozen_until=None
            self.record('provider_requested_cooldown_elapsed',no_early_retry=True)
        if self.frozen:raise BudgetBlocked('Provider wait exceeds automatic scope')

    def _progress(self, state, **fields):
        turn=CURRENT_TURN.get()
        # A context copied into a late worker must not update a newer task.
        # Unattributed requests retain their audit, but never guess a status.
        if turn and turn.get('meter') is self.budget and turn['live'].is_set():
            progress=turn.get('progress')
            if progress is not None:
                try:progress.note(state,**fields)
                except Exception:pass

    def started(self, family):
        super().started(family)
        self._progress_family.known=family in {'chat_completions','responses','messages','generate_content'}
        if self._progress_family.known:self._progress('request_started')

    def response(self, response):
        super().response(response)
        if getattr(self._progress_family,'known',False):
            self._progress('response_headers',status=response.status_code)
            turn=CURRENT_TURN.get()
            if turn and turn.get('meter') is self.budget and turn['live'].is_set():
                self.observation['progress_turn']=turn

    def stream_finished(self, observation, fully_iterated):
        if observation is None or observation['finished']:return
        category,_=self.error_classification(observation['status'],observation['error_prefix'])
        turn=observation.get('progress_turn')
        super().stream_finished(observation,fully_iterated)
        if category and turn and turn['live'].is_set():
            progress=turn.get('progress')
            if progress is not None:
                try:progress.note('provider_error',status=observation['status'],category=category)
                except Exception:pass


def propagate_title_threads(module):
    """Only the native title module's Thread binding; not global threading."""
    import types
    original=module.threading
    def thread(*args,**kwargs):
        if args or 'target' not in kwargs:
            raise RuntimeError('Unreviewed title worker signature')
        saved=contextvars.copy_context()
        target=kwargs.pop('target');target_args=kwargs.pop('args',())
        target_kwargs=kwargs.pop('kwargs',{})
        return original.Thread(target=lambda:saved.run(target,*target_args,**target_kwargs),**kwargs)
    module.threading=types.SimpleNamespace(Thread=thread)
    return lambda:setattr(module,'threading',original)
