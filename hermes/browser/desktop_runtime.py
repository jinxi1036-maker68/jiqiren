"""Resolve an existing Desktop's own runtime without bootstrapping another copy."""
import os
from pathlib import Path
from safety import ordinary_path, sha256


def existing_runtime(exe, home):
    exe, home = ordinary_path(exe), ordinary_path(home)
    if exe.name.lower() != "hermes.exe":
        raise RuntimeError("Only the original Hermes.exe may be used")
    candidates = [p for p in exe.parents
                  if (p / "hermes_cli/main.py").is_file()
                  and (p / "venv/Scripts/python.exe").is_file()]
    if len(candidates) != 1:
        raise RuntimeError("The original executable's existing runtime is not unique")
    root = ordinary_path(candidates[0])
    python = ordinary_path(root / "venv/Scripts/python.exe")
    main = ordinary_path(exe.parent / "resources/app.asar.unpacked/dist/electron-main.mjs")
    text = main.read_text(encoding="utf-8")
    # These are supported first-choice parameters in this installed Desktop.
    # Do not assume an option in a newer online version exists locally.
    terms = ["function resolveHermesBackend(backendArgs)",
             "process.env.HERMES_DESKTOP_HERMES_ROOT", "isHermesSourceRoot(overrideRoot)",
             "createPythonBackend(overrideRoot", "process.env.HERMES_DESKTOP_PYTHON"]
    if not all(t in text for t in terms):
        raise RuntimeError("Installed Desktop does not expose the verified existing-runtime parameters")
    return {"root": str(root), "python": str(python), "home": str(home),
            "desktop_main_sha256": sha256(main), "executable_sha256": sha256(exe),
            "bootstrap_required": False}


def runtime_env(existing, runtime):
    result = dict(existing)
    for key, value in [("HERMES_HOME", runtime["home"]),
                       ("HERMES_DESKTOP_HERMES_ROOT", runtime["root"]),
                       ("HERMES_DESKTOP_PYTHON", runtime["python"])]:
        if result.get(key) and os.path.normcase(os.path.abspath(result[key])) != os.path.normcase(os.path.abspath(value)):
            raise RuntimeError("Existing process setting conflicts: " + key)
    # HERMES_HOME is preserved rather than repointed to the program directory.
    result["HERMES_DESKTOP_HERMES_ROOT"] = runtime["root"]
    result["HERMES_DESKTOP_PYTHON"] = runtime["python"]
    return result
