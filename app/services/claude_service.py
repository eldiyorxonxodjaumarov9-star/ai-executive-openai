"""
Legacy Claude facade — disabled in normal chat flow.

Active chat uses OpenAI via app.services.openai_service.ask_openai().
Set AI_PROVIDER=claude to re-enable Anthropic through app.ai.ask_ai().
"""

from __future__ import annotations

from app.ai import AIProviderError, ask_ai
from app.ai.context import AICompletionContext

# Legacy alias used across routers and agents.
ClaudeServiceError = AIProviderError


async def ask_claude(
    system_prompt: str,
    user_prompt: str,
    *,
    max_tokens: int | None = None,
    timeout_seconds: float | None = None,
    context: AICompletionContext | None = None,
) -> str:
    """Legacy entry point — delegates to AI_PROVIDER (use ask_openai for OpenAI)."""
    return await ask_ai(
        system_prompt,
        user_prompt,
        max_tokens=max_tokens,
        timeout_seconds=timeout_seconds,
        context=context,
    )
