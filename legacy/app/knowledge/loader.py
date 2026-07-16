"""Company knowledge base loader for AI agents."""

from __future__ import annotations

from pathlib import Path

from app.config import VALID_AGENTS
from app.utils.logger import get_logger

logger = get_logger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
KNOWLEDGE_DIR = PROJECT_ROOT / "knowledge"

KNOWLEDGE_FILES = (
    "knowledge.md",
    "kpi.md",
    "rules.md",
    "faq.md",
    "examples.md",
)

PLACEHOLDER = "Client will provide this information."


def load_agent_knowledge(agent_name: str) -> str:
    """
    Load all knowledge files for an agent and combine into one text block.

    Files are read from knowledge/{agent_name}/ in a fixed order.
    Missing or empty files are included with a placeholder note.
    """
    normalized = agent_name.strip().lower().replace("-", "_").replace(" ", "_")
    if normalized not in VALID_AGENTS:
        raise ValueError(f"Unknown agent for knowledge loading: {agent_name}")

    agent_dir = KNOWLEDGE_DIR / normalized
    sections: list[str] = []

    logger.info("Loading knowledge base | agent=%s | dir=%s", normalized, agent_dir)

    for filename in KNOWLEDGE_FILES:
        file_path = agent_dir / filename
        header = f"### {filename}"

        if file_path.is_file():
            content = file_path.read_text(encoding="utf-8").strip()
            body = content if content else PLACEHOLDER
        else:
            body = PLACEHOLDER
            logger.warning("Knowledge file missing | agent=%s | file=%s", normalized, filename)

        sections.append(f"{header}\n{body}")

    combined = "\n\n".join(sections)
    logger.info(
        "Knowledge base loaded | agent=%s | files=%d | chars=%d",
        normalized,
        len(KNOWLEDGE_FILES),
        len(combined),
    )
    return combined


def list_knowledge_agents() -> list[str]:
    """Return agent names that have a knowledge directory."""
    if not KNOWLEDGE_DIR.is_dir():
        return []
    return sorted(
        folder.name
        for folder in KNOWLEDGE_DIR.iterdir()
        if folder.is_dir() and folder.name in VALID_AGENTS
    )
