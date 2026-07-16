"""Telegram Bot API integration service."""

from __future__ import annotations

from typing import Optional

import httpx

from app.config import Settings, get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

TELEGRAM_API_BASE = "https://api.telegram.org/bot{token}"
TELEGRAM_MAX_MESSAGE_LENGTH = 4096
TELEGRAM_SAFE_CHUNK_SIZE = 4000
TELEGRAM_TIMEOUT = httpx.Timeout(30.0, connect=10.0)


class TelegramError(Exception):
    """Raised when Telegram API returns an error."""

    def __init__(self, message: str, *, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class TelegramService:
    """Async client for Telegram Bot API."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self.enabled = self.settings.telegram_enabled
        if self.enabled:
            self._base_url = TELEGRAM_API_BASE.format(token=self.settings.telegram_bot_token)
            self.chat_id = self.settings.telegram_chat_id
        else:
            self._base_url = ""
            self.chat_id = ""
            logger.info("Telegram integration disabled (credentials not configured)")

    @staticmethod
    def split_message(text: str, max_length: int = TELEGRAM_SAFE_CHUNK_SIZE) -> list[str]:
        """Split long text into Telegram-safe chunks, preferring paragraph boundaries."""
        if len(text) <= max_length:
            return [text]

        chunks: list[str] = []
        remaining = text

        while remaining:
            if len(remaining) <= max_length:
                chunks.append(remaining)
                break

            split_at = remaining.rfind("\n\n", 0, max_length)
            if split_at == -1:
                split_at = remaining.rfind("\n", 0, max_length)
            if split_at == -1:
                split_at = remaining.rfind(" ", 0, max_length)
            if split_at == -1:
                split_at = max_length

            chunk = remaining[:split_at].rstrip()
            if not chunk:
                chunk = remaining[:max_length]
                split_at = max_length

            chunks.append(chunk)
            remaining = remaining[split_at:].lstrip()

        return chunks

    async def _send_raw(self, text: str, *, parse_mode: Optional[str] = None) -> dict:
        """Send a single message chunk."""
        payload: dict = {
            "chat_id": self.chat_id,
            "text": text,
            "disable_web_page_preview": True,
        }
        if parse_mode:
            payload["parse_mode"] = parse_mode

        try:
            async with httpx.AsyncClient(timeout=TELEGRAM_TIMEOUT) as client:
                response = await client.post(
                    f"{self._base_url}/sendMessage",
                    json=payload,
                )
        except httpx.RequestError as exc:
            logger.error("Telegram network error: %s", exc)
            raise TelegramError(f"Telegram network error: {exc}") from exc

        try:
            data = response.json()
        except ValueError as exc:
            raise TelegramError("Telegram returned invalid JSON") from exc

        if response.status_code >= 400 or not data.get("ok"):
            error_desc = data.get("description", response.text[:200])
            logger.error("Telegram API error: %s", error_desc)
            raise TelegramError(
                f"Telegram API error: {error_desc}",
                status_code=response.status_code,
            )

        return data

    async def send_message(
        self,
        text: str,
        *,
        parse_mode: Optional[str] = None,
    ) -> list[dict]:
        """
        Send a message to the configured chat.

        Automatically splits messages longer than Telegram's limit.
        Returns list of API responses (one per chunk).
        """
        if not text or not text.strip():
            raise TelegramError("Cannot send empty Telegram message")

        if not self.enabled:
            logger.info("Telegram disabled — message not sent")
            return []

        chunks = self.split_message(text.strip())
        responses: list[dict] = []

        logger.info("Sending Telegram message in %d chunk(s)", len(chunks))

        for index, chunk in enumerate(chunks, start=1):
            prefix = f"[{index}/{len(chunks)}]\n" if len(chunks) > 1 else ""
            try:
                result = await self._send_raw(prefix + chunk, parse_mode=parse_mode)
                responses.append(result)
            except TelegramError:
                if parse_mode:
                    logger.warning("Retrying chunk %d without parse_mode", index)
                    result = await self._send_raw(prefix + chunk, parse_mode=None)
                    responses.append(result)
                else:
                    raise

        return responses

    async def send_report(self, *, agent_name: str, report: str) -> list[dict]:
        """Send a formatted AI report to Telegram."""
        header = f"📊 {agent_name.upper()} HISOBOTI\n{'─' * 30}\n\n"
        return await self.send_message(header + report)
