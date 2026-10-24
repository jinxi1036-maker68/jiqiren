"""Publish only selected synthetic checks and protection hashes, never raw receipts."""
import argparse
import datetime
import importlib.metadata as md
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from safety import check_snapshot, sha256, windows_metadata
from deploy import hook_text


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--home", required=True)
    a.add_argument("--snapshot", required=True)
    a.add_argument("--output", required=True)
    args = a.parse_args()
    home = Path(args.home)
    root = home / "tools" / "company-browser"
    source = Path(__file__).resolve().parent
    unit = json.loads((source / ".local/unit-test-receipts.json").read_text(encoding="utf-8"))
    if not unit["all_passed"] or any(sha256(source / n) != d for n, d in unit["source_sha256"].items()):
        raise RuntimeError("Actual unit receipts missing, failed or stale for current code")
    baseline = json.loads(Path(args.snapshot).read_text(encoding="utf-8"))
    deployment = json.loads((root / "deployment.json").read_text(encoding="utf-8"))
    changes = check_snapshot(baseline)
    if changes:
        raise RuntimeError("Protected drift: do not publish a passing report")
    mismatches = [n for n, d in deployment["files"].items() if sha256(root / n) != d or sha256(source / n) != d]
    if mismatches:
        raise RuntimeError("Source/deployment mismatch: " + repr(mismatches))
    hook = deployment["hook"]
    legacy = home / "tools/company-browser-simulation/launch_bridge.py"
    preimage = Path(hook["preimage"])
    if sha256(preimage) != hook["before"] or sha256(legacy) != hook["after"]:
        raise RuntimeError("Hook/preimage mismatch")
    preserved = legacy.read_bytes().replace(hook_text(root) + b"\n", b"", 1) == preimage.read_bytes()
    smoke = json.loads((root / "zero-model-smoke.json").read_text(encoding="utf-8"))
    dispatch = json.loads((source / ".local/dispatch-smoke.json").read_text(encoding="utf-8"))
    native_files = sorted((root / "runs").glob("*-native-analysis-*/native-smoke.json"))
    native = json.loads(native_files[-1].read_text(encoding="utf-8"))
    gate = json.loads((root / "acceptance-gate.json").read_text(encoding="utf-8"))
    workspace_records = {p: r for p, r in baseline["files"].items() if str(home / "company-workspace") + "\\" in p}
    exist = sum(bool(r["exists"]) for r in baseline["files"].values())
    native_site = root / "native-env/Lib/site-packages"
    native_versions = {d.metadata["Name"].lower(): d.version for d in md.distributions(path=[str(native_site)])}
    node_versions = {n: json.loads((root / "node_modules" / n / "package.json").read_text(encoding="utf-8"))["version"] for n in ["@playwright/mcp", "@modelcontextprotocol/sdk"]}
    life = [json.loads(p.read_text(encoding="utf-8")) for p in (root / "runs").glob("*/lifecycle.json")]
    counters = {}
    for p in (root / "runs").glob("*/tool-receipts.jsonl"):
        for line in p.read_text(encoding="utf-8").splitlines():
            row = json.loads(line)
            counters[row["name"]] = counters.get(row["name"], 0) + 1
    recovery = preimage.parent
    acl_script = "$a=Get-Acl -LiteralPath '" + str(recovery).replace("'", "''") + "'; $s=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $r=@($a.Access); @{protected=$a.AreAccessRulesProtected;rules=$r.Count;private=(@($r | Where-Object {$_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin @($s,'S-1-5-18')}).Count -eq 0)} | ConvertTo-Json -Compress"
    acl = json.loads(windows_metadata(acl_script))
    result = {
        "checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "base_main": "689100ce85b86943638a39ea5b3bd37d8ce85067",
        "release": "LINGJU-BROWSER-LOCAL-B-2026-10-24",
        "status": "tooling_partial_model_acceptance_blocked",
        "new_hermes_identities": 0, "hermes_messages_sent": 0, "hermes_model_requests": 0,
        "production_platform_access": False, "raw_receipts_uploaded": False,
        "unit_tests": {"node_passed": unit["commands"]["node"]["passed_count"],
                       "python_passed": unit["commands"]["python"]["passed_count"],
                       "recorded_at": unit["at"], "actual_command_results": unit["commands"]},
        "versions": {**node_versions, "browser-use": native_versions.get("browser-use"),
                     "browser-harness": native_versions.get("browser-harness"),
                     "native_distribution_count": len(native_versions), "chrome": "156.0.8078.47",
                     "packaged_original_desktop": "0.17.0"},
        "playwright_component": {
            "status": smoke["routes"]["playwright"]["status"],
            "tools": smoke["routes"]["playwright"]["tools"],
            "image_block_delivered": smoke["routes"]["playwright"]["screenshot_image_delivered"], "vision_understanding": "unverified",
            "employee_tasks_performed": smoke["employee_tasks_performed"], "business_records_created": smoke["routes"]["playwright"]["business_records_created"]},
        "native_component": {"status": "failed", "error": native.get("error"),
                             "exit_code": native.get("exit_code"),
                             "root_cause": "unknown; isolated daemon/CDP initialization observed, execution did not return"},
        "dispatch_regression": {
            "unmarked_tools": dispatch["unmarked"]["tools"],
            "marked_tools": dispatch["marked"]["tools"],
            "marker_received": dispatch["marked"]["receipt"]["route_marker_received"],
            "original_home_unchanged": dispatch["marked"]["receipt"]["original_home_unchanged"],
            "desktop_environment_proven": False},
        "desktop": {"started_this_round": any("desktop_pid" in x for x in life), "model_session_tested": False,
                    "reason": "Do not start a potentially bootstrapping Desktop under a home without canonical runtime; no relocation or install permitted."},
        "budget_gate": gate,
        "protection": {"records_checked": len(baseline["files"]), "existing_files": exist,
                       "all_unchanged": True, "workspace_files": len(workspace_records),
                       "workspace_manifest_sha256": sha256(home / "company-workspace/SNAPSHOT_MANIFEST.json")},
        "existing_file_change": {"file": "H/tools/company-browser-simulation/launch_bridge.py",
                                 "before_sha256": hook["before"], "after_sha256": hook["after"],
                                 "unmarked_original_body_preserved": preserved,
                                 "preimage_hash_verified": True, "recovery_acl": acl,
                                 "rollback_performed": False},
        "new_tool_files_deployed": len(deployment["files"]),
        "tool_source_sha256": deployment["files"],
        "components_total_call_counts": counters,
        "recorded_runs": len(life),
        "all_recorded_children_exited": all(x.get("children_exited") is True for x in life),
        "agent_acceptance": {r: {c: "not_run" for c in ["analysis", "binding", "recovery"]} for r in ["native", "playwright"]},
        "selected_primary_driver": None,
        "note": "Component checks and developer actions are not Hermes Agent acceptance."
    }
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: result[k] for k in ["status", "protection", "new_tool_files_deployed", "recorded_runs", "all_recorded_children_exited", "hermes_model_requests"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
