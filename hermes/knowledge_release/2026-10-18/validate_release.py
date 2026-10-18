"""Offline semantic/reference/hash checks. Never accesses Hermes home or runs a model."""
from pathlib import Path
import hashlib, json, re, sys

ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
def load(p):return json.loads((ROOT/p).read_text(encoding='utf-8'))
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
for p in ROOT.rglob('*.json'):json.loads(p.read_text(encoding='utf-8'))
cw=load('knowledge/CURRENT_WORK.json');pi=load('knowledge/PROJECT_INDEX.json');pl=load('knowledge/PARTNER_LEDGER.json')
assert cw['work_item_id']==pi['current']['active_work_item_id']=='WI-2026-10-livsyn-first-trial-prep'
assert cw['company_identity']['name']==pi['company_identity']['official_zh_name']=='平顶山凌矩信息科技有限责任公司'
assert cw['now']['owner_reported_operational_update']['planned_active_devices']==3
assert cw['now']['owner_reported_operational_update']['actual_qa_accepted_hours'] is None
assert cw['now']['current_owner_self_operated_cap_2026_10_18']['own_devices_target']==10
assert cw['now']['future_network_cap_discussion_2026_10_18']['proposed_devices_total']==100
assert cw['now']['future_network_cap_discussion_2026_10_18']['includes_self_operated_ten'] is None
assert cw['now']['nine_team_leaders_employment_2026_10_18']['total_leaders']==9
assert cw['now']['nine_team_leaders_employment_2026_10_18']['status']=='owner_approved_future_hiring_method'
assert len({x['id'] for x in pl['partners']})==len(pl['partners'])
liv=next(x for x in pl['partners'] if x['id']=='livsyn')
assert liv['reporting_and_pilot_2026_10_16']['actual_qa_confirmed_hours'] is None
assert liv['daily_reporting_requirement_2026_10_17']['submission_format']=='plain_text_message'
daily=load('knowledge/LIVSYN_PINGDINGSHAN_DAILY_REPORT_REQUIREMENTS_2026-10-16.json')
assert len(daily['required_sections'])==4 and daily['submission_format']=='plain_text_message'
assert daily['pilot_plan']['current_actual_qa_accepted_hours'] is None
assert daily['partner_followup_2026_10_16']['payment_timing_specified'] is False
actual=cw['now']['owner_reported_daily_actuals_2026_10_17']
assert actual['operating_date']=='2026-10-17'
assert actual['evidence_level']=='owner_reported_not_platform_verified'
assert (actual['staff_participating'],actual['raw_capture_hours'],actual['average_raw_hours_per_person'])==(3,18,6)
assert actual['raw_capture_hours']/actual['staff_participating']==actual['average_raw_hours_per_person']
assert (actual['available_devices'],actual['abnormal_devices'])==(10,0)
assert all(actual[k] is None for k in ('upload_completed_for_operating_date','actual_uploaded_hours','platform_qa_effective_hours','settlement_confirmed','payment_received','daily_report_sent'))
assert actual['historical_backlog']['owner_reported_status']=='none_reported'
assert actual['historical_backlog']['platform_verified'] is False
assert actual['historical_backlog']['does_not_establish_operating_date_upload_completion'] is True
assert len(actual['owner_reported_efficiency_issues'])==2
assert cw['now']['owner_reported_operational_update']['actual_staffing']==3
assert cw['now']['owner_reported_operational_update']['actual_capture_hours']==18
assert cw['now']['owner_reported_operational_update']['reported_on']=='2026-10-16'
assert cw['now']['owner_reported_operational_update']['total_planned_effective_target_hours']==12
assert daily['pilot_plan']['aggregate_capture_target_device_hours']==18
assert daily['pilot_plan']['aggregate_effective_target_device_hours']==12
assert daily['pilot_plan']['record_status']=='historical_plan_as_of_2026_10_16'
assert daily['actual_submission_status']=='unverified'
for summary in (pi['current']['owner_reported_daily_actuals_2026_10_17'],liv['daily_reporting_requirement_2026_10_17']['day_one_actuals'],daily['owner_reported_daily_actuals_2026_10_17']):
 for k in ('evidence_level','staff_participating','raw_capture_hours','average_raw_hours_per_person','available_devices','abnormal_devices','upload_completed_for_operating_date','platform_qa_effective_hours','settlement_confirmed','daily_report_sent'):assert summary[k]==actual[k]
