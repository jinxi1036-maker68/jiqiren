"""Regression of the observed Phase02A attribution defect, including negation."""
import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from collect_evidence import unsupported_claims,incorrect_demo_baseline

class CauseEvidenceTests(unittest.TestCase):
    def test_observed_old_bug_rejected(self):
        self.assertTrue(unsupported_claims('待确认：503是模拟服务临时故障还是端口无服务。'))
    def test_negated_cause_list_allowed(self):
        self.assertFalse(unsupported_claims('具体原因未知；不能确认是端口无服务、服务未启动、网络断开或服务器宕机。'))
    def test_unfounded_page_exclusion_rejected(self):
        self.assertTrue(unsupported_claims('推断503为服务问题，非页面逻辑错误。'))
    def test_evidence_only_reply_allowed(self):
        self.assertFalse(unsupported_claims('HTTP503，未取得审核记录。具体原因未知，建议稍后重试。'))
    def test_observed_baseline_bug_rejected(self):
        self.assertTrue(incorrect_demo_baseline('DEMO-002 QA由"暂无"变为"模拟通过"。'))
    def test_actual_unchanged_baseline_allowed(self):
        self.assertFalse(incorrect_demo_baseline('DEMO-002基线已审、模拟通过，本次相同。'))

if __name__=='__main__':unittest.main()
