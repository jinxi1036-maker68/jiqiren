import asyncio
import sys
import unittest
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))
from client import BitableClient, BitableError, stable_client_token
from server import build_server


class BitableClientTests(unittest.TestCase):
    def setUp(self):
        self.calls = []

        def handler(request):
            self.calls.append((request.method, request.url.path, str(request.url.query)))
            if request.url.path == "/oauth/v3/token":
                return httpx.Response(200, json={"code": 0, "access_token": "t-test", "expires_in": 3600})
            if request.url.path.endswith("/records/rec123") and request.method == "GET":
                return httpx.Response(200, json={"code": 0, "data": {"record": {"fields": {"状态": "待办"}}}})
            return httpx.Response(200, json={"code": 0, "data": {"items": [], "has_more": False}})

        self.http = httpx.Client(transport=httpx.MockTransport(handler))
        self.client = BitableClient("cli_test", "secret-test", "basTEST", http=self.http)

    def tearDown(self):
        self.http.close()

    def test_read_uses_allowlisted_base_and_caches_token(self):
        self.client.list_tables()
        self.client.list_records("tbl123")
        self.assertEqual(sum(path == "/oauth/v3/token" for _, path, _ in self.calls), 1)
        self.assertTrue(all("basTEST" in path or path == "/oauth/v3/token" for _, path, _ in self.calls))

    def test_write_tools_not_exposed_by_default(self):
        names = {tool.name for tool in asyncio.run(build_server(self.client).list_tools())}
        self.assertIn("company_bitable_list_records", names)
        self.assertNotIn("company_bitable_create_record", names)
        with self.assertRaisesRegex(BitableError, "not enabled"):
            self.client.create_record("tbl123", {"名称": "X"}, "task-123456")

    def test_write_requires_old_value_and_stable_idempotency_key(self):
        self.client.write_enabled = True
        self.assertIn("company_bitable_create_record", {t.name for t in asyncio.run(build_server(self.client).list_tools())})
        with self.assertRaisesRegex(BitableError, "Record changed"):
            self.client.update_record("tbl123", "rec123", {"状态": "完成"}, "task-123456", {"状态": "处理中"})
        self.assertFalse(any(method == "PUT" for method, _, _ in self.calls))
        self.client.create_record("tbl123", {"名称": "X"}, "task-123456")
        self.assertTrue(any(method == "POST" and "client_token=" in query for method, _, query in self.calls))
        self.assertEqual(stable_client_token("task-123456"), stable_client_token("task-123456"))

    def test_invalid_resource_id_rejected_before_network(self):
        with self.assertRaisesRegex(BitableError, "Invalid"):
            self.client.list_records("../other")
        self.assertEqual(self.calls, [])

    def test_short_operation_key_cannot_write(self):
        self.client.write_enabled = True
        with self.assertRaisesRegex(BitableError, "operation_key"):
            self.client.create_record("tbl123", {"名称": "X"}, "")
        self.assertEqual(self.calls, [])


if __name__ == "__main__":
    unittest.main()
