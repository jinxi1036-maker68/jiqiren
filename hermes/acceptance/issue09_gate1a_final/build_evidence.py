"""Project existing task evidence into an explicit public whitelist.

No model, Hermes, browser or original-environment mutation. Raw SQLite task
records and process command lines remain private. This file does not execute
commands found in conversation content. Only the hashed target session and
one fixed synthetic run are included in public evidence.
"""
from pathlib import Path
import datetime,hashlib,json,re,collections
BASE=Path(__file__).resolve().parent
P=BASE/'private'
H=Path.home()/'.hermes'
PUB=BASE.parent/'hermes_issue09_gate1a_final_publication'
OUT=PUB/'hermes/evidence/issue09_gate1a_final'
OUT.mkdir(parents=True,exist_ok=True)
RUN='20261016T123217Z-b9d92b45'
SESSION='dbc30348a14e3410808ae7830be8ad246b0d9856cb4f9d6e037a7ce4770258b6'
def sha(x): return hashlib.sha256(x).hexdigest()
def load(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def red(x):
    if isinstance(x,str): return x.replace(str(Path.home()),'<USER_HOME>')
    if isinstance(x,list): return [red(v) for v in x]
    if isinstance(x,dict): return {k:red(v) for k,v in x.items()}
    return x
def localtime(t): return datetime.datetime.fromtimestamp(t,datetime.timezone(datetime.timedelta(hours=8))).isoformat()
sessions=load(P/'sessions_local_only.json')
s=next(x for x in sessions if sha(x['metadata']['id'].encode())==SESSION)
m=s['metadata'];msgs=s['messages'];toolrows={x['tool_call_id']:x for x in msgs if x['role']=='tool'}
source_manifest=[]
def source(p):
    b=p.read_bytes();source_manifest.append({'path':red(str(p)),'bytes':len(b),'sha256':sha(b)})
    return b
run=H/'tools/company-browser-simulation/runs'/RUN
trace=[json.loads(l) for l in source(run/'trace.jsonl').decode().splitlines()]
requests=[json.loads(l) for l in source(run/'requests.jsonl').decode().splitlines()]
life=json.loads(source(run/'lifecycle.json'))
calls=[]
for r in msgs:
    for t in json.loads(r['tool_calls'] or '[]'):
        f=t.get('function',t);a=f.get('arguments',{});a=json.loads(a) if isinstance(a,str) else a
        out=toolrows.get(t.get('id'))
        if f['name']!='tool_call': continue
        assert out and (a.get('name') or '').startswith('mcp__company_browser_simulation__')
        raw=out['content']
        # Persisted Desktop MCP results are marked as untrusted external data.
        # Decode only their JSON payload; never interpret wrapper/body directives.
        if raw.startswith('<untrusted_tool_result '):
            body,_=json.JSONDecoder().raw_decode(raw[raw.index('{'):])
        else: body=json.loads(raw)
        matched=next((i for i,x in enumerate(trace) if a['name'].endswith('__'+x['name']) and a.get('arguments',{})==x['arguments'] and body==x['result']),None)
        # Desktop adds MCP metadata; compare actual text payload if wrapper differs.
        if matched is None:
            candidates=[i for i,x in enumerate(trace) if a['name'].endswith('__'+x['name']) and a.get('arguments',{})==x['arguments']]
            def texts(v):
                if isinstance(v,dict):
                    if 'text' in v and isinstance(v['text'],str): yield v['text']
                    for v2 in v.values(): yield from texts(v2)
                elif isinstance(v,list):
                    for v2 in v: yield from texts(v2)
            payload=[body['result']] if isinstance(body.get('result'),str) else list(texts(body))
            matched=next((i for i in candidates if list(texts(trace[i]['result']))==payload),None)
        calls.append({'assistant_message':r['id'],'tool_message':out['id'],'at_local':localtime(out['timestamp']),'tool':a['name'],'arguments':a.get('arguments',{}),'desktop_result_sha256':sha(out['content'].encode()),'trace_line':matched+1 if matched is not None else None,'payload_cross_match':matched is not None})
assert len(calls)==len(trace)==13
assert all(c['payload_cross_match'] for c in calls), 'Desktop/trace mismatch; do not publish as matched'
assert len({c['trace_line'] for c in calls})==13, 'Mapping must be one-to-one'
receipts=load(P/'read_receipts_local_only.json')
knowledge=[x for x in receipts if x['kind']=='read_file' and 'company-workspace' in x['path'] and '..' not in x['path']]
assert len(knowledge)==10 and all(x['normalized_return_matches_current_file'] and not x['truncated'] and x['error'] is None for x in knowledge)
for x in knowledge:
    path=Path(x['path'].replace('<USER_HOME>',str(Path.home())))
    x['current_file_sha256']=sha(source(path))
successful_appends=[x['tool_message'] for x in knowledge if x['hermes_agents_full_text_in_appended_context']]
source(H/'company-workspace/hermes/AGENTS.md')
assert s['prompt_flags']['prompt_chars'] is None
processes=load(P/'processes_local_only.json')
proc=[]
for x in processes['process_rows']:
    o=x['observed'];proc.append({'run_id':x['run_id'],'kind':x['kind'],'pid':x['pid'],'present':bool(o),'name':o.get('Name') if o else None,'created':o.get('CreationDate') if o else None,'command_matches_company_bridge':bool(o and 'company-browser-simulation' in (o.get('CommandLine') or ''))})
# Six inherited hashes are fixed from PR12/14; no old file body exported.
expected={'SOUL.md':'6cde9e101908e83578a666380a0dab0aa9fba00cbb5bdfa480cb0a748c7032eb','config.yaml':'a6886244db5baab40566fd717c5503d835a70243594a0fb0adcc527bae4ce5af','project-dir.json':'d8edd6427eaefaebfa31da376e225b18b712a267f227d11863c335e75f518c63','MEMORY.md':'572baff8b1946728d3aeb34bf548bf5d5f59b37207f69e3eac9b10e7ff6aa3d0','USER.md':'04510b3d6a0630695e4a7fb6e92cac92330c2f78236927eea68ebf6e4c119ff6','jobs.json':'877a6efca16b7b9435b4c996a8d6c5756411563e0017c4f0980e97994cd54f59'}
hashes=[{'path':red(x['Path']),'sha256':x['Hash'].lower(),'inherited_sha256':expected[Path(x['Path']).name],'same_as_inherited':x['Hash'].lower()==expected[Path(x['Path']).name]} for x in processes['selected_hashes']]
summary={
 'schema':'hermes_gate1a_completed_session_evidence_v1','report_date_local':'2026-10-17','observed_at_utc':processes['observed_at'],
 'scope':{'new_model_calls':0,'browser_replays':0,'original_environment_mutations':False,'only_existing_owner_tasks':True,'raw_messages_logs_prompts_credentials_exported':False},
 'session':{'id_sha256':SESSION,'source':m['source'],'profile_name':m['profile_name'],'started_local':localtime(m['started_at']),'recorded_cwd':red(m['cwd']),'session_ended_at':m['ended_at'],'session_end_reason':m['end_reason'],'stored_system_prompt_present':False,'stored_system_prompt_hash':m['system_prompt_hash'],'stored_tool_names':m['tool_names'],'message_count':m['message_count'],'recorded_tool_call_count':m['tool_call_count'],'recorded_api_rounds_not_owner_turns':m['api_call_count']},
 'owner_task_turns':[{'user_message':103614,'kind':'identity_knowledge','start_local':localtime(next(r['timestamp'] for r in msgs if r['id']==103614)),'final_message':103647,'finish_local':localtime(next(r['timestamp'] for r in msgs if r['id']==103647)),'finish_reason':'stop'},{'user_message':103660,'kind':'qa_change_and_partial','start_local':localtime(next(r['timestamp'] for r in msgs if r['id']==103660)),'final_message':103713,'finish_local':localtime(next(r['timestamp'] for r in msgs if r['id']==103713)),'finish_reason':'stop'}],
 'budget':'Two targeted Owner prompts in the SAME Desktop session, plus earlier ordinary conversation acknowledged in Issue9. Existing <=3 authorization treated as exhausted; no new calls. API rounds != Owner task conversations.',
 'cwd_evidence':{'recorded_initial_cwd':red(m['cwd']),'explicit_terminal_cd_to_company_workspace':True,'terminal_tool_result_message':103645,'terminal_reported_cwd':'<USER_HOME>\\.hermes\\company-workspace','session_persistent_cwd_is_company_workspace':False,'full_runtime_os_cwd_history':'not_captured'},
 'knowledge_reads':knowledge,'hermes_agents_full_text_appended_to_tool_messages':successful_appends,'knowledge_total':'10 explicit file reads + 1 appended hermes/AGENTS.md, not 11 independent read_file calls',
 'failed_snapshot_read_receipt':[x for x in receipts if x['kind']=='read_file' and '..' in x['path']],
 'local_private_target_record_sha256':sha(json.dumps(s,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()),
 'browser':{'run_id':RUN,'origin':life['origin'],'tool_calls':calls,'trace_calls':13,'all_desktop_payloads_match_trace':True,'requests':requests,'page2_attempts_observed':sum(x['path']=='/api/page2' for x in requests),'http503_cause':'unknown','http503_temporariness':'unknown','business_results':False},
 'exit_evidence':{'browser_close_tool_message':103712,'browser_close_trace_line':13,'browser_tabs_closed':True,'both_task_final_messages_stop':True,'lifecycle':{k:v for k,v in life.items() if k!='sdk_anchor'},'lifecycle_model_calls_field_scope':'launcher itself, not Hermes Agent task/dialog count','lifecycle_has_closed_at':bool(life.get('closed_at_utc')),'lifecycle_has_children_exited':('children_exited' in life),'target_recorded_pids_currently_present':any(x['present'] for x in proc if x['run_id']==RUN),'port62555_connection_rows':processes.get('port62555',[]),'all_descendant_processes_and_graceful_exit':'not_proven','other_known_run_process_observations':proc},
 'selected_hashes':hashes,'configuration_drift':load(P/'config_semantic_local_only.json'),
 'verified_defects':['Session recorded cwd is original installation, not W; explicit cd/absolute file reads do work.','One mistaken snapshot file path failed; Agent recovered via browser_snapshot.','Final model report called HTTP503 transient without evidence.','Identity discovery listed user home/Desktop directories beyond minimum company file scope; raw filenames withheld.','config.yaml differs from PR14 baseline: auto_tts false->true and qqbot enabled; writer/reason unknown; MCP binding semantically equal.'],
 'only_hermes_self_report':['No second profile physically exists (not accepted as an inventory conclusion; prior test profiles retained).','Old memory conflict identification and influence; no automatic-injection proof.','Current model name not verified from request-side evidence.','Absolute absence of all out-of-scope/network side effects beyond observed task tools.'],
 'unverified':['Exact effective SOUL/system prompt/tool set and truncation; DB stores prompt null and tool_names null, hash alone insufficient.','Automatic memory reflow and semantic isolation across fresh sessions/restarts.','Session starts persistently in W.','Graceful launcher exit time/code and all descendant termination.','HTTP503 root cause, duration and recovery.','Real LingSyn/read-only onboarding/production operations/continuous duty.'],
 'verdict':{'core_original_desktop_identity_knowledge_and_synthetic_operation':'independently_supported_with_limits','full_gate1a':'not_yet_satisfied','next_gate_authorized':False}
}
write(OUT/'VERIFIED_FINDINGS.json',red(summary))
write(OUT/'BROWSER_TRACE.json',red(trace))
write(OUT/'HTTP_REQUESTS.json',requests)
# Only explicitly synthetic browser artifacts are copied; no production images.
for filename in ('page-2026-10-16T12-39-44-798Z.yml','page-2026-10-16T12-40-10-490Z.yml','page-2026-10-16T12-40-50-761Z.yml','page-2026-10-16T12-41-23-609Z.yml','console-2026-10-16T12-40-34-249Z.log'):
    data=source(run/'browser'/filename)
    dest=OUT/'synthetic_artifacts'/filename;dest.parent.mkdir(exist_ok=True)
    dest.write_bytes(data)
write(OUT/'SOURCE_HASHES.json',source_manifest)
write(P/'publication_source_record_local_only.json',{'target_session_hash':SESSION,'run_id':RUN,'source_manifest':source_manifest})
print(json.dumps({'export_files_so_far':len(list(OUT.rglob('*.*'))),'cross_matched_mcp_calls':len(calls),'knowledge_reads':len(knowledge),'automatic_subdirectory_context':len(successful_appends),'key_hashes_equal':sum(x['same_as_inherited'] for x in hashes),'verdict':summary['verdict']}))
