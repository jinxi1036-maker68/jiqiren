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


def main():
    root = ordinary_path(Path(__file__).parent)
    direct = os.environ.get("LINGJU_BROWSER_EXERCISE") == "playwright"
    alias = os.environ.get("XDG_LINGJU_BROWSER_RUNTIME")
    if not direct and not alias:
        raise RuntimeError("Explicit B-route process metadata required")
    runtime = ordinary_path(os.environ.get("LINGJU_BROWSER_RUNTIME") if direct else alias)
    run = ordinary_path(root / "runs")
    if run not in runtime.parents:
        raise RuntimeError("Runtime outside company browser runs")
    cfg = json.loads(runtime.read_text(encoding="utf-8"))
    if cfg["route"] != "playwright" or cfg["toolRoot"] != str(root):
        raise RuntimeError("Runtime/route identity mismatch")
    (runtime.parent / "dispatch-receipt.json").write_text(json.dumps({
        "route_marker_received": True, "runtime_validated": True,
        "activation_source": "direct_marker" if direct else "xdg_runtime_path",
        "wrapper_pid": os.getpid(), "home_env_present": bool(os.environ.get("HERMES_HOME")),
        "original_home_unchanged": Path(os.environ.get("HERMES_HOME") or Path.home() / ".hermes").resolve() == (Path.home() / ".hermes").resolve(),
        "max_turns_received": os.environ.get("HERMES_TUI_MAX_TURNS"),
        "toolsets_received": os.environ.get("HERMES_TUI_TOOLSETS"),
        "model_calls": 0}), encoding="utf-8")
    env = {k: v for k, v in os.environ.items() if k.upper() in {
        "PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "USERPROFILE",
        "APPDATA", "LOCALAPPDATA", "TEMP", "TMP"}}
    job = OwnedJob()
    try:
        child = subprocess.Popen([cfg["node"], str(root / "bridge.mjs"), str(runtime)],
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
            job.close()
        return child.wait(timeout=10)
    finally:
        job.close()


if __name__ == "__main__":
    sys.exit(main())
