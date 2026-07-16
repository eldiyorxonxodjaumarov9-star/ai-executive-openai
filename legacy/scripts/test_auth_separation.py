"""Verify dashboard vs external connector authentication separation."""

from __future__ import annotations

import os
import sys

from fastapi.testclient import TestClient

# Set secret before app settings load in tests
os.environ["CONNECTOR_SECRET"] = "test-connector-secret"
os.environ.setdefault("BITRIX24_WEBHOOK_URL", "https://example.bitrix24.uz/rest/1/test/")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test")

from app.config import get_settings

get_settings.cache_clear()

from app.main import app  # noqa: E402

client = TestClient(app)
SECRET = "test-connector-secret"


def test_tools_requires_secret() -> None:
    response = client.post(
        "/tools/agent/ceo",
        json={"question": "test"},
    )
    assert response.status_code == 401, response.text
    assert response.json()["error"] == "unauthorized"
    print("tools_without_secret: 401 OK")


def test_tools_with_secret_passes_auth() -> None:
    response = client.post(
        "/tools/agent/ceo",
        json={"question": "test"},
        headers={"X-Connector-Secret": SECRET},
    )
    assert response.status_code != 401, response.text
    print("tools_with_secret: auth OK", response.status_code)


def test_dashboard_requires_secret() -> None:
    response = client.post(
        "/dashboard/api/agent/ceo",
        json={"question": "test"},
    )
    assert response.status_code == 401, response.text
    print("dashboard_without_secret: 401 OK")


def test_mcp_requires_secret() -> None:
    response = client.post(
        "/mcp",
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "test", "version": "1.0"},
            },
        },
    )
    assert response.status_code == 401, response.text
    assert "error" in response.json()
    print("mcp_without_secret: 401 OK")


def test_mcp_with_secret() -> None:
    response = client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
        headers={"X-Connector-Secret": SECRET},
    )
    assert response.status_code == 200, response.text
    tools = response.json()["result"]["tools"]
    assert len(tools) == 7
    print("mcp_with_secret: OK")


def test_mcp_health_public() -> None:
    response = client.get("/mcp/health")
    assert response.status_code == 200
    print("mcp_health: OK")


def main() -> int:
    test_tools_requires_secret()
    test_tools_with_secret_passes_auth()
    test_dashboard_requires_secret()
    test_mcp_requires_secret()
    test_mcp_with_secret()
    test_mcp_health_public()
    print("ALL_AUTH_TESTS_PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
