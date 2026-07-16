"""Dashboard API for web frontend (Vercel)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from app.agents.runner import AGENT_DISPLAY_NAMES, AgentError, AgentRunner
from app.config import VALID_AGENTS
from app.routers.claude_tools import AgentToolRequest, _tool_error, run_agent_analysis
from app.services.bitrix import Bitrix24Error, Bitrix24Service
from app.ai import AIProviderError
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/dashboard/api", tags=["Dashboard API"])


@router.get("/agents")
async def list_agents() -> dict[str, Any]:
    """Agentlar ro'yxati — web dashboard uchun."""
    return {
        "success": True,
        "agents": [
            {"id": aid, "label": AGENT_DISPLAY_NAMES.get(aid, aid)}
            for aid in sorted(VALID_AGENTS)
        ],
    }


@router.get("/analytics")
async def dashboard_analytics() -> dict[str, Any]:
    """CRM qisqa ko'rsatkichlari — dashboard analytics."""
    try:
        bitrix = Bitrix24Service()
        crm = await bitrix.fetch_all_crm_data()
        return {
            "success": True,
            "fetched_at": crm.get("fetched_at"),
            "summary": crm.get("summary", {}),
        }
    except Bitrix24Error as exc:
        logger.error("Dashboard analytics failed: %s", exc)
        return {"success": False, "error": str(exc)}


@router.post("/agent/{agent_name}")
async def dashboard_run_agent(
    agent_name: str,
    body: AgentToolRequest,
    optimized: bool = Query(True, description="Enable dynamic context optimization"),
) -> dict[str, Any]:
    """
    Legacy full-report endpoint for same-origin static dashboard.
    Vercel frontend uses /chat/agent and /tools/agent directly.
    """
    logger.info("Dashboard API | agent=%s", agent_name)
    try:
        return await run_agent_analysis(
            agent_name,
            body.question.strip(),
            optimized=optimized,
            attachments=body.attachments,
        )
    except AgentError as exc:
        logger.error("Dashboard API failed | agent=%s | error=%s", agent_name, exc)
        return _tool_error("run_agent_analysis", str(exc))
    except AIProviderError as exc:
        logger.error("Dashboard API failed | agent=%s | error=%s", agent_name, exc)
        return _tool_error("run_agent_analysis", str(exc))
    except Bitrix24Error as exc:
        logger.error("Dashboard API failed | agent=%s | error=%s", agent_name, exc)
        return _tool_error("run_agent_analysis", str(exc))
