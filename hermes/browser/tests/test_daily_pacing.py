import datetime
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import httpx
from feishu_meter import GatewayMeter, gateway_pacer, DAILY_PACING, LEGACY_DAILY_PACING
from request_budget import RequestAudit, BudgetBlocked
from traffic_guard import TrafficAudit, TrafficPolicy, install_traffic_guard


class Clock:
    now=0.
    def __call__(self):return self.now
    def sleep(self,t):self.now+=t


class DailyPacingTests(unittest.TestCase):
    def create(self,root):
        clock=Clock();audit=RequestAudit.create(root/'requests.sqlite');audit.arm()
        meter=GatewayMeter(root,audit)
        pacer=gateway_pacer(meter,root/'responses.jsonl',{'daily_pacing':DAILY_PACING},continuous=True)
        pacer.clock,pacer.sleep=clock,clock.sleep
        pacer.utcnow=lambda:datetime.datetime(2026,10,29,tzinfo=datetime.timezone.utc)
        return clock,meter,pacer,audit

    def test_only_explicit_daily_policy_changes_historical_default(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);clock,meter,pacer,audit=self.create(root)
            self.assertEqual(pacer.min_interval_seconds,0)
            self.assertEqual(gateway_pacer(meter,root/'old.jsonl',{},continuous=False).min_interval_seconds,12)
            for g,continuous in [({'daily_pacing':DAILY_PACING},False),
                ({'daily_pacing':{**DAILY_PACING,'concurrency':2}},True),
                ({'daily_pacing':{**DAILY_PACING,'cooldown_on_429_seconds':1}},True)]:
                with self.assertRaises(BudgetBlocked):gateway_pacer(meter,root/'bad.jsonl',g,continuous=continuous)

    def test_healthy_real_transport_calls_have_no_fixed_wait_and_quota_stays_unlimited(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);clock,meter,pacer,audit=self.create(root);seen=[]
            def wire(_t,_r):seen.append(clock());return httpx.Response(200,json={'synthetic':True})
            turn,token=meter.begin(True)
            with patch.object(httpx.HTTPTransport,'handle_request',wire):
                restore=install_traffic_guard(meter,TrafficAudit(root/'traffic.sqlite'),TrafficPolicy(),pacer=pacer)
                try:
                    with httpx.Client(trust_env=False) as c:
                        for _ in range(4):c.post('https://synthetic.invalid/v1/chat/completions')
                finally:restore();meter.finish(turn,token)
            self.assertEqual(seen,[0,0,0,0])
            self.assertEqual(audit.status()['reserved_network_attempts'],4)
            self.assertIsNone(audit.status()['limit'])

    def test_daily_429_delegates_to_native_without_header_and_explicit_header_wins(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);clock,meter,pacer,audit=self.create(root)
            pacer.enter();pacer.started('chat_completions');pacer.response(httpx.Response(429));pacer.leave()
            pacer.enter();self.assertEqual(clock(),0)
            pacer.started('chat_completions');pacer.response(httpx.Response(429,headers={'Retry-After':'120'}));pacer.leave()
            pacer.enter();self.assertEqual(clock(),120);pacer.leave()

    def test_legacy_daily_policy_still_has_its_old_60_second_cooldown(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);clock,meter,_,audit=self.create(root)
            pacer=gateway_pacer(meter,root/'legacy.jsonl',{'daily_pacing':LEGACY_DAILY_PACING},continuous=True)
            pacer.clock,pacer.sleep=clock,clock.sleep
            pacer.enter();pacer.started('chat_completions');pacer.response(httpx.Response(429));pacer.leave()
            pacer.enter();self.assertEqual(clock(),60);pacer.leave()

    def test_504_server_wait_is_honored_no_guess_on_503_without_header(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);clock,meter,pacer,audit=self.create(root)
            pacer.enter();pacer.started('chat_completions')
            pacer.response(httpx.Response(504,headers={'Retry-After':'120'}));pacer.leave()
            pacer.enter();self.assertEqual(clock(),120)
            pacer.started('chat_completions');pacer.response(httpx.Response(503));pacer.leave()
            pacer.enter();self.assertEqual(clock(),120);pacer.leave()
            rows=[json.loads(x) for x in (root/'responses.jsonl').read_text().splitlines()]
            self.assertIsNone(rows[-1]['scheduled_cooldown_seconds'])

    def test_date_header_long_wait_pause_and_control_do_not_bypass_guard(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);clock,meter,pacer,audit=self.create(root)
            pacer.enter();pacer.started('chat_completions')
            pacer.response(httpx.Response(503,headers={'Retry-After':'Thu, 29 Oct 2026 00:01:30 GMT'}));pacer.leave()
            self.assertEqual(pacer.next_start,90)
            pacer.enter();pacer.started('chat_completions');pacer.response(httpx.Response(503,headers={'Retry-After':'900'}));pacer.leave()
            with self.assertRaises(BudgetBlocked):pacer.enter()
            self.assertFalse(pacer.lock.locked())
            turn,token=meter.begin(True,control=True)
            try:
                with self.assertRaises(BudgetBlocked):meter.take()
            finally:meter.finish(turn,token)


if __name__=='__main__':unittest.main()