assert r'\n' not in (ROOT/'knowledge/00_START_HERE.md').read_text(encoding='utf-8')
revision=load('hermes/knowledge_release/2026-10-18/REVIEW_18_RESPONSE.json')
policy_keys=['current_owner_self_operated_cap_2026_10_18','future_network_cap_discussion_2026_10_18','nine_team_leaders_employment_2026_10_18']
assert hashlib.sha256(json.dumps({k:cw['now'][k] for k in policy_keys},ensure_ascii=False,sort_keys=True).encode()).hexdigest()==revision['unchanged_team_policy_sha256']
# Static source versions must remain valid before and after any future deployment.
candidate=cw['now']['company_knowledge_candidate']
assert candidate['status']=='versioned_knowledge_artifact'
assert candidate['status_scope']=='immutable_artifact_metadata_not_runtime_deployment_state'
policy=candidate['local_deployment_evidence']
assert policy==pi['hermes_digital_employee']['local_knowledge_deployment']
assert policy['state_source']=='local_manifest_and_authorized_deployment_verification_record'
assert policy['manifest_file']=='SNAPSHOT_MANIFEST.json'
assert policy['static_artifact_is_deployment_evidence'] is False
assert len(policy['required_evidence'])==3
assert policy['missing_or_conflicting_evidence'].startswith('unverified;')
assert candidate['release_id']==pi['hermes_digital_employee']['company_knowledge_version']['release_id']
brief=(ROOT/'knowledge/OPERATING_BRIEF_2026-10-18.md').read_text(encoding='utf-8')
assert candidate['release_id'] in brief and 'Owner授权部署核验记录' in brief
assert '不从本静态快照推定已部署或未部署' in brief
active_fields=[candidate['status'],cw['parallel_development_track']['status'],cw['parallel_development_track']['current_limits'],cw['parallel_development_track']['current_phase'],pi['hermes_digital_employee']['implementation_state'],pi['hermes_digital_employee']['caveat'],brief]
for value in active_fields:
 assert all(stale not in value for stale in ('draft_for_owner_review_not_deployed','company_knowledge_candidate_not_deployed','公司W知识刷新尚未执行','本候选未部署','本次仅整合公司知识并准备增量部署，未写入W','状态：待Owner与ChatGPT审查的知识版本'))
econ=load('knowledge/ECONOMICS_MODEL.json')
assert econ['model_applicability_2026_10_18']['old_self_operated_50']=='superseded_historical_scenario'
assert econ['local_network_100_device_stage_cap_2026_10_18']['leader_employment_model_2026_10_18']['individuals_actual_hired'] is False
charter=ROOT/'knowledge/HERMES_DIGITAL_EMPLOYEE_CHARTER.md'
assert blob(charter.read_bytes())=='9471c5894e323461957e56f5594001207d4c1292'
payload=load('hermes/knowledge_release/2026-10-18/PAYLOAD_FILES.json')
assert len(payload['files'])==32
assert candidate['release_id']==payload['release_id']
for f in payload['files']:
 p=(ROOT/f['path']).resolve();assert p.is_relative_to(ROOT.resolve())
 data=p.read_bytes();assert hashlib.sha256(data).hexdigest()==f['sha256'] and blob(data)==f['git_blob_sha']
 assert f['path'] not in ('HERMES.md','GATE_1A_STATUS.json','SNAPSHOT_MANIFEST.json')

