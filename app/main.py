"""FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.agents.runner import AgentError, AgentRunner
from app.brains.loader import BRAIN_LOAD_ORDER, get_brain_stats
from app.config import VALID_AGENTS, get_settings
from app.middleware.connector_auth import ConnectorSecretMiddleware
from app.mcp.tools import get_mcp_tool_catalog
from app.routers import claude_connector, claude_tools, mcp_remote
from app.scheduler.jobs import shutdown_scheduler, start_scheduler
from app.services.bitrix import Bitrix24Error, Bitrix24Service
from app.services.bitrix_test import BitrixTestService
from app.services.claude import ClaudeError
from app.services.claude_service import ClaudeServiceError, ask_claude
from app.services.telegram import TelegramError, TelegramService
from app.utils.logger import get_logger, setup_logging

logger = get_logger(__name__)
STATIC_DIR = Path(__file__).resolve().parent / "static"
PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown hooks."""
    settings = get_settings()
    log_level = "DEBUG" if settings.debug else "INFO"
    setup_logging(log_level)
    logger.info("Starting %s [%s]", settings.app_name, settings.app_env)

    start_scheduler(settings)
    yield
    shutdown_scheduler()
    logger.info("Application stopped")


app = FastAPI(
    title="Bitrix24 Claude Telegram Integration",
    description=(
        "Production-ready integration server connecting Bitrix24 CRM, "
        "Anthropic Claude AI agents, and Telegram notifications."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(ConnectorSecretMiddleware)
app.include_router(claude_tools.router)
app.include_router(claude_connector.router)
app.include_router(mcp_remote.router)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
if PUBLIC_DIR.is_dir():
    app.mount("/public", StaticFiles(directory=PUBLIC_DIR), name="public")


# ── Request / Response models ──────────────────────────────────────────────


class ReportRequest(BaseModel):
    send_telegram: bool = Field(True, description="Send report to Telegram after analysis")


class TelegramTestRequest(BaseModel):
    message: str = Field(
        default="✅ Telegram integratsiyasi muvaffaqiyatli ishlayapti!",
        min_length=1,
        max_length=10000,
    )


class AgentReportResponse(BaseModel):
    success: bool
    agent: str
    report: Optional[str] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    app_name: str
    environment: str
    agents: list[str]
    daily_report_enabled: bool


# ── Exception handlers ─────────────────────────────────────────────────────


@app.exception_handler(Bitrix24Error)
async def bitrix_error_handler(_: Request, exc: Bitrix24Error) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"error": "bitrix24_error", "message": str(exc)},
    )


@app.exception_handler(ClaudeError)
async def claude_error_handler(_: Request, exc: ClaudeError) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"error": "claude_error", "message": str(exc)},
    )


@app.exception_handler(TelegramError)
async def telegram_error_handler(_: Request, exc: TelegramError) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"error": "telegram_error", "message": str(exc)},
    )


@app.exception_handler(AgentError)
async def agent_error_handler(_: Request, exc: AgentError) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"error": "agent_error", "message": str(exc)},
    )


# ── Routes ─────────────────────────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health() -> HealthResponse:
    """Health check endpoint."""
    settings = get_settings()
    return HealthResponse(
        status="ok",
        app_name=settings.app_name,
        environment=settings.app_env,
        agents=sorted(VALID_AGENTS),
        daily_report_enabled=settings.daily_report_enabled,
    )


@app.get("/", tags=["Dashboard"])
async def dashboard_home() -> FileResponse:
    """Serve AI Chat Dashboard."""
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/mcp/tools", tags=["MCP"])
async def mcp_tools() -> dict[str, Any]:
    """Return MCP-compatible tool catalog for agent integrations."""
    return get_mcp_tool_catalog()


@app.get("/agents", tags=["Agents"])
async def list_agents() -> dict[str, Any]:
    """List available AI agents."""
    runner = AgentRunner()
    return {"agents": runner.list_agents()}


@app.get("/optimization/status", tags=["Optimization"])
async def optimization_status() -> dict[str, Any]:
    """Return dynamic context optimization status and last run trace."""
    runner = AgentRunner()
    return runner.get_optimization_status()


@app.post("/reports/daily", tags=["Reports"])
async def trigger_daily_report(body: Optional[ReportRequest] = None) -> dict[str, Any]:
    """Manually trigger the daily report (uses configured daily_report_agent)."""
    send_telegram = body.send_telegram if body else True
    settings = get_settings()
    runner = AgentRunner()
    result = await runner.run_agent(
        settings.daily_report_agent,
        send_telegram=send_telegram,
    )

    return {
        "success": True,
        "agent": result.agent_name,
        "report": result.analysis,
        "crm_summary": result.crm_summary,
        "telegram_sent": result.telegram_sent,
        "telegram_chunks": result.telegram_chunks,
    }


@app.post("/reports/agent/{agent_name}", response_model=AgentReportResponse, tags=["Reports"])
async def trigger_agent_report(agent_name: str) -> AgentReportResponse:
    """Run a specific agent report using Bitrix24 CRM data and Claude."""
    logger.info("API request | endpoint=POST /reports/agent/%s", agent_name)
    runner = AgentRunner()

    try:
        normalized = runner.normalize_agent_name(agent_name)
        report = await runner.run_agent_report(normalized)
        return AgentReportResponse(success=True, agent=normalized, report=report)
    except AgentError as exc:
        logger.error("Agent report failed | agent=%s | error=%s", agent_name, exc)
        return AgentReportResponse(success=False, agent=agent_name, error=str(exc))


