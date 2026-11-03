import base64
import hashlib
from io import BytesIO
import json
from pathlib import Path
import sys
import unittest
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from client import GitHubKnowledge, KnowledgeError, _valid_path, xlsx_rows


COMMIT = "a" * 40
TREE = "b" * 40


def spreadsheet():
    output = BytesIO()
    with ZipFile(output, "w") as z:
        z.writestr("xl/workbook.xml", '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="业务" sheetId="1" r:id="rId1"/></sheets></workbook>')
        z.writestr("xl/_rels/workbook.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
        z.writestr("xl/sharedStrings.xml", '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>阶段</t></si><si><t>已核实</t></si></sst>')
        z.writestr("xl/worksheets/sheet1.xml", '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row></sheetData></worksheet>')
    return output.getvalue()


class GitHubKnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.data = {"knowledge/CURRENT_WORK.json": b'{"status":"current","devices":10}',
                     "knowledge/history/OLD.md": "历史计划：50台".encode(),
                     "knowledge/表格.xlsx": spreadsheet()}
        self.shas = {p: hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
                     for p, data in self.data.items()}
        self.calls = []

        def transport(path):
            self.calls.append(path)
            if path == "/git/ref/heads/main":
                return {"object": {"sha": COMMIT}}
            if path == "/git/commits/" + COMMIT:
                return {"tree": {"sha": TREE}}
            if path == "/git/trees/" + TREE + "?recursive=1":
                return {"truncated": False, "tree": [
                    {"path": p, "sha": self.shas[p], "type": "blob", "mode": "100644", "size": len(d)}
                    for p, d in self.data.items()] + [
                    {"path": "private/token.txt", "sha": "9" * 40, "type": "blob", "mode": "100644", "size": 3}]}
            for p, sha in self.shas.items():
                if path == "/git/blobs/" + sha:
                    return {"sha": sha, "encoding": "base64", "content": base64.b64encode(self.data[p]).decode()}
            raise AssertionError(path)

        self.client = GitHubKnowledge(credential=lambda: "synthetic", transport=transport)

    def test_search_pins_main_and_marks_history(self):
        found = self.client.search("历史计划")
        self.assertEqual(found["commit"], COMMIT)
        self.assertEqual(found["results"][0]["status_hint"], "历史资料，不能直接当现行决策")
        self.assertNotIn("private/token.txt", [r["path"] for r in found["results"]])
        self.assertEqual(self.client.read("knowledge/CURRENT_WORK.json")["commit"], COMMIT)
        self.assertEqual(self.calls.count("/git/ref/heads/main"), 2)

    def test_excel_sheet_and_rows(self):
        result = self.client.read("knowledge/表格.xlsx")
        self.assertEqual(result["sheets"], [{"name": "业务", "rows": 1}])
        self.assertEqual(self.client.read("knowledge/表格.xlsx", sheet="业务")["rows"], [["阶段", "已核实"]])

    def test_rejects_traversal_and_nonknowledge(self):
        for path in ("private/token.txt", "knowledge/../secret.md", "knowledge/evil.py", "knowledge\\file.md"):
            self.assertFalse(_valid_path(path))
            with self.assertRaises(KnowledgeError):
                self.client.read(path)

    def test_network_failure_does_not_return_stale_search(self):
        self.client.search("历史")
        self.client.checked_at = -100
        self.client.transport = lambda path: (_ for _ in ()).throw(KnowledgeError("GitHub unavailable"))
        with self.assertRaisesRegex(KnowledgeError, "unavailable"):
            self.client.search("历史")


if __name__ == "__main__":
    unittest.main()
