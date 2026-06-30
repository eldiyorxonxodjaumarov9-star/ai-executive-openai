"""Local tests for Remote MCP server (no Claude API agent calls)."""

from __future__ import annotations

import json
import sys

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _post_mcp(payload: dict, headers: dict | None = None) -> dict:
    response = client.post("/mcp", json=payload, headers=headers or {})
    assert response.status_code == 200, response.text
    return response.json()


def test_mcp_health() -> None:
    response = client.get("/mcp/health")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["endpoint"] == "/mcp"
    print("mcp_health: OK")


def test_initialize() -> None:
    data = _post_mcp(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "test-client", "version": "1.0.0"},
            },
        }
    )
    assert data["result"]["serverInfo"]["name"] == "ai-executive-platform"
    print("initialize: OK")


def test_tools_list() -> None:
    data = _post_mcp({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    tools = data["result"]["tools"]
    names = {tool["name"] for tool in tools}
    assert "get_bitrix_summary" in names
    assert "run_ceo_agent" in names
    assert len(tools) == 7
    print("tools/list: OK", names)


def test_get_bitrix_summary() -> None:
    data = _post_mcp(
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": "get_bitrix_summary", "arguments": {}},
        }
    )
    result = data["result"]
    assert result["isError"] is False
    content = json.loads(result["content"][0]["text"])
    assert content["success"] is True
    assert "summary" in content
    print("get_bitrix_summary: OK", content.get("summary"))


def main() -> int:
    test_mcp_health()
    test_initialize()
    test_tools_list()
    test_get_bitrix_summary()
    print("ALL_MCP_TESTS_PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
