"""Knowledge file router for dynamic context optimization."""

from __future__ import annotations

from pathlib import Path

from app.knowledge.loader import KNOWLEDGE_DIR

_INTENT_KNOWLEDGE_PRIORITY: dict[str, tuple[str, ...]] = {
    "kpi": ("kpi.md", "knowledge.md", "rules.md"),
    "risk": ("rules.md", "faq.md", "knowledge.md"),
    "forecast": ("kpi.md", "knowledge.md", "faq.md"),
    "finance": ("knowledge.md", "kpi.md", "rules.md"),
    "sales_pipeline": ("knowledge.md", "faq.md", "examples.md"),
    "hr_workload": ("knowledge.md", "rules.md", "kpi.md"),
    "marketing_sources": ("knowledge.md", "kpi.md", "examples.md"),
    "customer_retention": ("knowledge.md", "kpi.md", "faq.md"),
    "tasks": ("rules.md", "knowledge.md", "faq.md"),
    "deals": ("knowledge.md", "kpi.md", "faq.md"),
    "leads": ("knowledge.md", "examples.md", "faq.md"),
    "contacts": ("knowledge.md", "faq.md", "examples.md"),
    "strategy": ("knowledge.md", "rules.md", "kpi.md"),
    "operations": ("rules.md", "knowledge.md", "faq.md"),
    "general_summary": ("knowledge.md", "rules.md", "kpi.md"),
    "unknown": ("knowledge.md", "rules.md", "faq.md"),
}


def load_knowledge_for_intent(agent_name: str, intent: str) -> tuple[list[str], str]:
    """Load 3-5 targeted knowledge files based on intent."""
    normalized = agent_name.strip().lower().replace("-", "_").replace(" ", "_")
    agent_dir = KNOWLEDGE_DIR / normalized
    if not agent_dir.is_dir():
        return [], "Insufficient information: Agent knowledge files not yet provisioned."

    prioritized = list(_INTENT_KNOWLEDGE_PRIORITY.get(intent, _INTENT_KNOWLEDGE_PRIORITY["unknown"]))

    # Add useful fallback files without reading all knowledge files.
    for fallback in ("examples.md", "faq.md"):
        if fallback not in prioritized:
            prioritized.append(fallback)

    selected_files: list[str] = []
    sections: list[str] = []
    for filename in prioritized:
        if len(selected_files) >= 5:
            break
        path = agent_dir / filename
        if not path.is_file():
            continue
        content = path.read_text(encoding="utf-8").strip()
        if not content:
            continue
        selected_files.append(filename)
        sections.append(f"### {filename}\n{content}")

    # Keep at least 3 files when available on disk.
    if len(selected_files) < 3:
        for path in sorted(agent_dir.glob("*.md")):
            if len(selected_files) >= 3:
                break
            if path.name in selected_files:
                continue
            content = path.read_text(encoding="utf-8").strip()
            if not content:
                continue
            selected_files.append(path.name)
            sections.append(f"### {path.name}\n{content}")

    return selected_files, "\n\n".join(sections)
