"""Owned synthetic browser workplace. Starts the existing Desktop, never an Agent."""
import argparse
import datetime
import json
import os
from pathlib import Path
import queue
import subprocess
import sys
import threading
import time
import urllib.request
import uuid
sys.path.insert(0, str(Path(__file__).resolve().parent))
from safety import ordinary_path, write_new_json, sha256, windows_metadata
from owned_job import OwnedJob


class TrainingRun:
    def __init__(self, root, route, case, chrome, node, headed=False):
        self.root = ordinary_path(root)
        if route not in {"native", "playwright"} or case not in {"analysis", "binding", "recovery"}:
            raise ValueError("Unknown route/case")
        self.route, self.case = route, case
        self.output = self.root / "runs" / (datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + route + "-" + case + "-" + uuid.uuid4().hex[:8])
        self.output.mkdir(parents=True)
        ordinary_path(self.output)
        self.job, self.children = OwnedJob(), []
        self.errors = (self.output / "children-stderr.log").open("xb")
        self.meta = {"route": route, "case": case, "model_messages_sent_by_codex": 0,
                     "started_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                     "chrome": chrome, "node": node, "toolRoot": str(self.root)}
        self.env = {k: v for k, v in os.environ.items() if k.upper() in {
            "PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "USERPROFILE",
            "APPDATA", "LOCALAPPDATA", "TEMP", "TMP"}}
        self.env["ANONYMIZED_TELEMETRY"] = "false"
        try:
            fixture_config = self.output / "fixture-config.json"
            write_new_json(fixture_config, {"output": str(self.output), "visualCode": "47"})
            fixture = self.spawn([node, str(self.root / "fixture.mjs"), str(fixture_config)], stdout=subprocess.PIPE)
            ready_queue = queue.Queue()
            threading.Thread(target=lambda: ready_queue.put(fixture.stdout.readline()), daemon=True).start()
            ready = json.loads(ready_queue.get(timeout=15))
            if ready.get("event") != "fixture_ready":
                raise RuntimeError("Fixture not ready")
            self.origin = ready["origin"]
            profile = self.output / "chrome-profile"
            profile.mkdir()
            args = [chrome, "--user-data-dir=" + str(profile), "--remote-debugging-port=0",
                    "--remote-debugging-address=127.0.0.1", "--proxy-server=" + ready["proxy"],
                    "--proxy-bypass-list=<-loopback>", "--disable-background-networking",
                    "--disable-component-update", "--disable-sync", "--disable-default-apps",
                    "--no-first-run", "--no-default-browser-check", "--window-size=1280,900"]
            if not headed:
                args.append("--headless=new")
            args.append(self.origin + "/" + case)
            browser = self.spawn(args)
            active = profile / "DevToolsActivePort"
            deadline = time.monotonic() + 20
            while not active.exists():
                if browser.poll() is not None:
                    raise RuntimeError("Owned Chrome exited before CDP")
                if time.monotonic() >= deadline:
                    raise TimeoutError("Owned Chrome CDP readiness timed out")
                time.sleep(.1)
            port = int(active.read_text().splitlines()[0])
            self.cdp = "http://127.0.0.1:" + str(port)
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(self.cdp + "/json/version", timeout=5) as response:
                version = json.load(response)
            self.runtime = self.output / "runtime.json"
            browser_output = self.output / "browser"
            browser_output.mkdir()
            runtime = {**self.meta, "origin": self.origin, "cdp": self.cdp,
                       "dependencyRoot": str(self.root), "browserOutput": str(browser_output),
                       "trace": str(self.output / "tool-receipts.jsonl"),
                       "schema": str(self.output / "tool-schema.json"),
                       "stderr": str(self.output / "mcp-stderr.log")}
            write_new_json(self.runtime, runtime)
            self.meta.update(origin=self.origin, cdp=self.cdp, proxy=ready["proxy"],
                             chrome_version=version.get("Browser"), child_pids=[p.pid for p in self.children])
            write_new_json(self.output / "lifecycle.json", self.meta)
        except BaseException:
            self.close()
            raise

    def spawn(self, argv, stdout=subprocess.DEVNULL, stdin=subprocess.DEVNULL, env=None, cwd=None):
        p = subprocess.Popen(argv, stdin=stdin, stdout=stdout, stderr=self.errors,
                             cwd=cwd or str(self.root), env=env or self.env,
                             creationflags=subprocess.CREATE_NO_WINDOW)
        self.job.add(p)
        self.children.append(p)
        return p

    def desktop_env(self):
        home = Path.home() / ".hermes"
        if os.environ.get("HERMES_HOME") and Path(os.environ["HERMES_HOME"]).resolve() != home.resolve():
            raise RuntimeError("Original process HERMES_HOME differs; do not change identity")
        env = dict(os.environ)
        # No credentials/config paths are copied into a new identity.
        env["LINGJU_BROWSER_EXERCISE"] = self.route
        env["LINGJU_BROWSER_RUNTIME"] = str(self.runtime)
        env["HERMES_TUI_MAX_TURNS"] = "16"
        env["HERMES_TUI_TOOLSETS"] = "browser,terminal,file" if self.route == "native" else "company_browser_simulation,file"
        if self.route == "native":
            env["BU_CDP_URL"] = self.cdp
            env.pop("BU_CDP_WS", None)
            env["PATH"] = str(self.root / "compat" / "bin") + os.pathsep + str(self.root / "native-env" / "Scripts") + os.pathsep + env.get("PATH", "")
        return env

    def start_desktop(self, exe):
        exe = ordinary_path(exe)
        if exe.name.lower() != "hermes.exe":
            raise RuntimeError("Only the existing Hermes executable is permitted")
        # Installed Desktop computes its canonical runtime from HERMES_HOME.
        # Do not let this development launch accidentally enter first-install.
        expected_runtime = Path.home() / ".hermes" / "hermes-agent"
        if not (expected_runtime / "venv" / "Scripts" / "python.exe").is_file():
            raise RuntimeError("Desktop canonical runtime is absent under the existing HERMES_HOME; stop rather than bootstrap, relocate home or install another copy")
        existing = windows_metadata("@(Get-Process -Name Hermes -ErrorAction SilentlyContinue).Count")
        if existing != "0":
            raise RuntimeError("Original Desktop already open. Do not replace or kill it.")
        p = self.spawn([str(exe)], env=self.desktop_env(),
                       cwd=str(Path.home() / ".hermes" / "company-workspace"))
        self.meta.update(desktop_pid=p.pid, desktop_exe=str(exe), desktop_exe_sha256=sha256(exe),
                         original_home=str(Path.home() / ".hermes"),
                         workspace=str(Path.home() / ".hermes" / "company-workspace"))
        (self.output / "lifecycle.json").write_text(json.dumps(self.meta, indent=2), encoding="utf-8")
        return p

    def native_smoke(self):
        env = dict(self.env)
        ipc = self.output / "native-ipc"
        ipc.mkdir()
        env.update(BU_CDP_URL=self.cdp, BU_NAME="lingju_zero", BH_RUNTIME_DIR=str(ipc),
                   BH_TMP_DIR=str(ipc), BH_AGENT_WORKSPACE=str(self.output / "browser"))
        cli = self.root / "compat" / "bin" / "browser-use.cmd"
        proc = self.spawn([str(cli), "exec"], stdout=subprocess.PIPE,
                          stdin=subprocess.PIPE, env=env)
        try:
            code = "new_tab(" + repr(self.origin + "/analysis") + ")\nwait_for_load()\nprint(page_info())\nprint(capture_screenshot())\n"
            out, _ = proc.communicate(code.encode("utf-8"), timeout=45)
            result = {"exit_code": proc.returncode, "stdout": out.decode("utf-8", "replace"),
                      "explicit_cdp": self.cdp, "runtime_isolated": str(ipc), "model_calls": 0}
        except subprocess.TimeoutExpired as e:
            result = {"exit_code": proc.poll(), "error": "native CLI timed out", "model_calls": 0,
                      "partial_stdout": (e.output or b"").decode("utf-8", "replace")}
        write_new_json(self.output / "native-smoke.json", result)
        return result

    def close(self):
        if getattr(self, "job", None):
            self.job.close()
        for p in getattr(self, "children", []):
            try:
                p.wait(timeout=8)
            except subprocess.TimeoutExpired:
                self.meta["cleanup_timeout"] = True
        if getattr(self, "output", None):
            self.meta.update(closed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                             child_pids=[p.pid for p in self.children],
                             children_exited=all(p.poll() is not None for p in self.children))
            (self.output / "lifecycle.json").write_text(json.dumps(self.meta, indent=2), encoding="utf-8")
        if getattr(self, "errors", None):
            self.errors.close()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--route", choices=["native", "playwright"], required=True)
    p.add_argument("--case", choices=["analysis", "binding", "recovery"], required=True)
    p.add_argument("--chrome", required=True)
    p.add_argument("--node", required=True)
    p.add_argument("--desktop")
    p.add_argument("--headed", action="store_true")
    p.add_argument("--acceptance", action="store_true")
    args = p.parse_args()
    root = Path(__file__).resolve().parent
    if args.acceptance:
        gate = json.loads((root / "acceptance-gate.json").read_text(encoding="utf-8"))
        if not gate.get("all_zero_model_gates_passed") or not gate.get("physical_api_budget_enforced"):
            raise RuntimeError("Model acceptance is blocked; do not send a Desktop task")
    run = TrainingRun(root, args.route, args.case, args.chrome, args.node, args.headed)
    try:
        if args.desktop:
            run.start_desktop(args.desktop)
        print(json.dumps({"event": "run_ready", "output": str(run.output), "runtime": str(run.runtime),
                          "origin": run.origin, "cdp": run.cdp, "model_messages_sent": 0,
                          "owner_may_send_message": bool(args.acceptance)}, ensure_ascii=False), flush=True)
        for line in sys.stdin:
            if line.strip() == "stop":
                break
            if line.strip() == "native-smoke":
                result = run.native_smoke()
                print(json.dumps({"event": "native_smoke", **result}, ensure_ascii=False), flush=True)
    finally:
        run.close()


if __name__ == "__main__":
    main()
