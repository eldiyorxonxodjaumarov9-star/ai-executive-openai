"""OpenAI Responses API service — primary LLM for AI Executive Platform."""

from __future__ import annotations

import asyncio
from typing import Any

from openai import APIError, APIStatusError, APITimeoutError, AsyncOpenAI, AuthenticationError

from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Transient HTTP statuses — safe to retry once.
_RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})


class OpenAIServiceError(Exception):
    """Raised when an OpenAI Responses API call fails."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "openai_error",
        status_code: int | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code


def _extract_output_text(response: Any) -> str:
    """Extract assistant text from a Responses API result."""
    output_text = getattr(response, "output_text", None)
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    parts: list[str] = []
    for item in getattr(response, "output", []) or []:
        if getattr(item, "type", None) != "message":
            continue
        for block in getattr(item, "content", []) or []:
            text = getattr(block, "text", None)
            if text:
                parts.append(str(text))
    return "\n".join(parts).strip()


async def ask_openai(
    instructions: str,
    user_input: str,
    *,
    max_output_tokens: int | None = None,
    timeout_seconds: float | None = None,
) -> str:
    """
    Send instructions + user input to OpenAI Responses API and return final text.

    Uses OPENAI_API_KEY and OPENAI_MODEL from environment.
    Never logs the API key.
    """
    settings = get_settings()
    api_key = (settings.openai_api_key or "").strip()
    if not api_key:
        raise OpenAIServiceError(
            "OpenAI API kaliti sozlanmagan — OPENAI_API_KEY ni tekshiring.",
            code="not_configured",
        )

    model = (settings.openai_model or "").strip()
    if not model:
        raise OpenAIServiceError(
            "OpenAI modeli sozlanmagan — OPENAI_MODEL ni tekshiring.",
            code="not_configured",
        )

    token_limit = max_output_tokens if max_output_tokens is not None else settings.openai_max_output_tokens
    wait_seconds = timeout_seconds if timeout_seconds is not None else settings.openai_timeout_seconds
    max_retries = max(0, settings.openai_max_retries)

    client = AsyncOpenAI(
        api_key=api_key,
        timeout=wait_seconds,
        max_retries=0,  # we handle retries explicitly
    )

    logger.info(
        "OpenAI Responses request | model=%s | max_output_tokens=%d | timeout=%.0fs | "
        "instructions_chars=%d | input_chars=%d",
        model,
        token_limit,
        wait_seconds,
        len(instructions),
        len(user_input),
    )

    last_error: Exception | None = None
    attempts = max_retries + 1

    for attempt in range(attempts):
        try:
            response = await asyncio.wait_for(
                client.responses.create(
                    model=model,
                    instructions=instructions,
                    input=user_input,
                    max_output_tokens=token_limit,
                ),
                timeout=wait_seconds + 5,
            )
            result = _extract_output_text(response)
            if not result:
                raise OpenAIServiceError(
                    "OpenAI bo'sh javob qaytardi.",
                    code="empty_response",
                )
            logger.info("OpenAI Responses success | response_chars=%d", len(result))
            return result

        except asyncio.TimeoutError as exc:
            last_error = exc
            logger.error("OpenAI request timeout after %.0fs", wait_seconds)
            raise OpenAIServiceError(
                "OpenAI javobi vaqti tugadi — qayta urinib ko'ring.",
                code="timeout",
            ) from exc

        except AuthenticationError as exc:
            logger.error("OpenAI authentication failed")
            raise OpenAIServiceError(
                "OpenAI API kaliti noto'g'ri — OPENAI_API_KEY ni tekshiring.",
                code="auth_error",
                status_code=401,
            ) from exc

        except APITimeoutError as exc:
            last_error = exc
            if attempt < attempts - 1:
                logger.warning("OpenAI timeout, retry %d/%d", attempt + 1, attempts)
                await asyncio.sleep(min(1.0 * (2**attempt), 4.0))
                continue
            raise OpenAIServiceError(
                "OpenAI javobi vaqti tugadi — qayta urinib ko'ring.",
                code="timeout",
            ) from exc

        except APIStatusError as exc:
            last_error = exc
            status = exc.status_code or 0
            if status in _RETRYABLE_STATUS and attempt < attempts - 1:
                logger.warning(
                    "OpenAI transient error status=%s, retry %d/%d",
                    status,
                    attempt + 1,
                    attempts,
                )
                await asyncio.sleep(min(1.0 * (2**attempt), 4.0))
                continue
            user_msg = _user_facing_api_error(status, getattr(exc, "message", str(exc)))
            raise OpenAIServiceError(user_msg, code="api_error", status_code=status) from exc

        except APIError as exc:
            last_error = exc
            raise OpenAIServiceError(
                "OpenAI so'rovi muvaffaqiyatsiz — keyinroq qayta urinib ko'ring.",
                code="api_error",
            ) from exc

        except OpenAIServiceError:
            raise

        except Exception as exc:
            last_error = exc
            logger.exception("OpenAI unexpected error")
            raise OpenAIServiceError(
                "OpenAI so'rovi muvaffaqiyatsiz — keyinroq qayta urinib ko'ring.",
                code="api_error",
            ) from exc

    raise OpenAIServiceError(
        "OpenAI so'rovi muvaffaqiyatsiz — keyinroq qayta urinib ko'ring.",
        code="api_error",
    ) from last_error


def _user_facing_api_error(status: int, raw: str) -> str:
    """Map API errors to Uzbek user-facing messages without leaking internals."""
    _ = raw  # never expose raw API payload to users
    if status == 429:
        return "OpenAI vaqtincha band — bir necha soniyadan keyin qayta urinib ko'ring."
    if status in {500, 502, 503, 504}:
        return "OpenAI vaqtincha javob bermadi — keyinroq qayta urinib ko'ring."
    if status == 401 or status == 403:
        return "OpenAI API kaliti noto'g'ri — OPENAI_API_KEY ni tekshiring."
    return "OpenAI javob bermadi — keyinroq qayta urinib ko'ring."


async def test_openai_connection() -> dict[str, Any]:
    """Minimal connectivity test — one short Uzbek response."""
    settings = get_settings()
    try:
        text = await ask_openai(
            instructions="Faqat o'zbek tilida javob ber.",
            user_input="Faqat quyidagini yoz: OpenAI muvaffaqiyatli ulandi",
            max_output_tokens=32,
            timeout_seconds=25,
        )
        return {
            "success": True,
            "provider": "openai",
            "model": settings.openai_model,
            "response": text,
        }
    except OpenAIServiceError as exc:
        return {
            "success": False,
            "provider": "openai",
            "model": settings.openai_model,
            "error": str(exc),
            "code": exc.code,
        }
