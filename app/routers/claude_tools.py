"""MCP-ready tool API layer for Claude chat and external tool calling."""

from __future__ import annotations

import asyncio
import time
from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.agents.runner import AGENT_DISPLAY_NAMES, AgentError, AgentRunner
from app.config import VALID_AGENTS, get_settings
from app.services.agent_jobs import agent_job_store
from app.services.bitrix import Bitrix24Error, Bitrix24Service
from app.ai import AIProviderError
from app.utils.logger import get_logger
from app.utils.uzbek_output import user_facing_ai_error

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


class FileAttachment(BaseModel):
    name: str = Field(..., max_length=255)
    content: str = Field(..., max_length=50000)
    mime_type: str = Field(default="text/plain", max_length=100)


class AgentToolRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=8000)
    attachments: list[FileAttachment] = Field(default_factory=list)


async def run_agent_analysis(
    agent_name: str,
    question: str,
    *,
    optimized: bool = True,
    attachments: list[FileAttachment] | None = None,
) -> dict[str, Any]:
    """Shared agent execution used by external tools and dashboard API."""
    tool = "run_agent_analysis"
    runner = AgentRunner()

    normalized = runner.normalize_agent_name(agent_name)
    full_question = question.strip()
    if attachments:
        parts = [full_question, "\n\n--- Attached files ---"]
        for att in attachments:
            parts.append(f"\n### {att.name}\n{att.content.strip()}")
        full_question = "\n".join(parts)[:12000]

    answer = await runner.run_agent_report(
        normalized,
        question=full_question,
        optimized=optimized,
    )
    crm_data = runner.last_crm_data or {"summary": {}, "fetched_at": None}

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


async def _execute_agent_job(
    job_id: str,
    agent_name: str,
    question: str,
    *,
    optimized: bool,
    attachments: list[FileAttachment] | None,
) -> None:
    """Run agent analysis in background and store result on the job."""
    t0 = time.perf_counter()
    logger.info("Agent job started | job=%s | agent=%s", job_id, agent_name)
    await agent_job_store.set_status(job_id, status="running", stage="crm")
    try:
        await agent_job_store.set_status(job_id, stage="llm")
        t_crm = time.perf_counter()
        logger.info("Agent job | job=%s | stage=llm | prep=%.1fs", job_id, t_crm - t0)
        result = await run_agent_analysis(
            agent_name,
            question,
            optimized=optimized,
            attachments=attachments,
        )
        elapsed = time.perf_counter() - t0
        logger.info("Agent job completed | job=%s | elapsed=%.1fs", job_id, elapsed)
        await agent_job_store.set_status(
            job_id, status="completed", stage="done", result=result
        )
    except (AgentError, AIProviderError, Bitrix24Error, ValueError) as exc:
        logger.error("Agent job failed | job=%s | error=%s", job_id, exc)
        await agent_job_store.set_status(
            job_id, status="failed", stage="failed", error=str(exc)
        )
    except Exception as exc:
        logger.exception("Agent job unexpected error | job=%s", job_id)
        await agent_job_store.set_status(
            job_id, status="failed", stage="failed", error="Tahlil vaqtida kutilmagan xato yuz berdi."
        )


def _tool_success(tool: str, data: Any) -> dict[str, Any]:
    return {"success": True, "tool": tool, "data": data}


def _tool_error(tool: str, error: str) -> dict[str, Any]:
    return {"success": False, "tool": tool, "error": user_facing_ai_error(error)}


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
    async_mode: bool = Query(
        False,
        alias="async",
        description="Queue job and return job_id immediately (for Chrome extension polling)",
    ),
) -> dict[str, Any]:
    """
    Run agent analysis with live Bitrix24 data and a user question.

    Use ?async=1 for long-running jobs — poll GET /tools/agent/jobs/{job_id}.
    """
    tool = "run_agent_analysis"
    logger.info(
        "Claude tool call | tool=%s | agent=%s | async=%s",
        tool,
        agent_name,
        async_mode,
    )

    if async_mode:
        job = await agent_job_store.create(agent_name)
        asyncio.create_task(
            _execute_agent_job(
                job.job_id,
                agent_name,
                body.question.strip(),
                optimized=optimized,
                attachments=body.attachments,
            )
        )
        return _tool_success(
            tool,
            {
                "job_id": job.job_id,
                "status": "queued",
                "agent": agent_name,
            },
        )

    try:
        return await run_agent_analysis(
            agent_name,
            body.question.strip(),
            optimized=optimized,
            attachments=body.attachments,
        )
    except AgentError as exc:
        logger.error("Tool failed | tool=%s | agent=%s | error=%s", tool, agent_name, exc)
        return _tool_error(tool, str(exc))
    except AIProviderError as exc:
        logger.error("Tool failed | tool=%s | agent=%s | error=%s", tool, agent_name, exc)
        return _tool_error(tool, str(exc))
    except Bitrix24Error as exc:
        logger.error("Tool failed | tool=%s | agent=%s | error=%s", tool, agent_name, exc)
        return _tool_error(tool, str(exc))


@router.get("/agent/jobs/{job_id}")
async def get_agent_job(job_id: str) -> dict[str, Any]:
    """Poll async agent job status and result."""
    tool = "get_agent_job"
    job = await agent_job_store.get(job_id)
    if not job:
        return _tool_error(tool, "Vazifa topilmadi yoki muddati tugagan.")

    payload: dict[str, Any] = {
        "job_id": job.job_id,
        "agent": job.agent_name,
        "status": job.status,
        "stage": job.stage,
    }
    if job.status == "completed" and job.result is not None:
        payload["result"] = job.result
    if job.status == "failed":
        payload["error"] = job.error or "Tahlil muvaffaqiyatsiz"
    return _tool_success(tool, payload)
