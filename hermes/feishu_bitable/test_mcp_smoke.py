"""Zero-model, zero-business-request MCP handshake test."""

import asyncio
import json
import os
import sys
from pathlib import Path

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client


async def main() -> None:
    server = Path(__file__).with_name("server.py")
    env = dict(os.environ)
    env["COMPANY_FEISHU_BITABLE_APP_TOKEN"] = os.environ.get("COMPANY_FEISHU_BITABLE_APP_TOKEN", "basTEST")
    env["COMPANY_FEISHU_BITABLE_WRITES"] = os.environ.get("COMPANY_FEISHU_BITABLE_WRITES", "0")
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
            expected_write = env["COMPANY_FEISHU_BITABLE_WRITES"] == "1"
            assert ("company_bitable_create_record" in names) == expected_write
            assert ("company_bitable_update_record" in names) == expected_write
            print(f"MCP handshake OK; tools={len(names)}; write_tools={2 if expected_write else 0}")
            if os.environ.get("COMPANY_FEISHU_BITABLE_PROBE") == "1":
                result = await session.call_tool("company_bitable_list_tables", {"page_size": 100})
                assert not result.is_error
                data = result.structured_content or json.loads(result.content[0].text)
                if "result" in data:
                    data = data["result"]
                tables = data.get("items", [])
                assert tables, "No data table returned"
                table_id = tables[0]["table_id"]
                fields = await session.call_tool("company_bitable_list_fields", {"table_id": table_id})
                records = await session.call_tool("company_bitable_list_records", {"table_id": table_id, "page_size": 1})
                assert not fields.is_error and not records.is_error
                print("MCP live read-only tables/fields/records OK")


if __name__ == "__main__":
    asyncio.run(main())
