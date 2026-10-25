"""Opt-in process-local model pacing. No prompts, credentials or URLs logged.

This does not change the request budget or bypass a provider's account limits.
The permit lasts through response-stream close, including streaming generation.
"""
import asyncio
import datetime
from email.utils import parsedate_to_datetime
import json
import math
from pathlib import Path
import threading
import time

from request_budget import BudgetBlocked


def approved_pacing(gate):
    value = gate.get('provider_pacing')
    if value is None:
        return None
    expected = {'min_interval_seconds': 12, 'cooldown_on_429_seconds': 60,
                'max_single_wait_seconds': 600, 'concurrency': 1}
    if value != expected:
        raise BudgetBlocked('Unverified process-local pacing settings')
    return value


class ModelPacer:
    def __init__(self, budget, receipt, *, clock=time.monotonic, sleep=time.sleep,
                 utcnow=lambda: datetime.datetime.now(datetime.timezone.utc)):
        self.budget, self.receipt = budget, Path(receipt)
        self.clock, self.sleep, self.utcnow = clock, sleep, utcnow
        self.lock = threading.Lock()
        self.next_start, self.frozen, self.ordinal = 0.0, False, 0

    def check(self):
        state = self.budget.status()
        if state['reserved_network_attempts'] >= state['limit']:
            # Preserve the existing hard-stop receipt and launcher behavior.
            # Counters are monotonic; this take can only log a denial.
            self.budget.take('unclassified')
        if self.frozen or not state['armed']:
            raise BudgetBlocked('Model admission paused, exhausted or needs operator review')

    def enter(self):
        deadline = self.clock() + 600
        while not self.lock.acquire(blocking=False):
            self.check()
            if self.clock() >= deadline:
                raise BudgetBlocked('Pacing permit wait exceeded; no request sent')
            self.sleep(.05)
        try:
            while self.clock() < self.next_start:
                self.check()
                if self.clock() >= deadline:
                    raise BudgetBlocked('Pacing wait exceeded; no request sent')
                self.sleep(min(.25, self.next_start - self.clock()))
            self.check()
        except BaseException:
            self.lock.release()
            raise

    async def aenter(self):
        deadline = self.clock() + 600
        while not self.lock.acquire(blocking=False):
            self.check()
            if self.clock() >= deadline:
                raise BudgetBlocked('Pacing permit wait exceeded; no request sent')
            await asyncio.sleep(.05)
        try:
            while self.clock() < self.next_start:
                self.check()
                if self.clock() >= deadline:
                    raise BudgetBlocked('Pacing wait exceeded; no request sent')
                await asyncio.sleep(min(.25, self.next_start - self.clock()))
            self.check()
        except BaseException:
            self.lock.release()
            raise

    def leave(self):
        self.lock.release()

    def record(self, kind, **fields):
        row = {'at': self.utcnow().isoformat(), 'event': kind, 'ordinal': self.ordinal, **fields}
        with self.receipt.open('a', encoding='utf-8') as f:
            f.write(json.dumps(row, ensure_ascii=False) + '\n')

    def started(self, family):
        self.ordinal += 1
        self.next_start = self.clock() + 12
        self.record('model_wire_start', family=family)

    def response(self, response):
        status = response.status_code
        retry_after = None
        value = response.headers.get('retry-after')
        if value is not None:
            try:
                retry_after = float(value)
            except (ValueError, TypeError):
                try:
                    date = parsedate_to_datetime(value)
                    if date.tzinfo is None:
                        date = date.replace(tzinfo=datetime.timezone.utc)
                    retry_after = (date - self.utcnow()).total_seconds()
                except (ValueError, TypeError, OverflowError):
                    pass
            if retry_after is not None and (not math.isfinite(retry_after) or retry_after < 0):
                retry_after = None
        numeric = {}
        for name in ['x-ratelimit-limit-requests', 'x-ratelimit-remaining-requests',
                     'x-ratelimit-limit-tokens', 'x-ratelimit-remaining-tokens']:
            raw = response.headers.get(name, '')
            if raw.isascii() and raw.isdigit() and len(raw) <= 12:
                numeric[name] = int(raw)
        if status == 429:
            wait = retry_after if retry_after is not None else 60
            if wait > 600:
                self.frozen = True  # Never shorten a server's long requested wait.
            else:
                self.next_start = max(self.next_start, self.clock() + wait)
        self.record('model_response_headers', status=status, retry_after_seconds=retry_after,
                    numeric_rate_headers=numeric, admission_frozen=self.frozen,
                    no_body_or_arbitrary_headers_recorded=True)


def paced_sync_stream(stream, pacer):
    import httpx
    class HeldStream(httpx.SyncByteStream):
        closed = False

        def __iter__(self):
            yield from stream

        def close(self):
            if not self.closed:
                self.closed = True
                try:
                    stream.close()
                finally:
                    pacer.leave()
    return HeldStream()


def paced_async_stream(stream, pacer):
    import httpx
    class HeldStream(httpx.AsyncByteStream):
        closed = False

        async def __aiter__(self):
            async for chunk in stream:
                yield chunk

        async def aclose(self):
            if not self.closed:
                self.closed = True
                try:
                    await stream.aclose()
                finally:
                    pacer.leave()
    return HeldStream()
