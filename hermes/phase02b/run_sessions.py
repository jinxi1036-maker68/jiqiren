"""Run fresh installed Hermes conversations against a synthetic case matrix.
The harness supplies tasks and records evidence; it performs no browser actions.
"""
from pathlib import Path
import json,subprocess,sys,time,datetime,uuid,argparse
import psutil

def stop_owned(process):
    # Only children launched by this harness, never pre-existing Hermes/browser.
    try:
        parent=psutil.Process(process.pid)
        for child in reversed(parent.children(recursive=True)):
            try:child.terminate()
            except psutil.NoSuchProcess:pass
        parent.terminate()
    except psutil.NoSuchProcess:pass

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('runtime',type=Path);p.add_argument('--cases',nargs='+');a=p.parse_args()
    runtime_path=a.runtime.resolve();r=json.loads(runtime_path.read_text(encoding='utf-8'));code=Path(__file__).resolve().parent
    root=runtime_path.parent
    cases=json.loads((code/'CASES.json').read_text(encoding='utf-8'));selected=a.cases or list(cases)
    if any(case not in cases for case in selected):raise ValueError('Unknown simulation case')
    run_id=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:5]
    run=root/'runs'/run_id;run.mkdir(parents=True);(run/'results').mkdir()
    (root/'latest_run.txt').write_text(run_id,encoding='utf-8')
    with (run/'fixture_stdout.txt').open('w',encoding='utf-8') as fixture_out,(run/'fixture_stderr.txt').open('w',encoding='utf-8') as fixture_err:
        server=subprocess.Popen([r['node'],str(code/'demo_server.mjs'),str(runtime_path)],stdout=fixture_out,stderr=fixture_err,creationflags=subprocess.CREATE_NO_WINDOW)
        runs=[]
        try:
            for _ in range(40):
                if (run/'fixture_stdout.txt').read_text(encoding='utf-8').strip():break
                if server.poll() is not None:raise RuntimeError('Fixture exited before readiness')
                time.sleep(.25)
            else:raise TimeoutError('Fixture did not become ready')
            for case in selected:
                Path(r['navigationScope']).write_text(json.dumps({'paths':['/'+case]}),encoding='utf-8')
                trace=Path(r['trace']);start=len(trace.read_text(encoding='utf-8').splitlines()) if trace.exists() else 0
                with (run/(case+'_stdout.txt')).open('w',encoding='utf-8') as out,(run/(case+'_stderr.txt')).open('w',encoding='utf-8') as err:
                    process=subprocess.Popen([sys.executable,'-I','-B',str(code/'agent_session.py'),str(runtime_path),case,str(run/'results')],stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
                    print(json.dumps({'event':'hermes_session_started','case':case}),flush=True)
                    try:exitcode=process.wait(timeout=330)
                    except subprocess.TimeoutExpired:stop_owned(process);raise
                end=len(trace.read_text(encoding='utf-8').splitlines()) if trace.exists() else 0
                runs.append({'case':case,'exitcode':exitcode,'trace_start':start,'trace_end':end})
                (run/'session_runs.json').write_text(json.dumps(runs,indent=2),encoding='utf-8')
                print(json.dumps({'event':'hermes_session_finished','case':case,'exitcode':exitcode,'browser_calls':end-start}),flush=True)
                if exitcode!=0:raise RuntimeError('Hermes session failed; inspect local sanitized error category before retry')
        finally:stop_owned(server)
