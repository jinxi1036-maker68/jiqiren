"""Pinned, read-only GitHub knowledge access. No GitHub write methods exist here."""
from __future__ import annotations

import base64
from concurrent.futures import ThreadPoolExecutor
import ctypes
from ctypes import wintypes
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
import re
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from zipfile import ZipFile


OWNER = "jinxi1036-maker68"
REPO = "jiqiren"
REF = "main"
API = f"https://api.github.com/repos/{OWNER}/{REPO}"
CREDENTIAL_TARGET = "LingjuHermesGitHubReadOnly"
ALLOWED = (".md", ".json", ".csv", ".xlsx")
MAX_BLOB = 2_000_000
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "p": "http://schemas.openxmlformats.org/package/2006/relationships"}


class KnowledgeError(RuntimeError):
    pass


def windows_credential(target: str = CREDENTIAL_TARGET) -> str:
    """Read one fixed Generic Credential. The secret is never logged or returned to Hermes."""
    if not hasattr(ctypes, "windll"):
        raise KnowledgeError("Windows Credential Manager is unavailable")

    class CREDENTIAL(ctypes.Structure):
        _fields_ = [("Flags", wintypes.DWORD), ("Type", wintypes.DWORD),
                    ("TargetName", wintypes.LPWSTR), ("Comment", wintypes.LPWSTR),
                    ("LastWritten", wintypes.FILETIME), ("CredentialBlobSize", wintypes.DWORD),
                    ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
                    ("Persist", wintypes.DWORD), ("AttributeCount", wintypes.DWORD),
                    ("Attributes", ctypes.c_void_p), ("TargetAlias", wintypes.LPWSTR),
                    ("UserName", wintypes.LPWSTR)]

    cred = ctypes.POINTER(CREDENTIAL)()
    api = ctypes.windll.advapi32
    api.CredReadW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                              ctypes.POINTER(ctypes.POINTER(CREDENTIAL))]
    api.CredReadW.restype = wintypes.BOOL
    api.CredFree.argtypes = [ctypes.c_void_p]
    if not api.CredReadW(target, 1, 0, ctypes.byref(cred)):
        raise KnowledgeError("Dedicated GitHub read-only credential is not configured")
    try:
        raw = ctypes.string_at(cred.contents.CredentialBlob,
                               cred.contents.CredentialBlobSize)
        token = raw.decode("utf-8").strip()
        if not token or len(token) > 4096:
            raise KnowledgeError("Dedicated GitHub credential is invalid")
        return token
    finally:
        api.CredFree(cred)


def _valid_path(path: str) -> bool:
    return (isinstance(path, str) and path.startswith("knowledge/")
            and path.endswith(ALLOWED) and len(path) <= 240
            and "\\" not in path and all(x not in ("", ".", "..") for x in path.split("/")))


def _cell_text(cell, shared: list[str]) -> str:
    kind = cell.get("t", "")
    if kind == "inlineStr":
        return "".join(x.text or "" for x in cell.findall(".//m:t", NS))
    v = cell.find("m:v", NS)
    value = v.text if v is not None and v.text is not None else ""
    if kind == "s":
        try:
            return shared[int(value)]
        except (ValueError, IndexError):
            return ""
    if kind == "b":
        return "TRUE" if value == "1" else "FALSE"
    return value


def xlsx_rows(data: bytes) -> dict[str, list[list[str]]]:
    """Read cached cell values, not formulas/macros/external links; bounded ZIP input."""
    out = {}
    with ZipFile(BytesIO(data)) as z:
        members = z.infolist()
        if len(members) > 2000 or sum(m.file_size for m in members) > 15_000_000:
            raise KnowledgeError("Spreadsheet exceeds read limit")
        names = set(z.namelist())
        if "xl/workbook.xml" not in names or "xl/_rels/workbook.xml.rels" not in names:
            raise KnowledgeError("Invalid spreadsheet")
        shared = []
        if "xl/sharedStrings.xml" in names:
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            shared = ["".join(t.text or "" for t in item.findall(".//m:t", NS))
                      for item in root.findall("m:si", NS)]
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        targets = {r.get("Id"): r.get("Target", "") for r in rels}
        workbook = ET.fromstring(z.read("xl/workbook.xml"))
        for sheet in workbook.findall("m:sheets/m:sheet", NS):
            name = sheet.get("name", "")
            target = targets.get(sheet.get(f"{{{NS['r']}}}id"), "")
            location = target.lstrip("/") if target.startswith("/") else "xl/" + target
            location = re.sub(r"(^|/)\./", r"\1", location)
            if ".." in location.split("/") or location not in names:
                raise KnowledgeError("Invalid spreadsheet worksheet path")
            root = ET.fromstring(z.read(location))
            rows = []
            for row in root.findall("m:sheetData/m:row", NS):
                values = []
                for cell in row.findall("m:c", NS):
                    ref = cell.get("r", "")
                    letters = re.match(r"[A-Z]+", ref)
                    if letters:
                        col = 0
                        for char in letters.group():
                            col = col * 26 + ord(char) - 64
                        if col > 256:
                            continue
                        values.extend([""] * max(0, col - len(values) - 1))
                    values.append(_cell_text(cell, shared))
                rows.append(values[:256])
                if len(rows) > 20_000:
                    raise KnowledgeError("Spreadsheet row limit exceeded")
            out[name] = rows
    return out


