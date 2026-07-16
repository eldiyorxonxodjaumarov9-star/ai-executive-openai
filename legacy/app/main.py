"""FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.agents.runner import AgentError, AgentRunner
from app.brains.loader import BRAIN_LOAD_ORDER, get_brain_stats
from app.ai import AIProviderError, ask_ai, get_ai_provider_manager
from app.config import VALID_AGENTS, get_settings, log_ai_provider_startup
from app.middleware.connector_auth import ConnectorSecretMiddleware
from app.mcp.tools import get_mcp_tool_catalog
from app.routers import api_gateway, chat_api, claude_connector, claude_tools, dashboard_api, mcp_remote
from app.scheduler.jobs import shutdown_scheduler, start_scheduler
from app.services.bitrix import Bitrix24Error, Bitrix24Service
from app.services.bitrix_test import BitrixTestService
from app.services.claude import ClaudeError
from app.services.openai_service import test_openai_connection
from app.services.telegram import TelegramError, TelegramService
from app.utils.logger import get_logger, setup_logging

logger = get_logger(__name__)
STATIC_DIR = Path(__file__).resolve().parent / "static"
PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"
DASHBOARD_HTML = PUBLIC_DIR / "dashboard.html"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown hooks."""
    settings = get_settings()
    log_level = "DEBUG" if settings.debug else "INFO"
    setup_logging(log_level)
    ai_status = get_ai_provider_manager().status()
    log_ai_provider_startup(settings, logger)
    logger.info(
        "Starting %s [%s] | ai_provider=%s | ai_configured=%s",
        settings.app_name,
        settings.app_env,
        ai_status.get("provider"),
        ai_status.get("configured"),
    )

    start_scheduler(settings)
    yield
    shutdown_scheduler()
    logger.info("Application stopped")


app = FastAPI(
    title="AI Executive Platform",
    description=(
        "Production-ready integration server connecting Bitrix24 CRM, "
        "OpenAI agents, and Telegram notifications."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

settings = get_settings()

# CORS must be outermost so OPTIONS preflight succeeds before connector auth.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"^chrome-extension://.*$",
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Connector-Secret"],
    allow_credentials=False,
)
app.add_middleware(ConnectorSecretMiddleware)
app.include_router(api_gateway.router)
app.include_router(chat_api.router)
app.include_router(claude_tools.router)
app.include_router(claude_connector.router)
app.include_router(dashboard_api.router)
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
    ai_provider: str
    ai_configured: bool
    openai_configured: bool
    claude_legacy_configured: bool


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
    ai_status = get_ai_provider_manager().status()
    return HealthResponse(
        status="ok",
        app_name=settings.app_name,
        environment=settings.app_env,
        agents=sorted(VALID_AGENTS),
        daily_report_enabled=settings.daily_report_enabled,
        ai_provider=str(ai_status.get("provider", settings.ai_provider)),
        ai_configured=bool(ai_status.get("configured")),
        openai_configured=settings.openai_configured,
        claude_legacy_configured=settings.claude_legacy_configured,
    )


@app.get("/", tags=["Dashboard"], include_in_schema=False)
async def root_redirect() -> RedirectResponse:
    """Redirect root to web dashboard."""
    return RedirectResponse(url="/dashboard", status_code=307)


@app.get("/dashboard", tags=["Dashboard"])
async def dashboard_page() -> FileResponse:
    """Serve AI Executive web chat dashboard."""
    if not DASHBOARD_HTML.is_file():
        raise HTTPException(status_code=404, detail="dashboard.html topilmadi")
    return FileResponse(DASHBOARD_HTML, media_type="text/html")


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
    """Run a specific agent report using Bitrix24 CRM data and OpenAI."""
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
    """Validate agent brain files are loaded for all agents (no LLM call)."""
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


# ── OpenAI connectivity test ─────────────────────────────────────────────────


@app.get("/test/openai", tags=["AI Test"])
async def test_openai() -> dict[str, Any]:
    """Test OpenAI Responses API with a short Uzbek prompt."""
    logger.info("API request | endpoint=GET /test/openai")
    return await test_openai_connection()


# ── AI connectivity test (all providers) ─────────────────────────────────────


@app.get("/test/ai", tags=["AI Test"])
async def test_ai_connection() -> dict[str, Any]:
    """Test active AI provider connectivity."""
    settings = get_settings()
    manager = get_ai_provider_manager()
    status = manager.status()
    provider = str(status.get("provider", settings.ai_provider))
    model = status.get("model")

    if provider == "none":
        return {
            "success": True,
            "provider": "none",
            "model": model,
            "ai_enabled": False,
            "response": "AI o'chirilgan — CRM shablon javoblari ishlatiladi.",
        }

    if not status.get("configured"):
        return {
            "success": False,
            "provider": provider,
            "model": model,
            "ai_enabled": True,
            "error": status.get("error") or "AI provider sozlanmagan.",
        }

    logger.info("API request | endpoint=GET /test/ai | provider=%s | model=%s", provider, model)

    try:
        response_text = await ask_ai(
            system_prompt="You are an AI assistant.",
            user_prompt="Reply with exactly: AI API Connected Successfully",
            max_tokens=64,
            timeout_seconds=30,
        )
        return {
            "success": True,
            "provider": provider,
            "model": model,
            "ai_enabled": True,
            "response": response_text,
        }
    except AIProviderError as exc:
        logger.error("AI test failed | provider=%s | %s", provider, exc)
        return {
            "success": False,
            "provider": provider,
            "model": model,
            "ai_enabled": provider != "none",
            "error": str(exc),
        }
    except Exception as exc:
        logger.exception("AI test unexpected error")
        return {
            "success": False,
            "provider": provider,
            "model": model,
            "ai_enabled": provider != "none",
            "error": str(exc),
        }


@app.get("/test/claude", tags=["AI Test"])
async def test_claude_connection() -> dict[str, Any]:
    """Legacy alias — use GET /test/openai for OpenAI or GET /test/ai for active provider."""
    return await test_ai_connection()
