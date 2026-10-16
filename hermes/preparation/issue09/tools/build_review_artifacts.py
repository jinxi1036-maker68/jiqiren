"""Build explicitly redacted review artifacts from this preparation's private metadata.

No original data is changed. No raw old memory/prompt/credential is published.
This is a one-round audit helper, not a Hermes deployment or cleanup tool.
"""
from pathlib import Path
import json,re,datetime,hashlib,shutil
base=Path(__file__).resolve().parent;private=base/'private';pub=base.parent/'hermes_issue09_preparation_publication'
dest=pub/'hermes/preparation/issue09';evidence=pub/'hermes/evidence/issue09_preparation';evidence.mkdir(parents=True,exist_ok=True)
j=json.loads((private/'selected_probe_local_only.json').read_text(encoding='utf-8'))
def clean(value):
    if isinstance(value,dict):return {k:(v if k in ['TaskPath','task_path'] else clean(v)) for k,v in value.items()}
    if isinstance(value,list):return [clean(v) for v in value]
    if not isinstance(value,str):return value
    while '\\\\' in value:value=value.replace('\\\\','\\')
    value=value.replace(str(Path.home()),'<USER_HOME>').replace(str(Path.home()).replace('\\','/'),'<USER_HOME>')
    return value.replace('\\','/').replace('<USER_HOME>/.hermes','H').replace('<USER_HOME>/AppData/Local/hermes','P').replace('<USER_HOME>/AppData/Roaming/Hermes','D')
