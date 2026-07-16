"""AI provider interface and shared errors."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from app.ai.context import AICompletionContext

if TYPE_CHECKING:
    from app.config import Settings


class AIProviderError(Exception):
    """Raised when an AI provider call fails or is misconfigured."""

    def __init__(
        self,
        message: str,
        *,
        provider: str = "",
        code: str = "ai_error",
    ) -> None:
        super().__init__(message)
        self.provider = provider
        self.code = code


class AIProvider(ABC):
    """Contract for OpenAI, Claude, and Gemini backends."""

    name: str

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @abstractmethod
    def is_configured(self) -> bool:
        """Return True when required credentials are present."""

    @abstractmethod
    def configuration_error_message(self) -> str:
        """User-facing Uzbek message when provider is not configured."""

    @abstractmethod
    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        max_tokens: int | None = None,
        timeout_seconds: float | None = None,
        context: AICompletionContext | None = None,
    ) -> str:
        """Generate assistant text from system + user prompts."""
