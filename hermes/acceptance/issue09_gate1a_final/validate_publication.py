"""Validate exported artifacts only; never call a model or browser."""
from pathlib import Path
import ast,hashlib,json,re
BASE=Path(__file__).resolve().parent
PUB=BASE.parent/'hermes_issue09_gate1a_final_publication'
EV=PUB/'hermes/evidence/issue09_gate1a_final'
def load(p): return json.loads(p.read_text(encoding='utf-8'))
facts=load(EV/'VERIFIED_FINDINGS.json');trace=load(EV/'BROWSER_TRACE.json');http=load(EV/'HTTP_REQUESTS.json')
assert facts['scope']['new_model_calls']==0 and facts['scope']['browser_replays']==0
assert len(trace)==13 and all(c['payload_cross_match'] for c in facts['browser']['tool_calls'])
assert all(x['path'] in ('/change','/partial','/api/page2') for x in http)
assert sum(x['path']=='/api/page2' and x['status']==503 for x in http)==1
assert facts['browser']['http503_cause']==facts['browser']['http503_temporariness']=='unknown'
assert len(facts['knowledge_reads'])==10 and all(x['normalized_return_matches_current_file'] for x in facts['knowledge_reads'])
assert len(facts['hermes_agents_full_text_appended_to_tool_messages'])==1
assert sum(x['same_as_inherited'] for x in facts['selected_hashes'])==5
assert facts['configuration_drift']['company_browser_simulation_binding_semantically_equal']
assert facts['verdict']['full_gate1a']=='not_yet_satisfied'
art=EV/'synthetic_artifacts'
def cells(name): return re.findall(r'cell "([^"]*)"', (art/name).read_text(encoding='utf-8'))
assert cells('page-2026-10-16T12-39-44-798Z.yml')==['DEMO-001','待审','暂无','DEMO-002','已审','模拟通过']
assert cells('page-2026-10-16T12-40-10-490Z.yml')==['DEMO-001','已审','模拟通过','DEMO-002','已审','模拟通过']
assert '记录总数4' in (art/'page-2026-10-16T12-40-50-761Z.yml').read_text(encoding='utf-8')
assert 'HTTP 503' in (art/'page-2026-10-16T12-41-23-609Z.yml').read_text(encoding='utf-8')
assert '62555/api/page2' in (art/'console-2026-10-16T12-40-34-249Z.log').read_text(encoding='utf-8')
files=[p for p in PUB.rglob('*') if p.is_file()]
for p in files:
    text=p.read_text(encoding='utf-8')
    assert not any(part in ('private','node_modules') for part in p.relative_to(PUB).parts)
    assert str(Path.home()) not in text and 'C:\\Users\\Administrator' not in text
    assert not re.search(r'(?i)(?:sk-[A-Za-z0-9]{15,}|gh[pousr]_[A-Za-z0-9]{15,}|Bearer\s+[A-Za-z0-9._-]{16,}|-----BEGIN [A-Z ]{3,30} PRIVATE KEY-----)',text),p.name
    if p.suffix=='.py': ast.parse(text,filename=str(p))
    elif p.suffix=='.json': json.loads(text)
    elif p.suffix=='.md':
        for link in re.findall(r'\]\(([^)]+)\)',text):
            if '://' in link or link.startswith('#'): continue
            assert (p.parent/link).resolve().is_file(),(str(p),link)
for name in ('build_evidence.py','validate_publication.py'):
    assert (PUB/'hermes/acceptance/issue09_gate1a_final'/name).read_bytes()==(BASE/name).read_bytes()
result={'schema':'gate1a_final_publication_validation_v1','client_report_date':'2026-10-17','validation_kind':'offline artifact checks, not repeated capability tests','desktop_mcp_trace_payload_cross_matches':13,'company_file_read_receipts':10,'appended_hermes_agents_contexts':1,'synthetic_qa_snapshots_consistent':True,'http503_request_and_console_consistent':True,'cause_and_temporariness_unknown':True,'model_calls':0,'browser_replays':0,'selected_hashes_equal_to_inherited':5,'python_ast_valid':True,'json_valid':True,'relative_report_links_resolve':True,'public_sources_equal_executed_local_sources':True,'private_root_or_obvious_credential_pattern_scan':'passed; heuristic plus manual review, not absolute proof','raw_private_data_exported':False,'original_environment_files_exported':False,'business_current_files_overwritten':False,'full_gate1a_verdict':'not_yet_satisfied'}
(EV/'PUBLICATION_VALIDATION.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
manifest=[]
for p in sorted(PUB.rglob('*')):
    if not p.is_file(): continue
    b=p.read_bytes();manifest.append({'path':p.relative_to(PUB).as_posix(),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'git_blob_sha':hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()})
(BASE/'private/publication_manifest_local_only.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'files':len(manifest),'checks':'passed','model_calls':0,'browser_replays':0,'verdict':'Gate1A not fully accepted'}))
