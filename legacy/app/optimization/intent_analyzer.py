"""Keyword-based intent analyzer for optimized context routing."""

from __future__ import annotations

from dataclasses import dataclass

INTENTS = {
    "general_summary",
    "kpi",
    "risk",
    "forecast",
    "finance",
    "sales_pipeline",
    "hr_workload",
    "marketing_sources",
    "customer_retention",
    "tasks",
    "deals",
    "leads",
    "contacts",
    "strategy",
    "operations",
    "unknown",
}


@dataclass(frozen=True)
class IntentResult:
    intent: str
    matched_keywords: list[str]


_KEYWORD_MAP: dict[str, tuple[str, ...]] = {
    "kpi": ("kpi", "ko'rsatkich", "indikator", "metric", "metrics"),
    "risk": ("risk", "xavf", "muammo", "problem", "issue"),
    "forecast": ("forecast", "prognoz", "bashorat", "prediction"),
    "finance": ("finance", "moliya", "cash", "pul oqimi", "profit", "marja"),
    "sales_pipeline": ("pipeline", "voronka", "savdo", "conversion", "close rate"),
    "hr_workload": ("hr", "xodim", "yuklama", "workload", "burnout", "recruitment"),
    "marketing_sources": ("marketing", "source", "lead source", "campaign", "reklama"),
    "customer_retention": ("retention", "renewal", "churn", "customer success", "upsell"),
    "tasks": ("task", "vazifa", "todo", "deadline"),
    "deals": ("deal", "bitim", "opportunity", "stage"),
    "leads": ("lead", "lid", "mijoz"),
    "contacts": ("contact", "kontakt", "aloqa"),
    "strategy": ("strategy", "strategik", "yo'nalish", "roadmap"),
    "operations": ("operations", "operatsion", "jarayon", "process"),
    "general_summary": ("xulosa", "summary", "umumiy", "overview"),
}


def analyze_intent(question: str | None) -> IntentResult:
    """Detect intent using deterministic keyword rules only."""
    if not question or not question.strip():
        return IntentResult(intent="general_summary", matched_keywords=[])

    text = question.lower()
    matches: list[tuple[str, str]] = []
    for intent, keywords in _KEYWORD_MAP.items():
        for keyword in keywords:
            if keyword in text:
                matches.append((intent, keyword))

    if not matches:
        return IntentResult(intent="unknown", matched_keywords=[])

    # Keep first detected intent by map order to stay deterministic.
    selected_intent = matches[0][0]
    selected_keywords = [kw for i, kw in matches if i == selected_intent]
    return IntentResult(intent=selected_intent, matched_keywords=selected_keywords)
