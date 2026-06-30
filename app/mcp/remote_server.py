"""JSON-RPC 2.0 Remote MCP protocol handler."""

from __future__ import annotations

from typing import Any

from app.connector.manifest import TOOL_NAMES
from app.mcp.tool_executor import (
    MCP_PROTOCOL_VERSION,
    MCP_SERVER_NAME,
    MCP_SERVER_VERSION,
    execute_mcp_tool,
    list_mcp_tools,
)

JSONRPC_PARSE_ERROR = -32700
JSONRPC_INVALID_REQUEST = -32600
JSONRPC_METHOD_NOT_FOUND = -32601
JSONRPC_INVALID_PARAMS = -32602
JSONRPC_INTERNAL_ERROR = -32603
JSONRPC_UNAUTHORIZED = -32001


def jsonrpc_error(
    code: int,
    message: str,
    *,
    request_id: Any = None,
    data: Any = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": error}


def jsonrpc_result(request_id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


async def handle_mcp_request(body: dict[str, Any]) -> dict[str, Any] | None:
    """
    Handle a single JSON-RPC MCP request.

    Returns None for notifications (no id).
    """
    if body.get("jsonrpc") != "2.0":
        return jsonrpc_error(JSONRPC_INVALID_REQUEST, "Invalid Request: jsonrpc must be '2.0'")

    method = body.get("method")
    params = body.get("params") or {}
    request_id = body.get("id")
    is_notification = "id" not in body

    if not method or not isinstance(method, str):
        if is_notification:
            return None
        return jsonrpc_error(JSONRPC_INVALID_REQUEST, "Invalid Request: method is required", request_id=request_id)

    try:
        if method == "initialize":
            result = {
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {"name": MCP_SERVER_NAME, "version": MCP_SERVER_VERSION},
            }
        elif method == "notifications/initialized":
            return None
        elif method == "tools/list":
            result = {"tools": list_mcp_tools()}
        elif method == "tools/call":
            tool_name = params.get("name")
            if not tool_name or not isinstance(tool_name, str):
                return jsonrpc_error(
                    JSONRPC_INVALID_PARAMS,
                    "Invalid params: name is required",
                    request_id=request_id,
                )
            arguments = params.get("arguments") or {}
            if not isinstance(arguments, dict):
                return jsonrpc_error(
                    JSONRPC_INVALID_PARAMS,
                    "Invalid params: arguments must be an object",
                    request_id=request_id,
                )
            result = await execute_mcp_tool(tool_name, arguments)
        elif method == "ping":
            result = {}
        else:
            if is_notification:
                return None
            return jsonrpc_error(
                JSONRPC_METHOD_NOT_FOUND,
                f"Method not found: {method}",
                request_id=request_id,
            )

        if is_notification:
            return None
        return jsonrpc_result(request_id, result)
    except Exception as exc:
        if is_notification:
            return None
        return jsonrpc_error(JSONRPC_INTERNAL_ERROR, str(exc), request_id=request_id)


def mcp_health_payload() -> dict[str, Any]:
    """Return MCP health check payload."""
    return {
        "success": True,
        "service": "AI Executive Platform Remote MCP",
        "protocol": MCP_PROTOCOL_VERSION,
        "endpoint": "/mcp",
        "tools_available": TOOL_NAMES,
    }
