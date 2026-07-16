"""Public API gateway — /api/* routes for Vercel frontend."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.ai import get_ai_provider_manager
from app.config import VALID_AGENTS, get_settings
from app.routers import chat_api, claude_tools
from app.services.bitrix_test import BitrixTestService
from app.services.openai_service import test_openai_connection
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["API"])

router.include_router(chat_api.router)
router.include_router(claude_tools.router)


@router.get("/health")
async def api_health() -> dict[str, Any]:
    """Platform health — frontend status bar."""
    settings = get_settings()
    ai_status = get_ai_provider_manager().status()
    return {
        "ok": True,
        "status": "ok",
        "app_name": settings.app_name,
        "environment": settings.app_env,
        "agents": sorted(VALID_AGENTS),
        "ai_provider": str(ai_status.get("provider", settings.ai_provider)),
        "ai_configured": bool(ai_status.get("configured")),
        "ai_model": ai_status.get("model"),
        "openai_configured": settings.openai_configured,
        "claude_legacy_configured": settings.claude_legacy_configured,
    }


@router.get("/test/bitrix")
async def api_test_bitrix() -> dict[str, Any]:
    """Bitrix24 ulanishini tekshirish."""
    logger.info("API request | endpoint=GET /api/test/bitrix")
    service = BitrixTestService()
    return await service.test_connection()


@router.get("/test/openai")
async def api_test_openai() -> dict[str, Any]:
    """OpenAI Responses API ulanishini tekshirish."""
    logger.info("API request | endpoint=GET /api/test/openai")
    return await test_openai_connection()