class GitHubKnowledge:
    def __init__(self, credential=windows_credential, transport=None, clock=time.monotonic):
        self.credential = credential
        self.transport = transport or self._http
        self.clock = clock
        self.commit = None
        self.files = {}
        self.blobs = {}
        self.checked_at = 0.0

    def _http(self, path: str):
        if not path.startswith("/") or "//" in path or ".." in path:
            raise KnowledgeError("Invalid GitHub API path")
        token = self.credential()
        request = urllib.request.Request(API + path, headers={
            "Accept": "application/vnd.github+json",
            "Authorization": "Bearer " + token,
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "lingju-hermes-knowledge-readonly"})
        try:
            with urllib.request.urlopen(request, timeout=18) as reply:
                return json.load(reply)
        except urllib.error.HTTPError as exc:
            # Do not reveal response body, request headers, account details or token.
            raise KnowledgeError(f"GitHub read failed (HTTP {exc.code})") from None
        except (urllib.error.URLError, TimeoutError, ValueError):
            raise KnowledgeError("GitHub read unavailable; no cached answer used") from None

    def refresh(self, force=False):
        if not force and self.commit and self.clock() - self.checked_at < 60:
            return self.commit
        try:
            ref = self.transport("/git/ref/heads/main")
            commit = ref["object"]["sha"]
        except (KeyError, TypeError):
            raise KnowledgeError("Invalid GitHub ref response") from None
        if not re.fullmatch(r"[0-9a-f]{40}", commit):
            raise KnowledgeError("Invalid main commit")
        try:
            record = self.transport("/git/commits/" + commit)
            tree = record["tree"]["sha"]
            listing = self.transport("/git/trees/" + tree + "?recursive=1")
        except (KeyError, TypeError):
            raise KnowledgeError("Invalid GitHub tree response") from None
        if not re.fullmatch(r"[0-9a-f]{40}", tree):
            raise KnowledgeError("Invalid GitHub tree SHA")
        if listing.get("truncated"):
            raise KnowledgeError("GitHub tree truncated; search refused")
        try:
            files = {x["path"]: x for x in listing["tree"]
                     if x.get("type") == "blob" and x.get("mode") == "100644"
                     and _valid_path(x.get("path", "")) and x.get("size", 0) <= MAX_BLOB}
        except (KeyError, TypeError):
            raise KnowledgeError("Invalid GitHub tree entries") from None
        self.commit, self.files, self.checked_at = commit, files, self.clock()
        return commit

    def _blob(self, path):
        if not _valid_path(path):
            raise KnowledgeError("Only knowledge/ Markdown, JSON, CSV and XLSX may be read")
        self.refresh()
        item = self.files.get(path)
        if item is None:
            raise KnowledgeError("Knowledge file is absent from current main")
        sha = item["sha"]
        if sha not in self.blobs:
            result = self.transport("/git/blobs/" + sha)
            if result.get("encoding") != "base64" or result.get("sha") != sha:
                raise KnowledgeError("GitHub blob metadata mismatch")
            try:
                data = base64.b64decode(result["content"], validate=False)
            except (KeyError, ValueError, TypeError):
                raise KnowledgeError("Invalid GitHub blob response") from None
            if len(data) > MAX_BLOB:
                raise KnowledgeError("Knowledge file exceeds read limit")
            digest = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
            if digest != sha:
                raise KnowledgeError("Knowledge blob SHA-1 mismatch")
            self.blobs[sha] = data
        return self.blobs[sha], sha

    def _render(self, path, data):
        if path.endswith(".xlsx"):
            return "\n".join(name + "\n" + "\n".join(" | ".join(r) for r in rows)
                             for name, rows in xlsx_rows(data).items())
        return data.decode("utf-8-sig")

    def search(self, query: str, limit: int = 6):
        if not query or len(query) > 120:
            raise KnowledgeError("Search query must be 1–120 characters")
        commit = self.refresh(force=True)
        words = []
        for term in re.findall(r"[\u4e00-\u9fff]{2,}|[a-zA-Z0-9_]{2,}", query.lower()):
            if re.fullmatch(r"[\u4e00-\u9fff]+", term) and len(term) > 3:
                words.extend(term[i:i + 2] for i in range(len(term) - 1))
            else:
                words.append(term)
        words = list(dict.fromkeys(words))
        if not words:
            raise KnowledgeError("Search query has no indexable terms")
        def inspect(path):
            try:
                data, sha = self._blob(path)
                content = self._render(path, data)
            except (UnicodeError, ValueError):
                return None
            haystack = content.lower()
            filename = path.lower()
            score = sum((8 if word in filename else 0) + min(haystack.count(word), 8)
                        for word in words)
            if not score:
                return None
            hit = next((haystack.find(word) for word in words if word in haystack), 0)
            snippet = re.sub(r"\s+", " ", content[max(0, hit - 70):hit + 170])
            historical = ("/history/" in path or "/archive/" in path
                          or "已取代" in path or "_OLD" in path.upper())
            return (score, {"path": path, "blob_sha": sha, "snippet": snippet[:240],
                            "status_hint": "历史资料，不能直接当现行决策" if historical
                            else "请以文件内容的日期和证据等级判断现行性"})
        with ThreadPoolExecutor(max_workers=8) as pool:
            matches = [hit for hit in pool.map(inspect, list(self.files)) if hit]
        matches.sort(key=lambda pair: (-pair[0], pair[1]["path"]))
        return {"source": "GitHub main", "commit": commit,
                "checked_at_utc": datetime.now(timezone.utc).isoformat(),
                "results": [item for _, item in matches[:max(1, min(limit, 8))]],
                "note": "搜索命中不是事实证明；阅读原文件，区分当前决策、历史、报告与计划。"}

    def read(self, path: str, start_line: int = 1, max_lines: int = 100,
             sheet: str = "", start_row: int = 1, max_rows: int = 30):
        if not _valid_path(path):
            raise KnowledgeError("Only knowledge/ Markdown, JSON, CSV and XLSX may be read")
        self.refresh(force=True)
        data, sha = self._blob(path)
        result = {"source": "GitHub main", "commit": self.commit, "path": path,
                  "blob_sha": sha, "file_bytes": len(data),
                  "checked_at_utc": datetime.now(timezone.utc).isoformat()}
        if path.endswith(".xlsx"):
            sheets = xlsx_rows(data)
            result["sheets"] = [{"name": name, "rows": len(rows)} for name, rows in sheets.items()]
            if sheet:
                if sheet not in sheets:
                    raise KnowledgeError("Sheet not found")
                start = max(1, min(start_row, 20_000)) - 1
                result["sheet"] = sheet
                result["start_row"] = start + 1
                output = []
                size = 0
                for row in sheets[sheet][start:start + max(1, min(max_rows, 50))]:
                    clipped = [str(value)[:300] for value in row[:40]]
                    row_size = sum(len(value) for value in clipped)
                    if output and size + row_size > 16_000:
                        break
                    output.append(clipped)
                    size += row_size
                result["rows"] = output
                result["has_more"] = start + len(output) < len(sheets[sheet])
            return result
        lines = data.decode("utf-8-sig").splitlines()
        start = max(1, min(start_line, 200_000)) - 1
        selected = []
        size = 0
        for line in lines[start:start + max(1, min(max_lines, 120))]:
            clipped = line[:2000]
            if selected and size + len(clipped) > 16_000:
                break
            selected.append(clipped)
            size += len(clipped)
        result.update(total_lines=len(lines), start_line=start + 1,
                      lines=[{"line": start + i + 1, "text": line}
                             for i, line in enumerate(selected)],
                      has_more=start + len(selected) < len(lines))
        return result
