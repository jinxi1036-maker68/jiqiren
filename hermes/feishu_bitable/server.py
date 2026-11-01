"""Allowlisted Feishu Base tools for the original Hermes MCP registry."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from mcp.server.mcpserver import MCPServer

sys.path.insert(0, str(Path(__file__).resolve().parent))
from client import BitableClient, load_app_credentials


def build_server(client: BitableClient) -> MCPServer:
    server = MCPServer("company-feishu-bitable")

    @server.tool(description="列出获准的公司多维表格中的数据表；只读。")
    def company_bitable_list_tables(page_size: int = 100, page_token: str = "") -> dict:
        return client.list_tables(page_size, page_token)

    @server.tool(description="列出指定数据表字段及类型；只读，写入前先核对字段。")
    def company_bitable_list_fields(table_id: str, page_size: int = 100, page_token: str = "") -> dict:
        return client.list_fields(table_id, page_size, page_token)

    @server.tool(description="逐页读取指定数据表的记录；只读。返回 has_more/page_token 时须继续翻页。")
    def company_bitable_list_records(table_id: str, page_size: int = 50, page_token: str = "") -> dict:
        return client.list_records(table_id, page_size, page_token)

    @server.tool(description="按记录 ID 读取一条记录；只读。")
    def company_bitable_get_record(table_id: str, record_id: str) -> dict:
        return client.get_record(table_id, record_id)

    if client.write_enabled:
        @server.tool(description="按明确业务任务新增一条记录。operation_key 必须是本次业务动作的稳定唯一键；返回不明确时先查询，不盲重试。")
        def company_bitable_create_record(table_id: str, fields: dict, operation_key: str) -> dict:
            return client.create_record(table_id, fields, operation_key)

        @server.tool(description="按记录 ID 更新指定字段。expected_fields 填入刚读到的旧值；若旧值变化即拒绝更新。重大费用或付款决定需 Owner 批准。")
        def company_bitable_update_record(table_id: str, record_id: str, fields: dict,
                                          operation_key: str, expected_fields: dict) -> dict:
            return client.update_record(table_id, record_id, fields, operation_key, expected_fields)

    return server


def main() -> None:
    app_token = os.environ.get("COMPANY_FEISHU_BITABLE_APP_TOKEN", "")
    if not app_token:
        raise SystemExit("COMPANY_FEISHU_BITABLE_APP_TOKEN is required")
    app_id, app_secret = load_app_credentials(Path.home() / ".hermes")
    client = BitableClient(
        app_id, app_secret, app_token,
        write_enabled=os.environ.get("COMPANY_FEISHU_BITABLE_WRITES", "0") == "1",
    )
    asyncio.run(build_server(client).run_stdio_async())


if __name__ == "__main__":
    main()
