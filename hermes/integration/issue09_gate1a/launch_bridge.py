"""Original-Hermes MCP entry: one owned, ephemeral synthetic browser session.

No model/auth loading, second Hermes, business account or persistent daemon.
All child processes belong to this invocation's Windows Job.
"""
from pathlib import Path
import datetime, importlib.util, json, os, queue, subprocess, sys, threading, uuid

# Explicit sibling import works under Python -I without trusting cwd/PYTHONPATH.
_spec = importlib.util.spec_from_file_location('company_owned_job', Path(__file__).with_name('owned_job.py'))
_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_module)
OwnedJob = _module.OwnedJob


def main():
    template_path = Path(sys.argv[1]).resolve()
    template = json.loads(template_path.read_text(encoding='utf-8'))
    root = template_path.parent
    run = root / 'runs' / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + uuid.uuid4().hex[:8])
    run.mkdir(parents=True, exist_ok=False)
    env = {k: os.environ[k] for k in ('PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP') if k in os.environ}
    job = OwnedJob()
    fixture = bridge = None
    summary = {'run_id': run.name, 'wrapper_pid': os.getpid(), 'model_calls': 0, 'business_data': False}
    with (run / 'child-stderr.log').open('xb') as errors:
        try:
            runtime = dict(template, port=0, origin='http://127.0.0.1:0', requests=str(run / 'requests.jsonl'))
            fixture_config = run / 'fixture.json'
            fixture_config.write_text(json.dumps(runtime), encoding='utf-8')
            fixture = subprocess.Popen([template['node'], str(root / 'demo_server.mjs'), str(fixture_config)], stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=errors, env=env, cwd=root, creationflags=subprocess.CREATE_NO_WINDOW)
            job.add(fixture)
            lines = queue.Queue()
            threading.Thread(target=lambda: lines.put(fixture.stdout.readline()), daemon=True).start()
            ready = json.loads(lines.get(timeout=15))
            if ready.get('event') != 'demo_ready' or not (0 < ready.get('port', 0) < 65536):
                raise RuntimeError('Synthetic server readiness not verified')
            origin = 'http://127.0.0.1:' + str(ready['port'])
            scope = run / 'scope.json'
            scope.write_text(json.dumps({'paths': ['/change', '/partial']}), encoding='utf-8')
            runtime.update(origin=origin, navigationScope=str(scope), trace=str(run / 'trace.jsonl'), browserOutput=str(run / 'browser'))
            (run / 'runtime.json').write_text(json.dumps(runtime), encoding='utf-8')
            summary.update(origin=origin, fixture_pid=fixture.pid, sdk_anchor=template['sdkAnchorPackage'])
            bridge = subprocess.Popen([template['node'], str(root / 'browser_bridge.mjs'), str(run / 'runtime.json')], stdin=subprocess.PIPE, stdout=sys.stdout, stderr=errors, env=env, cwd=root, creationflags=subprocess.CREATE_NO_WINDOW)
            job.add(bridge)
            summary['bridge_pid'] = bridge.pid
            (run / 'lifecycle.json').write_text(json.dumps(summary), encoding='utf-8')
            input_closed = threading.Event()
            def forward_input():
                try:
                    while True:
                        block = os.read(sys.stdin.fileno(), 65536)
                        if not block:
                            break
                        bridge.stdin.write(block)
                        bridge.stdin.flush()
                except (OSError, BrokenPipeError):
                    pass
                finally:
                    try:
                        bridge.stdin.close()
                    except OSError:
                        pass
                    input_closed.set()
            threading.Thread(target=forward_input, daemon=True).start()
            while bridge.poll() is None and not input_closed.wait(0.1):
                pass
            # Host closing stdio must end this entire invocation, even if the
            # Windows venv redirector is the host's directly tracked PID.
            if input_closed.is_set():
                summary['host_stdin_closed'] = True
            summary['bridge_exit_code_before_job_close'] = bridge.poll()
        finally:
            # Closing this unnamed Job affects only this launcher's child tree.
            job.close()
            for child in (bridge, fixture):
                if child is not None:
                    try:
                        child.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        summary['cleanup_timeout'] = True
            summary['children_exited'] = all(p is None or p.poll() is not None for p in (bridge, fixture))
            summary['closed_at_utc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            (run / 'lifecycle.json').write_text(json.dumps(summary), encoding='utf-8')


if __name__ == '__main__':
    main()
