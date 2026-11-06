"""Offline contract checks; no Hermes model call or Feishu group send."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from hermes.feishu_crosschat.bridge import CrossChat, CrossChatError


GROUP = "oc_group_example"
DM = "oc_dm_example"
MESSAGE = "om_owner_example"


class Response:
    status_code = 200

    def __init__(self, data):
        self.data = data

    def json(self):
        return self.data


class HTTP:
    def __init__(self, **kwargs):
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append(("POST", url))
        return Response({"code": 0, "access_token": "fake-token"})

    def get(self, url, **kwargs):
        self.calls.append(("GET", url))
        if url.endswith("/" + MESSAGE):
            return Response({"code": 0, "data": {"items": [{
                "chat_id": DM, "sender": {"id_type": "open_id", "id": "ou_owner",
                                             "sender_type": "user"},
                "msg_type": "text", "body": {"content": json.dumps({"text": "去合作群看看问题并回复"})},
            }]}})
        return Response({"code": 0, "data": {"items": [{
            "message_id": "om_group_1", "create_time": "1000", "msg_type": "text",
            "sender": {"id": "ou_member", "sender_type": "user"},
            "body": {"content": json.dumps({"text": "设备情况待核实"})},
        }], "has_more": False, "page_token": ""}})

    def close(self):
        pass


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)
        directory = self.home / "tools" / "company-feishu-crosschat"
        directory.mkdir(parents=True)
        (directory / "policy.json").write_text(json.dumps({
            "app_id": "cli_test", "owner_dm_chat_id": DM,
            "owner_user_id": "owner_user", "owner_union_id": "on_owner",
            "owner_open_id": "ou_owner",
            "groups": [{"id": GROUP, "name": "合作群", "aliases": ["合作群"]}],
        }), encoding="utf-8")
        (self.home / "config.yaml").write_text(
            "platforms:\n  feishu:\n    extra:\n      group_allowed_chats:\n        - " + GROUP + "\n",
            encoding="utf-8",
        )
        (self.home / ".env").write_text(
            "FEISHU_APP_ID=cli_test\nFEISHU_APP_SECRET=fake-secret\n", encoding="utf-8")
        self.session = {"PLATFORM": "feishu", "CHAT_TYPE": "dm", "CHAT_ID": DM,
                        "USER_ID": "owner_user", "USER_ID_ALT": "on_owner", "MESSAGE_ID": MESSAGE}
        self.http = HTTP()
        self.injected = []
        self.bridge = CrossChat(home=self.home, session_value=self.session.get,
                                http_factory=lambda **kw: self.http,
                                inject_message=lambda *a, **kw: self.injected.append((a, kw)) or True)

    def test_read_and_delegate_once_into_same_group_session(self):
        self.assertEqual(self.bridge.list_groups()["groups"][0]["name"], "合作群")
        read = self.bridge.read_group("合作群")
        self.assertEqual(read["items"][0]["text"], "设备情况待核实")
        result = self.bridge.delegate("合作群", "核对群里的设备问题，查清后在群里回复。")
        self.assertEqual(result["status"], "accepted_not_completed")
        self.assertEqual(self.injected[0][1]["origin"]["chat_id"], GROUP)
        self.assertEqual(self.injected[0][1]["origin"]["chat_type"], "group")
        self.assertIn("设备情况待核实", self.injected[0][0][0])
        self.assertEqual(self.bridge.delegate("合作群", "核对群里的设备问题，查清后在群里回复。")
                         ["status"], "already_delegated_or_unknown")
        self.assertEqual(len(self.injected), 1)

    def test_group_member_cannot_read_or_delegate(self):
        self.session["CHAT_TYPE"] = "group"
        with self.assertRaises(CrossChatError):
            self.bridge.read_group("合作群")
        with self.assertRaises(CrossChatError):
            self.bridge.delegate("合作群", "请帮我在群里回复这个问题。")

    def test_other_dm_sender_cannot_use_owner_capability(self):
        self.session["USER_ID_ALT"] = "on_other"
        with self.assertRaisesRegex(CrossChatError, "身份"):
            self.bridge.list_groups()
        self.assertFalse(self.http.calls)

    def test_forged_source_message_sender_refused(self):
        self.http.get = lambda url, **kw: Response({"code": 0, "data": {"items": [{
            "chat_id": DM, "sender": {"id_type": "open_id", "id": "ou_other", "sender_type": "user"},
            "msg_type": "text", "body": {"content": json.dumps({"text": "去合作群处理"})},
        }]}})
        with self.assertRaisesRegex(CrossChatError, "原始消息"):
            self.bridge.delegate("合作群", "核对群里的设备问题，查清后在群里回复。")
        self.assertFalse(self.injected)

    def test_owner_must_name_target_in_actual_message(self):
        self.http.get = lambda url, **kw: Response({"code": 0, "data": {"items": [{
            "chat_id": DM, "sender": {"id_type": "open_id", "id": "ou_owner", "sender_type": "user"},
            "msg_type": "text", "body": {"content": json.dumps({"text": "在吗"})},
        }]}})
        with self.assertRaisesRegex(CrossChatError, "未明确指定"):
            self.bridge.delegate("合作群", "核对群里的设备问题，查清后在群里回复。")
        self.assertFalse(self.injected)

    def test_wrong_app_and_changed_group_allowlist_fail_closed(self):
        (self.home / ".env").write_text(
            "FEISHU_APP_ID=cli_other\nFEISHU_APP_SECRET=fake-secret\n", encoding="utf-8")
        with self.assertRaisesRegex(CrossChatError, "应用身份"):
            self.bridge.read_group("合作群")
        (self.home / "config.yaml").write_text(
            "platforms:\n  feishu:\n    extra:\n      group_allowed_chats: []\n", encoding="utf-8")
        with self.assertRaisesRegex(CrossChatError, "白名单"):
            self.bridge.list_groups()

    def test_refused_injection_does_not_claim_message(self):
        self.bridge.inject_message = lambda *a, **kw: False
        with self.assertRaisesRegex(CrossChatError, "未接受"):
            self.bridge.delegate("合作群", "核对群里的设备问题，查清后在群里回复。")
        self.assertFalse(list((self.home / "tools" / "company-feishu-crosschat" / "receipts").glob("*.json")))


if __name__ == "__main__":
    unittest.main()
