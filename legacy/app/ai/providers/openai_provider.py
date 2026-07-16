"""OpenAI provider — delegates to app.services.openai_service (Responses API)."""

from __future__ import annotations

from app.ai.base import AIProvider, AIProviderError
from app.ai.context import AICompletionContext
from app.config import Settings
from app.services.openai_service import OpenAIServiceError, ask_openai
from app.utils.logger import get_logger

logger = get_logger(__name__)


class OpenAIProvider(AIProvider):
    name = "openai"

    def __init__(self, settings: Settings) -> None:
        super().__init__(settings)

    def is_configured(self) -> bool:
        return bool(self.settings.openai_api_key.strip())

    def configuration_error_message(self) -> str:
        return (
            "OpenAI API kaliti sozlanmagan. "
            ".env faylida OPENAI_API_KEY ni kiriting va AI_PROVIDER=openai ekanligini tekshiring."
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
        _ = context  # template/none providers use context; OpenAI uses raw prompts
        if not self.is_configured():
            raise AIProviderError(
                self.configuration_error_message(),
                provider=self.name,
                code="not_configured",
            )

        token_limit = max_tokens if max_tokens is not None else self.settings.openai_max_output_tokens
        wait_seconds = (
            timeout_seconds if timeout_seconds is not None else self.settings.openai_timeout_seconds
        )

        try:
            return await ask_openai(
                system_prompt,
                user_prompt,
                max_output_tokens=token_limit,
                timeout_seconds=wait_seconds,
            )
        except OpenAIServiceError as exc:
            raise AIProviderError(
                str(exc),
                provider=self.name,
                code=exc.code,
            ) from exc
