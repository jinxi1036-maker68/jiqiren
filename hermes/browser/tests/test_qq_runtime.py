import concurrent.futures
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from qq_runtime import Intake, official_qq_websocket, verify_browser_catalog


class QQIntakeTests(unittest.TestCase):
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
