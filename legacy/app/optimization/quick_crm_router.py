"""Minimal CRM fetch for quick_answer mode — only entities relevant to the question."""

from __future__ import annotations

from datetime import datetime, timezone
import asyncio
from typing import Any

from app.services.bitrix import Bitrix24Service

_QUICK_MAX_ITEMS = 12

_ENTITY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "deals": (
        "sotuv",
        "bitim",
        "narx",
        "qancha sotuv",
        "bugun sotuv",
        "savdo",
        "konversiya",
        "voronka",
        "pipeline",
    ),
    "tasks": (
        "vazifa",
        "kim nima qildi",
        "xodim",
        "ishchi",
        "ishchilar",
        "bajarildi",
        "deadline",
    ),
    "leads": ("lid", "so'rov", "so‘rov", "yangi mijoz", "lead"),
    "contacts": ("mijoz", "kontakt", "aloqa", "contact"),
}


def _normalize_text(question: str) -> str:
    return (
        question.lower()
        .replace("ʻ", "'")
        .replace("’", "'")
    )


def detect_quick_crm_entities(question: str | None) -> tuple[str, ...]:
    """Pick CRM entities for quick mode; summary-only when question is generic."""
    if not question or not question.strip():
        return ("summary",)

    text = _normalize_text(question)
    selected: list[str] = []

    if any(k in text for k in _ENTITY_KEYWORDS["deals"]):
        selected.append("deals")
    if any(k in text for k in _ENTITY_KEYWORDS["tasks"]):
        selected.append("tasks")
    if any(k in text for k in _ENTITY_KEYWORDS["leads"]):
        selected.append("leads")
    if any(k in text for k in _ENTITY_KEYWORDS["contacts"]):
        selected.append("contacts")

    if "mijoz" in text or "lid" in text:
        if "leads" not in selected:
            selected.append("leads")
        if "contacts" not in selected:
            selected.append("contacts")

    if not selected:
        return ("summary",)

    return tuple(dict.fromkeys(selected))


def _summary(crm_data: dict[str, Any]) -> dict[str, Any]:
    leads = crm_data.get("leads", [])
    deals = crm_data.get("deals", [])
    contacts = crm_data.get("contacts", [])
    tasks = crm_data.get("tasks", [])
    return {
        "leads_count": len(leads),
        "deals_count": len(deals),
        "contacts_count": len(contacts),
        "tasks_count": len(tasks),
        "total_opportunity": sum(float(d.get("OPPORTUNITY", 0) or 0) for d in deals),
    }


async def fetch_crm_for_quick(
    bitrix: Bitrix24Service,
    question: str | None,
) -> tuple[list[str], dict[str, Any]]:
    """Fetch only the CRM slices needed for a quick answer."""
    entities = list(detect_quick_crm_entities(question))
    payload: dict[str, Any] = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "leads": [],
        "deals": [],
        "contacts": [],
        "tasks": [],
        "mode": "quick",
    }

    if entities == ["summary"]:
        leads, deals, tasks = await asyncio.gather(
            bitrix.fetch_leads(),
            bitrix.fetch_deals(),
            bitrix.fetch_tasks(),
        )
        payload["leads"] = leads[:5]
        payload["deals"] = deals[:5]
        payload["tasks"] = tasks[:5]
        payload["summary"] = _summary(
            {
                "leads": leads,
                "deals": deals,
                "contacts": [],
                "tasks": tasks,
            }
        )
        return ["summary"], payload

    fetchers = {
        "leads": bitrix.fetch_leads,
        "deals": bitrix.fetch_deals,
        "contacts": bitrix.fetch_contacts,
        "tasks": bitrix.fetch_tasks,
    }
    results = await asyncio.gather(*(fetchers[name]() for name in entities if name in fetchers))
    for name, result in zip([n for n in entities if n in fetchers], results):
        payload[name] = result[:_QUICK_MAX_ITEMS]

    payload["summary"] = _summary(payload)
    return entities, payload
