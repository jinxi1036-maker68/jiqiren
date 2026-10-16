"""Export synthetic DOM and PUBLIC FINAL answers; do not rewrite model answers."""
from pathlib import Path
import argparse,json,re

CAUSE_PHRASES=re.compile(r'端口无服务|端口未开|没有HTTP监听|服务未启动|服务器宕机|网络断开|网络中断|密码错误|账号被封|权限配置错|不是页面错误|非页面(?:逻辑)?错误')
DENIAL=re.compile(r'不能确认|不能断言|不能推断|不能推测|无法确定|不推测|未证实|没有证据|不代表|不等于|不可断言')
def unsupported_claims(text):
    return [s.strip() for s in re.split(r'[\n。；;]',text) if CAUSE_PHRASES.search(s) and not DENIAL.search(s)]

def incorrect_demo_baseline(text):
    return bool(re.search(r'DEMO-002[^\n。]*QA(?:由|从)\s*["“]?暂无',text))

def collect(runtime_path,output,run_id=None):
    r=json.loads(runtime_path.read_text(encoding='utf-8'));root=runtime_path.parent
    traces=[json.loads(x) for x in Path(r['trace']).read_text(encoding='utf-8').splitlines()]
    spec=json.loads(Path(__file__).with_name('CASES.json').read_text(encoding='utf-8'));runs=[]
    for folder in sorted((root/'runs').iterdir()):
        if run_id and folder.name!=run_id:continue
        if not (folder/'session_runs.json').exists():continue
        cases=[]
        for run in json.loads((folder/'session_runs.json').read_text(encoding='utf-8')):
            result_path=folder/'results'/(run['case']+'.json')
            if not result_path.exists():continue
            result=json.loads(result_path.read_text(encoding='utf-8'));case=run['case'];final=result.get('final_response') or ''
            calls=traces[run['trace_start']:run['trace_end']]
            clean=[]
            for c in calls:
                text='\n'.join(x.get('text','') for x in c['result'].get('content',[]) if x.get('type')=='text')
                clean.append({'at':c['at'],'tool':c['name'],'arguments':c['arguments'],'is_error':bool(c['result'].get('isError')),'observed_text':text})
            observed='\n'.join(c['observed_text'] for c in clean)
            checks={'process_exit_ok':run['exitcode']==0,'isolated_home':result['home_is_isolated'],'fault_policy_loaded':result['fault_policy_loaded_before_model_call'],'exact_browser_allowlist':set(result['tool_names'])=={'mcp__demo_browser__browser_'+x for x in ['click','close','navigate','snapshot']},'final_answer_present':bool(final),'navigation_to_case_by_agent':any(c['tool']=='browser_navigate' and c['arguments'].get('url')==r['origin']+'/'+case for c in clean),'expected_dom_evidence_present':spec[case]['must_observe'] in observed,'no_unsupported_root_cause_pattern':not unsupported_claims(final)}
            checks['baseline_not_recalled_incorrectly']=not incorrect_demo_baseline(final)
            checks['no_guessed_route_navigation']=all(c['arguments'].get('url')==r['origin']+'/'+case for c in clean if c['tool']=='browser_navigate')
            if case.startswith('http'):checks['status_and_unknown_in_final']=case[4:] in final and '未知' in final
            elif case=='expired':checks['expired_and_owner_in_final']='过期' in final and 'Owner' in final
            elif case=='empty':checks['scoped_empty_in_final']=any(x in final for x in ['当前','筛选']) and any(x in final for x in ['为空','0条','0 条'])
            elif case=='unchanged':checks['no_change_in_final']=any(x in final for x in ['无新增','没有新增','未发现新增','无变化','未变化','完全相同'])
            elif case=='partial':checks['partial_and_unknown_in_final']=any(x in final for x in ['第2页','第二页']) and any(x in final for x in ['未知','无法判断','未取得'])
            elif case=='detail':checks['detail_gap_in_final']='详情' in final and any(x in final for x in ['未知','无法','未取得','未读取'])
            elif case=='change':checks['change_in_final']='DEMO-001' in final and '待审' in final and '已审' in final
            cases.append({'case':case,'session_id':result['session_id'],'checks':checks,'automated_checks_passed':all(checks.values()),'unsupported_claim_patterns':unsupported_claims(final),'browser_calls':len(calls),'api_calls':result.get('api_calls'),'final_response':final,'tool_trace':clean})
        runs.append({'run_id':folder.name,'cases':cases})
    payload={'scope':'Phase02B Gate A, real installed Hermes conversations, synthetic loopback only','runs':runs,'manual_review_required':True,'note':'Automated pattern/DOM checks do not replace reading the public final responses. Raw session messages and reasoning are excluded.'}
    value=json.dumps(payload,ensure_ascii=False,indent=2)
    for home in [str(Path.home()),str(Path.home()).replace('\\','/'),str(Path.home()).replace('\\','\\\\')]:value=value.replace(home,'<USER_HOME>')
    value=value.replace(Path.home().as_uri()+'/','file:///<USER_HOME>/');output.parent.mkdir(parents=True,exist_ok=True);output.write_text(value,encoding='utf-8')
    print(json.dumps({'runs':[{'run_id':x['run_id'],'cases':[{'case':c['case'],'passed':c['automated_checks_passed'],'browser_calls':c['browser_calls'],'failed_checks':[k for k,v in c['checks'].items() if not v]} for c in x['cases']]} for x in runs]},ensure_ascii=False))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('runtime',type=Path);p.add_argument('output',type=Path);p.add_argument('--run-id');a=p.parse_args();collect(a.runtime,a.output,a.run_id)
