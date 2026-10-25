"""Static budget feasibility evidence. Never changes model/client configuration."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import sys
import yaml


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def evaluate(install, home):
    install, home = Path(install), Path(home)
    loop = install / "agent" / "conversation_loop.py"
    init = install / "agent" / "agent_init.py"
    gateway = install / "tui_gateway" / "server.py"
    texts = {p.relative_to(install).as_posix(): p.read_text(encoding="utf-8") for p in [loop, init, gateway]}
    cfg = yaml.safe_load((home / "config.yaml").read_text(encoding="utf-8")) or {}
    retries = max(1, int((cfg.get("agent") or {}).get("api_max_retries", 3)))
    witnesses = {}
    needles = {
        "agent/conversation_loop.py": ["api_call_count += 1", "while retry_count < max_retries:", "agent.session_api_calls += 1"],
        "agent/agent_init.py": ['_agent_section.get("api_max_retries", 3)'],
        "tui_gateway/server.py": ['os.environ.get("HERMES_TUI_MAX_TURNS")'],
    }
    for rel, terms in needles.items():
        lines = texts[rel].splitlines()
        witnesses[rel] = {"sha256": sha(install / rel), "lines": {
            term: [i + 1 for i, line in enumerate(lines) if term in line] for term in terms}}
    logical_loop_found = all(witnesses["agent/conversation_loop.py"]["lines"].values())
    return {
        "checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "message_limit": 6, "physical_request_limit": 120,
        "max_turns_per_task": 16, "configured_app_attempts_per_loop": retries,
        "six_tasks_times_16_loops_times_app_attempts": 6 * 16 * retries,
        "fallback_config_present": bool(cfg.get("fallback_providers") or cfg.get("fallback_model")),
        "logical_loop_counter_found": logical_loop_found,
        "logical_counter_is_physical_counter": False,
        "physical_api_budget_enforced": False,
        "all_zero_model_gates_passed": False,
        "owner_may_send_message": False,
        "reason": "Existing turn/usage counters do not enforce a global physical request limit including retries, fallback and auxiliary calls. No authorized transport-wide limiter is installed.",
        "action": "Stop model acceptance. Do not alter model/config/provider routes or inject runtime patches.",
        "source_witnesses": witnesses, "model_calls": 0,
    }


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--install", required=True)
    p.add_argument("--home", required=True)
    p.add_argument("--output", required=True)
    a = p.parse_args()
    result = evaluate(a.install, a.home)
    Path(a.output).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k != "source_witnesses"}, ensure_ascii=False))
