"""Exercise the installed Hermes adapter's peer admission without network/model calls.

Set HERMES_AGENT_ROOT to the active installation before running this test.
"""
import os
import sys
from types import SimpleNamespace as NS

root = os.environ.get("HERMES_AGENT_ROOT")
if not root:
    raise SystemExit("Set HERMES_AGENT_ROOT to the active Hermes installation")
sys.path.insert(0, root)

from plugins.platforms.feishu.adapter import FeishuAdapter, FeishuGroupRule  # noqa: E402

group = "oc_collaboration"
peer = "ou_pi"
self_id = "ou_hermes"
adapter = object.__new__(FeishuAdapter)
adapter.config = NS(extra={"bot_peer_allowlist_by_chat": {group: [peer]}})
adapter._allow_bots = "none"
adapter._bot_open_id = self_id
adapter._bot_user_id = ""
adapter._bot_name = "Hermes"
adapter._group_rules = {group: FeishuGroupRule(policy="open", require_mention=True)}
adapter._require_mention = True
adapter._admins = set()
adapter._default_group_policy = "open"
adapter._group_policy = "open"
adapter._allowed_group_users = set()


def sender(oid=peer, typ="bot"):
    return NS(sender_type=typ, sender_id=NS(open_id=oid, user_id=None, union_id=None))


def message(chat=group, mention=True, kind="group"):
    mentions = [NS(id=NS(open_id=self_id, user_id=None), name="Hermes")] if mention else []
    return NS(chat_type=kind, chat_id=chat, mentions=mentions,
              content="@_user_1 请帮忙", message_type="text")


assert adapter._admit(sender(), message()) is None
assert adapter._admit(sender(oid="ou_other"), message()) == "bots_disabled"
assert adapter._admit(sender(), message(chat="oc_other")) == "bots_disabled"
assert adapter._admit(sender(), message(mention=False)) == "bots_disabled"
assert adapter._admit(sender(), message(kind="p2p")) == "bots_disabled"
assert adapter._admit(sender(oid=self_id), message()) == "self_echo"
assert adapter._admit(sender(typ="user"), message()) is None
print("Hermes per-group peer gate: 7 checks passed")
