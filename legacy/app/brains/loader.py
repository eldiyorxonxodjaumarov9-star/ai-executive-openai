"""Agent Brain intelligence layer loader."""

from __future__ import annotations

from pathlib import Path

from functools import lru_cache

from app.config import VALID_AGENTS
from app.utils.logger import get_logger

logger = get_logger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BRAINS_DIR = PROJECT_ROOT / "brains"

# Preferred load order: identity and reasoning first, then domain expertise.
BRAIN_LOAD_ORDER: dict[str, list[str]] = {
    "ceo": [
        "identity.md",
        "thinking_framework.md",
        "decision_rules.md",
        "business_logic.md",
        "kpis.md",
        "risk_analysis.md",
        "forecasting.md",
        "strategic_planning.md",
        "executive_questions.md",
        "recommendations.md",
        "meeting_assistant.md",
        "report_structure.md",
        "communication_style.md",
        "forbidden_actions.md",
        "memory.md",
        "examples.md",
    ],
    "finance": [
        "identity.md",
        "thinking_framework.md",
        "decision_rules.md",
        "cashflow.md",
        "forecast.md",
        "accounting_rules.md",
        "financial_risks.md",
        "investment_logic.md",
        "profitability.md",
        "kpis.md",
        "report_structure.md",
        "forbidden_actions.md",
        "examples.md",
    ],
    "sales": [
        "identity.md",
        "thinking_framework.md",
        "decision_rules.md",
        "lead_scoring.md",
        "pipeline.md",
        "sales_strategy.md",
        "negotiation.md",
        "conversion.md",
        "forecast.md",
        "closing.md",
        "objections.md",
        "kpis.md",
        "report_structure.md",
        "forbidden_actions.md",
        "examples.md",
    ],
    "hr": [
        "identity.md",
        "thinking_framework.md",
        "decision_rules.md",
        "employee_performance.md",
        "motivation.md",
        "workload.md",
        "recruitment.md",
        "career_growth.md",
        "conflict_resolution.md",
        "training.md",
        "kpis.md",
        "report_structure.md",
        "forbidden_actions.md",
        "examples.md",
    ],
    "marketing": [
        "identity.md",
        "thinking_framework.md",
        "decision_rules.md",
        "campaigns.md",
        "lead_sources.md",
        "roi.md",
        "advertising.md",
        "branding.md",
        "content_strategy.md",
        "analytics.md",
        "kpis.md",
        "report_structure.md",
        "forbidden_actions.md",
        "examples.md",
    ],
    "customer_success": [
        "identity.md",
        "thinking_framework.md",
        "decision_rules.md",
        "customer_health.md",
        "customer_retention.md",
        "upsell.md",
        "cross_sell.md",
        "support.md",
        "customer_journey.md",
        "complaints.md",
        "renewals.md",
        "kpis.md",
        "report_structure.md",
        "forbidden_actions.md",
        "examples.md",
    ],
}


def list_brain_files(agent_name: str) -> list[str]:
    """Return ordered brain filenames for an agent, including any extra files on disk."""
    normalized = agent_name.strip().lower().replace("-", "_").replace(" ", "_")
    if normalized not in VALID_AGENTS:
        raise ValueError(f"Unknown agent for brain loading: {agent_name}")

    agent_dir = BRAINS_DIR / normalized
    preferred = BRAIN_LOAD_ORDER.get(normalized, [])
    if not agent_dir.is_dir():
        return preferred

    on_disk = sorted(f.name for f in agent_dir.glob("*.md"))
    ordered = [f for f in preferred if f in on_disk]
    ordered.extend(f for f in on_disk if f not in ordered)
    return ordered


@lru_cache(maxsize=16)
def load_agent_brain(agent_name: str) -> str:
    """Load all brain markdown files for an agent in intelligence-layer order (cached)."""
    return _load_agent_brain_uncached(agent_name)


def _load_agent_brain_uncached(agent_name: str) -> str:
    normalized = agent_name.strip().lower().replace("-", "_").replace(" ", "_")
    if normalized not in VALID_AGENTS:
        raise ValueError(f"Unknown agent for brain loading: {agent_name}")

    agent_dir = BRAINS_DIR / normalized
    filenames = list_brain_files(normalized)
    sections: list[str] = []

    logger.info("Loading agent brain | agent=%s | dir=%s", normalized, agent_dir)

    if not agent_dir.is_dir():
        logger.warning("Brain directory missing | agent=%s", normalized)
        return "Insufficient information: Agent brain files not yet provisioned."

    loaded_count = 0
    for filename in filenames:
        path = agent_dir / filename
        if not path.is_file():
            logger.warning("Brain file missing | agent=%s | file=%s", normalized, filename)
            continue
        content = path.read_text(encoding="utf-8").strip()
        if not content:
            continue
        sections.append(f"## Brain: {filename}\n\n{content}")
        loaded_count += 1

    combined = "\n\n---\n\n".join(sections)
    logger.info(
        "Agent brain loaded | agent=%s | files=%d | chars=%d",
        normalized,
        loaded_count,
        len(combined),
    )
    return combined


def get_brain_stats(agent_name: str) -> dict:
    """Return brain file count and character totals for validation."""
    normalized = agent_name.strip().lower().replace("-", "_").replace(" ", "_")
    agent_dir = BRAINS_DIR / normalized
    files = list_brain_files(normalized)
    total_chars = 0
    loaded = 0
    for filename in files:
        path = agent_dir / filename
        if path.is_file():
            total_chars += len(path.read_text(encoding="utf-8"))
            loaded += 1
    return {"agent": normalized, "files": loaded, "chars": total_chars}
