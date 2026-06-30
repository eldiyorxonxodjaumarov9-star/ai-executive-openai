"""MCP-ready tool API layer for Claude chat and external tool calling."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.agents.runner import AGENT_DISPLAY_NAMES, AgentError, AgentRunner
from app.config import VALID_AGENTS, get_settings
from app.services.bitrix import Bitrix24Error, Bitrix24Service
from app.services.claude_service import ClaudeServiceError
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/tools", tags=["Claude Tools"])

TOOL_MANIFEST: list[dict[str, Any]] = [
    {
        "name": "get_bitrix_summary",
        "description": "Bitrix24 CRM umumiy statistikasini olish (lidlar, bitimlar, kontaktlar, vazifalar soni va umumiy summa).",
        "method": "GET",
        "path": "/tools/bitrix/summary",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_leads",
        "description": "Bitrix24 dan lidlar ro'yxatini olish.",
        "method": "GET",
        "path": "/tools/bitrix/leads",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_deals",
        "description": "Bitrix24 dan bitimlar ro'yxatini olish.",
        "method": "GET",
        "path": "/tools/bitrix/deals",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_tasks",
        "description": "Bitrix24 dan vazifalar ro'yxatini olish.",
        "method": "GET",
        "path": "/tools/bitrix/tasks",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "run_agent_analysis",
        "description": (
            "Tanlangan agent (ceo, sales, finance, hr, marketing, customer_success) "
            "yordamida Bitrix24 ma'lumotlarini tahlil qilish va foydalanuvchi savoliga javob berish."
        ),
        "method": "POST",
        "path": "/tools/agent/{agent_name}",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_name": {
                    "type": "string",
                    "enum": sorted(VALID_AGENTS),
                    "description": "Agent nomi (URL path parametri)",
                },
                "question": {
                    "type": "string",
                    "description": "Foydalanuvchi savoli yoki tahlil so'rovi",
                },
            },
            "required": ["question"],
        },
    },
]


class AgentToolRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=8000)


async def run_agent_analysis(
    agent_name: str,
    question: str,
    *,
    optimized: bool = True,
) -> dict[str, Any]:
    """Shared agent execution used by external tools and dashboard API."""
    tool = "run_agent_analysis"
    runner = AgentRunner()

    normalized = runner.normalize_agent_name(agent_name)
    answer = await runner.run_agent_report(
        normalized,
        question=question.strip(),
        optimized=optimized,
    )
    crm_data = await runner.bitrix.fetch_all_crm_data()

    return _tool_success(
        tool,
        {
            "agent": normalized,
            "agent_display_name": AGENT_DISPLAY_NAMES.get(normalized, normalized),
            "question": question.strip(),
            "optimized": optimized,
            "answer": answer,
            "crm_summary": crm_data.get("summary", {}),
            "fetched_at": crm_data.get("fetched_at"),
        },
    )


def _tool_success(tool: str, data: Any) -> dict[str, Any]:
    return {"success": True, "tool": tool, "data": data}


def _tool_error(tool: str, error: str) -> dict[str, Any]:
    return {"success": False, "tool": tool, "error": error}


@router.get("/manifest")
async def tools_manifest() -> dict[str, Any]:
    """Return tool manifest for Claude MCP or external tool calling."""
    settings = get_settings()
    return {
        "name": "bitrix24-claude-tools",
        "version": "1.0.0",
        "description": "Bitrix24 CRM ma'lumotlari va agent tahlili uchun Claude tool API",
        "base_url_hint": f"http://{settings.host}:{settings.port}",
        "agents": sorted(VALID_AGENTS),
        "tools": TOOL_MANIFEST,
    }


@router.get("/bitrix/summary")
async def get_bitrix_summary() -> dict[str, Any]:
    """Fetch Bitrix24 CRM summary statistics."""
    tool = "get_bitrix_summary"
    logger.info("Claude tool call | tool=%s", tool)
    try:
        bitrix = Bitrix24Service()
        crm_data = await bitrix.fetch_all_crm_data()
        return _tool_success(
            tool,
            {
                "fetched_at": crm_data.get("fetched_at"),
                "summary": crm_data.get("summary", {}),
            },
        )
    except Bitrix24Error as exc:
        logger.error("Tool failed | tool=%s | error=%s", tool, exc)
        return _tool_error(tool, str(exc))


@router.get("/bitrix/leads")
async def get_bitrix_leads() -> dict[str, Any]:
    """Fetch Bitrix24 leads."""
    tool = "get_leads"
    logger.info("Claude tool call | tool=%s", tool)
    try:
        bitrix = Bitrix24Service()
        leads = await bitrix.fetch_leads()
        return _tool_success(tool, {"count": len(leads), "items": leads})
    except Bitrix24Error as exc:
        logger.error("Tool failed | tool=%s | error=%s", tool, exc)
        return _tool_error(tool, str(exc))


@router.get("/bitrix/deals")
async def get_bitrix_deals() -> dict[str, Any]:
    """Fetch Bitrix24 deals."""
    tool = "get_deals"
    logger.info("Claude tool call | tool=%s", tool)
    try:
        bitrix = Bitrix24Service()
        deals = await bitrix.fetch_deals()
        return _tool_success(tool, {"count": len(deals), "items": deals})
    except Bitrix24Error as exc:
        logger.error("Tool failed | tool=%s | error=%s", tool, exc)
        return _tool_error(tool, str(exc))


@router.get("/bitrix/tasks")
async def get_bitrix_tasks() -> dict[str, Any]:
    """Fetch Bitrix24 tasks."""
    tool = "get_tasks"
    logger.info("Claude tool call | tool=%s", tool)
    try:
        bitrix = Bitrix24Service()
        tasks = await bitrix.fetch_tasks()
        return _tool_success(tool, {"count": len(tasks), "items": tasks})
    except Bitrix24Error as exc:
        logger.error("Tool failed | tool=%s | error=%s", tool, exc)
        return _tool_error(tool, str(exc))


@router.post("/agent/{agent_name}")
async def run_agent_tool(
    agent_name: str,
    body: AgentToolRequest,
    optimized: bool = Query(True, description="Enable dynamic context optimization"),
) -> dict[str, Any]:
    """
    Run agent analysis with live Bitrix24 data and a user question.

    Designed for Claude chat tool-calling: returns a clean JSON answer payload.
    """
    tool = "run_agent_analysis"
    logger.info("Claude tool call | tool=%s | agent=%s", tool, agent_name)

    try:
        return await run_agent_analysis(
            agent_name,
            body.question.strip(),
            optimized=optimized,
        )
    except AgentError as exc:
        logger.error("Tool failed | tool=%s | agent=%s | error=%s", tool, agent_name, exc)
        return _tool_error(tool, str(exc))
    except ClaudeServiceError as exc:
        logger.error("Tool failed | tool=%s | agent=%s | error=%s", tool, agent_name, exc)
        return _tool_error(tool, str(exc))
    except Bitrix24Error as exc:
        logger.error("Tool failed | tool=%s | agent=%s | error=%s", tool, agent_name, exc)
        return _tool_error(tool, str(exc))
