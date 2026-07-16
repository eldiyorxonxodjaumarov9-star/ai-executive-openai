"""Short-lived in-memory CRM snapshot cache (per process)."""

from __future__ import annotations

import asyncio
import time
from typing import Any

from app.config import get_settings

_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_LOCK = asyncio.Lock()
DEFAULT_TTL_SECONDS = 90


def _cache_key() -> str:
    settings = get_settings()
    return (settings.bitrix24_webhook_url or "default").strip()


async def get_cached_crm() -> dict[str, Any] | None:
    """Return cached CRM payload if still fresh."""
    key = _cache_key()
    entry = _CACHE.get(key)
    if not entry:
        return None
    expires_at, payload = entry
    if time.monotonic() > expires_at:
        _CACHE.pop(key, None)
        return None
    return payload


async def set_cached_crm(payload: dict[str, Any], ttl_seconds: int = DEFAULT_TTL_SECONDS) -> None:
    """Store CRM payload in cache."""
    key = _cache_key()
    async with _LOCK:
        _CACHE[key] = (time.monotonic() + ttl_seconds, payload)


async def invalidate_crm_cache() -> None:
    """Clear CRM cache (e.g. after webhook change)."""
    async with _LOCK:
        _CACHE.clear()
