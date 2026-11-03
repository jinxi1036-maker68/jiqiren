"""Minimal read-only MCP interface for the original Hermes employee."""
from __future__ import annotations

import asyncio
from pathlib import Path
import sys

from mcp.server.mcpserver import MCPServer

sys.path.insert(0, str(Path(__file__).resolve().parent))
from client import GitHubKnowledge, KnowledgeError


def build_server(client=None):
    client = client or GitHubKnowledge()
    server = MCPServer("company-github-knowledge")

    @server.tool(description="按需搜索凌矩公司 GitHub main 分支 knowledge/ 的现行与历史资料；只读。返回固定提交和文件 SHA。搜索命中须再读原文件，不把历史计划当现行事实。")
    def company_github_knowledge_search(query: str, limit: int = 6) -> dict:
        try:
            return client.search(query, limit)
        except KnowledgeError as exc:
            return {"error": str(exc), "verified": False}

    @server.tool(description="按路径和行号读取 GitHub main 的 company knowledge 文件，支持 Markdown/JSON/CSV；XLSX 先列工作表，再指定 sheet 读取最多 50 行。只读，不写 GitHub 或本机记忆。")
    def company_github_knowledge_read(path: str, start_line: int = 1, max_lines: int = 100,
                                      sheet: str = "", start_row: int = 1, max_rows: int = 30) -> dict:
        try:
            return client.read(path, start_line, max_lines, sheet, start_row, max_rows)
        except KnowledgeError as exc:
            return {"error": str(exc), "verified": False}

    return server


if __name__ == "__main__":
    asyncio.run(build_server().run_stdio_async())