def write(path,value):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(clean(value),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
segments=[];files=[];local=['# 本机审阅索引（仅本地；不提交GitHub）','本轮没有改写或删除任何原内容。可点击原文件并按公开条目范围核对；这里只保存定位信息，不复制旧正文。','']
for item in j['identity_entry_metadata']:
    name=Path(item['path']).name if '/' in item['path'] else item['path'].split('\\')[-1]
    source=Path.home()/'.hermes'/('SOUL.md' if name=='SOUL.md' else 'memories/'+name)
    draft=dest/'drafts'/name.replace('.md','.draft.md');after=draft.read_text(encoding='utf-8')
    raw=source.read_text(encoding='utf-8-sig')
    native_count=len([x for x in raw.split('\n§\n') if x.strip()]) if name!='SOUL.md' else None
    files.append({'target':clean(item['path']),'before_sha256':item['sha256'],'before_characters':item['characters'],'native_memory_entries_before':native_count,'review_segments_before':len(item['entries']),'proposed_draft':str(draft.relative_to(pub)).replace('\\','/'),'draft_characters':len(after),'draft_sha256':hashlib.sha256(after.encode()).hexdigest(),'native_memory_entries_proposed':len([x for x in after.split('\n§\n') if x.strip()]) if name!='SOUL.md' else None,'owner_approval':'pending','deployment':'not_executed'})
    for row in item['entries']:
        old=row['topics'];old_business=any(x.startswith('old_') for x in old)
        proposal='拟退出当前公司岗位事实；混合的通用方法须Owner核对后单独保留' if old_business else '待Owner核对：可能是结构、通用偏好或未分类内容；不得自动删除'
        segments.append({'id':row['entry_id'],'target':clean(item['path']),'before_line_range':[row['start_line'],row['end_line']],'before_summary':'旧正文不公开；主题线索：'+(','.join(old) or '未分类/结构片段'),'before_is_semantically_verified':False,'proposed_change':proposal,'after_reference':str(draft.relative_to(pub)).replace('\\','/'),'owner_decision':'pending','whole_file_replacement_allowed_now':False})
        local.append(f'- {row["entry_id"]}：[{name} 第{row["start_line"]}行]({source.as_posix()}:{row["start_line"]})—第{row["end_line"]}行；主题线索{old or "未分类"}；尚未批准处置。')
identity={'status':'draft_only_not_approved_for_deployment','source_files':files,'review_segmentation':'Blank lines and native § delimiter; review segments are not necessarily native memory entries. Topic cues are not semantic ownership decisions.','before_raw_text_published':False,'replacement_requires_all_affected_segments_and_new_content_approved':True,'segments':segments,'new_workspace_file':{'target':'H/company-workspace/HERMES.md','currently_exists':(Path.home()/'.hermes/company-workspace/HERMES.md').exists(),'draft':'hermes/preparation/issue09/drafts/HERMES.draft.md','owner_approval':'pending'}}
write(dest/'IDENTITY_ITEM_DIFF.json',identity);(private/'OWNER_LOCAL_REVIEW.md').write_text('\n'.join(local)+'\n',encoding='utf-8')
changes=[
('C01','H/config.yaml:terminal.cwd',j['selected_fields']['terminal.cwd'],'H/company-workspace','需Owner批准字段改动，并核实Desktop会话cwd优先级'),
('C02','D/project-dir.json:dir','文件不存在','H/company-workspace','需Owner批准原入口默认项目设置；本轮没有创建该文件'),
('C03','H/config.yaml:mcp_servers.playwright-xianyu-lab',j['mcp']['playwright-xianyu-lab'],'拟退出旧CDP业务绑定，包暂保留','中性接入及原入口增量验收获批后才可处理'),
('C04','H/config.yaml:mcp_servers.xianyu-browser-tools',j['mcp']['xianyu-browser-tools'],'拟退出旧上传业务server绑定，原目录暂保留','本轮只验证开发区解耦，未批准停用原server'),
('C05','H/config.yaml:mcp_servers.company_browser_simulation','不存在','拟增加受限模拟桥，sdkAnchorPackage指向批准后的中性目录','尚需打包/原入口模型测试授权；不能接灵生域名'),
('C06','拟建 H/tools/company-browser-sdk/ 与 H/tools/company-browser-simulation/','未部署','中性SDK1.30.0及限定loopback桥','本轮副本只在开发区；正式落盘位置、启用须Owner另批')]
fields={'status':'proposal_only_no_config_applied','before_config_sha256':json.loads((private/'watched_hashes_local_only.json').read_text())[str(Path.home()/'.hermes/config.yaml')],'changes':[{'id':i,'target':p,'before':v,'proposed_after':a,'condition':c,'owner_approval':'pending','execution_status':'not_executed'} for i,p,v,a,c in changes],
'explicitly_unchanged_fields':j['selected_fields'],'model_env_auth_change_proposed':False,'whole_config_replacement_proposed':False,'formal_model_approval_currently_granted':False,'old_mcp_physical_directory_change_allowed':False}
write(dest/'CONFIG_FIELD_DIFF.json',fields)
objects=[]
for group in j['selected_skill_candidates']:
    for entry in group['files']:objects.append({'id':f'F{len(objects)+1:03}','kind':'selected_skill_file','target':clean(entry['path']),'bytes':entry['bytes'],'parent_scope':group['target'],'disposition':'candidate_only_owner_scope_and_dependencies_pending','delete_authorized':False})
for row in j['selected_script_candidates']:objects.append({'id':f'F{len(objects)+1:03}','kind':'selected_script','target':row['target'],'exists':row['exists'],'sha256':row['sha256'],'references_to_selected_scripts':row['referenced_selected_script_names'],'disposition':'candidate_only_owner_scope_and_dependencies_pending','delete_authorized':False})
write(dest/'EXACT_CANDIDATE_OBJECTS.json',{'status':'exact_metadata_not_delete_allowlist','skill_directory_count':len(j['selected_skill_candidates']),'skill_file_count':sum(len(x['files']) for x in j['selected_skill_candidates']),'script_count':len(j['selected_script_candidates']),'objects':objects,'all_delete_authorizations':False,'other_globs_and_bulk_sessions_expanded':False,'holds':['M09: only two old cron session IDs identified; no bulk session scan or DB deletion proposal','M13/M18/M23-M28: unrelated categories, data/browser storage, second root and credentials remain unclassified; no broad scan','M29-M32: test profiles/CMDs and recovery artifacts must remain until future acceptance and explicit disposal approval']})
tasks=json.loads((private/'windows_tasks_local_only.json').read_text(encoding='utf-8-sig'));tasks=tasks if isinstance(tasks,list) else [tasks]
links=json.loads((private/'shortcuts_local_only.json').read_text(encoding='utf-8-sig'));links=links if isinstance(links,list) else [links]
environment=json.loads((private/'home_environment_local_only.json').read_text(encoding='utf-8-sig'))
targeted={'checked_at_utc':j['checked_at_utc'],'original_home_environment':environment,'shortcut_targets':links,'matching_original_hermes_processes':len(j['process_paths']),'desktop_project_dir_file_exists':False,'config_selected_fields':j['selected_fields'],
'live_new_session_injection_verified':False,'live_home_and_cwd_unavailable_reason':'No matching original Hermes process at the point check; no launch or new conversation authorized this round.',
'historical_session_metadata_view':'SQLite immutable base only; WAL excluded; not a current conversation snapshot','last_desktop_session_cwd':'<USER_HOME>','last_desktop_session_id':'20261015_224929_5bf37b',
'cron_current':{'jobs':0,'updated_at_recorded':'2026-10-15T23:54:23.622437+08:00','matches_verified_phase02a_jobs_file_hash':True,'reason_or_writer_of_prior_removal':'unknown','changed_by_this_preparation':False},
'cron_historical':{'job_id':'44e3730eedc5','provenance':['selected cron/executions.db metadata','exact cron_44e3730eedc5_20261015_224758 first user message only','inherited Phase01 weekday08:00 schedule'],'purpose_summary':'旧托管业务朋友圈素材草稿：选题、取天气、渲染卡片、质检、生成三版文案，交Owner选用；并非灵生数采巡检。','prompt_raw_published':False,'dependencies':['H/moments_daily/theme_state.json','H/moments_daily/','<USER_HOME>/AppData/Local/Programs/Python/Python313/python.exe','临时卡片模板及人工选择后的发布环节'],'delivery_known':'历史提示说明自动投递给Owner的QQ；不等于自动发朋友圈','exact_delivery_route_or_recipient':'当前任务定义已无，未从账号配置重建；未知','historical_session_ids':['cron_44e3730eedc5_20261015_224758','cron_44e3730eedc5_20261012_110743'],'action_this_round':'none; do not recreate, stop or repurpose'},
'windows_tasks':tasks,'windows_task_dependency_summary':{'task_path':'/','task_name':'OpenClaw Gateway','chain':['powershell.exe','<USER_HOME>/.openclaw/gateway-launcher.ps1','<USER_HOME>/.openclaw/gateway.cmd','existing node.exe','<APPDATA>/npm/node_modules/openclaw/dist/index.js gateway --port 18790 --task-supervisor'],'script_may_start_or_kill_gateway_processes':True,'script_executed_this_round':False,'shared_use_or_hierarchy_with_Hermes':'No direct link established in the selected task/config sources; other applications and channel use remain unverified; Owner decision required.'},
'mcp_bindings':j['mcp'],'selected_script_reference_graph':j['selected_script_candidates'],'unknown_old_memory_body_uploaded':False,'original_env_auth_or_browser_storage_read':False,'full_audit_or_bulk_memory_scan':False}
write(evidence/'TARGETED_FINDINGS.json',targeted)
targeted['windows_tasks'][0]['TaskPath']='\\'
targeted['windows_task_dependency_summary']['task_path']='\\'
targeted['task_protection']=json.loads((private/'task_protection_sanitized.json').read_text(encoding='utf-8-sig'))
targeted['ancestor_context_metadata']=json.loads((private/'context_ancestors_sanitized.json').read_text(encoding='utf-8'))
targeted['desktop_environment_hints']=json.loads((private/'desktop_environment_local_only.json').read_text(encoding='utf-8-sig'))
targeted['public_paths_are_redacted_normalized_aliases_not_executable_arguments']=True
write(evidence/'TARGETED_FINDINGS.json',targeted)
old_matrix=json.loads((base.parent/'hermes_issue09_gate0_publication/hermes/plans/issue09_gate0/CHANGE_CLEANUP_MATRIX.json').read_text(encoding='utf-8'))
prepared={'M02','M03','M05','M06','M07','M08','M11','M15','M16','M17','M19','M20','M21','M27','M33'}
write(dest/'MATRIX_34_STATUS.json',{'original_matrix_ref':'PR10 e6d581cd4454c60d84750ef769da427cb01b11a8','labels_are_not_authorizations':True,'items':[{'id':x['id'],'prepared_this_round':x['id'] in prepared,'current_preparation':'本轮仅准备' if x['id'] in prepared else '暂时不得触碰','actual_change_authority':'需要Owner单独批准' if x['owner_approval_required'] else '保留核心现状；未提出原机改动','execution_status':'not_executed','bulk_delete_allowed':False} for x in old_matrix['rows']]})
lock=json.loads((private/'dependency_bundle_sanitized.json').read_text(encoding='utf-8'));write(evidence/'SDK_DEPENDENCY_LOCK.json',lock)
limits={'SOUL.draft.md':20000,'MEMORY.draft.md':10000,'USER.draft.md':5000,'HERMES.draft.md':20000}
lengths={p.name:{'characters':len(p.read_text(encoding='utf-8')),'static_limit_used':limits[p.name],'below_limit':len(p.read_text(encoding='utf-8'))<limits[p.name]} for p in (dest/'drafts').glob('*.md')}
validation={'kind':'offline preparation only, no Hermes/browser/model acceptance','draft_lengths':lengths,'all_static_draft_length_checks_passed':all(v['below_limit'] for v in lengths.values()),'actual_prompt_injection_scanning_truncation_or_cache_replay_verified':False,'memory_native_delimiter':'\\n§\\n','original_review_segments':len(segments),'sdk_test_rounds':[{'round':1,'pass':3,'fail':1,'note':'Mock fixture relied on environment removed by bounded bridge; connection closed. No original or real service involved.'},{'round':2,'pass':4,'fail':0,'fix':'Fixture entry explicitly supplies its anchor; bridge environment boundary unchanged.'}], 'sdk_runtime_old_business_modules_loaded':0,'sdk_component_tests_use_fake_mcp_no_browser_or_http':True,'model_calls':0,'actual_browser_sessions':0,'dependency_network_installation':False,'formal_deployment':False,'real_business_access':False,'original_files_protection':json.loads((private/'protection_sanitized.json').read_text()),'limitations':['Topic cues are not complete semantic ownership review','Four drafts are not an approved whole-file rewrite','Immutable history view excludes active WAL','Desktop is not running; real new-session loading remains blocked pending authorization','MCP mock checks are not browser or Hermes autonomy tests']}
write(evidence/'PREPARATION_VALIDATION.json',validation)
print(json.dumps({'review_segments':len(segments),'native_memory_entries':{x['target']:x['native_memory_entries_before'] for x in files},'exact_objects':len(objects),'draft_lengths':lengths,'all_execution_status':'not_executed'},ensure_ascii=False))
