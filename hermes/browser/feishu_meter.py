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
            if not state['armed'] or state['reserved_network_attempts']>=state['limit']:
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
    def check(self):
        self.budget.check()
        if self.frozen:raise BudgetBlocked('Provider wait exceeds automatic scope')


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
