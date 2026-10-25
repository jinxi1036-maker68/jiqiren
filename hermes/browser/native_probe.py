"""One bounded, zero-model IPC localization; does not patch installed packages."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from launch import TrainingRun
from safety import ordinary_path, write_new_json


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--tool-root", required=True)
    p.add_argument("--chrome", required=True)
    p.add_argument("--node", required=True)
    p.add_argument("--transport", choices=["direct", "cmd"], default="direct")
    p.add_argument("--screenshot", action="store_true")
    args = p.parse_args()
    root = ordinary_path(args.tool_root)
    run = TrainingRun(root, "native", "analysis", args.chrome, args.node)
    result = {"model_calls": 0, "package_modifications": 0, "timeout_seconds": 15,
              "transport": args.transport}
    try:
        ipc = run.output / "native-ipc"
        ipc.mkdir()
        env = dict(run.env)
        env.update(BU_CDP_URL=run.cdp, BU_NAME="lingju_probe",
                   BH_HOME=str(ipc), BH_RUNTIME_DIR=str(ipc), BH_TMP_DIR=str(ipc),
                   BH_AGENT_WORKSPACE=str(run.output / "browser"), BH_UPDATE_CHECK="0",
                   BH_TELEMETRY="false", PYTHONUNBUFFERED="1")
        python = root / "native-env/Scripts/python.exe"
        # Stack traces contain code locations only; no model, prompt or auth files.
        code = ("import faulthandler,runpy,sys; faulthandler.enable(); "
                "faulthandler.dump_traceback_later(8,repeat=False); "
                "sys.argv=[" + repr(str(root / "native_cli.py")) + ", 'exec']; "
                "runpy.run_path(sys.argv[0],run_name='__main__')")
        command = ([str(python), "-I", "-B", "-u", "-c", code] if args.transport == "direct"
                   else [str(root / "compat/bin/browser-use.cmd"), "exec"])
        proc = run.spawn(command,
                         stdout=subprocess.PIPE, stdin=subprocess.PIPE, env=env)
        task = ("print('PROBE_CODE_ENTERED', flush=True)\nnew_tab(" + repr(run.origin + "/analysis") + ")\n"
                "print('PROBE_TAB_CREATED', flush=True)\nprint(page_info(), flush=True)\n")
        if args.screenshot:
            task += ("print('PROBE_BEFORE_LOAD', flush=True)\nwait_for_load(timeout=5)\n"
                     "print('PROBE_BEFORE_SCREENSHOT', flush=True)\nprint(capture_screenshot(), flush=True)\n")
        result["screenshot_requested"] = args.screenshot
        try:
            output, _ = proc.communicate(task.encode(), timeout=15)
            result.update(exit_code=proc.returncode, timed_out=False, stdout=output.decode("utf-8", "replace"))
        except subprocess.TimeoutExpired as e:
            result.update(exit_code=None, timed_out=True,
                          stdout=(e.output or b"").decode("utf-8", "replace"))
        write_new_json(run.output / "native-probe.json", result)
        print(json.dumps({"run": str(run.output), **result}), flush=True)
    finally:
        run.close()


if __name__ == "__main__":
    main()
