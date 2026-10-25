"""Read-only current-run receipt collector. NOT a physical API budget enforcer."""
import argparse
import json
from pathlib import Path
import sqlite3
import sys


def collect(db, since, session_ids=()):
    c = sqlite3.connect(Path(db).absolute().as_uri() + "?mode=ro", uri=True)
    c.execute("pragma query_only=on")
    c.row_factory = sqlite3.Row
    # Never SELECT system_prompt, model_config, content, api_content or private memory.
    rows = c.execute("""SELECT id, source, cwd, started_at, ended_at, end_reason,
                        message_count, tool_call_count, api_call_count, model
                        FROM sessions WHERE started_at >= ? AND source = 'desktop'""", (since,)).fetchall()
    result = []
    for row in rows:
        if session_ids and row["id"] not in session_ids:
            continue
        tools = [dict(t) for t in c.execute(
            "SELECT id, tool_name, timestamp FROM messages WHERE session_id=? AND role='tool'",
            (row["id"],))]
        user_count = c.execute("SELECT count(*) FROM messages WHERE session_id=? AND role='user'",
                               (row["id"],)).fetchone()[0]
        result.append({**dict(row), "user_rows": user_count, "tool_receipts": tools})
    c.close()
    return {"sessions": result, "logical_api_calls": sum(r["api_call_count"] or 0 for r in result),
            "physical_api_requests": "not_proven", "is_budget_enforcer": False,
            "private_text_exported": False, "model_calls_by_collector": 0}


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--db", required=True)
    p.add_argument("--since", type=float, required=True)
    p.add_argument("--session-id", action="append", default=[])
    a = p.parse_args()
    print(json.dumps(collect(a.db, a.since, a.session_id), ensure_ascii=False, indent=2))
