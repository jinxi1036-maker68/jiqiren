import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
import http.server
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import threading
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from request_budget import RequestBudget, BudgetBlocked, install_httpx_budget, network_audit


class BudgetTests(unittest.TestCase):
    def test_actual_openai_sync_retry_and_async_auxiliary_share_one_cap(self):
        from openai import OpenAI, AsyncOpenAI, APIConnectionError
        import json
        seen = []
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                self.rfile.read(int(self.headers.get("Content-Length", 0)))
                seen.append(self.path)
                status = 503 if len(seen) == 1 else 200
                body = ({"error": {"message": "synthetic", "type": "synthetic"}} if status == 503 else
                        {"id": "synthetic", "object": "chat.completion", "created": 0, "model": "synthetic",
                         "choices": [{"index": 0, "message": {"role": "assistant", "content": "synthetic"}, "finish_reason": "stop"}]})
                encoded = json.dumps(body).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)
            def log_message(self, *a):
                pass
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        url = "http://127.0.0.1:" + str(server.server_port) + "/v1"
        try:
            with tempfile.TemporaryDirectory() as d:
                b = RequestBudget.create(Path(d) / "budget.sqlite", 3)
                restore = install_httpx_budget(b)
                try:
                    with OpenAI(api_key="synthetic-not-a-real-account", base_url=url, max_retries=1) as c:
                        c.chat.completions.create(model="synthetic", messages=[{"role":"user","content":"synthetic"}])
                    async def auxiliary():
                        async with AsyncOpenAI(api_key="synthetic-not-a-real-account", base_url=url, max_retries=0) as c:
                            return await c.chat.completions.create(model="synthetic", messages=[{"role":"user","content":"synthetic"}])
                    asyncio.run(auxiliary())
                    with OpenAI(api_key="synthetic-not-a-real-account", base_url=url, max_retries=0) as c:
                        with self.assertRaises(APIConnectionError):
                            c.chat.completions.create(model="synthetic", messages=[{"role":"user","content":"synthetic"}])
                    self.assertEqual(len(seen), 3)
                    self.assertEqual(b.status()["families"], {"chat_completions": 3})
                finally:
                    restore()
        finally:
            server.shutdown()
            server.server_close()

    def test_startup_hook_is_inert_without_marker_and_fails_closed_outside_owned_root(self):
        startup = Path(__file__).resolve().parents[1] / "startup"
        env = dict(os.environ, PYTHONPATH=str(startup))
        env.pop("LINGJU_BROWSER_BUDGET", None)
        code = "import sys; print('BACKEND_CODE_REACHED')"
        unmarked = subprocess.run([sys.executable, "-B", "-c", code], env=env, capture_output=True, timeout=10)
        self.assertEqual(unmarked.returncode, 0)
        self.assertIn(b"BACKEND_CODE_REACHED", unmarked.stdout)
        env["LINGJU_BROWSER_BUDGET"] = "1"
        marked = subprocess.run([sys.executable, "-B", "-c", code], env=env, capture_output=True, timeout=10)
        self.assertEqual(marked.returncode, 78)
        self.assertNotIn(b"BACKEND_CODE_REACHED", marked.stdout)

    def test_zero_model_startup_stays_unarmed_and_preserves_count_when_armed(self):
        with tempfile.TemporaryDirectory() as d:
            b = RequestBudget.create(Path(d) / "budget.sqlite", 120, armed=False)
            with self.assertRaises(BudgetBlocked):
                b.take("chat_completions")
            self.assertEqual(b.status()["reserved_network_attempts"], 0)
            self.assertEqual(b.status()["events"], {"denied_unarmed": 1})
            b.arm()
            b.take("responses")
            self.assertEqual(b.status()["reserved_network_attempts"], 1)
            self.assertEqual(b.status()["families"], {"responses": 1})
    def test_shared_atomic_counter_never_resets_for_new_client_or_retry(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "budget.sqlite"
            b = RequestBudget.create(path, 12)
            def take(_):
                try:
                    RequestBudget(path).take()
                    return True
                except BudgetBlocked:
                    return False
            with ThreadPoolExecutor(max_workers=8) as executor:
                self.assertEqual(sum(executor.map(take, range(45))), 12)
            self.assertEqual(b.status()["reserved_network_attempts"], 12)
            with self.assertRaises(FileExistsError):
                RequestBudget.create(path)
            # Missing ledger cannot recreate/reset budget.
            path.unlink()
            with self.assertRaises((BudgetBlocked, sqlite3.Error)):
                b.take()
            self.assertFalse(path.exists())

    def test_sync_async_redirect_and_failed_responses_all_count_before_send(self):
        import httpx
        seen = []
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                seen.append(self.path)
                self.send_response(302 if self.path == "/redirect" else 503)
                if self.path == "/redirect":
                    self.send_header("Location", "/failed")
                self.send_header("Content-Length", "0")
                self.end_headers()
            def log_message(self, *a):
                pass
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        url = "http://127.0.0.1:" + str(server.server_port)
        try:
            with tempfile.TemporaryDirectory() as d:
                b = RequestBudget.create(Path(d) / "budget.sqlite", 4)
                restore = install_httpx_budget(b)
                try:
                    with httpx.Client(trust_env=False) as c:
                        self.assertEqual(c.get(url + "/redirect", follow_redirects=True).status_code, 503)
                        self.assertEqual(c.get(url + "/retry").status_code, 503)
                    async def call():
                        async with httpx.AsyncClient(trust_env=False) as c:
                            return await c.get(url + "/auxiliary")
                    self.assertEqual(asyncio.run(call()).status_code, 503)
                    with httpx.Client(trust_env=False) as c:
                        with self.assertRaises(BudgetBlocked):
                            c.get(url + "/must-not-arrive")
                    self.assertEqual(seen, ["/redirect", "/failed", "/retry", "/auxiliary"])
                    self.assertEqual(b.status()["reserved_network_attempts"], 4)
                finally:
                    restore()
        finally:
            server.shutdown()
            server.server_close()

    def test_hidden_transport_retry_is_rejected_before_request(self):
        import httpx
        with tempfile.TemporaryDirectory() as d:
            b = RequestBudget.create(Path(d) / "budget.sqlite")
            restore = install_httpx_budget(b)
            try:
                with httpx.Client(transport=httpx.HTTPTransport(retries=1), trust_env=False) as c:
                    with self.assertRaises(BudgetBlocked):
                        c.get("http://127.0.0.1:1/no-network")
                self.assertEqual(b.status()["reserved_network_attempts"], 0)
            finally:
                restore()

    def test_unmetered_external_socket_is_denied_without_network(self):
        with self.assertRaises(BudgetBlocked):
            network_audit("socket.connect", (None, ("192.0.2.1", 443)))
        network_audit("socket.connect", (None, ("127.0.0.1", 12345)))
        network_audit("socket.connect", (None, ("::1", 12345)))

    def test_counter_is_shared_across_separate_python_processes(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "budget.sqlite"
            b = RequestBudget.create(path, 1)
            program = ("import sys; sys.path.insert(0,sys.argv[1]); "
                       "from request_budget import RequestBudget; RequestBudget(sys.argv[2]).take()")
            args = [sys.executable, "-I", "-B", "-c", program,
                    str(Path(__file__).resolve().parents[1]), str(path)]
            first = subprocess.run(args, capture_output=True, timeout=10)
            second = subprocess.run(args, capture_output=True, timeout=10)
            self.assertEqual(first.returncode, 0)
            self.assertNotEqual(second.returncode, 0)
            self.assertEqual(b.status()["reserved_network_attempts"], 1)


if __name__ == "__main__":
    unittest.main()
