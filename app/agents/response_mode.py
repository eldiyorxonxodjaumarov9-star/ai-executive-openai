"""Detect quick Q&A vs full executive report from user question."""

from __future__ import annotations

from typing import Literal

ResponseMode = Literal["quick_answer", "full_report"]

_FULL_REPORT_KEYWORDS: tuple[str, ...] = (
    "to'liq hisobot",
    "to‘liq hisobot",
    "tolik hisobot",
    "batafsil tahlil",
    "umumiy holat",
    "barcha ma'lumot",
    "barcha malumot",
    "rahbar uchun hisobot",
    "keng tahlil",
)


def detect_response_mode(question: str | None) -> ResponseMode:
    """Return full_report only when user explicitly asks for a large report."""
    if not question or not question.strip():
        return "full_report"

    text = (
        question.lower()
        .replace("ʻ", "'")
        .replace("’", "'")
        .replace("`", "'")
    )
    for keyword in _FULL_REPORT_KEYWORDS:
        if keyword in text:
            return "full_report"
    return "quick_answer"
