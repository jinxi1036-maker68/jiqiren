import contextlib
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import types
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from feishu_session_fence import SessionFence, resolve_native_session, local_session_command
from feishu_meter import GatewayMeter
from request_budget import RequestBudget, BudgetBlocked


class SessionFenceTests(unittest.TestCase):
    def test_closed_session_survives_restart_without_private_bodies_or_budget_reset(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);b=RequestBudget.create(p/'budget.sqlite',limit=1);b.take()
            f=SessionFence(p/'fence.sqlite',create=True);f.bind('trial','one-grant');f.close('trial')
            reopened=SessionFence(p/'fence.sqlite')
            self.assertEqual(reopened.phase('trial'),'closed')
            self.assertIsNone(reopened.phase('new-native-ordinary'))
            self.assertTrue(reopened.mentions_protected_session('/resume trial,'))
            self.assertEqual(b.status()['reserved_network_attempts'],1)
            with contextlib.closing(sqlite3.connect(p/'fence.sqlite')) as c:
                cols={row[1] for row in c.execute('pragma table_info(exercise_sessions)')}
            self.assertEqual(cols,{'session_id','grant_sha256','phase','updated_at'})

    def test_rebinding_or_closing_unknown_sessions_does_not_grant_scope(self):
        with tempfile.TemporaryDirectory() as d:
            f=SessionFence(Path(d)/'fence.sqlite',create=True);f.bind('same','grant');f.close('same')
            with self.assertRaises(sqlite3.IntegrityError):f.bind('same','other')
            with self.assertRaises(RuntimeError):f.close('unknown')
            self.assertEqual(f.phase('same'),'closed')

    def test_missing_fence_cannot_silently_recreate_empty_history(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'fence.sqlite';f=SessionFence(p,create=True);f.bind('trial','grant');f.close('trial');p.unlink()
            with self.assertRaises(sqlite3.OperationalError):SessionFence(p)
            self.assertFalse(p.exists())

    def test_native_routing_peek_never_creates_or_touches_session(self):
        calls=[];source=object()
        store=types.SimpleNamespace(_generate_session_key=lambda s:'real-key' if s is source else None,
                                    peek_session_id=lambda k:calls.append(k) or 'trial')
        self.assertEqual(resolve_native_session(store,source),'trial');self.assertEqual(calls,['real-key'])

    def test_missing_route_cache_must_resolve_before_ordinary_exemption(self):
        source=object();calls=[]
        def recover(src,*,touch_activity):
            calls.append((src is source,touch_activity));return types.SimpleNamespace(session_id='recovered-trial')
        store=types.SimpleNamespace(_generate_session_key=lambda s:'real-key',peek_session_id=lambda k:None,get_or_create_session=recover)
        self.assertEqual(resolve_native_session(store,source),'recovered-trial');self.assertEqual(calls,[(True,False)])

    def test_only_local_nonresuming_commands_can_leave_closed_session(self):
        for text in ['/new','/stop','/help','/status']:
            self.assertTrue(local_session_command(types.SimpleNamespace(text=text)))
        for text in ['/resume trial','/approve','/new do more work','继续','继续R4','/new\n继续']:
            self.assertFalse(local_session_command(types.SimpleNamespace(text=text)))
        self.assertFalse(local_session_command(types.SimpleNamespace(text='/new',media_urls=['synthetic'])))

    def test_local_new_command_cannot_borrow_normal_network_exemption(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);b=RequestBudget.create(p/'budget.sqlite',limit=1,armed=False);m=GatewayMeter(p,b)
            turn,token=m.begin(True,control=True)
            with self.assertRaises(BudgetBlocked):m.take('chat_completions')
            m.finish(turn,token)
            normal,token=m.begin(False);m.take();m.finish(normal,token)
            self.assertEqual(b.status()['reserved_network_attempts'],0)
            self.assertEqual(m.ordinary_attempts,1)

    def test_local_stop_does_not_unbind_running_browser_context(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);b=RequestBudget.create(p/'budget.sqlite',limit=2);m=GatewayMeter(p,b)
            browser,token=m.begin(True);control,control_token=m.begin(True,control=True)
            m.finish(control,control_token);self.assertIs(m.browser_turn,browser)
            m.take();m.finish(browser,token)
            self.assertEqual(b.status()['reserved_network_attempts'],1)

    def test_local_control_cannot_spend_a_newly_armed_grant_either(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);b=RequestBudget.create(p/'budget.sqlite',limit=2);m=GatewayMeter(p,b)
            control,token=m.begin(True,control=True)
            with self.assertRaises(BudgetBlocked):m.take('chat_completions')
            m.finish(control,token)
            self.assertEqual(b.status()['reserved_network_attempts'],0)


if __name__=='__main__':unittest.main()
