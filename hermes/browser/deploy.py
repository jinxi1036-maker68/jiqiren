"""Install only this tool's files and one opt-in legacy dispatch.
No model/config/knowledge/MCP-registration changes; conditional single-file rollback.
"""
import argparse
import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
from safety import ordinary_path, sha256, write_new_json, check_snapshot, windows_metadata

FILES = ["package.json", "package-lock.json", "requirements-native.in",
         "requirements-native.lock", "cases.json", "safety.py", "fixture.mjs",
         "bridge.mjs", "image_result.mjs", "browser_evidence.mjs", "native_cli.py", "compat/bin/browser-use.cmd", "dispatch.py", "owned_job.py", "launch.py",
         "watch.py", "TASKS.md", "web/index.html", "web/app.js", "web/style.css"]
FILES.append("budget_gate.py")
FILES.append("desktop_runtime.py")
FILES.extend(["request_budget.py", "startup/sitecustomize.py"])


def hook_text(root):
    # Insert before imports so unmarked calls execute the original file verbatim.
    return (
        "# LINGJU_BROWSER_OPT_IN_DISPATCH_V2\n"
        "import os as _lj_os\n"
        "if _lj_os.environ.get('LINGJU_BROWSER_EXERCISE') == 'playwright' or _lj_os.environ.get('XDG_LINGJU_BROWSER_RUNTIME'):\n"
        "    import runpy as _lj_runpy\n"
        "    _lj_runpy.run_path(" + repr(str(root / "dispatch.py")) + ", run_name='__main__')\n"
        "    raise SystemExit(0)\n"
        "# END_LINGJU_BROWSER_OPT_IN_DISPATCH_V2\n"
    ).encode("utf-8")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("action", choices=["files", "hook", "refresh-hook", "rollback-hook", "verify"])
    p.add_argument("--home", required=True)
    p.add_argument("--snapshot", required=True)
    p.add_argument("--recovery-dir")
    p.add_argument("--only", action="append", choices=FILES,
                   help="Explicit incremental tool source (files action only)")
    args = p.parse_args()
    if args.only and args.action != "files":
        p.error("--only is permitted only for incremental tool-file deployment")
    source = Path(__file__).resolve().parent
    home = ordinary_path(args.home)
    root = ordinary_path(home / "tools" / "company-browser")
    receipt = root / "deployment.json"
    baseline = json.loads(Path(args.snapshot).read_text(encoding="utf-8"))
    changes = check_snapshot(baseline)
    if changes:
        raise RuntimeError("Protected file changed; stop: " + repr(changes))
    old = json.loads(receipt.read_text(encoding="utf-8")) if receipt.exists() else {"files": {}}
    legacy = ordinary_path(home / "tools" / "company-browser-simulation" / "launch_bridge.py")
    if args.action == "files":
        selected = list(dict.fromkeys(args.only or FILES))
        for rel in selected:
            src, dst = source / rel, root / rel
            if not src.is_file():
                raise RuntimeError("Missing source: " + rel)
            if dst.exists() and sha256(dst) != old["files"].get(rel):
                raise RuntimeError("Concurrent/untracked target modification: " + rel)
        for rel in selected:
            dst = root / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source / rel, dst)
            old["files"][rel] = sha256(dst)
        receipt.write_text(json.dumps(old, indent=2), encoding="utf-8")
        print(json.dumps({"tool_files_written": len(selected), "protected_changes": 0, "model_calls": 0}))
    elif args.action == "hook":
        if "hook" in old:
            if sha256(legacy) != old["hook"]["after"]:
                raise RuntimeError("Hook differs from receipt")
            print("Existing exact hook retained")
            return
        original = legacy.read_bytes()
        if b"LINGJU_BROWSER_OPT_IN_DISPATCH" in original:
            raise RuntimeError("Untracked dispatch exists")
        markers = [b'if __name__ == "__main__":', b"if __name__ == '__main__':"]
        recognized = [m for m in markers if original.count(m) == 1]
        if len(recognized) != 1:
            raise RuntimeError("Legacy entrypoint not uniquely recognized")
        marker = recognized[0]
        recovery_parent = ordinary_path(Path.home() / ".lingju-hermes-recovery")
        recovery = ordinary_path(Path(args.recovery_dir) if args.recovery_dir else recovery_parent / ("browser-b-" + datetime.datetime.now().strftime("%Y%m%dT%H%M%S")), allow_missing=True)
        if recovery.parent != recovery_parent or not recovery.name.startswith("browser-b-"):
            raise RuntimeError("Recovery must be an owned browser-b subdirectory")
        sid = windows_metadata("[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value")
        if not recovery.exists():
            recovery.mkdir()
            subprocess.run(["icacls.exe", str(recovery), "/inheritance:r", "/grant:r",
                            "*" + sid + ":(OI)(CI)F", "*S-1-5-18:(OI)(CI)F"], check=True, capture_output=True)
        elif not args.recovery_dir:
            raise RuntimeError("Unexpected existing recovery path")
        ordinary_path(recovery)
        acl_check = "$a=Get-Acl -LiteralPath '" + str(recovery).replace("'", "''") + "'; $s='" + sid + "'; if(-not $a.AreAccessRulesProtected){exit 2}; foreach($r in $a.Access){$i=$r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value; if($r.AccessControlType -eq 'Allow' -and $i -notin @($s,'S-1-5-18')){exit 3}}"
        windows_metadata(acl_check)
        before = sha256(legacy)
        preimage = recovery / "launch_bridge.py.before"
        if not preimage.exists():
            with preimage.open("xb") as f:
                f.write(original)
        if sha256(preimage) != before:
            raise RuntimeError("Preimage verification failed")
        # Preserve the original module docstring/future imports by append-at-entry.
        insert = hook_text(root)
        patched = original.replace(marker, insert + b"\n" + marker, 1)
        if sha256(legacy) != before:
            raise RuntimeError("Legacy file changed concurrently")
        tmp = legacy.with_name("launch_bridge.py.lingju-pending")
        with tmp.open("xb") as f:
            f.write(patched)
        if sha256(legacy) != before:
            raise RuntimeError("Legacy file changed before replace")
        os.replace(tmp, legacy)
        old["hook"] = {"before": before, "after": sha256(legacy), "preimage": str(preimage),
                       "recovery_final_path": str(recovery)}
        receipt.write_text(json.dumps(old, indent=2), encoding="utf-8")
        print(json.dumps({"existing_files_modified": 1, "config_changed": False,
                          "preimage_verified": True, "default_implementation_preserved": True}))
    elif args.action == "refresh-hook":
        h = old.get("hook")
        if not h or sha256(legacy) != h["after"] or h.get("refresh"):
            raise RuntimeError("Tracked V1 hook missing, changed or already refreshed")
        recovery = ordinary_path(args.recovery_dir)
        parent = ordinary_path(Path.home() / ".lingju-hermes-recovery")
        if recovery.parent != parent or not recovery.name.startswith("browser-b-"):
            raise RuntimeError("Recovery must remain in this round's private directory")
        sid = windows_metadata("[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value")
        windows_metadata("$a=Get-Acl -LiteralPath '" + str(recovery).replace("'", "''") + "'; $s='" + sid + "'; if(-not $a.AreAccessRulesProtected){exit 2}; foreach($r in $a.Access){if($r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin @($s,'S-1-5-18')){exit 3}}")
        original = legacy.read_bytes()
        start = b"# LINGJU_BROWSER_OPT_IN_DISPATCH_V1\n"
        end = b"# END_LINGJU_BROWSER_OPT_IN_DISPATCH_V1\n"
        if original.count(start) != 1 or original.count(end) != 1:
            raise RuntimeError("Original V1 guard not uniquely recognized")
        a, b = original.index(start), original.index(end) + len(end)
        if b <= a:
            raise RuntimeError("Invalid guard boundary")
        patched = original[:a] + hook_text(root) + original[b:]
        preimage = recovery / "launch_bridge.py.before"
        with preimage.open("xb") as f:
            f.write(original)
        if sha256(preimage) != h["after"] or sha256(legacy) != h["after"]:
            raise RuntimeError("Preimage or current guard changed")
        pending = legacy.with_name("launch_bridge.py.lingju-pending")
        with pending.open("xb") as f:
            f.write(patched)
        if sha256(legacy) != h["after"]:
            raise RuntimeError("Concurrent guard change; no replace")
        before = h["after"]
        os.replace(pending, legacy)
        h["after"] = sha256(legacy)
        h["refresh"] = {"before": before, "after": h["after"], "preimage": str(preimage)}
        receipt.write_text(json.dumps(old, indent=2), encoding="utf-8")
        print(json.dumps({"hook_refreshed": True, "config_changed": False, "mcp_environment_allowlist_changed": False, "preimage_verified": True}))
    elif args.action == "rollback-hook":
        h = old.get("hook")
        if not h:
            raise RuntimeError("No owned hook recorded")
        restore = h.get("refresh", h)
        if sha256(legacy) != restore["after"] or sha256(restore["preimage"]) != restore["before"]:
            raise RuntimeError("Concurrent change or invalid preimage; no rollback")
        shutil.copyfile(restore["preimage"], legacy)
        if sha256(legacy) != restore["before"]:
            raise RuntimeError("Rollback hash failed")
        old["hook_rolled_back"] = True
        if h.get("refresh"):
            h["after"] = restore["before"]
            h.pop("refresh")
        receipt.write_text(json.dumps(old, indent=2), encoding="utf-8")
        print("Owned hook restored exactly")
    else:
        bad = [rel for rel, digest in old["files"].items() if sha256(root / rel) != digest]
        if old.get("hook") and sha256(legacy) != old["hook"]["after"]:
            bad.append("legacy_hook")
        print(json.dumps({"tool_changes": bad, "protected_changes": changes,
                          "protected_files": len(baseline["files"]), "model_calls": 0}))
        if bad:
            raise SystemExit(1)


if __name__ == "__main__":
    main()
