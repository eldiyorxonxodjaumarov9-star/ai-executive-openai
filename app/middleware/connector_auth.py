"""Optional connector secret protection for external /tools/* and /claude/* routes."""

from __future__ import annotations
import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import get_settings


class ConnectorSecretMiddleware(BaseHTTPMiddleware):
    """
    Require X-Connector-Secret for external tool API routes when CONNECTOR_SECRET is set.

    Not applied to:
    - /mcp/health, /claude/health (handled separately)
    - /mcp POST auth (handled in mcp_remote router)
    """

    @staticmethod
    def _is_protected_path(path: str) -> bool:
        if path.startswith("/api/chat/") or path.startswith("/api/tools/"):
            return True
        # /chat/* is public for web dashboard — no connector secret required.
        if path.startswith("/dashboard/api/"):
            return True
        if path.startswith("/tools/"):
            return True
        if path.startswith("/claude/") and path != "/claude/health":
            return True
        return False

    async def dispatch(self, request: Request, call_next) -> Response:
        # Let CORS preflight through without connector secret.
        if request.method == "OPTIONS":
            return await call_next(request)

        settings = get_settings()
        secret = (settings.connector_secret or "").strip()

        if not secret or not self._is_protected_path(request.url.path):
            return await call_next(request)

        provided = request.headers.get("X-Connector-Secret", "").strip()
        if not provided or not secrets.compare_digest(provided, secret):
            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "error": "unauthorized",
                    "message": "Invalid or missing X-Connector-Secret header.",
                },
            )

        return await call_next(request)
