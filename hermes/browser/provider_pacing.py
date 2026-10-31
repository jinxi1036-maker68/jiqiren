"""Opt-in process-local model pacing. No prompts, credentials or URLs logged.

This does not change the request budget or bypass a provider's account limits.
The permit lasts through response-stream close, including streaming generation.
"""
import asyncio
import datetime
from email.utils import parsedate_to_datetime
import json
import math
import re
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
                 utcnow=lambda: datetime.datetime.now(datetime.timezone.utc),
                 min_interval_seconds=12, retry_after_statuses=(429,)):
        if not math.isfinite(min_interval_seconds) or min_interval_seconds < 0:
            raise ValueError('Invalid request interval')
        self.budget, self.receipt = budget, Path(receipt)
        self.clock, self.sleep, self.utcnow = clock, sleep, utcnow
        self.min_interval_seconds = min_interval_seconds
        self.retry_after_statuses = frozenset(retry_after_statuses)
        self.lock = threading.Lock()
        self.next_start, self.frozen, self.ordinal = 0.0, False, 0
        self.frozen_until=None
        self.request_started_at=None;self.observation=None

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
        self.request_started_at=self.clock()
        self.next_start = self.clock() + self.min_interval_seconds
        self.record('model_wire_start', family=family,
                    min_interval_seconds=self.min_interval_seconds)

    def observe_request(self,request):
        """Counts/model ID only: never record message bodies, URLs or headers."""
        meta={'model_id':None,'request_body_bytes':None,'message_count':None,'tool_schema_count':None}
        try:
            raw=request.content;meta['request_body_bytes']=len(raw)
            if len(raw)<=8*1024*1024:
                body=json.loads(raw);model=body.get('model')
                if isinstance(model,str) and re.fullmatch(r'agnes-[0-9][a-z0-9._-]{0,60}',model):meta['model_id']=model
                if isinstance(body.get('messages'),list):meta['message_count']=len(body['messages'])
                if isinstance(body.get('tools'),list):meta['tool_schema_count']=len(body['tools'])
        except (ValueError,TypeError,AttributeError,RuntimeError):pass
        self.record('model_request_metadata',**meta,raw_request_or_credentials_recorded=False)

    @staticmethod
    def error_classification(status,raw):
        if status<400:return None,None
        try:
            body=json.loads(raw);error=body.get('error',body)
            if not isinstance(error,dict):return 'unclassified_http_error',None
            code=error.get('code') or error.get('type');message=str(error.get('message','')).lower()
            known={'rate_limit_exceeded','rpm_limit_exceeded','insufficient_quota','quota_exceeded',
                   'subscription_quota_exceeded','get_channel_failed','AgnesAI_error'}
            safe_code=code if code in known else None
            if status==429 and 'rate limit for free users' in message:return 'provider_reported_free_user_limit',safe_code
            if code in {'insufficient_quota','quota_exceeded','subscription_quota_exceeded'}:return 'explicit_quota_error',safe_code
            if status==429 and (code in {'rate_limit_exceeded','rpm_limit_exceeded'} or 'requests per minute' in message or 'rpm limit' in message):return 'reported_request_rate_limit',safe_code
            if code=='get_channel_failed':return 'reported_model_channel_error',safe_code
            return 'unclassified_429' if status==429 else 'unclassified_http_error',safe_code
        except (ValueError,TypeError,AttributeError,UnicodeError):return 'unclassified_429' if status==429 else 'unclassified_http_error',None

    def body_piece(self,observation,chunk):
        if observation is None:return
        if observation['first_body_at'] is None:observation['first_body_at']=self.clock()
        observation['body_bytes']+=len(chunk)
        if observation['status']>=400 and len(observation['error_prefix'])<8192:
            observation['error_prefix'].extend(chunk[:8192-len(observation['error_prefix'])])

    def stream_finished(self,observation,fully_iterated):
        if observation is None or observation['finished']:return
        observation['finished']=True;now=self.clock();start=observation['start']
        category,code=self.error_classification(observation['status'],observation['error_prefix'])
        self.record('model_stream_closed',status=observation['status'],
            request_to_headers_seconds=round(observation['headers_at']-start,4),
            request_to_first_body_bytes_seconds=None if observation['first_body_at'] is None else round(observation['first_body_at']-start,4),
            total_request_seconds=round(now-start,4),response_body_bytes=observation['body_bytes'],
            body_fully_iterated=bool(fully_iterated),provider_error_class=category,provider_error_code=code,
            raw_response_or_request_id_recorded=False)
        observation['error_prefix'].clear()

    def response(self, response):
        status = response.status_code
        now=self.clock()
        self.observation={'start':self.request_started_at if self.request_started_at is not None else now,
            'headers_at':now,'first_body_at':None,'body_bytes':0,'error_prefix':bytearray(),'status':status,'finished':False}
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
        cooldown = None
        if status == 429 or (status in self.retry_after_statuses and retry_after is not None):
            wait = retry_after if retry_after is not None else 60
            cooldown = wait
            if wait > 600:
                self.frozen = True  # Never shorten a server's long requested wait.
                self.frozen_until=self.clock()+wait
                self.next_start=max(self.next_start,self.frozen_until)
            else:
                self.next_start = max(self.next_start, self.clock() + wait)
        self.record('model_response_headers', status=status, retry_after_seconds=retry_after,
                    numeric_rate_headers=numeric, admission_frozen=self.frozen,
                    scheduled_cooldown_seconds=cooldown,
                    no_body_or_arbitrary_headers_recorded=True)


def paced_sync_stream(stream, pacer):
    import httpx
    observation=getattr(pacer,'observation',None)
    class HeldStream(httpx.SyncByteStream):
        closed = False
        fully_iterated=False

        def __iter__(self):
            for chunk in stream:
                if observation is not None:pacer.body_piece(observation,chunk)
                yield chunk
            self.fully_iterated=True

        def close(self):
            if not self.closed:
                self.closed = True
                try:
                    stream.close()
                finally:
                    try:
                        if observation is not None:pacer.stream_finished(observation,self.fully_iterated)
                    finally:pacer.leave()
    return HeldStream()


def paced_async_stream(stream, pacer):
    import httpx
    observation=getattr(pacer,'observation',None)
    class HeldStream(httpx.AsyncByteStream):
        closed = False
        fully_iterated=False

        async def __aiter__(self):
            async for chunk in stream:
                if observation is not None:pacer.body_piece(observation,chunk)
                yield chunk
            self.fully_iterated=True

        async def aclose(self):
            if not self.closed:
                self.closed = True
                try:
                    await stream.aclose()
                finally:
                    try:
                        if observation is not None:pacer.stream_finished(observation,self.fully_iterated)
                    finally:pacer.leave()
    return HeldStream()
