"""Export synthetic tool evidence and selected booleans, never raw session memory."""
from pathlib import Path
import argparse,json,re

def collect(private,output):
    r=json.loads((private/'runtime-local/runtime.json').read_text(encoding='utf-8'))
    root=private/'runtime-local';runs=json.loads((root/'session_runs.json').read_text(encoding='utf-8'))
    traces=[json.loads(x) for x in Path(r['trace']).read_text(encoding='utf-8').splitlines()]
    cases=[]
    for run in runs:
        case=run['case'];result=json.loads((Path(r['results'])/(case+'.json')).read_text(encoding='utf-8'))
        calls=traces[run['trace_start']:run['trace_end']]
        texts=['\n'.join(c.get('text','') for c in call['result'].get('content',[]) if c.get('type')=='text') for call in calls]
        final=result.get('final_response') or ''
        observed='\n'.join(texts)
        checks={'fresh_process_exit_ok':run['exitcode']==0,'isolated_home':result['home_is_isolated'],'identity_loaded':result['identity_loaded_before_model_call'],'synthetic_memory_loaded':result['synthetic_memory_loaded_before_model_call'],'bounded_tools_only':all(n.startswith('mcp_demo_browser_') for n in result['tool_names']),'agent_final_response_present':bool(final),'model_reported_no_failure':not result['failed'],'navigation_by_agent':any(c['name']=='browser_navigate' and c['arguments']['url']==r['origin']+'/'+case for c in calls),'role_maintained_in_final':'Hermes' in final and '数采' in final}
        if case in ['change','unchanged']:
            checks['agent_clicked_menu_and_refresh']=sum(c['name']=='browser_click' for c in calls)>=2
            checks['initial_pending_row_observed']='DEMO-001 待审 暂无' in observed
            checks['expected_final_row_observed']=('DEMO-001 已审 模拟通过' if case=='change' else 'DEMO-001 待审 暂无') in '\n'.join(texts[-3:])
        else:
            checks['service_failure_observed']='503' in observed
            checks['failure_explained_in_final']=any(x in final for x in ['访问失败','无法访问','无法读取','不可用'])
        # Only synthetic calls and final answer are exported; exclude messages/reasoning.
        safe_calls=[]
        for call,text in zip(calls,texts):safe_calls.append({'at':call['at'],'tool':call['name'],'arguments':call['arguments'],'is_error':bool(call['result'].get('isError')),'observed_text':text})
        cases.append({'case':case,'checks':checks,'automated_checks_passed':all(checks.values()),'browser_calls':len(calls),'api_calls':result.get('api_calls'),'session_id':result['session_id'],'final_response':final,'tool_trace':safe_calls})
    result={'scope':'Actual installed Hermes AIAgent, isolated profile, synthetic loopback fixture only','distinct_sessions':len(set(c['session_id'] for c in cases)),'cases':cases,'manual_review_required':'Confirm final claims match DOM and no-new is not substituted for access failure; check inference labels. Automated checks are not production acceptance.'}
    value=json.dumps(result,ensure_ascii=False,indent=2)
    for home in [str(Path.home()),str(Path.home()).replace('\\','/'),str(Path.home()).replace('\\','\\\\')]:value=value.replace(home,'<USER_HOME>')
    value=value.replace(Path.home().as_uri()+'/','file:///<USER_HOME>/')
    output.parent.mkdir(parents=True,exist_ok=True);output.write_text(value,encoding='utf-8')
    print(json.dumps({'distinct_sessions':result['distinct_sessions'],'cases':[{'case':c['case'],'passed':c['automated_checks_passed'],'checks':c['checks'],'browser_calls':c['browser_calls']} for c in cases]},ensure_ascii=False))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('private',type=Path);p.add_argument('output',type=Path);a=p.parse_args();collect(a.private,a.output)
