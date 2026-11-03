import sys
from pathlib import Path
import unittest

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client


class ServerProtocol(unittest.IsolatedAsyncioTestCase):
    async def test_stdio_has_only_two_read_tools_and_rejects_other_paths(self):
        script = Path(__file__).resolve().parents[1] / "server.py"
        params = StdioServerParameters(command=sys.executable, args=["-I", "-B", str(script)])
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                listing = await session.list_tools()
                self.assertEqual({tool.name for tool in listing.tools},
                                 {"company_github_knowledge_search", "company_github_knowledge_read"})
                result = await session.call_tool("company_github_knowledge_read",
                                                 {"path": "private/credentials.txt"})
                self.assertIn("Only knowledge/", str(result))


if __name__ == "__main__":
    unittest.main()
