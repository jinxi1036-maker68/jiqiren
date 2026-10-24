import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from safety import ordinary_path, sha256, write_new_json, check_snapshot
from native_cli import normalize_args


class SafetyTests(unittest.TestCase):
    def test_native_adapter_only_removes_legacy_exec_argument(self):
        self.assertEqual(normalize_args(["exec"]), [])
        self.assertEqual(normalize_args(["skill"]), ["skill"])
        self.assertEqual(normalize_args(["--version"]), ["--version"])
        for a in [["auth", "login"], ["--update"], ["chat", "do business"], ["exec", "unexpected"]]:
            with self.assertRaises(ValueError):
                normalize_args(a)

    def test_missing_path_never_assumed_existing(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "not-created"
            with self.assertRaises(FileNotFoundError):
                ordinary_path(p)
            self.assertEqual(ordinary_path(p, allow_missing=True), p)
            self.assertFalse(p.exists())

    def test_json_is_exclusive_create(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "receipt.json"
            write_new_json(p, {"model_calls": 0})
            with self.assertRaises(FileExistsError):
                write_new_json(p, {"model_calls": 99})

    def test_protected_file_drift_detected_without_restore(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "protected.md"
            p.write_text("before")
            snapshot = {"files": {str(p): {"exists": True, "sha256": sha256(p)}}}
            self.assertEqual(check_snapshot(snapshot), [])
            p.write_text("concurrent")
            self.assertEqual(check_snapshot(snapshot), [str(p)])
            self.assertEqual(p.read_text(), "concurrent")


if __name__ == "__main__":
    unittest.main()
