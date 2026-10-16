"""Regression of the observed Phase02A attribution defect, including negation."""
import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from collect_evidence import unsupported_claims,incorrect_demo_baseline,failure_empty_claim,premature_completion

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
    def test_observed_403_empty_bug_rejected(self):
        self.assertTrue(failure_empty_claim('HTTP403。当前可见范围为空（无任务记录）。'))
    def test_unread_not_empty_allowed(self):
        self.assertFalse(failure_empty_claim('HTTP403，记录未读取，是否为空未知。'))
    def test_partial_premature_header_rejected(self):
        self.assertTrue(premature_completion('已完成本轮获准虚拟页面读取。第2页失败。'))
    def test_partial_scope_header_allowed(self):
        self.assertFalse(premature_completion('部分分页读取失败，第1页已读，第2页未读；不能输出全部正常。'))
    def test_completion_explicitly_rejected_allowed(self):
        self.assertFalse(premature_completion('因此“全部正常”“巡检完成”均不成立。'))
    def test_latest_repeat_completion_explicitly_prohibited_allowed(self):
        self.assertFalse(premature_completion('第2页结果取得前，不应输出“巡检完成”或“全部正常”的结论。'))
    def test_latest_repeat_global_conclusion_unknown_allowed(self):
        self.assertFalse(premature_completion('总体“全范围无新增/全部正常”结论未知。'))

if __name__=='__main__':unittest.main()
