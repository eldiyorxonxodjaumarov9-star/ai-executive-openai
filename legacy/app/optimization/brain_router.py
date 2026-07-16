"""Brain file router for dynamic context optimization."""

from __future__ import annotations

from pathlib import Path

from app.brains.loader import BRAINS_DIR

_COMMON_OPTIONAL = ("communication_style.md",)
_COMMON_DECISION = ("decision_rules.md", "decision_framework.md")

_INTENT_BRAIN_MAP: dict[str, tuple[str, ...]] = {
    "kpi": ("kpis.md", "report_structure.md"),
    "risk": ("risk_analysis.md", "financial_risks.md", "forbidden_actions.md"),
    "forecast": ("forecast.md", "forecasting.md", "strategic_planning.md"),
    "finance": ("cashflow.md", "profitability.md", "investment_logic.md", "accounting_rules.md"),
    "sales_pipeline": ("pipeline.md", "lead_scoring.md", "conversion.md", "closing.md"),
    "hr_workload": ("workload.md", "employee_performance.md", "motivation.md", "recruitment.md"),
    "marketing_sources": ("lead_sources.md", "campaigns.md", "analytics.md", "roi.md"),
    "customer_retention": ("customer_retention.md", "customer_health.md", "renewals.md", "upsell.md"),
    "tasks": ("meeting_assistant.md", "workload.md", "support.md"),
    "deals": ("pipeline.md", "sales_strategy.md", "profitability.md"),
    "leads": ("lead_scoring.md", "conversion.md", "lead_sources.md"),
    "contacts": ("customer_journey.md", "support.md", "negotiation.md"),
    "strategy": ("strategic_planning.md", "business_logic.md", "recommendations.md"),
    "operations": ("business_logic.md", "report_structure.md", "training.md"),
    "general_summary": ("report_structure.md", "recommendations.md", "examples.md"),
    "unknown": ("report_structure.md", "examples.md"),
}


def _read_existing(agent_dir: Path, files: list[str]) -> tuple[list[str], str]:
    selected_files: list[str] = []
    sections: list[str] = []
    for filename in files:
        if filename in selected_files:
            continue
        path = agent_dir / filename
        if not path.is_file():
            continue
        content = path.read_text(encoding="utf-8").strip()
        if not content:
            continue
        selected_files.append(filename)
        sections.append(f"## Brain: {filename}\n\n{content}")
    return selected_files, "\n\n---\n\n".join(sections)


def load_brain_for_intent(agent_name: str, intent: str) -> tuple[list[str], str]:
    """Load only relevant brain files for the given agent + intent."""
    normalized = agent_name.strip().lower().replace("-", "_").replace(" ", "_")
    agent_dir = BRAINS_DIR / normalized
    if not agent_dir.is_dir():
        return [], "Insufficient information: Agent brain files not yet provisioned."

    requested: list[str] = ["identity.md"]
    requested.extend(_COMMON_DECISION)
    requested.extend(_COMMON_OPTIONAL)
    requested.extend(_INTENT_BRAIN_MAP.get(intent, _INTENT_BRAIN_MAP["unknown"]))
    requested.extend(("kpis.md", "report_structure.md"))

    return _read_existing(agent_dir, requested)