@app.post("/webhooks/bitrix", tags=["Webhooks"])
async def bitrix_webhook(request: Request) -> dict[str, Any]:
    """
    Receive Bitrix24 outgoing webhook events.

    On CRM events, triggers a CEO agent report and sends to Telegram.
    """
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        payload = await request.json()
    else:
        form = await request.form()
        payload = dict(form)

    event = payload.get("event") or payload.get("EVENT")
    logger.info("Bitrix24 webhook received: event=%s", event)

    runner = AgentRunner()
    result = await runner.run_agent("ceo", send_telegram=True)

    return {
        "success": True,
        "event": event,
        "agent": result.agent_name,
        "telegram_sent": result.telegram_sent,
        "crm_summary": result.crm_summary,
    }


@app.post("/telegram/send-test", tags=["Telegram"])
async def telegram_send_test(body: TelegramTestRequest) -> dict[str, Any]:
    """Send a test message to the configured Telegram chat."""
    settings = get_settings()
    if not settings.telegram_enabled:
        return {
            "success": False,
            "error": "telegram_disabled",
            "message": "Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (both optional).",
        }

    telegram = TelegramService(settings)
    responses = await telegram.send_message(body.message)
    return {
        "success": True,
        "chunks_sent": len(responses),
        "chat_id": telegram.chat_id,
    }


@app.get("/bitrix/crm", tags=["Bitrix24"])
async def fetch_crm_snapshot() -> dict[str, Any]:
    """Fetch normalized Bitrix24 CRM data (debug / MCP tool endpoint)."""
    bitrix = Bitrix24Service()
    return await bitrix.fetch_all_crm_data()


# ── Bitrix24 connectivity tests ────────────────────────────────────────────


@app.get("/test/bitrix", tags=["Bitrix24 Test"])
async def test_bitrix_connection() -> dict[str, Any]:
    """Test Bitrix24 incoming webhook connectivity (profile.json)."""
    logger.info("API request | endpoint=GET /test/bitrix")
    service = BitrixTestService()
    return await service.test_connection()


@app.get("/test/leads", tags=["Bitrix24 Test"])
async def test_bitrix_leads() -> dict[str, Any]:
    """Test Bitrix24 leads fetch (crm.lead.list.json)."""
    logger.info("API request | endpoint=GET /test/leads")
    service = BitrixTestService()
    return await service.get_leads(limit=5)


@app.get("/test/deals", tags=["Bitrix24 Test"])
async def test_bitrix_deals() -> dict[str, Any]:
    """Test Bitrix24 deals fetch (crm.deal.list.json)."""
    logger.info("API request | endpoint=GET /test/deals")
    service = BitrixTestService()
    return await service.get_deals(limit=5)


@app.get("/test/contacts", tags=["Bitrix24 Test"])
async def test_bitrix_contacts() -> dict[str, Any]:
    """Test Bitrix24 contacts fetch (crm.contact.list.json)."""
    logger.info("API request | endpoint=GET /test/contacts")
    service = BitrixTestService()
    return await service.get_contacts(limit=5)


@app.get("/test/tasks", tags=["Bitrix24 Test"])
async def test_bitrix_tasks() -> dict[str, Any]:
    """Test Bitrix24 tasks fetch (tasks.task.list.json)."""
    logger.info("API request | endpoint=GET /test/tasks")
    service = BitrixTestService()
    return await service.get_tasks(limit=5)


# ── Agent brain validation ─────────────────────────────────────────────────


@app.get("/test/brains", tags=["Brain Test"])
async def test_agent_brains() -> dict[str, Any]:
    """Validate agent brain files are loaded for all agents (no Claude call)."""
    logger.info("API request | endpoint=GET /test/brains")
    runner = AgentRunner()
    agents_report = []
    all_ok = True

    for agent in sorted(VALID_AGENTS):
        expected = len(BRAIN_LOAD_ORDER.get(agent, []))
        stats = get_brain_stats(agent)
        system = runner.build_system_prompt(agent)
        brain_in_system = "AGENT BRAIN" in system and stats["chars"] > 0
        ok = stats["files"] == expected and brain_in_system
        all_ok = all_ok and ok
        agents_report.append(
            {
                "agent": agent,
                "expected_files": expected,
                "loaded_files": stats["files"],
                "brain_chars": stats["chars"],
                "system_chars": len(system),
                "brain_in_system": brain_in_system,
                "ok": ok,
            }
        )

    return {"success": all_ok, "agents": agents_report}


# ── Claude connectivity test ───────────────────────────────────────────────


@app.get("/test/claude", tags=["Claude Test"])
async def test_claude_connection() -> dict[str, Any]:
    """Test Anthropic Claude API connectivity."""
    settings = get_settings()
    logger.info("API request | endpoint=GET /test/claude | model=%s", settings.claude_model)

    try:
        response_text = await ask_claude(
            system_prompt="You are an AI assistant.",
            user_prompt="Reply with exactly: Claude API Connected Successfully",
        )
        return {
            "success": True,
            "model": settings.claude_model,
            "response": response_text,
        }
    except ClaudeServiceError as exc:
        logger.error("Claude test failed: %s", exc)
        return {"success": False, "error": str(exc)}
    except Exception as exc:
        logger.exception("Claude test unexpected error")
        return {"success": False, "error": str(exc)}
