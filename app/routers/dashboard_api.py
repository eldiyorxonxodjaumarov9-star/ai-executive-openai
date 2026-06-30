"""Internal dashboard API — same-origin UI only, no connector secret required."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from app.agents.runner import AgentError
from app.routers.claude_tools import AgentToolRequest, _tool_error, run_agent_analysis
from app.services.bitrix import Bitrix24Error
from app.services.claude_service import ClaudeServiceError
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/dashboard/api", tags=["Dashboard API"])


@router.post("/agent/{agent_name}")
async def dashboard_run_agent(
    agent_name: str,
    body: AgentToolRequest,
    optimized: bool = Query(True, description="Enable dynamic context optimization"),
) -> dict[str, Any]:
    """
    Run agent analysis for the built-in dashboard.

    Not protected by CONNECTOR_SECRET — intended for same-origin browser use only.
    External integrations must use POST /tools/agent/{agent_name} with X-Connector-Secret.
    """
    logger.info("Dashboard API | agent=%s", agent_name)
    try:
        return await run_agent_analysis(
            agent_name,
            body.question.strip(),
            optimized=optimized,
        )
    except AgentError as exc:
        logger.error("Dashboard API failed | agent=%s | error=%s", agent_name, exc)
        return _tool_error("run_agent_analysis", str(exc))
    except ClaudeServiceError as exc:
        logger.error("Dashboard API failed | agent=%s | error=%s", agent_name, exc)
        return _tool_error("run_agent_analysis", str(exc))
    except Bitrix24Error as exc:
        logger.error("Dashboard API failed | agent=%s | error=%s", agent_name, exc)
        return _tool_error("run_agent_analysis", str(exc))
