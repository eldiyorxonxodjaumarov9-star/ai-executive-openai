"""Remote MCP JSON-RPC endpoint for Claude.ai Custom Connectors."""

from __future__ import annotations
import secrets

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from app.config import get_settings
from app.mcp.remote_server import (
    JSONRPC_PARSE_ERROR,
    JSONRPC_UNAUTHORIZED,
    handle_mcp_request,
    jsonrpc_error,
    mcp_health_payload,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/mcp", tags=["Remote MCP"])


def _check_connector_secret(request: Request) -> JSONResponse | None:
    """Return JSON-RPC error response if secret is required but invalid."""
    settings = get_settings()
    secret = (settings.connector_secret or "").strip()
    if not secret:
        return None

    provided = request.headers.get("X-Connector-Secret", "").strip()
    if not provided or not secrets.compare_digest(provided, secret):
        return JSONResponse(
            status_code=401,
            content=jsonrpc_error(
                JSONRPC_UNAUTHORIZED,
                "Unauthorized: Invalid or missing X-Connector-Secret header.",
            ),
        )
    return None


@router.get("/health")
async def mcp_health() -> dict[str, Any]:
    """MCP service health (no authentication required)."""
    return mcp_health_payload()


@router.post("")
async def mcp_jsonrpc(request: Request) -> Response:
    """Remote MCP JSON-RPC 2.0 endpoint."""
    auth_error = _check_connector_secret(request)
    if auth_error is not None:
        return auth_error

    try:
        body = await request.json()
    except Exception:
        return JSONResponse(
            status_code=400,
            content=jsonrpc_error(JSONRPC_PARSE_ERROR, "Parse error: invalid JSON body"),
        )

    logger.info("MCP request | method=%s", body.get("method") if isinstance(body, dict) else "batch")

    if isinstance(body, list):
        responses: list[dict[str, Any]] = []
        for item in body:
            if not isinstance(item, dict):
                responses.append(jsonrpc_error(JSONRPC_PARSE_ERROR, "Parse error: invalid batch item"))
                continue
            result = await handle_mcp_request(item)
            if result is not None:
                responses.append(result)
        return JSONResponse(content=responses if responses else [])

    if not isinstance(body, dict):
        return JSONResponse(
            status_code=400,
            content=jsonrpc_error(JSONRPC_PARSE_ERROR, "Parse error: body must be a JSON object"),
        )

    result = await handle_mcp_request(body)
    if result is None:
        return Response(status_code=204)
    return JSONResponse(content=result)
