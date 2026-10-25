import concurrent.futures
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from qq_runtime import (Intake, official_qq_websocket, verify_browser_catalog,
                        metadata_catalog_urls, round_settings, TOOLSETS,
                        acceptance_thread_id, verify_unused_thread)


class QQIntakeTests(unittest.TestCase):
    def test_thread_id_does_not_collide_across_runs_or_slots(self):
        a=Path('runs/run-A/runtime.json');b=Path('runs/run-B/runtime.json')
        self.assertNotEqual(acceptance_thread_id(a,1),acceptance_thread_id(b,1))
        self.assertNotEqual(acceptance_thread_id(a,1),acceptance_thread_id(a,2))
        self.assertNotEqual(acceptance_thread_id(a,1),'qq-transport-1')

    def test_existing_conversation_is_rejected_without_mutating_database(self):
        import sqlite3,hashlib,contextlib
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'state.sqlite'
            with contextlib.closing(sqlite3.connect(p)) as c, c:
                c.execute('create table sessions(source text,thread_id text)')
                c.execute("insert into sessions values('qqbot','already-used')")
            before=hashlib.sha256(p.read_bytes()).hexdigest()
            verify_unused_thread(p,'new-run-thread')
            with self.assertRaises(RuntimeError):verify_unused_thread(p,'already-used')
            self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),before)

    def test_model_metadata_exemption_only_comes_from_clean_model_config(self):
        cfg={'model':{'base_url':'https://synthetic.invalid/v1'},
             'auxiliary':{'vision':{'base_url':'https://synthetic.invalid/aux'}},
             'mcp_servers':{'anything':{'base_url':'https://not-a-model.invalid'}},
             'custom_providers':[{'base_url':'https://user:secret@synthetic.invalid/v1'},
                                 {'base_url':'https://synthetic.invalid/v1?prompt=x'}]}
        self.assertEqual(metadata_catalog_urls(cfg),{'https://synthetic.invalid/v1/models',
                                                     'https://synthetic.invalid/aux/models'})

    def test_B_browser_tasks_have_no_file_or_terminal_tools(self):
        self.assertEqual(set(TOOLSETS),{'company_browser_simulation','vision'})

    def test_new_round_requires_explicit_limits_and_preserves_old_exhausted_ledger(self):
        from request_budget import RequestBudget
        local=Path(__file__).resolve().parents[1]/'.local'
        local.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='qq-round-test-',dir=local) as d:
            root=Path(d);old=root/'runs/old/requests.sqlite';new=root/'runs/new/requests.sqlite'
            runtime=root/'runs/case/runtime.json'
            for p in [old,new,runtime]:p.parent.mkdir(parents=True,exist_ok=True)
            runtime.write_text('{}')
            previous=RequestBudget.create(old,120)
            for _ in range(120):previous.take()
            before=previous.status()
            RequestBudget.create(new,60,armed=False)
            gate={'accounting_mode':'model_attempts_v1','approved_model_limit':60,
                  'approved_task_limit':3,'owner_authorization':'2026-10-25 Owner: 60 model requests, 3 QQ simulation tasks',
                  'previous_exhausted_ledger':str(old)}
            settings=round_settings(gate,{'roundBudget':str(new)},runtime,root)
            self.assertEqual(settings['limit'],60)
            self.assertEqual(settings['intake'],new.parent/'qq-intake.sqlite')
            self.assertEqual(previous.status(),before)
            with self.assertRaises(RuntimeError):
                round_settings(gate,{'roundBudget':str(old)},runtime,root)
            for key,value in [('approved_model_limit',61),('approved_task_limit',4),('owner_authorization','')]:
                with self.assertRaises(RuntimeError):
                    round_settings({**gate,key:value},{'roundBudget':str(new)},runtime,root)

    def test_one_approved_retry_preserves_failed_slot_and_closes_after_second(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "intake.sqlite"
            old = Intake(path)
            self.assertEqual(old.take("failed-first-task"), 1)
            reopened = Intake(path, cap=2)
            self.assertEqual(reopened.take("one-owner-approved-retry"), 2)
            self.assertIsNone(reopened.take("failed-first-task"))
            restarted = Intake(path, cap=2)
            with self.assertRaises(RuntimeError):
                restarted.take("not-approved-third-task")
            self.assertEqual(restarted.count(), 2)

    def test_a_live_adapter_without_model_catalog_is_not_ready(self):
        status = [{"name": "company_browser_simulation", "connected": True}]
        with self.assertRaises(RuntimeError):
            verify_browser_catalog(status, {"read_file", "vision_analyze"}, {"browser_navigate"})

    def test_both_process_connection_and_model_catalog_are_required(self):
        names = {"browser_navigate", "browser_snapshot"}
        expected = set(names)
        with self.assertRaises(RuntimeError):
            verify_browser_catalog([], names, expected)
        with self.assertRaises(RuntimeError):
            verify_browser_catalog([{"name":"company_browser_simulation", "connected":False}], names, expected)
        verify_browser_catalog([{"name":"company_browser_simulation", "connected":True}], names, expected)

    def test_only_native_qq_websocket_is_exempted(self):
        self.assertEqual(official_qq_websocket("wss://api.sgroup.qq.com/websocket"),
                         "wss://api.sgroup.qq.com/websocket")
        for url in ["ws://api.sgroup.qq.com/websocket", "wss://evil.test/websocket",
                    "wss://api.sgroup.qq.com.evil.test/websocket",
                    "wss://someone@api.sgroup.qq.com/websocket",
                    "wss://api.sgroup.qq.com:444/websocket", "wss://api.sgroup.qq.com/other"]:
            with self.assertRaises((RuntimeError, ValueError)):
                official_qq_websocket(url)

    def test_dedup_and_count_survive_transport_restart(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "intake.sqlite"
            a = Intake(path)
            self.assertEqual(a.take("first"), 1)
            b = Intake(path)
            self.assertIsNone(b.take("first"))
            self.assertEqual(b.take("second"), 2)
            self.assertEqual(b.take("third"), 3)
            with self.assertRaises(RuntimeError):
                b.take("fourth")
            self.assertEqual(b.count(), 3)

    def test_atomic_task_limit_under_concurrent_delivery(self):
        with tempfile.TemporaryDirectory() as d:
            a = Intake(Path(d) / "intake.sqlite")
            def take(n):
                try:
                    return a.take(str(n))
                except RuntimeError:
                    return None
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                admitted = list(pool.map(take, range(12)))
            self.assertEqual(sorted(x for x in admitted if x is not None), [1, 2, 3])
            self.assertEqual(a.count(), 3)

    def test_missing_message_id_is_not_admitted(self):
        with tempfile.TemporaryDirectory() as d:
            a = Intake(Path(d) / "intake.sqlite")
            with self.assertRaises(RuntimeError):
                a.take("")
            self.assertEqual(a.count(), 0)


if __name__ == "__main__":
    unittest.main()
