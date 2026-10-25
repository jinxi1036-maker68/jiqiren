"""Owner-approved temporary startup hook; no marker means no behavior change."""
import os

if os.environ.get("LINGJU_BROWSER_BUDGET") == "1":
    try:
        import datetime
        import hashlib
        import importlib.util
        import json
        from pathlib import Path
        import sys
        original_argv = getattr(sys, "orig_argv", [])
        if "--profile" in original_argv:
            at = original_argv.index("--profile")
            if at + 1 >= len(original_argv) or original_argv[at + 1] != "default":
                raise RuntimeError("Only the original default employee identity is allowed")
        if os.environ.get("HERMES_PROFILE") not in (None, "", "default"):
            raise RuntimeError("A different profile is active")
        root = Path(__file__).resolve().parents[1]
        spec = importlib.util.spec_from_file_location("lingju_safety", root / "safety.py")
        safety = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(safety)
        safety.ordinary_path(root)
        expected = safety.ordinary_path(Path.home() / ".hermes/tools/company-browser")
        if root != expected:
            raise RuntimeError("Startup hook is outside the owned tool root")
        runtime = safety.ordinary_path(os.environ["LINGJU_BROWSER_RUNTIME"])
        if root / "runs" not in runtime.parents:
            raise RuntimeError("Runtime outside owned runs")
        config = json.loads(runtime.read_text(encoding="utf-8"))
        if config["toolRoot"] != str(root) or config["route"] != os.environ.get("LINGJU_BROWSER_EXERCISE"):
            raise RuntimeError("Runtime marker mismatch")
        if Path(os.environ.get("HERMES_HOME", "")).resolve() != (Path.home() / ".hermes").resolve():
            raise RuntimeError("Original Hermes home is not preserved")
        ledger = safety.ordinary_path(config["roundBudget"])
        if root / "runs" not in ledger.parents or ledger.name != "requests.sqlite":
            raise RuntimeError("Invalid shared round ledger")
        budget_spec = importlib.util.spec_from_file_location("lingju_request_budget", root / "request_budget.py")
        budget_module = importlib.util.module_from_spec(budget_spec)
        budget_spec.loader.exec_module(budget_module)
        budget = budget_module.RequestBudget(ledger)
        if budget.status()["limit"] != 120:
            raise RuntimeError("Unapproved physical request limit")
        budget_module.install_httpx_budget(budget, add_network_audit=True)
        receipt = runtime.parent / ("budget-startup-" + str(os.getpid()) + ".json")
        safety.write_new_json(receipt, {
            "at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "pid": os.getpid(), "parent_pid": os.getppid(),
            "python": sys.executable, "home_preserved": True,
            "cwd": os.getcwd(), "original_profile_only": True,
            "route_marker": os.environ.get("LINGJU_BROWSER_EXERCISE"),
            "toolsets_received": os.environ.get("HERMES_TUI_TOOLSETS"),
            "turn_limit_received": os.environ.get("HERMES_TUI_MAX_TURNS"),
            "runtime": str(runtime), "shared_ledger": str(ledger),
            "hook_sha256": safety.sha256(__file__),
            "budget_code_sha256": safety.sha256(root / "request_budget.py"),
            "httpx_sync_guard": True, "httpx_async_guard": True,
            "unmetered_external_socket_guard": True,
            "initial_budget": budget.status(), "models_called_by_hook": 0})
    except BaseException:
        # Python normally swallows sitecustomize exceptions. Fail closed instead.
        try:
            os.write(2, b"Lingju temporary request-budget startup validation failed; no backend launch.\n")
        finally:
            os._exit(78)
