import sys,unittest,tempfile,contextlib,sqlite3
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from ego_task import EgoReadonlyExercise
from request_budget import RequestAudit

class EgoDailyPauseTests(unittest.TestCase):
    def test_daily_pause_preserves_accounting_and_uses_real_budget_interface(self):
        with tempfile.TemporaryDirectory() as d:
            audit=RequestAudit.create(Path(d)/'audit.sqlite');audit.arm();audit.take('chat_completions')
            e=object.__new__(EgoReadonlyExercise);e.budget=audit;e.pause()
            state=audit.status()
            self.assertFalse(state['armed']);self.assertEqual(state['reserved_network_attempts'],1)
            self.assertIsNone(state['limit']);self.assertFalse(state['quota_enforced'])
            e.pause();self.assertEqual(audit.status()['reserved_network_attempts'],1)
if __name__=='__main__':unittest.main()
