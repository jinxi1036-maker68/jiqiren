"""Create only the new tool root; record protection hashes without private text."""
import argparse
import json
from pathlib import Path
from safety import ordinary_path, protection_snapshot, write_new_json


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--home", required=True)
    p.add_argument("--install", required=True)
    p.add_argument("--output", required=True)
    args = p.parse_args()
    home = ordinary_path(args.home)
    root = ordinary_path(home / "tools" / "company-browser", allow_missing=True)
    if root.exists():
        raise RuntimeError("New tool root already exists; do not overwrite")
    snapshot = protection_snapshot(home, args.install)
    write_new_json(args.output, snapshot)
    root.mkdir()
    ordinary_path(root)
    print(json.dumps({"new_tool_root": str(root), "protected_files": len(snapshot["files"]),
                      "model_calls": 0, "existing_files_modified": 0}, ensure_ascii=False))


if __name__ == "__main__":
    main()
