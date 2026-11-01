"""Zero-model, zero-business-request MCP handshake test."""

import asyncio
import os
import sys
from pathlib import Path

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client


async def main() -> None:
    server = Path(__file__).with_name("server.py")
    env = dict(os.environ)
    env["COMPANY_FEISHU_BITABLE_APP_TOKEN"] = os.environ.get("COMPANY_FEISHU_BITABLE_APP_TOKEN", "basTEST")
    env["COMPANY_FEISHU_BITABLE_WRITES"] = "0"
    params = StdioServerParameters(
        command=sys.executable, args=["-I", "-B", str(server)], env=env,
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            names = {tool.name for tool in tools.tools}
            assert "company_bitable_list_tables" in names
            assert "company_bitable_list_records" in names
            assert "company_bitable_create_record" not in names
            print(f"MCP handshake OK; read_tools={len(names)}; write_tools=0")
            if os.environ.get("COMPANY_FEISHU_BITABLE_PROBE") == "1":
                result = await session.call_tool("company_bitable_list_tables", {"page_size": 100})
                assert not result.is_error
                print("MCP live read-only list_tables OK")


if __name__ == "__main__":
    asyncio.run(main())
