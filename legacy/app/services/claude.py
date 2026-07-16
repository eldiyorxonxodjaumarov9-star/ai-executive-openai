"""Anthropic Claude API integration service."""

from __future__ import annotations

import json
from typing import Any, Optional

import httpx

from app.config import Settings, get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

CLAUDE_TIMEOUT = httpx.Timeout(120.0, connect=10.0)
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"


class ClaudeError(Exception):
    """Raised when Claude API returns an error."""

    def __init__(self, message: str, *, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class ClaudeService:
    """Async client for Anthropic Messages API."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()

    async def analyze(
        self,
        *,
        system_prompt: str,
        user_content: str,
        max_tokens: Optional[int] = None,
    ) -> str:
        """
        Send CRM data to Claude with the agent system prompt.

        Returns the assistant text response (Uzbek business analysis).
        """
        headers = {
            "x-api-key": self.settings.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        body = {
            "model": self.settings.claude_model,
            "max_tokens": max_tokens or self.settings.claude_max_tokens,
            "system": system_prompt,
            "messages": [
                {
                    "role": "user",
                    "content": user_content,
                }
            ],
        }

        logger.info(
            "Calling Claude model=%s, user_content_chars=%d",
            self.settings.claude_model,
            len(user_content),
        )

        try:
            async with httpx.AsyncClient(timeout=CLAUDE_TIMEOUT) as client:
                response = await client.post(
                    ANTHROPIC_API_URL,
                    headers=headers,
                    json=body,
                )
        except httpx.RequestError as exc:
            logger.error("Claude network error: %s", exc)
            raise ClaudeError(f"Claude network error: {exc}") from exc

        if response.status_code >= 400:
            logger.error(
                "Claude HTTP %s: %s",
                response.status_code,
                response.text[:500],
            )
            raise ClaudeError(
                f"Claude API error ({response.status_code}): {response.text[:300]}",
                status_code=response.status_code,
            )

        try:
            data = response.json()
        except ValueError as exc:
            raise ClaudeError("Claude returned invalid JSON") from exc

        content_blocks = data.get("content", [])
        text_parts = [
            block.get("text", "")
            for block in content_blocks
            if block.get("type") == "text"
        ]
        result = "\n".join(part for part in text_parts if part).strip()

        if not result:
            raise ClaudeError("Claude returned an empty response")

        logger.info("Claude response received, chars=%d", len(result))
        return result

    @staticmethod
    def format_crm_context(crm_data: dict[str, Any]) -> str:
        """Serialize CRM payload for Claude user message."""
        return (
            "Quyidagi Bitrix24 CRM ma'lumotlarini tahlil qiling:\n\n"
            f"```json\n{json.dumps(crm_data, ensure_ascii=False, indent=2)}\n```"
        )
