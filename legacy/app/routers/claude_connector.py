"""Claude.ai connector endpoints (manifest, instructions, health)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from app.connector.manifest import (
    build_connector_health,
    build_connector_instructions,
    build_connector_manifest,
)

router = APIRouter(prefix="/claude", tags=["Claude Connector"])


def _request_base_url(request: Request) -> str:
    settings_base = (get_settings_public_base_url() or "").strip()
    if settings_base:
        return settings_base.rstrip("/")
    return str(request.base_url).rstrip("/")


def get_settings_public_base_url() -> str | None:
    from app.config import get_settings

    return get_settings().public_base_url


@router.get("/health")
async def claude_connector_health() -> dict[str, Any]:
    """Connector health check (no secret required)."""
    return build_connector_health()


@router.get("/manifest")
async def claude_connector_manifest(request: Request) -> dict[str, Any]:
    """Return connector tool manifest for Claude.ai."""
    return build_connector_manifest(_request_base_url(request))


@router.get("/instructions")
async def claude_connector_instructions(request: Request) -> dict[str, Any]:
    """Return user-facing connector instructions for Claude."""
    return build_connector_instructions(_request_base_url(request))
