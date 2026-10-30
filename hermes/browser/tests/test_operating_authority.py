import sys,types,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from company_support import operating_authority,apply_operating_authority,AUTH_START
def config():
 return dict(schema='lingju.ego-browser.v3',mode='company-business',productionEnabled=True,businessWritesEnabled=True,
  origin='https://ldp.lingrobotics.com',businessAuthorization=dict(schema='lingju.browser-business-grant.v1',ownerApproved=True,
  scopeOrigin='https://ldp.lingrobotics.com',scope='all-company-browser-ui-business-actions',reference='synthetic approval',highImpactRequiresSpecificOwnerTask=True))
class Authority(unittest.TestCase):
 def test_explicit_grant_separates_live_authority_from_historical_knowledge(self):
  a=operating_authority(config());self.assertTrue(a['real_company_browser_authorized']);self.assertTrue(a['business_UI_writes_authorized'])
  self.assertIn('not proof',a['availability']);self.assertIn('historical',a['historical_stage_policy'])
 def test_flags_or_wrong_site_never_create_a_business_grant(self):
  for change in [{'businessAuthorization':{}},{'origin':'https://unapproved.example'},{'productionEnabled':False}]:
   self.assertFalse(operating_authority({**config(),**change})['business_UI_writes_authorized'])
 def test_ephemeral_native_prompt_preserves_channel_policy_and_is_idempotent(self):
  msg=types.SimpleNamespace(channel_prompt='existing native channel policy')
  apply_operating_authority(msg,config());apply_operating_authority(msg,config())
  self.assertEqual(msg.channel_prompt.count(AUTH_START),1);self.assertTrue(msg.channel_prompt.startswith('existing native channel policy'))
  self.assertIn('不是Gate1A本机模拟',msg.channel_prompt);self.assertIn('不猜绑定或保存结果',msg.channel_prompt)
 def test_readonly_scope_does_not_gain_writes(self):
  a=operating_authority({'schema':'lingju.ego-browser.v2','mode':'company-readonly','origin':'https://ldp.lingrobotics.com','productionEnabled':False,'businessWritesEnabled':False,'approvalReference':'synthetic-readonly'})
  self.assertTrue(a['real_company_browser_authorized']);self.assertFalse(a['business_UI_writes_authorized'])
 def test_synthetic_or_absent_config_does_not_override_role_or_policy(self):
  msg=types.SimpleNamespace(channel_prompt='existing');apply_operating_authority(msg,{})
  self.assertEqual(msg.channel_prompt,'existing')
