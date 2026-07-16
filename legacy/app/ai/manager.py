"""AI provider manager — selects and invokes the configured backend."""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

from app.ai.base import AIProvider, AIProviderError
from app.ai.providers.claude_provider import ClaudeProvider
from app.ai.providers.gemini_provider import GeminiProvider
from app.ai.providers.none_provider import NoneProvider
from app.ai.providers.openai_provider import OpenAIProvider
from app.ai.context import AICompletionContext
from app.config import VALID_AI_PROVIDERS, Settings, get_settings
from app.utils.logger import get_logger

if TYPE_CHECKING:
    pass

logger = get_logger(__name__)

_PROVIDER_FACTORIES: dict[str, type[AIProvider]] = {
    "none": NoneProvider,
    "claude": ClaudeProvider,
    "openai": OpenAIProvider,
    "gemini": GeminiProvider,
}


class AIProviderManager:
    """Lazy provider registry — no network calls or key validation at import."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._instances: dict[str, AIProvider] = {}

    @property
    def active_provider_name(self) -> str:
        return self.settings.ai_provider

    def resolve_provider_name(self, name: str | None = None) -> str:
        resolved = (name or self.settings.ai_provider).strip().lower()
        if resolved not in VALID_AI_PROVIDERS:
            valid = ", ".join(sorted(VALID_AI_PROVIDERS))
            raise AIProviderError(
                f"Noto'g'ri AI provider: '{resolved}'. Qo'llab-quvvatlanadi: {valid}",
                provider=resolved,
                code="invalid_provider",
            )
        return resolved

    def get_provider(self, name: str | None = None) -> AIProvider:
        resolved = self.resolve_provider_name(name)
        if resolved not in self._instances:
            factory = _PROVIDER_FACTORIES[resolved]
            self._instances[resolved] = factory(self.settings)
            logger.debug("AI provider instance created | provider=%s", resolved)
        return self._instances[resolved]

    def status(self) -> dict[str, object]:
        """Non-blocking status for health checks — does not call external APIs."""
        name = self.settings.ai_provider
        try:
            provider = self.get_provider(name)
            configured = provider.is_configured()
            return {
                "provider": name,
                "configured": configured,
                "model": self._model_for(name),
                "error": None if configured else provider.configuration_error_message(),
            }
        except AIProviderError as exc:
            return {
                "provider": name,
                "configured": False,
                "model": None,
                "error": str(exc),
            }

    def _model_for(self, provider_name: str) -> str | None:
        if provider_name == "none":
            return "crm-template"
        if provider_name == "openai":
            return self.settings.openai_model
        if provider_name == "gemini":
            return self.settings.gemini_model
        return self.settings.claude_model


@lru_cache
def get_ai_provider_manager() -> AIProviderManager:
    return AIProviderManager()


async def ask_ai(
    system_prompt: str,
    user_prompt: str,
    *,
    max_tokens: int | None = None,
    timeout_seconds: float | None = None,
    provider_name: str | None = None,
    context: AICompletionContext | None = None,
) -> str:
    """Send prompts to the active AI provider and return assistant text."""
    manager = get_ai_provider_manager()
    provider = manager.get_provider(provider_name)

    if provider.name != "none" and not provider.is_configured():
        raise AIProviderError(
            provider.configuration_error_message(),
            provider=provider.name,
            code="not_configured",
        )

    return await provider.complete(
        system_prompt,
        user_prompt,
        max_tokens=max_tokens,
        timeout_seconds=timeout_seconds,
        context=context,
    )
