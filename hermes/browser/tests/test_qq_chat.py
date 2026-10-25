import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from qq_chat import OwnerMessageMeter,OwnerMessagePacer,validate_chat_gate,OWNER_CHAT_AUTH,CHAT_TOOLSETS,OrdinaryTrafficAudit
from request_budget import BudgetBlocked


class OrdinaryQQTests(unittest.TestCase):
    def test_ordinary_QQ_does_not_inherit_exercise_lifetime_control_limit(self):
        import sqlite3
        with tempfile.TemporaryDirectory() as d:
            audit=OrdinaryTrafficAudit(Path(d)/'traffic.sqlite')
            for _ in range(201):audit.reserve('qq','other_httpx')
            self.assertEqual(audit.counts()['qq'],201)

    def test_only_explicit_ordinary_chat_not_an_acceptance_gate(self):
        validate_chat_gate({'mode':'ordinary_owner_chat','owner_authorization':OWNER_CHAT_AUTH,
                            'browser_tasks_enabled':False,'business_tools_enabled':False})
        with self.assertRaises(RuntimeError):validate_chat_gate({'communication_only':True})
        with self.assertRaises(RuntimeError):validate_chat_gate({'mode':'ordinary_owner_chat','owner_authorization':OWNER_CHAT_AUTH,
                            'browser_tasks_enabled':True,'business_tools_enabled':False})
        self.assertEqual(CHAT_TOOLSETS,[])

    def test_requests_only_during_owner_message_and_no_test_ledger_created(self):
        with tempfile.TemporaryDirectory() as d:
            out=Path(d);meter=OwnerMessageMeter(out)
            with self.assertRaises(BudgetBlocked):meter.take('chat_completions')
            meter.begin()
            self.assertEqual(meter.take('chat_completions'),1)
            meter.finish()
            with self.assertRaises(BudgetBlocked):meter.take('chat_completions')
            self.assertEqual([p.name for p in out.iterdir()],['receipts.jsonl'])
            record=json.loads((out/'receipts.jsonl').read_text())
            self.assertEqual(record['ordinal'],1)

    def test_dialogue_is_not_limited_to_two_test_messages(self):
        with tempfile.TemporaryDirectory() as d:
            meter=OwnerMessageMeter(Path(d))
            for _ in range(3):
                meter.begin();meter.take();meter.finish()
            self.assertEqual(meter.ordinal,3)
            meter.begin()
            with self.assertRaises(RuntimeError):meter.begin()
            meter.finish()

    def test_background_and_provider_frozen_requests_still_fail_closed(self):
        with tempfile.TemporaryDirectory() as d:
            out=Path(d);meter=OwnerMessageMeter(out);pacer=OwnerMessagePacer(meter,out/'response.jsonl')
            with self.assertRaises(BudgetBlocked):pacer.check()
            meter.begin();pacer.check();pacer.frozen=True
            with self.assertRaises(BudgetBlocked):pacer.check()
            meter.finish()


if __name__=='__main__':unittest.main()