# Validate all newly added Markdown link targets and all machine routing fields;
# legacy references to non-cached main files remain allowed but are recorded.
base=load('hermes/knowledge_release/2026-10-18/BASE_TREE_PATHS.json')
available=set(base)|{p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*') if p.is_file()}
missing=[];not_cached=[];checked=set()
def check(ref,origin):
 if re.match(r'^(?:https?://|mailto:|#|app:|chatgpt:)',ref):return
 target=ref.split('#',1)[0].split('?',1)[0]
 if not target or not re.search(r'\.(?:md|json|csv)$',target):return
 if target.startswith(('knowledge/','hermes/','templates/')) or target=='AGENTS.md':rel=target
 else:
  try:rel=(ROOT/Path(origin).parent/target).resolve().relative_to(ROOT.resolve()).as_posix()
  except ValueError:missing.append({'origin':origin,'target':target});return
 checked.add((origin,rel))
 if rel not in available:missing.append({'origin':origin,'target':rel})
 elif not (ROOT/rel).is_file():not_cached.append({'origin':origin,'target':rel,'availability':'GitHub main only; not W payload'})
for f in payload['files']:
 path=f['path']
 if path.endswith('.md'):
  for ref in re.findall(r'\]\(([^)]+)\)',(ROOT/path).read_text(encoding='utf-8')):check(ref,path)
def walk(v,origin,key=''):
 if isinstance(v,dict):
  for k,val in v.items():walk(val,origin,k)
 elif isinstance(v,list):
  for val in v:walk(val,origin,key)
 elif isinstance(v,str) and v.endswith(('.md','.json','.csv')) and not v.startswith('http'):
  if '/' in v or v=='AGENTS.md':check(v,origin)
for f in payload['files']:
 if f['path'].endswith('.json'):walk(load(f['path']),f['path'])
assert not missing,missing
plan_path=HERE/'DEPLOYMENT_PLAN.json'
if plan_path.is_file() and '--knowledge-only' not in sys.argv:
 plan=json.loads(plan_path.read_text(encoding='utf-8'));assert plan['deployment_performed'] is False
 assert plan['counts']=={'before_source_files':18,'after_source_files':32,'before_deployment_files':3,'after_deployment_files':3,'before_total_files':21,'after_total_files':35}
 rows=plan['files'];assert len(rows)==32
 assert sum(x['action']=='add' for x in rows)==14
 assert sum(x['action']=='update' for x in rows)==9
 assert sum(x['action']=='preserve' for x in rows)==9
 for x in rows:
  assert x['target']==('W/'+x['repository_path'])
  if x['action']=='add':assert x['before_sha256'] is None and x['required_before_state']=='absent'
  elif x['action']=='preserve':assert x['before_sha256']==x['after_sha256']
 assert plan['protected']['W/HERMES.md']=='0ae46293b8773631ceb3acf0da4a44ae6d361860e44c95926ccf322185374247'
 manifest=(HERE/'SNAPSHOT_MANIFEST.candidate.json').read_bytes()
 assert hashlib.sha256(manifest).hexdigest()==plan['manifest_update']['after_sha256']
 assert len(json.loads(manifest)['files'])==32
 decoded=json.loads(manifest)
 assert plan['approved_source_commit']==decoded['ref']
 assert plan['release_id']==decoded['release_id']==payload['release_id']
 manifest_rows={x['path']:x for x in decoded['files']}
 payload_rows={x['path']:x for x in payload['files']}
 assert set(manifest_rows)==set(payload_rows)=={x['repository_path'] for x in rows}
 for row in rows:
  path=row['repository_path']; m=manifest_rows[path]; p=payload_rows[path]
  assert row['github_source']['commit']==decoded['ref']
  assert row['after_sha256']==m['sha256']==p['sha256']
  assert row['github_source']['git_blob_sha']==m['git_blob_sha']==p['git_blob_sha']
 assert decoded['deployment_evidence_policy']==policy

 for x in json.loads(manifest)['files']:
  assert hashlib.sha256((ROOT/x['path']).read_bytes()).hexdigest()==x['sha256']

report={'static_artifact_runtime_deployment_separated':True,'deployment_authority_manifest_and_authorized_record':True,'missing_deployment_evidence_is_unverified':True,'stale_current_deployment_assertions_removed':True,'json_valid':True,'shared_schema_and_semantics_passed':True,'work_item_consistent':True,'owner_reported_actuals_consistent':True,'historical_plan_separate':True,'raw_not_QA_or_settlement':True,'upload_and_report_send_unknown':True,'entry_literal_newline_escape_removed':True,'team_policy_unchanged':True,'charter_blob_unchanged':True,'payload_hashes_verified':32,'references_checked':len(checked),'missing_references':missing,'repo_only_references_not_in_payload':not_cached,'deployment_plan_present':plan_path.is_file(),'deployment_plan_checked':'--knowledge-only' not in sys.argv,'Hermes_model_calls':0,'original_environment_writes':0}
print(json.dumps(report,ensure_ascii=False,indent=2))
