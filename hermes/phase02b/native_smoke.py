"""Verify the actual installed HermesCLI through the dedicated entry path."""
from pathlib import Path
import argparse,json,sqlite3,subprocess,sys,re,datetime,uuid,secrets

def session_ids(profile):
    c=sqlite3.connect((profile/'state.db').resolve().as_uri()+'?mode=ro',uri=True)
    try:return {x[0] for x in c.execute('SELECT id FROM sessions')}
    finally:c.close()

def run(runtime_path,output):
    r=json.loads(runtime_path.read_text(encoding='utf-8'));root=runtime_path.parent;profile=Path(r['profile']);folder=root/'native-smoke'/('run-'+datetime.datetime.now(datetime.timezone.utc).strftime('%H%M%S')+'-'+uuid.uuid4().hex[:5]);folder.mkdir(parents=True)
    marker=root/'identity_canary_local_only.json'
    if not marker.exists():
        value='P02B-'+secrets.token_hex(6);marker.write_text(json.dumps({'value':value,'purpose':'non-credential identity test marker'}),encoding='utf-8')
        soul=profile/'SOUL.md';soul.write_text(soul.read_text(encoding='utf-8')+'\n身份自检标识：'+value+'。这是非凭据测试标识，只在Owner要求身份自检时报告。\n',encoding='utf-8')
    query=folder/'query_local_only.txt';query.write_text((Path(r['prompt_dir'])/'http503.txt').read_text(encoding='utf-8')+'\n请先说明你的岗位身份，并报告当前身份文件中给出的“身份自检标识”；若没有给出则写未知，不要猜测。',encoding='utf-8')
    before=session_ids(profile);trace=Path(r['trace']);start=len(trace.read_text(encoding='utf-8').splitlines())
    with (folder/'stdout_local_only.txt').open('w',encoding='utf-8') as out,(folder/'stderr_local_only.txt').open('w',encoding='utf-8') as err:
        process=subprocess.Popen([sys.executable,'-I','-B',str(Path(__file__).with_name('entry.py')),str(runtime_path),'--query-file',str(query)],stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
        try:code=process.wait(timeout=330)
        except subprocess.TimeoutExpired:process.terminate();process.wait(timeout=10);raise
    after=session_ids(profile);new=after-before
    c=sqlite3.connect((profile/'state.db').resolve().as_uri()+'?mode=ro',uri=True)
    try:
        answers=[]
        for sid in new:
            row=c.execute('SELECT content FROM messages WHERE session_id=? AND role=? AND (tool_calls IS NULL OR tool_calls IN (\'[]\',\'\')) ORDER BY id DESC LIMIT 1',(sid,'assistant')).fetchone()
            prompt=c.execute('SELECT system_prompt FROM sessions WHERE id=?',(sid,)).fetchone()[0] or ''
            final=row[0] if row else None
            expected=json.loads((root/'identity_canary_local_only.json').read_text(encoding='utf-8'))['value']
            answers.append({'session_id':sid,'final_response':final,'system_prompt_saved_in_session_row':bool(prompt),'identity_canary_matched':bool(final and expected in final),'identity_canary_is_a_credential':False})
    finally:c.close()
    raw=[json.loads(x) for x in trace.read_text(encoding='utf-8').splitlines()[start:]]
    calls=[{'tool':x['name'],'arguments':x['arguments'],'is_error':bool(x['result'].get('isError')),'observed_text':'\n'.join(y.get('text','') for y in x['result'].get('content',[]) if y.get('type')=='text')} for x in raw]
    result={'entry':'same dedicated entry used by local cmd; actual installed hermes_cli.main -> classic HermesCLI','process_exit':code,'new_session_count':len(new),'answers':answers,'browser_calls':len(calls),'tool_trace':calls,'manual_double_click_visual_acceptance':False}
    value=json.dumps(result,ensure_ascii=False,indent=2)
    for home in [str(Path.home()),str(Path.home()).replace('\\','/'),str(Path.home()).replace('\\','\\\\')]:value=value.replace(home,'<USER_HOME>')
    output.parent.mkdir(parents=True,exist_ok=True);output.write_text(value,encoding='utf-8')
    print(json.dumps({'native_cli_exit':code,'new_sessions':len(new),'browser_calls':len(calls),'answer_present':bool(answers and answers[0]['final_response'])}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('runtime',type=Path);p.add_argument('output',type=Path);a=p.parse_args();run(a.runtime.resolve(),a.output)
