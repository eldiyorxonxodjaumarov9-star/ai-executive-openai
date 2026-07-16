"""Legacy Anthropic Claude provider — active only when AI_PROVIDER=claude."""

from __future__ import annotations

import asyncio

import anthropic

from app.ai.base import AIProvider, AIProviderError
from app.ai.context import AICompletionContext
from app.config import Settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


class ClaudeProvider(AIProvider):
    name = "claude"

    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)

    def is_configured(self) -> bool:
        return bool(self.settings.anthropic_api_key.strip())

    def configuration_error_message(self) -> str:
        return (
            "Anthropic Claude API kaliti sozlanmagan. "
            ".env faylida ANTHROPIC_API_KEY ni kiriting va AI_PROVIDER=claude ekanligini tekshiring."
        )

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        max_tokens: int | None = None,
        timeout_seconds: float | None = None,
        context: AICompletionContext | None = None,
    ) -> str:
        if not self.is_configured():
            raise AIProviderError(
                self.configuration_error_message(),
                provider=self.name,
                code="not_configured",
            )

        token_limit = max_tokens if max_tokens is not None else self.settings.claude_max_tokens
        wait_seconds = (
            timeout_seconds if timeout_seconds is not None else self.settings.claude_timeout_seconds
        )

        client = anthropic.AsyncAnthropic(
            api_key=self.settings.anthropic_api_key,
            timeout=wait_seconds,
            max_retries=self.settings.claude_max_retries,
        )

        logger.info(
            "Claude request | model=%s | max_tokens=%d | timeout=%.0fs",
            self.settings.claude_model,
            token_limit,
            wait_seconds,
        )

        try:
            async with client:
                message = await asyncio.wait_for(
                    client.messages.create(
                        model=self.settings.claude_model,
                        max_tokens=token_limit,
                        system=system_prompt,
                        messages=[{"role": "user", "content": user_prompt}],
                    ),
                    timeout=wait_seconds + 5,
                )
        except asyncio.TimeoutError as exc:
            raise AIProviderError(
                "Claude javobi vaqti tugadi — qayta urinib ko'ring.",
                provider=self.name,
                code="timeout",
            ) from exc
        except anthropic.AuthenticationError as exc:
            raise AIProviderError(
                "Anthropic API kaliti noto'g'ri — ANTHROPIC_API_KEY ni tekshiring.",
                provider=self.name,
                code="auth_error",
            ) from exc
        except anthropic.APIStatusError as exc:
            raise AIProviderError(
                f"Claude API xatosi ({exc.status_code}): {exc.message}",
                provider=self.name,
                code="api_error",
            ) from exc
        except anthropic.APIError as exc:
            raise AIProviderError(
                f"Claude API xatosi: {exc}",
                provider=self.name,
                code="api_error",
            ) from exc
        except Exception as exc:
            raise AIProviderError(
                f"Claude so'rovi muvaffaqiyatsiz: {exc}",
                provider=self.name,
                code="api_error",
            ) from exc

        text_parts = [
            block.text
            for block in message.content
            if getattr(block, "type", None) == "text" and block.text
        ]
        result = "\n".join(text_parts).strip()
        if not result:
            raise AIProviderError(
                "Claude bo'sh javob qaytardi.",
                provider=self.name,
                code="empty_response",
            )

        logger.info("Claude response | chars=%d", len(result))
        return result
