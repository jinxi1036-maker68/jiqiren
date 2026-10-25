"""Run only the new component unit tests and record actual outcomes."""
import datetime
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import time
from deploy import FILES

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("--only-python", action="store_true")
parser.add_argument("--output", default=str(root / ".local/unit-test-receipts.json"))
args = parser.parse_args()
commands = [
    ("node", ["node", "--test", *[str(p.relative_to(root)) for p in sorted((root / "tests").glob("*.test.mjs"))]]),
    ("python", [sys.executable, "-B", "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py"]),
]
if args.only_python:
    commands = [c for c in commands if c[0] == "python"]
results = {}
for name, command in commands:
    start = time.monotonic()
    p = subprocess.run(command, cwd=root, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
    text = p.stdout + p.stderr
    count = re.search(r"\bpass\s+(\d+)", text) if name == "node" else re.search(r"Ran (\d+) tests?", text)
    results[name] = {"exit_code": p.returncode, "passed_count": int(count.group(1)) if count and p.returncode == 0 else 0,
                     "duration_seconds": round(time.monotonic() - start, 3),
                     "stdout_sha256": hashlib.sha256(p.stdout.encode()).hexdigest(),
                     "stderr_sha256": hashlib.sha256(p.stderr.encode()).hexdigest()}
    local = root / ".local"
    local.mkdir(exist_ok=True)
    (local / (name + "-unit-output.txt")).write_text(text, encoding="utf-8")
inputs = set(FILES + ["deploy.py", "prepare.py", "collect_validation.py", "run_unit_tests.py",
                     "smoke.mjs", "dispatch_smoke.mjs", "tests/test_safety.py"])
inputs.update(str(p.relative_to(root)).replace("\\", "/") for p in (root / "tests").glob("*test*"))
inputs.update(["desktop_runtime.py", "native_probe.py", "request_budget.py"])
receipt = {"at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "model_calls": 0,
           "all_passed": all(r["exit_code"] == 0 for r in results.values()),
           "commands": results, "source_sha256": {n: hashlib.sha256((root / n).read_bytes()).hexdigest() for n in sorted(inputs)}}
Path(args.output).write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"all_passed": receipt["all_passed"], "commands": results, "model_calls": 0}))
raise SystemExit(0 if receipt["all_passed"] else 1)
