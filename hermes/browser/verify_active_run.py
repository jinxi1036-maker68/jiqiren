"""Zero-model evidence gate for the active original Desktop. Never sends a task."""
import argparse
import datetime
import json
import os
from pathlib import Path
import sqlite3
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from safety import ordinary_path, check_snapshot, sha256, windows_metadata
from request_budget import RequestBudget


EXPECTED = {"browser_close", "browser_handle_dialog", "browser_fill_form", "browser_press_key",
            "browser_type", "browser_navigate", "browser_navigate_back", "browser_take_screenshot",
            "browser_snapshot", "browser_click", "browser_select_option", "browser_tabs", "browser_wait_for"}


def verify(root, runtime_path, baseline_path, unit_path, recovery):
    root, runtime_path, recovery = map(ordinary_path, (root, runtime_path, recovery))
    if root / "runs" not in runtime_path.parents:
        raise RuntimeError("Active runtime must be an owned run")
    config = json.loads(runtime_path.read_text(encoding="utf-8"))
    life = json.loads((runtime_path.parent / "lifecycle.json").read_text(encoding="utf-8"))
    if config["route"] != "playwright" or config["toolRoot"] != str(root):
        raise RuntimeError("This verifier only admits the verified Playwright route")
    baseline = json.loads(Path(baseline_path).read_text(encoding="utf-8"))
    differences = check_snapshot(baseline)
    if differences:
        raise RuntimeError("Protected immutable file changed; stop: " + repr(differences))
    source = Path(__file__).resolve().parent
    unit = json.loads(Path(unit_path).read_text(encoding="utf-8"))
    if not unit["all_passed"]:
        raise RuntimeError("Unit checks failed")
    if any(sha256(source / rel) != digest for rel, digest in unit["source_sha256"].items()):
        raise RuntimeError("Unit receipts are stale for current source")
    deployment = json.loads((root / "deployment.json").read_text(encoding="utf-8"))
    for rel, digest in deployment["files"].items():
        if sha256(root / rel) != digest or sha256(source / rel) != digest:
            raise RuntimeError("Deployed source differs: " + rel)
    home = Path(baseline["home"])
    legacy = home / "tools/company-browser-simulation/launch_bridge.py"
    if sha256(legacy) != deployment["hook"]["after"]:
        raise RuntimeError("Dispatch guard changed")
    dispatch = json.loads((runtime_path.parent / "dispatch-receipt.json").read_text(encoding="utf-8"))
    if dispatch.get("activation_source") != "xdg_runtime_path" or not dispatch.get("runtime_validated"):
        raise RuntimeError("Original MCP did not receive validated runtime-path metadata")
    schema = json.loads((runtime_path.parent / "tool-schema.json").read_text(encoding="utf-8"))
    if {x["name"] for x in schema["tools"]} != EXPECTED:
        raise RuntimeError("Actual MCP does not expose the approved 13 tools")
    receipts = [json.loads(p.read_text(encoding="utf-8")) for p in runtime_path.parent.glob("budget-startup-*.json")]
    # Resolve the actual venv redirector -> base-Python process chain. Do not
    # mistake the Windows base image path for a second employee identity.
    process_text = windows_metadata("Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,ExecutablePath | ConvertTo-Json -Compress")
    processes = {p["ProcessId"]: p for p in json.loads(process_text)}
    desktop = processes.get(life["desktop_pid"])
    if not desktop or desktop["ExecutablePath"] != life["desktop_exe"]:
        raise RuntimeError("Original Desktop is not the recorded live process")
    valid = []
    for receipt in receipts:
        parent = processes.get(receipt["parent_pid"])
        if (receipt["python"] == life["existing_runtime"]["python"]
                and receipt["pid"] in processes and parent
                and parent["ParentProcessId"] == life["desktop_pid"]):
            valid.append(receipt)
    if len(valid) != 1:
        raise RuntimeError("No unique live Desktop backend startup receipt")
    receipt = valid[0]
    if not (receipt["home_preserved"] and receipt["original_profile_only"]
            and receipt["httpx_sync_guard"] and receipt["httpx_async_guard"]
            and receipt["unmetered_external_socket_guard"]):
        raise RuntimeError("Original identity or request guards not verified")
    if (receipt["cwd"] != baseline["workspace"] or receipt["route_marker"] != "playwright"
            or receipt["toolsets_received"] != "company_browser_simulation,file,vision"
            or receipt["turn_limit_received"] != "16"
            or receipt["shared_ledger"] != config["roundBudget"]):
        raise RuntimeError("Desktop settings do not match this run")
    if (receipt["budget_code_sha256"] != sha256(root / "request_budget.py")
            or receipt["hook_sha256"] != sha256(root / "startup/sitecustomize.py")):
        raise RuntimeError("Runtime limiter source differs from its receipt")
    pid = dispatch["wrapper_pid"]
    for _ in range(8):
        if pid == receipt["pid"]:
            break
        if pid not in processes:
            raise RuntimeError("Original MCP process chain no longer exists")
        pid = processes[pid]["ParentProcessId"]
    else:
        raise RuntimeError("MCP wrapper is not a child of this Desktop backend")
    budget = RequestBudget(config["roundBudget"])
    status = budget.status()
    if status["limit"] != 120 or status["armed"]:
        raise RuntimeError("Zero-model gate requires the existing shared cap to be unarmed")
    conn = sqlite3.connect((home / "state.db").as_uri() + "?mode=ro", uri=True)
    conn.execute("pragma query_only=on")
    try:
        start = datetime.datetime.fromisoformat(life["started_at"]).timestamp()
        count = conn.execute("SELECT count(*) FROM messages WHERE role='user' AND timestamp>=?", (start,)).fetchone()[0]
    finally:
        conn.close()
    if count:
        raise RuntimeError("A user message was already sent before verification")
    if recovery.parent != ordinary_path(Path.home() / ".lingju-hermes-recovery"):
        raise RuntimeError("Recovery path differs from the approved private root")
    sid = windows_metadata("[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value")
    windows_metadata("$a=Get-Acl -LiteralPath '" + str(recovery).replace("'", "''") + "'; $s='" + sid + "'; if(-not $a.AreAccessRulesProtected){exit 2}; foreach($r in $a.Access){if($r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin @($s,'S-1-5-18')){exit 3}}")
    gate_path = root / "acceptance-gate.json"
    before = sha256(gate_path)
    preimage = recovery / "acceptance-gate.json.before"
    with preimage.open("xb") as f:
        f.write(gate_path.read_bytes())
    if sha256(preimage) != before or sha256(gate_path) != before:
        raise RuntimeError("Gate changed concurrently")
    gate = {"checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "all_zero_model_gates_passed": True, "physical_api_budget_enforced": True,
            "owner_may_send_message": True, "route": config["route"], "case": config["case"],
            "active_runtime": str(runtime_path), "shared_ledger": config["roundBudget"],
            "desktop_pid": life["desktop_pid"], "backend_pid": receipt["pid"],
            "tool_source_sha256": deployment["files"], "registered_tools": sorted(EXPECTED),
            "protected_immutable_records": len(baseline["files"]), "user_messages_seen": count,
            "budget_before_arm": status, "models_called_by_verifier": 0,
            "scope": "This active Desktop's main/aux HTTPX attempts; fail-closed other external Python transports. Not an OS/child-program sandbox.",
            "previous_gate_sha256": before, "preimage": str(preimage)}
    pending = gate_path.with_suffix(".pending")
    with pending.open("x", encoding="utf-8") as f:
        json.dump(gate, f, ensure_ascii=False, indent=2)
        f.write("\n")
    if sha256(gate_path) != before:
        raise RuntimeError("Concurrent gate modification; no replacement")
    os.replace(pending, gate_path)
    (runtime_path.parent / "zero-model-gate.json").write_text(json.dumps(gate, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"zero_model_gate": "pass", "route": config["route"],
                      "desktop_pid": life["desktop_pid"], "backend_pid": receipt["pid"],
                      "actual_mcp_tools": len(EXPECTED), "budget_still_unarmed": True,
                      "hermes_model_calls": 0}))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    for arg in ("root", "runtime", "baseline", "unit", "recovery"):
        p.add_argument("--" + arg, required=True)
    a = p.parse_args()
    verify(a.root, a.runtime, a.baseline, a.unit, a.recovery)
