import importlib.util
import pathlib
import socket
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("web_read", str(pathlib.Path(__file__).parent / "src" / "web_read.py"))
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


def address(ip):
    return lambda *_args, **_kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 443))]


class WebReadChecks(unittest.TestCase):
    def read_fixture(self, html, mode="auto"):
        response = Mock(status=200)
        response.getheader.side_effect = {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Encoding": "identity",
        }.get
        response.read.return_value = html.encode("utf-8")
        with patch.object(reader, "PublicConnection", return_value=Mock(getresponse=Mock(return_value=response))), \
                patch.object(reader, "public_target", return_value=reader.public_target(
                    "https://example.com/report/", address("93.184.216.34")
                )):
            return reader.read_page("https://example.com/report/", text_mode=mode)

    def test_public_host(self):
        self.assertEqual(reader.public_target("https://example.com/a", address("93.184.216.34"))[3], "93.184.216.34")

    def test_private_networks_and_metadata(self):
        for ip in ("127.0.0.1", "10.0.0.2", "169.254.169.254", "172.16.0.1", "192.168.1.2", "::1", "fc00::1"):
            with self.subTest(ip=ip), self.assertRaises(ValueError):
                reader.public_target("https://example.com/", address(ip))

    def test_account_and_non_http_urls(self):
        for url in ("file:///etc/passwd", "https://user:password@example.com/", "https://example.com/?access_token=private"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                reader.public_target(url, address("93.184.216.34"))

    def test_internal_redirect_target(self):
        target = reader.urljoin("https://example.com/", "http://127.0.0.1/admin")
        with self.assertRaises(ValueError):
            reader.public_target(target, address("127.0.0.1"))

    def test_page_text_table_and_links(self):
        parser = reader.PageText("https://example.com/report/")
        parser.feed('<html><title>经营报告</title><h1>采集情况</h1><table><tr><th>原始</th><th>有效</th></tr><tr><td>18</td><td>未知</td></tr></table><a href="details">明细</a><script>untrusted_code()</script></html>')
        self.assertEqual("".join(parser.title_parts), "经营报告")
        self.assertIn("18 | 未知", parser.text())
        self.assertNotIn("untrusted_code", parser.text())
        self.assertEqual(parser.tables, 1)
        self.assertEqual(parser.links[0]["url"], "https://example.com/report/details")

    def test_image_alt_is_text_only(self):
        parser = reader.PageText("https://example.com/")
        parser.feed('<img src="chart.png" alt="柱状图">')
        self.assertIn("image alt: 柱状图", parser.text())

    def test_html_with_unclosed_anchor(self):
        parser = reader.PageText("https://example.com/")
        parser.feed('<a href="/details">明细')
        parser.close()
        self.assertEqual(parser.links[0]["url"], "https://example.com/details")

    def test_link_limit_preserves_missing_scope(self):
        parser = reader.PageText("https://example.com/")
        parser.feed("".join('<a href="/p{0}">页面</a>'.format(i) for i in range(35)))
        parser.close()
        self.assertEqual(len(parser.links), 30)
        self.assertEqual(parser.link_count, 35)

    def test_auto_cleans_article_and_keeps_original_links(self):
        paragraph = "采集日报说明实际上传量、审核状态与有效时长。经营人员应分别核实这些口径，引用可追溯的证据。" * 12
        html = (
            '<html><head><title>经营报告</title></head><body><nav id="navigation">'
            '<a href="/index">站点菜单</a></nav><article><h1>采集情况</h1>'
            '<p>{0}</p><p>{0}</p></article><footer id="footer">网站页脚</footer></body></html>'
        ).format(paragraph)
        article = self.read_fixture(html)
        page = self.read_fixture(html, "page")
        self.assertEqual(article["text_extraction"], "readability")
        self.assertIn("实际上传量", article["text"])
        self.assertNotIn("站点菜单", article["text"])
        self.assertEqual(article["links"], page["links"])
        self.assertEqual(article["source_sha256"], page["source_sha256"])
        self.assertIn("网站页脚", page["text"])

    def test_table_rows_keep_original_extraction(self):
        html = "<p>{}</p><table><tr><th>原始</th><th>有效</th></tr><tr><td>18</td><td>未知</td></tr></table>".format("采集情况。" * 80)
        with patch.object(reader, "extract_article_text") as extract:
            result = self.read_fixture(html)
        extract.assert_not_called()
        self.assertEqual(result["text_extraction"], "page_text")
        self.assertEqual(result["html_table_count"], 1)
        self.assertIn("18 | 未知", result["text"])

    def test_missing_parser_falls_back_to_page_text(self):
        with patch.object(reader, "READABILITY_SCRIPT", pathlib.Path(__file__).with_name("absent_parser.mjs")):
            result = self.read_fixture("<p>{}</p>".format("采集情况。" * 80))
        self.assertEqual(result["text_extraction"], "page_text")
        self.assertIn("采集情况", result["text"])


if __name__ == "__main__":
    unittest.main()
