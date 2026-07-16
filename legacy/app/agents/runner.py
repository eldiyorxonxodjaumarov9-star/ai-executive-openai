"""Agent runner: loads prompts, brain, knowledge base, Bitrix24 CRM data, calls OpenAI."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from app.agents.language_policy import USER_OUTPUT_INSTRUCTION, wrap_system_prompt
from app.brains.loader import get_brain_stats, load_agent_brain
from app.config import PROMPTS_DIR, VALID_AGENTS, Settings, get_settings
from app.knowledge.loader import load_agent_knowledge
from app.optimization.brain_router import load_brain_for_intent
from app.optimization.crm_router import fetch_crm_for_intent
from app.optimization.intent_analyzer import analyze_intent
from app.optimization.knowledge_router import load_knowledge_for_intent
from app.optimization.quick_crm_router import fetch_crm_for_quick
from app.services.bitrix import Bitrix24Service
from app.agents.response_mode import detect_response_mode
from app.ai import AIProviderError, ask_ai
from app.ai.context import AICompletionContext
from app.services.openai_service import OpenAIServiceError, ask_openai
from app.services.telegram import TelegramService
from app.utils.logger import get_logger
from app.utils.uzbek_output import sanitize_user_output

logger = get_logger(__name__)
LAST_OPTIMIZATION_RUN: dict[str, Any] | None = None

QUICK_ANSWER_INSTRUCTION = (
    "Foydalanuvchi savoliga faqat kerakli ma'lumot asosida qisqa, aniq va o'zbek tilida javob ber. "
    "Javob odatda 2–8 jumladan iborat bo'lsin. Katta hisobot yozma. Keraksiz bo'limlar ochma. "
    "Jadval, uzun ro'yxat va keng risk tahlilini faqat savol aniq talab qilsa ishlat. "
    "Ichki CRM kodlarini (STAGE_ID, STATUS_ID va h.k.) ko'rsatma — faqat o'zbekcha tushunarli nomlar. "
    "Inglizcha va ruscha so'z ishlatma. "
    "Agar ma'lumot yetarli bo'lmasa, quyidagicha yoz: "
    "'Bu savolga aniq javob berish uchun CRMda yetarli ma'lumot topilmadi.'"
)

AGENT_DISPLAY_NAMES = {
    "ceo": "Bosh direktor agenti",
    "sales": "Sotuv agenti",
    "finance": "Moliya agenti",
    "marketing": "Marketing agenti",
    "customer_success": "Mijozlar muvaffaqiyati agenti",
    "hr": "Kadrlar agenti",
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
    """Orchestrates Brain + Knowledge Base + Bitrix24 → AI agent report pipeline."""

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
        self.last_crm_data: dict[str, Any] | None = None

    def _build_ai_context(
        self,
        *,
        agent_name: str,
        crm_data: dict[str, Any],
        question: str | None = None,
        mode: str | None = None,
    ) -> AICompletionContext:
        q = (question or "").strip()
        return AICompletionContext(
            question=q or None,
            crm_data=crm_data,
            mode=mode or detect_response_mode(q),  # type: ignore[arg-type]
            agent_name=agent_name,
            bitrix=self.bitrix,
        )

    async def _call_llm(
        self,
        instructions: str,
        user_input: str,
        *,
        max_output_tokens: int | None = None,
        timeout_seconds: float | None = None,
        context: AICompletionContext | None = None,
    ) -> str:
        """Route LLM calls by AI_PROVIDER — OpenAI path never touches Claude."""
        provider = self.settings.ai_provider.strip().lower()

        if provider == "openai":
            try:
                return await ask_openai(
                    instructions,
                    user_input,
                    max_output_tokens=max_output_tokens,
                    timeout_seconds=timeout_seconds,
                )
            except OpenAIServiceError as exc:
                raise AgentError(str(exc)) from exc

        if provider == "claude":
            from app.services.claude_service import ask_claude

            try:
                return await ask_claude(
                    instructions,
                    user_input,
                    max_tokens=max_output_tokens,
                    timeout_seconds=timeout_seconds,
                    context=context,
                )
            except AIProviderError as exc:
                raise AgentError(str(exc)) from exc

        try:
            return await ask_ai(
                instructions,
                user_input,
                max_tokens=max_output_tokens,
                timeout_seconds=timeout_seconds,
                context=context,
            )
        except AIProviderError as exc:
            raise AgentError(str(exc)) from exc

    def _quick_llm_limits(self) -> tuple[int, float]:
        if self.settings.ai_provider.strip().lower() == "openai":
            return (
                self.settings.openai_quick_max_output_tokens,
                self.settings.openai_quick_timeout_seconds,
            )
        return (
            self.settings.claude_quick_max_tokens,
            self.settings.claude_quick_timeout_seconds,
        )

    def _full_report_llm_limits(self) -> tuple[int, float]:
        if self.settings.ai_provider.strip().lower() == "openai":
            return (
                max(self.settings.openai_max_output_tokens, self.settings.claude_max_tokens),
                self.settings.openai_timeout_seconds,
            )
        return (
            self.settings.claude_max_tokens,
            self.settings.claude_timeout_seconds,
        )

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
    def format_bitrix_crm_block_quick(crm_data: dict[str, Any]) -> str:
        """Compact CRM block for quick_answer — skip empty entity sections."""
        summary = crm_data.get("summary", {})
        sections: list[str] = []
        if crm_data.get("fetched_at"):
            sections.append(f"Ma'lumot olingan vaqt: {crm_data['fetched_at']}\n")

        sections.append("UMUMIY STATISTIKA:")
        sections.append(json.dumps(summary, ensure_ascii=False, indent=2))

        for key, label in (
            ("leads", "LIDLAR"),
            ("deals", "BITIMLAR"),
            ("contacts", "KONTAKTLAR"),
            ("tasks", "VAZIFALAR"),
        ):
            items = crm_data.get(key) or []
            if not items:
                continue
            sections.append(f"\n{label} ({len(items)} ta ko'rsatilgan):")
            sections.append(json.dumps(items, ensure_ascii=False, indent=2))

        return "\n".join(sections)

    @staticmethod
    def format_bitrix_summary(crm_data: dict[str, Any]) -> str:
        """Normalize Bitrix24 CRM payload into a readable text summary for the LLM."""
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
            f"{wrap_system_prompt(role_prompt)}\n\n"
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
            f"{wrap_system_prompt(role_prompt)}\n\n=== AGENT BRAIN — EXECUTIVE INTELLIGENCE LAYER ===\n\n{brain}",
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
        1. System prompt + brain (handled in build_system_prompt / LLM system message)
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
                    "foydalanuvchi savoliga agent rolingizga mos professional javob bering.\n\n"
                    f"{USER_OUTPUT_INSTRUCTION}",
                ]
            )
        else:
            sections.extend(
                [
                    "",
                    "Yuqoridagi kompaniya bilim bazasi va Bitrix24 ma'lumotlariga tayangan holda "
                    "agent rolingizga mos to'liq hisobot tayyorlang.\n\n"
                    f"{USER_OUTPUT_INSTRUCTION}",
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
                    "Yuqoridagi tanlangan bilim bazasi va CRM ma'lumotlariga tayangan holda javob bering.\n\n"
                    f"{USER_OUTPUT_INSTRUCTION}",
                ]
            )
        else:
            sections.extend(
                [
                    "",
                    "Yuqoridagi tanlangan bilim bazasi va CRM ma'lumotlariga tayangan holda "
                    "agent rolingizga mos to'liq hisobot tayyorlang.\n\n"
                    f"{USER_OUTPUT_INSTRUCTION}",
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
        """Send system prompt + brain + knowledge + CRM data (+ question) to OpenAI."""
        normalized = self.normalize_agent_name(agent_name)
        system_prompt = self.build_system_prompt(normalized)
        user_prompt = self.build_user_context(
            normalized,
            crm_data,
            question=question,
        )
        max_tokens, timeout = self._full_report_llm_limits()

        logger.info(
            "Calling OpenAI | agent=%s | crm_summary=%s | has_question=%s",
            normalized,
            crm_data.get("summary", {}),
            bool(question and question.strip()),
        )

        return await self._call_llm(
            system_prompt,
            user_prompt,
            max_output_tokens=max_tokens,
            timeout_seconds=timeout,
            context=self._build_ai_context(
                agent_name=normalized,
                crm_data=crm_data,
                question=question,
                mode="full_report",
            ),
        )

    async def _generate_analysis_optimized(
        self,
        agent_name: str,
        *,
        question: Optional[str] = None,
    ) -> str:
        """Optimized path: route context dynamically before calling OpenAI."""
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
        self.last_crm_data = crm_data
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
        max_tokens, timeout = self._full_report_llm_limits()
        return await self._call_llm(
            system_prompt,
            user_prompt,
            max_output_tokens=max_tokens,
            timeout_seconds=timeout,
            context=self._build_ai_context(
                agent_name=normalized,
                crm_data=crm_data,
                question=question,
                mode="full_report",
            ),
        )

    async def run_quick_answer(
        self,
        agent_name: str,
        *,
        question: Optional[str] = None,
    ) -> str:
        """Fast Q&A: minimal CRM, short prompt, 2–8 sentence answer."""
        normalized = self.normalize_agent_name(agent_name)
        display = AGENT_DISPLAY_NAMES.get(normalized, normalized)
        q = (question or "").strip()
        if not q:
            raise AgentError("Savol bo'sh bo'lishi mumkin emas.")

        logger.info("Quick answer | agent=%s | question_len=%d", normalized, len(q))

        role_prompt = self.load_prompt(normalized)
        system_prompt = (
            f"{wrap_system_prompt(role_prompt)}\n\n"
            f"Siz {display} sifatida tezkor savol-javob rejimidasiz.\n\n"
            f"{QUICK_ANSWER_INSTRUCTION}\n\n"
            f"{USER_OUTPUT_INSTRUCTION}"
        )

        selected_entities, crm_data = await fetch_crm_for_quick(self.bitrix, q)
        self.last_crm_data = crm_data

        _, knowledge_text = load_knowledge_for_intent(normalized, "unknown")
        if len(knowledge_text) > 2500:
            knowledge_text = knowledge_text[:2500] + "\n…[qisqartirildi]"

        user_prompt = "\n".join(
            [
                "=== QISQA KONTEKST (faqat kerakli qism) ===",
                knowledge_text or "Qo'shimcha bilim bazasi yo'q.",
                "",
                "=== BITRIX24 (tanlangan qism) ===",
                self.format_bitrix_crm_block_quick(crm_data),
                "",
                "=== SAVOL ===",
                q,
                "",
                "Yuqoridagi ma'lumotlarga tayangan holda qisqa javob bering (2–8 jumla).",
            ]
        )

        logger.info(
            "Quick answer context | agent=%s | crm_entities=%s | user_chars=%d",
            normalized,
            selected_entities,
            len(user_prompt),
        )

        max_tokens, timeout = self._quick_llm_limits()
        analysis = await self._call_llm(
            system_prompt,
            user_prompt,
            max_output_tokens=max_tokens,
            timeout_seconds=timeout,
            context=self._build_ai_context(
                agent_name=normalized,
                crm_data=crm_data,
                question=q,
                mode="quick_answer",
            ),
        )

        logger.info("Quick answer done | agent=%s | chars=%d", normalized, len(analysis))
        return sanitize_user_output(analysis)

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
        4. Combine context and call OpenAI
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
            except (OSError, ValueError, KeyError) as exc:
                logger.warning(
                    "Optimizer failed, using full context fallback | agent=%s | error=%s",
                    normalized,
                    exc,
                )
                crm_data = await self.bitrix.fetch_all_crm_data()
                self.last_crm_data = crm_data
                analysis = await self._generate_analysis(
                    normalized,
                    crm_data,
                    question=question,
                )
        else:
            crm_data = await self.bitrix.fetch_all_crm_data()
            self.last_crm_data = crm_data
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
        return sanitize_user_output(analysis)

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
            except (OSError, ValueError, KeyError) as exc:
                logger.warning(
                    "Optimizer failed, using full context fallback | agent=%s | error=%s",
                    normalized,
                    exc,
                )
                if crm_data is None:
                    crm_data = await self.bitrix.fetch_all_crm_data()
                    self.last_crm_data = crm_data
                analysis = await self._generate_analysis(
                    normalized,
                    crm_data,
                    question=question,
                )
        else:
            if crm_data is None:
                crm_data = await self.bitrix.fetch_all_crm_data()
                self.last_crm_data = crm_data
            analysis = await self._generate_analysis(
                normalized,
                crm_data,
                question=question,
            )

        analysis = sanitize_user_output(analysis)

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
