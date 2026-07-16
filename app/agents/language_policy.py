"""Central Uzbek language policy injected into every agent system prompt."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from app.config import PROMPTS_DIR

POLICY_PATH = PROMPTS_DIR / "_til_siyosati.md"

USER_OUTPUT_INSTRUCTION = """
=== JAVOB TALABI ===
Yuqoridagi til siyosatiga qat'iy rioya qiling.
Javobni 100% o'zbek tilida yozing.
Hisobotni quyidagi tartibda bering: Sarlavha → Qisqacha xulosa → Asosiy muammolar → Kuchli tomonlar → Xavflar → Tavsiyalar → Keyingi bajarilishi kerak bo'lgan ishlar → Umumiy xulosa.
CRM ichki kodlari, inglizcha ustun nomlari va texnik atamalar foydalanuvchiga ko'rinmasin.
Valyutani faqat «so'm» bilan yozing (UZS yozmang).
""".strip()


@lru_cache
def load_language_policy() -> str:
    """Load shared Uzbek-only language policy for all agents."""
    if not POLICY_PATH.is_file():
        return USER_OUTPUT_INSTRUCTION
    return POLICY_PATH.read_text(encoding="utf-8").strip()


def wrap_system_prompt(role_prompt: str) -> str:
    """Prepend mandatory language policy to agent role + brain system prompt."""
    policy = load_language_policy()
    return (
        "=== TIL SIYOSATI (MAJBURIY — BARCHA AGENTLAR) ===\n\n"
        f"{policy}\n\n"
        "=== AGENT ROLI ===\n\n"
        f"{role_prompt}"
    )
