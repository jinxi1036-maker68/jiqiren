import os
from pathlib import Path
import sys
import tempfile
import unittest
import json
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from desktop_runtime import existing_runtime, runtime_env


class ExistingDesktopTests(unittest.TestCase):
    def test_arm_rejects_other_runtime_and_never_resets_shared_request_count(self):
        from launch import TrainingRun, arm_run
        from request_budget import RequestBudget
        from safety import sha256
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            b = RequestBudget.create(root / "requests.sqlite", 120, armed=False)
            runtime = root / "runtime.json"
            runtime.write_text(json.dumps({"roundBudget": str(b.path)}))
            (root / "tool.py").write_text("original")
            gate = {"all_zero_model_gates_passed": True, "physical_api_budget_enforced": True,
                    "active_runtime": str(runtime), "route": "playwright", "case": "analysis",
                    "shared_ledger": str(b.path), "tool_source_sha256": {"tool.py": sha256(root / "tool.py")}}
            run = object.__new__(TrainingRun)
            run.root, run.runtime, run.route, run.case = root, runtime, "playwright", "analysis"
            path = root / "acceptance-gate.json"
            gate["active_runtime"] = "different"
            path.write_text(json.dumps(gate))
            with self.assertRaises(RuntimeError):
                arm_run(run)
            self.assertFalse(b.status()["armed"])
            gate["active_runtime"] = str(runtime)
            path.write_text(json.dumps(gate))
            arm_run(run)
            b.take()
            arm_run(run)
            self.assertEqual(b.status()["reserved_network_attempts"], 1)
            (root / "tool.py").write_text("concurrent change")
            with self.assertRaises(RuntimeError):
                arm_run(run)
    def test_both_routes_preserve_shared_budget_and_offer_existing_visual_tool(self):
        from launch import TrainingRun
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for route in ("native", "playwright"):
                run = object.__new__(TrainingRun)
                run.root = root
                run.route = route
                run.output = root / route
                run.output.mkdir()
                run.runtime = run.output / "runtime.json"
                run.cdp = "http://127.0.0.1:12345"
                run.runtime.write_text(json.dumps({"roundBudget": str(root / "requests.sqlite")}))
                before = dict(os.environ)
                env = run.desktop_env()
                self.assertEqual(before, dict(os.environ))
                self.assertEqual(env["LINGJU_BROWSER_BUDGET"], "1")
                self.assertEqual(env["LINGJU_BROWSER_RUNTIME"], str(run.runtime))
                self.assertIn("vision", env["HERMES_TUI_TOOLSETS"].split(","))
                self.assertEqual(env["PYTHONDONTWRITEBYTECODE"], "1")
                self.assertEqual(env.get("XDG_LINGJU_BROWSER_RUNTIME"), str(run.runtime) if route == "playwright" else None)

    def test_existing_install_resolves_without_creating_canonical_copy(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            home, install = base / "home", base / "original-install"
            home.mkdir()
            files = {"apps/desktop/release/win-unpacked/Hermes.exe": b"original",
                     "hermes_cli/main.py": b"# original",
                     "venv/Scripts/python.exe": b"original-python",
                     "apps/desktop/release/win-unpacked/resources/app.asar.unpacked/dist/electron-main.mjs":
                     b"function resolveHermesBackend(backendArgs) { process.env.HERMES_DESKTOP_HERMES_ROOT; isHermesSourceRoot(overrideRoot); createPythonBackend(overrideRoot); process.env.HERMES_DESKTOP_PYTHON; }"}
            for name, value in files.items():
                path = install / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(value)
            exe = install / "apps/desktop/release/win-unpacked/Hermes.exe"
            runtime = existing_runtime(exe, home)
            self.assertEqual(runtime["root"], str(install))
            self.assertFalse(runtime["bootstrap_required"])
            self.assertFalse((home / "hermes-agent").exists())
            env = runtime_env({"HERMES_HOME": str(home), "OTHER": "retain"}, runtime)
            self.assertEqual(env["HERMES_HOME"], str(home))
            self.assertEqual(env["OTHER"], "retain")
            for key in ("HERMES_HOME", "HERMES_DESKTOP_HERMES_ROOT", "HERMES_DESKTOP_PYTHON"):
                with self.assertRaises(RuntimeError):
                    runtime_env({key: str(base / "different")}, runtime)
            main = install / "apps/desktop/release/win-unpacked/resources/app.asar.unpacked/dist/electron-main.mjs"
            main.write_text("unsupported Desktop")
            with self.assertRaises(RuntimeError):
                existing_runtime(exe, home)


if __name__ == "__main__":
    unittest.main()
