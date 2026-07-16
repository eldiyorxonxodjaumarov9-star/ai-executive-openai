"""Google Gemini provider."""

from __future__ import annotations

import asyncio

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.ai.base import AIProvider, AIProviderError
from app.ai.context import AICompletionContext
from app.config import Settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


class GeminiProvider(AIProvider):
    name = "gemini"

    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)

    def is_configured(self) -> bool:
        return bool(self.settings.google_api_key.strip())

    def configuration_error_message(self) -> str:
        return (
            "Google Gemini API kaliti sozlanmagan. "
            ".env faylida GOOGLE_API_KEY ni kiriting va AI_PROVIDER=gemini ekanligini tekshiring."
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

        client = genai.Client(api_key=self.settings.google_api_key)

        logger.info(
            "Gemini request | model=%s | max_tokens=%d | timeout=%.0fs",
            self.settings.gemini_model,
            token_limit,
            wait_seconds,
        )

        async def _generate() -> str:
            response = await client.aio.models.generate_content(
                model=self.settings.gemini_model,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    max_output_tokens=token_limit,
                ),
            )
            return (response.text or "").strip()

        try:
            result = await asyncio.wait_for(_generate(), timeout=wait_seconds + 5)
        except asyncio.TimeoutError as exc:
            raise AIProviderError(
                "Gemini javobi vaqti tugadi — qayta urinib ko'ring.",
                provider=self.name,
                code="timeout",
            ) from exc
        except genai_errors.ClientError as exc:
            message = str(exc)
            if "API_KEY" in message.upper() or "401" in message or "403" in message:
                raise AIProviderError(
                    "Google Gemini API kaliti noto'g'ri — GOOGLE_API_KEY ni tekshiring.",
                    provider=self.name,
                    code="auth_error",
                ) from exc
            raise AIProviderError(
                f"Gemini API xatosi: {message}",
                provider=self.name,
                code="api_error",
            ) from exc
        except Exception as exc:
            raise AIProviderError(
                f"Gemini so'rovi muvaffaqiyatsiz: {exc}",
                provider=self.name,
                code="api_error",
            ) from exc

        if not result:
            raise AIProviderError(
                "Gemini bo'sh javob qaytardi.",
                provider=self.name,
                code="empty_response",
            )

        logger.info("Gemini response | chars=%d", len(result))
        return result
