"""CRM entity router for dynamic context optimization."""

from __future__ import annotations

from datetime import datetime, timezone
import asyncio
from typing import Any

from app.services.bitrix import Bitrix24Service

_INTENT_ENTITIES: dict[str, tuple[str, ...]] = {
    "leads": ("leads",),
    "deals": ("deals",),
    "finance": ("deals", "leads"),
    "forecast": ("deals", "leads"),
    "sales_pipeline": ("deals", "leads"),
    "hr_workload": ("tasks",),
    "tasks": ("tasks",),
    "customer_retention": ("contacts", "deals", "leads"),
    "contacts": ("contacts",),
    "marketing_sources": ("leads", "contacts"),
    "general_summary": ("leads", "deals", "tasks"),
    "strategy": ("deals", "leads", "tasks"),
    "operations": ("deals", "tasks"),
    "kpi": ("deals", "leads", "tasks"),
    "risk": ("deals", "tasks"),
    "unknown": ("leads", "deals", "tasks"),
}


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


async def fetch_crm_for_intent(bitrix: Bitrix24Service, intent: str) -> tuple[list[str], dict[str, Any]]:
    """Fetch only required CRM entities according to intent."""
    entities = list(_INTENT_ENTITIES.get(intent, _INTENT_ENTITIES["unknown"]))
    payload: dict[str, Any] = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "leads": [],
        "deals": [],
        "contacts": [],
        "tasks": [],
    }

    fetchers = {
        "leads": bitrix.fetch_leads,
        "deals": bitrix.fetch_deals,
        "contacts": bitrix.fetch_contacts,
        "tasks": bitrix.fetch_tasks,
    }
    results = await asyncio.gather(*(fetchers[name]() for name in entities))
    for name, result in zip(entities, results):
        payload[name] = result

    payload["summary"] = _summary(payload)
    return entities, payload
