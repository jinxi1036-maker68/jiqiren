"""Preserve every simulated answer and index the most recent case evidence."""
from pathlib import Path
import argparse,json,sys
sys.path.insert(0,str(Path(__file__).parent))
from collect_evidence import collect

p=argparse.ArgumentParser();p.add_argument('runtime',type=Path);p.add_argument('evidence',type=Path);a=p.parse_args();a.evidence.mkdir(parents=True,exist_ok=True)
r=json.loads(a.runtime.read_text(encoding='utf-8'));folders=sorted(x for x in (a.runtime.parent/'runs').iterdir() if (x/'session_runs.json').exists())
labels=['AGENT_RUNS_INITIAL.json','AGENT_RUNS_ROUND2.json','AGENT_RUNS_TARGETED.json','AGENT_RUNS_REPEAT.json'];latest={};dialogues=0;calls=0
for i,folder in enumerate(folders):
    name=labels[i] if i<len(labels) else 'AGENT_RUNS_'+str(i+1)+'.json'
    output=a.evidence/name;collect(a.runtime,output,folder.name);payload=json.loads(output.read_text(encoding='utf-8'))
    for run in payload['runs']:
        for case in run['cases']:
            dialogues+=1;calls+=case['browser_calls']
            latest[case['case']]={'case':case['case'],'run_id':run['run_id'],'evidence_file':name,'automated_checks_passed':case['automated_checks_passed'],'browser_calls':case['browser_calls'],'session_id':case['session_id']}
expected=set(json.loads(Path(__file__).with_name('CASES.json').read_text(encoding='utf-8')))
index={'scope':'Gate A simulation only, latest evidence per case; not one single all-pass run','simulated_matrix_dialogues':dialogues,'simulated_matrix_browser_calls':calls,'latest_case_count':len(latest),'all_cases_present':set(latest)==expected,'latest_automated_checks_passed':all(c['automated_checks_passed'] for c in latest.values()),'latest_cases':list(latest.values()),'manual_public_final_review_required':True,'real_backend_learning_started':False}
(a.evidence/'FINAL_CASE_INDEX.json').write_text(json.dumps(index,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({k:index[k] for k in ['simulated_matrix_dialogues','simulated_matrix_browser_calls','latest_case_count','all_cases_present','latest_automated_checks_passed']}))
