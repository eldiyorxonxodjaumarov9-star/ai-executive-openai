"""Tezkor savol-javob API — qisqa javoblar uchun."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents.runner import AGENT_DISPLAY_NAMES, AgentError, AgentRunner
from app.ai import AIProviderError
from app.services.bitrix import Bitrix24Error
from app.utils.logger import get_logger
from app.utils.uzbek_output import user_facing_ai_error

logger = get_logger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=8000)


def _chat_http_error(code: str, message: str, status_code: int) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


def _ai_error_response(exc: AIProviderError) -> HTTPException:
    safe = user_facing_ai_error(str(exc))
    if exc.code in {"timeout"} or "vaqti tugadi" in str(exc).lower():
        return _chat_http_error("ai_timeout", safe, 504)
    if exc.code in {"not_configured", "auth_error", "invalid_provider"}:
        return _chat_http_error("ai_config_error", safe, 503)
    return _chat_http_error("ai_error", safe, 502)


@router.get("/health")
async def chat_health() -> dict[str, Any]:
    """Chat API mavjudligini tekshirish."""
    return {"ok": True, "service": "chat", "quick_endpoint": "/chat/agent/{agent_name}"}


@router.post("/agent/{agent_name}")
async def chat_agent(agent_name: str, body: ChatRequest) -> dict[str, Any]:
    """
    Tezkor savol-javob — 2–8 jumla, faqat savolga tegishli CRM.
    To'liq hisobot uchun POST /tools/agent/{agent_name}?async=1 ishlating.
    """
    runner = AgentRunner()
    question = body.question.strip()

    try:
        normalized = runner.normalize_agent_name(agent_name)
    except AgentError as exc:
        logger.warning("Chat agent nomi noto'g'ri | agent=%s | %s", agent_name, exc)
        raise _chat_http_error(
            "agent_invalid",
            f"Agent nomi noto'g'ri: {exc}",
            400,
        ) from exc

    logger.info(
        "Quick chat so'rovi | agent=%s | question_len=%d",
        normalized,
        len(question),
    )

    try:
        answer = await runner.run_quick_answer(normalized, question=question)
        logger.info("Quick chat muvaffaqiyatli | agent=%s | answer_chars=%d", normalized, len(answer))
        return {
            "success": True,
            "agent": normalized,
            "agent_display_name": AGENT_DISPLAY_NAMES.get(normalized, normalized),
            "mode": "quick_answer",
            "question": question,
            "answer": answer,
            "crm_summary": (runner.last_crm_data or {}).get("summary", {}),
        }
    except Bitrix24Error as exc:
        logger.error("Quick chat CRM xatosi | agent=%s | %s", normalized, exc)
        raise _chat_http_error(
            "crm_error",
            "CRM ma'lumot olishda xato — Bitrix24 ulanishini tekshiring.",
            502,
        ) from exc
    except AIProviderError as exc:
        logger.error("Quick chat AI xatosi | agent=%s | provider=%s | %s", normalized, exc.provider, exc)
        raise _ai_error_response(exc) from exc
    except AgentError as exc:
        msg = str(exc)
        logger.error("Quick chat agent xatosi | agent=%s | %s", normalized, msg)
        if "unknown agent" in msg.lower() or "valid agents" in msg.lower():
            raise _chat_http_error("agent_invalid", f"Agent nomi noto'g'ri: {msg}", 400) from exc
        if "vaqti tugadi" in msg.lower():
            raise _chat_http_error("ai_timeout", user_facing_ai_error(msg), 504) from exc
        raise _chat_http_error("ai_error", user_facing_ai_error(msg), 502) from exc
    except ValueError as exc:
        logger.error("Quick chat validatsiya | agent=%s | %s", normalized, exc)
        raise _chat_http_error("validation_error", str(exc), 422) from exc
    except Exception as exc:
        logger.exception("Quick chat kutilmagan xato | agent=%s", normalized)
        raise _chat_http_error(
            "internal_error",
            "Server ichki xatosi — keyinroq qayta urinib ko'ring.",
            500,
        ) from exc
