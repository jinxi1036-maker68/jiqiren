"""Local path, protection and ownership utilities. No model/auth loading."""
import ctypes
import hashlib
import json
import os
from pathlib import Path
import sys


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def final_path(path):
    path = Path(path).absolute()
    if os.name != "nt":
        return str(path.resolve(strict=True))
    k = ctypes.WinDLL("kernel32", use_last_error=True)
    k.CreateFileW.argtypes = [ctypes.c_wchar_p, ctypes.c_uint, ctypes.c_uint,
                             ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint, ctypes.c_void_p]
    k.CreateFileW.restype = ctypes.c_void_p
    k.GetFinalPathNameByHandleW.argtypes = [ctypes.c_void_p, ctypes.c_wchar_p,
                                           ctypes.c_uint, ctypes.c_uint]
    k.GetFinalPathNameByHandleW.restype = ctypes.c_uint
    k.CloseHandle.argtypes = [ctypes.c_void_p]
    handle = k.CreateFileW(str(path), 0, 7, None, 3, 0x02000000, None)
    if handle == ctypes.c_void_p(-1).value:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        buf = ctypes.create_unicode_buffer(32768)
        size = k.GetFinalPathNameByHandleW(handle, buf, len(buf), 0)
        if not size or size >= len(buf):
            raise ctypes.WinError(ctypes.get_last_error())
        result = buf.value
        return result[4:] if result.startswith("\\\\?\\") else result
    finally:
        k.CloseHandle(handle)


def ordinary_path(path, allow_missing=False):
    path = Path(os.path.abspath(path))
    anchor = path
    while not anchor.exists():
        if not allow_missing:
            raise FileNotFoundError(path)
        anchor = anchor.parent
    for p in [anchor, *anchor.parents]:
        if p.stat().st_file_attributes & 0x400 if os.name == "nt" else p.is_symlink():
            raise RuntimeError("Reparse/symlink ancestor: " + str(p))
    actual = final_path(anchor)
    if os.path.normcase(actual) != os.path.normcase(str(anchor)):
        raise RuntimeError("Handle-final path differs: " + str(anchor))
    denied = ("\\packages\\", "\\localcache\\", "\\onedrive\\", "\\dropbox\\")
    if any(p in str(path).lower() + "\\" for p in denied):
        raise RuntimeError("Cache/cloud path forbidden")
    return path


def protection_snapshot(home, install):
    home, install = Path(home), Path(install)
    candidates = [
        home / "SOUL.md", home / "MEMORY.md", home / "USER.md",
        home / "memories" / "MEMORY.md", home / "memories" / "USER.md",
        home / "config.yaml", home / ".env", home / "auth.json",
        install / "uv.lock",
    ]
    workspace = home / "company-workspace"
    if not workspace.is_dir():
        raise RuntimeError("Existing company workspace missing")
    candidates.extend(p for p in workspace.rglob("*") if p.is_file())
    # Existing private profiles and cron are only hashed, never read as text.
    profiles = home / "profiles"
    if profiles.exists():
        for d in profiles.iterdir():
            if d.is_dir():
                candidates.extend(d / n for n in ["config.yaml", "SOUL.md", ".env",
                                  "MEMORY.md", "USER.md", "memories/MEMORY.md", "memories/USER.md"])
    cron = home / "cron"
    if cron.exists():
        candidates.extend(p for p in cron.glob("*") if p.is_file())
    candidates.append(install / "venv" / "pyvenv.cfg")
    candidates.extend((install / "venv" / "Lib" / "site-packages").glob("idna-*.dist-info/RECORD"))
    candidates.extend((install / "venv" / "Lib" / "site-packages").glob("aiohttp-*.dist-info/RECORD"))
    records = {}
    for p in sorted(set(candidates)):
        records[str(p)] = {"exists": p.exists(), "sha256": sha256(p) if p.exists() else None}
    return {"home": str(home), "workspace": str(workspace), "files": records}


def check_snapshot(snapshot):
    differences = []
    for name, old in snapshot["files"].items():
        p = Path(name)
        new = {"exists": p.exists(), "sha256": sha256(p) if p.exists() else None}
        if new != old:
            differences.append(name)
    return differences


def write_new_json(path, value):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("x", encoding="utf-8", newline="\n") as f:
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.write("\n")


def windows_metadata(script):
    """PS5 must not inherit Codex's PS7-only module search path.
    This changes only a helper child environment, never registry/global settings.
    """
    import subprocess
    env = {k: v for k, v in os.environ.items() if k.upper() != "PSMODULEPATH"}
    exe = Path(os.environ["SYSTEMROOT"]) / "System32/WindowsPowerShell/v1.0/powershell.exe"
    r = subprocess.run([str(exe), "-NoProfile", "-NonInteractive", "-Command",
                        "$ErrorActionPreference='Stop'; " + script],
                       env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError("Windows metadata helper failed (exit " + str(r.returncode) + "); no existing-file write permitted")
    return r.stdout.strip()
