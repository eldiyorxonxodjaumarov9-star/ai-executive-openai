"""Template-only provider — no external AI API calls."""

from __future__ import annotations

import json
import re

from app.ai.base import AIProvider, AIProviderError
from app.ai.context import AICompletionContext
from app.ai.template_engine import generate_template_answer
from app.agents.response_mode import detect_response_mode
from app.config import Settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


class NoneProvider(AIProvider):
    """CRM template answers when AI_PROVIDER=none."""

    name = "none"

    def is_configured(self) -> bool:
        return True

    def configuration_error_message(self) -> str:
        return "Shablon rejimi faol — tashqi AI kaliti talab qilinmaydi."

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        max_tokens: int | None = None,
        timeout_seconds: float | None = None,
        context: AICompletionContext | None = None,
    ) -> str:
        ctx = context or _parse_prompt_fallback(system_prompt, user_prompt)
        if not ctx.crm_data:
            raise AIProviderError(
                "CRM ma'lumoti topilmadi — Bitrix24 ulanishini tekshiring.",
                provider=self.name,
                code="crm_missing",
            )

        question = (ctx.question or "").strip()
        mode = ctx.mode or detect_response_mode(question)
        agent = ctx.agent_name or "ceo"

        logger.info(
            "Template answer | agent=%s | mode=%s | question_len=%d",
            agent,
            mode,
            len(question),
        )

        return await generate_template_answer(
            question,
            ctx.crm_data,
            mode=mode,
            agent_name=agent,
            bitrix=ctx.bitrix,
        )


def _parse_prompt_fallback(system_prompt: str, user_prompt: str) -> AICompletionContext:
    """Extract question and CRM JSON from legacy prompt text."""
    question = ""
    for marker in ("=== SAVOL ===", "=== FOYDALANUVCHI SAVOLI ==="):
        match = re.search(rf"{re.escape(marker)}\s*\n(.*?)(?:\n===|\Z)", user_prompt, re.S)
        if match:
            question = match.group(1).strip()
            break

    crm_data: dict | None = None
    stats_match = re.search(
        r"UMUMIY STATISTIKA:\s*\n(\{.*?\})",
        user_prompt,
        re.S,
    )
    if stats_match:
        try:
            summary = json.loads(stats_match.group(1))
            crm_data = {"summary": summary, "leads": [], "deals": [], "tasks": [], "contacts": []}
        except json.JSONDecodeError:
            crm_data = None

    mode = detect_response_mode(question)
    agent_match = re.search(r"agent[:\s]+(\w+)", system_prompt, re.I)
    agent_name = agent_match.group(1) if agent_match else "ceo"

    return AICompletionContext(
        question=question,
        crm_data=crm_data,
        mode=mode,
        agent_name=agent_name,
    )
