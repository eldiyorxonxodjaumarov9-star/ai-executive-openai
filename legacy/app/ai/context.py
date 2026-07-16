"""Structured context passed to AI providers (required for template/none mode)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Literal

if TYPE_CHECKING:
    from app.services.bitrix import Bitrix24Service

ChatMode = Literal["quick_answer", "full_report"]


@dataclass
class AICompletionContext:
    question: str | None = None
    crm_data: dict[str, Any] | None = None
    mode: ChatMode = "quick_answer"
    agent_name: str | None = None
    bitrix: Bitrix24Service | None = None
