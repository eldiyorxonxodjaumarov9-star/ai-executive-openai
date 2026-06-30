"""Agent runner: loads prompts, brain, knowledge base, Bitrix24 CRM data, calls Claude."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from app.brains.loader import get_brain_stats, load_agent_brain
from app.config import PROMPTS_DIR, VALID_AGENTS, Settings, get_settings
from app.knowledge.loader import load_agent_knowledge
from app.optimization.brain_router import load_brain_for_intent
from app.optimization.crm_router import fetch_crm_for_intent
from app.optimization.intent_analyzer import analyze_intent
from app.optimization.knowledge_router import load_knowledge_for_intent
from app.services.bitrix import Bitrix24Service
from app.services.claude_service import ClaudeServiceError, ask_claude
from app.services.telegram import TelegramService
from app.utils.logger import get_logger

logger = get_logger(__name__)
LAST_OPTIMIZATION_RUN: dict[str, Any] | None = None

AGENT_DISPLAY_NAMES = {
    "ceo": "CEO Agent",
    "sales": "Sales Agent",
    "finance": "Finance Agent",
    "marketing": "Marketing Agent",
    "customer_success": "Customer Success Agent",
    "hr": "HR Agent",
}


class AgentError(Exception):
    """Raised when agent execution fails."""


@dataclass
class AgentReportResult:
    """Result of a full agent report pipeline including optional Telegram delivery."""

    agent_name: str
    agent_display_name: str
    analysis: str
    crm_summary: dict[str, Any]
    telegram_sent: bool
    telegram_chunks: int = 0


@dataclass
class OptimizationTrace:
    agent_name: str
    intent: str
    selected_brain_files: list[str]
    selected_knowledge_files: list[str]
    selected_crm_entities: list[str]
    estimated_input_characters: int
    estimated_tokens: int
    optimization_enabled: bool
    timestamp: str


class AgentRunner:
    """Orchestrates Brain + Knowledge Base + Bitrix24 → Claude agent report pipeline."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        *,
        bitrix: Optional[Bitrix24Service] = None,
        telegram: Optional[TelegramService] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.bitrix = bitrix or Bitrix24Service(self.settings)
        self.telegram = telegram or TelegramService(self.settings)
        self.last_optimization_run: dict[str, Any] | None = LAST_OPTIMIZATION_RUN

    @staticmethod
    def normalize_agent_name(agent_name: str) -> str:
        """Normalize and validate agent identifier."""
        normalized = agent_name.strip().lower().replace("-", "_").replace(" ", "_")
        if normalized not in VALID_AGENTS:
            valid = ", ".join(sorted(VALID_AGENTS))
            raise AgentError(f"Unknown agent '{agent_name}'. Valid agents: {valid}")
        return normalized

    def load_prompt(self, agent_name: str) -> str:
        """Load system prompt from prompts/{agent_name}.md."""
        normalized = self.normalize_agent_name(agent_name)
        prompt_path = PROMPTS_DIR / f"{normalized}.md"

        if not prompt_path.is_file():
            raise AgentError(f"Prompt file not found: {prompt_path}")

        content = prompt_path.read_text(encoding="utf-8").strip()
        if not content:
            raise AgentError(f"Prompt file is empty: {prompt_path}")

        logger.info("Loaded system prompt | agent=%s | file=%s", normalized, prompt_path)
        return content

    @staticmethod
    def format_bitrix_crm_block(crm_data: dict[str, Any]) -> str:
        """Format Bitrix24 CRM payload as a structured data block."""
        summary = crm_data.get("summary", {})
        leads = crm_data.get("leads", [])
        deals = crm_data.get("deals", [])
        contacts = crm_data.get("contacts", [])
        tasks = crm_data.get("tasks", [])

        sections: list[str] = []
        if crm_data.get("fetched_at"):
            sections.append(f"Ma'lumot olingan vaqt: {crm_data['fetched_at']}")
            sections.append("")

        sections.extend(
            [
                "UMUMIY STATISTIKA:",
                json.dumps(summary, ensure_ascii=False, indent=2),
                "",
                f"LIDLAR ({len(leads)} ta):",
                json.dumps(leads, ensure_ascii=False, indent=2),
                "",
                f"BITIMLAR ({len(deals)} ta):",
                json.dumps(deals, ensure_ascii=False, indent=2),
                "",
                f"KONTAKTLAR ({len(contacts)} ta):",
                json.dumps(contacts, ensure_ascii=False, indent=2),
                "",
                f"VAZIFALAR ({len(tasks)} ta):",
                json.dumps(tasks, ensure_ascii=False, indent=2),
            ]
        )
        return "\n".join(sections)

    @staticmethod
    def format_bitrix_summary(crm_data: dict[str, Any]) -> str:
        """Normalize Bitrix24 CRM payload into a readable text summary for Claude."""
        return (
            "Quyidagi Bitrix24 CRM ma'lumotlarini tahlil qiling.\n\n"
            + AgentRunner.format_bitrix_crm_block(crm_data)
        )

    def build_system_prompt(self, agent_name: str) -> str:
        """
        Combine role system prompt with the agent's executive brain intelligence layer.

        Context order (system message):
        1. System prompt (prompts/{agent}.md)
        2. Agent brain (brains/{agent}/*.md)
        """
        normalized = self.normalize_agent_name(agent_name)
        role_prompt = self.load_prompt(normalized)
        brain = load_agent_brain(normalized)
        stats = get_brain_stats(normalized)
        logger.info(
            "System prompt assembled | agent=%s | brain_files=%d | brain_chars=%d",
            normalized,
            stats["files"],
            stats["chars"],
        )
        return (
            f"{role_prompt}\n\n"
            "=== AGENT BRAIN — EXECUTIVE INTELLIGENCE LAYER ===\n\n"
            f"{brain}"
        )

    def build_system_prompt_optimized(self, agent_name: str, intent: str) -> tuple[list[str], str]:
        """Build system prompt with a routed subset of brain files."""
        normalized = self.normalize_agent_name(agent_name)
        role_prompt = self.load_prompt(normalized)
        selected_files, brain = load_brain_for_intent(normalized, intent)
        return (
            selected_files,
            f"{role_prompt}\n\n=== AGENT BRAIN — EXECUTIVE INTELLIGENCE LAYER ===\n\n{brain}",
        )

    def build_user_context(
        self,
        agent_name: str,
        crm_data: dict[str, Any],
        *,
        question: Optional[str] = None,
    ) -> str:
        """
        Combine company knowledge, Bitrix24 data, and optional user question.

        Full pipeline context order:
        1. System prompt + brain (handled in build_system_prompt / ask_claude system)
        2. Company knowledge
        3. Bitrix24 CRM data
        4. User question (optional)
        """
        normalized = self.normalize_agent_name(agent_name)
        knowledge = load_agent_knowledge(normalized)
        bitrix_block = self.format_bitrix_crm_block(crm_data)

        sections = [
            "=== KOMPANIYA BILIM BAZASI ===",
            knowledge,
            "",
            "=== BITRIX24 CRM MA'LUMOTLARI ===",
            bitrix_block,
        ]

        if question and question.strip():
            sections.extend(
                [
                    "",
                    "=== FOYDALANUVCHI SAVOLI ===",
                    question.strip(),
                    "",
                    "Yuqoridagi kompaniya bilim bazasi va Bitrix24 ma'lumotlariga tayangan holda "
                    "foydalanuvchi savoliga agent rolingizga mos professional javob bering.",
                ]
            )
        else:
            sections.extend(
                [
                    "",
                    "Yuqoridagi kompaniya bilim bazasi va Bitrix24 ma'lumotlariga tayangan holda "
                    "agent rolingizga mos to'liq hisobot tayyorlang.",
                ]
            )

        return "\n".join(sections)

    def build_user_context_optimized(
        self,
        agent_name: str,
        crm_data: dict[str, Any],
        knowledge_text: str,
        *,
        question: Optional[str] = None,
    ) -> str:
        """Build user context using routed knowledge + routed CRM entities."""
        normalized = self.normalize_agent_name(agent_name)
        _ = normalized
        bitrix_block = self.format_bitrix_crm_block(crm_data)
        sections = [
            "=== KOMPANIYA BILIM BAZASI (OPTIMIZED) ===",
            knowledge_text,
            "",
            "=== BITRIX24 CRM MA'LUMOTLARI (OPTIMIZED) ===",
            bitrix_block,
        ]
        if question and question.strip():
            sections.extend(
                [
                    "",
                    "=== FOYDALANUVCHI SAVOLI ===",
                    question.strip(),
                    "",
                    "Yuqoridagi tanlangan bilim bazasi va CRM ma'lumotlariga tayangan holda javob bering.",
                ]
            )
        return "\n".join(sections)

    async def _generate_analysis(
        self,
        agent_name: str,
        crm_data: dict[str, Any],
        *,
        question: Optional[str] = None,
    ) -> str:
        """Send system prompt + brain + knowledge + CRM data (+ question) to Claude."""
        normalized = self.normalize_agent_name(agent_name)
        system_prompt = self.build_system_prompt(normalized)
        user_prompt = self.build_user_context(
            normalized,
            crm_data,
            question=question,
        )

        logger.info(
            "Calling Claude | agent=%s | crm_summary=%s | has_question=%s",
            normalized,
            crm_data.get("summary", {}),
            bool(question and question.strip()),
        )

        try:
            return await ask_claude(
                system_prompt,
                user_prompt,
                max_tokens=self.settings.claude_max_tokens,
            )
        except ClaudeServiceError as exc:
            logger.error("Claude failed for agent=%s: %s", normalized, exc)
            raise AgentError(str(exc)) from exc

    async def _generate_analysis_optimized(
        self,
        agent_name: str,
        *,
        question: Optional[str] = None,
    ) -> str:
        """Optimized path: route context dynamically before calling Claude."""
        normalized = self.normalize_agent_name(agent_name)
        intent_result = analyze_intent(question)
        selected_brain_files, system_prompt = self.build_system_prompt_optimized(
            normalized, intent_result.intent
        )
        selected_knowledge_files, knowledge_text = load_knowledge_for_intent(
            normalized, intent_result.intent
        )
        selected_crm_entities, crm_data = await fetch_crm_for_intent(
            self.bitrix, intent_result.intent
        )
        user_prompt = self.build_user_context_optimized(
            normalized,
            crm_data,
            knowledge_text,
            question=question,
        )
        estimated_chars = len(system_prompt) + len(user_prompt)
        estimated_tokens = max(1, estimated_chars // 4)
        trace = OptimizationTrace(
            agent_name=normalized,
            intent=intent_result.intent,
            selected_brain_files=selected_brain_files,
            selected_knowledge_files=selected_knowledge_files,
            selected_crm_entities=selected_crm_entities,
            estimated_input_characters=estimated_chars,
            estimated_tokens=estimated_tokens,
            optimization_enabled=True,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        global LAST_OPTIMIZATION_RUN
        self.last_optimization_run = trace.__dict__
        LAST_OPTIMIZATION_RUN = trace.__dict__
        logger.info(
            "Optimization trace | agent=%s | intent=%s | brain=%s | knowledge=%s | crm=%s | chars=%d | tokens=%d | optimized=%s",
            trace.agent_name,
            trace.intent,
            trace.selected_brain_files,
            trace.selected_knowledge_files,
            trace.selected_crm_entities,
            trace.estimated_input_characters,
            trace.estimated_tokens,
            trace.optimization_enabled,
        )
        try:
            return await ask_claude(
                system_prompt,
                user_prompt,
                max_tokens=self.settings.claude_max_tokens,
            )
        except ClaudeServiceError as exc:
            logger.warning(
                "Optimized mode failed, falling back to full context | agent=%s | error=%s",
                normalized,
                exc,
            )
            full_crm = await self.bitrix.fetch_all_crm_data()
            return await self._generate_analysis(
                normalized,
                full_crm,
                question=question,
            )

    async def run_agent_report(
        self,
        agent_name: str,
        *,
        question: Optional[str] = None,
        optimized: bool = True,
    ) -> str:
        """
        Run an agent report:
        1. Validate agent name and load system prompt + brain
        2. Load company knowledge files
        3. Fetch Bitrix24 CRM data
        4. Combine context and call Claude
        5. Return AI analysis text
        """
        normalized = self.normalize_agent_name(agent_name)
        logger.info(
            "Running agent report | agent=%s | has_question=%s",
            normalized,
            bool(question and question.strip()),
        )

        if optimized:
            try:
                analysis = await self._generate_analysis_optimized(
                    normalized,
                    question=question,
                )
            except Exception as exc:
                logger.warning(
                    "Optimizer failed, using full context fallback | agent=%s | error=%s",
                    normalized,
                    exc,
                )
                crm_data = await self.bitrix.fetch_all_crm_data()
                analysis = await self._generate_analysis(
                    normalized,
                    crm_data,
                    question=question,
                )
        else:
            crm_data = await self.bitrix.fetch_all_crm_data()
            analysis = await self._generate_analysis(
                normalized,
                crm_data,
                question=question,
            )

        logger.info(
            "Agent report completed | agent=%s | report_chars=%d",
            normalized,
            len(analysis),
        )
        return analysis

    async def run_agent(
        self,
        agent_name: str,
        *,
        crm_data: Optional[dict[str, Any]] = None,
        send_telegram: bool = True,
        question: Optional[str] = None,
        optimized: bool = True,
    ) -> AgentReportResult:
        """Execute agent report and optionally deliver to Telegram."""
        normalized = self.normalize_agent_name(agent_name)
        display_name = AGENT_DISPLAY_NAMES.get(normalized, normalized)

        if optimized:
            try:
                analysis = await self._generate_analysis_optimized(
                    normalized,
                    question=question,
                )
                if crm_data is None:
                    crm_data = {"summary": {}}
            except Exception as exc:
                logger.warning(
                    "Optimizer failed, using full context fallback | agent=%s | error=%s",
                    normalized,
                    exc,
                )
                if crm_data is None:
                    crm_data = await self.bitrix.fetch_all_crm_data()
                analysis = await self._generate_analysis(
                    normalized,
                    crm_data,
                    question=question,
                )
        else:
            if crm_data is None:
                crm_data = await self.bitrix.fetch_all_crm_data()
            analysis = await self._generate_analysis(
                normalized,
                crm_data,
                question=question,
            )

        telegram_sent = False
        telegram_chunks = 0

        if send_telegram and self.settings.telegram_enabled:
            responses = await self.telegram.send_report(
                agent_name=display_name,
                report=analysis,
            )
            telegram_sent = True
            telegram_chunks = len(responses)
        elif send_telegram:
            logger.info("Telegram send skipped — integration disabled")

        return AgentReportResult(
            agent_name=normalized,
            agent_display_name=display_name,
            analysis=analysis,
            crm_summary=crm_data.get("summary", {}),
            telegram_sent=telegram_sent,
            telegram_chunks=telegram_chunks,
        )

    async def run_daily_report(self) -> AgentReportResult:
        """Run the configured daily report agent."""
        agent = self.settings.daily_report_agent
        logger.info("Executing daily report with agent=%s", agent)
        return await self.run_agent(agent, send_telegram=True)

    def list_agents(self) -> list[dict[str, str | int | bool]]:
        """Return available agents with prompt and brain metadata."""
        agents = []
        for name in sorted(VALID_AGENTS):
            prompt_file = PROMPTS_DIR / f"{name}.md"
            brain_stats = get_brain_stats(name)
            agents.append(
                {
                    "name": name,
                    "display_name": AGENT_DISPLAY_NAMES.get(name, name),
                    "prompt_file": str(prompt_file),
                    "prompt_exists": prompt_file.is_file(),
                    "brain_files": brain_stats["files"],
                    "brain_chars": brain_stats["chars"],
                }
            )
        return agents

    def get_optimization_status(self) -> dict[str, Any]:
        """Return optimization status and latest trace."""
        return {"enabled": True, "last_run": self.last_optimization_run}
