from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from launch import task_scope_for
from qq_browser_task import validate_browser_grant,REMAINING_AUTHORIZATION,REMAINING_PREFIX,FEISHU_TRANSFER,AUTHORIZATION,PREFIX

class RemainingScopeTests(unittest.TestCase):
    def test_launcher_only_allows_the_narrower_scope_not_another_case_grant(self):
        for case in ['analysis','binding','recovery']:self.assertEqual(task_scope_for(case),case)
        self.assertEqual(task_scope_for('recovery','remaining-readonly'),'remaining-readonly')
        for case,scope in [('analysis','remaining-readonly'),('recovery','binding'),('binding','analysis'),('recovery','unknown')]:
            with self.assertRaises(ValueError):task_scope_for(case,scope)

    def test_remaining_task_needs_its_own_exact_human_grant_and_prefix(self):
        value=dict(owner_authorization=REMAINING_AUTHORIZATION,channel='feishu',channel_transfer_authorization=FEISHU_TRANSFER,
                   request_limit=30,task_limit=1,case='remaining-pages',message_prefix=REMAINING_PREFIX,zero_model_checks_passed=True)
        validate_browser_grant(value,'feishu')
        for change in [dict(owner_authorization=AUTHORIZATION),dict(message_prefix=PREFIX),dict(request_limit=31),dict(task_limit=2),dict(zero_model_checks_passed=False)]:
            with self.assertRaises(RuntimeError):validate_browser_grant({**value,**change},'feishu')
        with self.assertRaises(RuntimeError):validate_browser_grant(value,'qqbot')

if __name__=='__main__':unittest.main()
