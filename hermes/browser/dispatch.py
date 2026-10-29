"""Opt-in bridge target. Default legacy bridge is not replaced or rewritten."""
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
sys.path.insert(0, str(Path(__file__).resolve().parent))
from safety import ordinary_path
from owned_job import OwnedJob


def wait_bridge_shutdown(child,job):
    """Allow lease cleanup before enforcing orphan prevention."""
    try:return child.wait(timeout=12)
    except subprocess.TimeoutExpired:
        job.close()
        return child.wait(timeout=10)


def dispatch_target(runtime, root):
    """Explicit fixed entry or legacy finite runtime; never guess a fallback."""
    cfg = json.loads(runtime.read_text(encoding="utf-8"))
    if cfg.get('schema') in ('lingju.ego-browser.v1', 'lingju.ego-browser.v2'):
        from ego_runtime import validate_ego_runtime
        cfg = validate_ego_runtime(runtime, root)
        return cfg, 'ego/bridge.mjs'
    if cfg.get('schema') == 'lingju.browser.work-entry.v1':
        from work_entry import validate_entry
        cfg, _ = validate_entry(runtime, root)
        return cfg, 'work_broker.mjs'
    if root / 'runs' not in runtime.parents:
        raise RuntimeError("Runtime outside company browser runs")
    if cfg.get('schema') == 'lingju.readonly-browser.v1':
        from readonly_task import validate_readonly_runtime
        # Keep the passive catalog when the browser stops. Every actual read
        # separately requires a live owned browser, current login and new grant.
        validate_readonly_runtime(runtime,root,require_ready=False)
        return cfg, 'readonly_bridge.mjs'
    if cfg.get("route") != "playwright" or cfg.get("toolRoot") != str(root):
        raise RuntimeError("Runtime/route identity mismatch")
    return cfg, 'bridge.mjs'


def main():
    root = ordinary_path(Path(__file__).parent)
    direct = os.environ.get("LINGJU_BROWSER_EXERCISE") == "playwright"
    alias = os.environ.get("XDG_LINGJU_BROWSER_RUNTIME")
    if not direct and not alias:
        raise RuntimeError("Explicit B-route process metadata required")
    runtime = ordinary_path(os.environ.get("LINGJU_BROWSER_RUNTIME") if direct else alias)
    run = ordinary_path(root / "runs")
    cfg, target = dispatch_target(runtime, root)
    if target=='ego/bridge.mjs':
        from ego_lease import recover_dead_ego_lease
        recover_dead_ego_lease(runtime,root)
    (runtime.parent / "dispatch-receipt.json").write_text(json.dumps({
        "route_marker_received": True, "runtime_validated": True,
        "activation_source": "direct_marker" if direct else "xdg_runtime_path",
        "wrapper_pid": os.getpid(), "home_env_present": bool(os.environ.get("HERMES_HOME")),
        "original_home_unchanged": Path(os.environ.get("HERMES_HOME") or Path.home() / ".hermes").resolve() == (Path.home() / ".hermes").resolve(),
        "max_turns_received": os.environ.get("HERMES_TUI_MAX_TURNS"),
        "toolsets_received": os.environ.get("HERMES_TUI_TOOLSETS"),
        "model_calls": 0, "target": target}), encoding="utf-8")
    env = {k: v for k, v in os.environ.items() if k.upper() in {
        "PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "USERPROFILE",
        "APPDATA", "LOCALAPPDATA", "TEMP", "TMP"}}
    job = OwnedJob()
    try:
        child = subprocess.Popen([cfg["node"], str(root / target), str(runtime)],
                                 stdin=subprocess.PIPE, stdout=sys.stdout, stderr=sys.stderr,
                                 env=env, cwd=str(run), creationflags=subprocess.CREATE_NO_WINDOW)
        job.add(child)
        closed = threading.Event()
        def forward():
            try:
                while True:
                    block = os.read(sys.stdin.fileno(), 65536)
                    if not block:
                        break
                    child.stdin.write(block)
                    child.stdin.flush()
            except (OSError, BrokenPipeError):
                pass
            finally:
                try:
                    child.stdin.close()
                except OSError:
                    pass
                closed.set()
        threading.Thread(target=forward, daemon=True).start()
        while child.poll() is None and not closed.wait(.1):
            pass
        if closed.is_set():
            # Give Node stdin-end/worker-finally cleanup time to release its
            # own lease before the Job Object enforces orphan prevention.
            return wait_bridge_shutdown(child,job)
        return child.wait(timeout=10)
    finally:
        job.close()


if __name__ == "__main__":
    sys.exit(main())
