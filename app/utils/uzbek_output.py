"""Post-process agent output: hide CRM codes and common English leaks."""

from __future__ import annotations

import re

# Known Bitrix24 stage codes → user-facing Uzbek labels
CRM_STAGE_LABELS: dict[str, str] = {
    "PREPAYMENT_INVOICE": "To'lov kutilayotgan bosqich",
    "NEW": "Yangi bitim",
    "WIN": "Yakunlangan bitim",
    "LOSE": "Bekor bo'lgan bitim",
    "C0": "Jarayondagi bitim",
    "UC_WENQTH": "Jarayondagi bitim",
    "UC_K4EIVL": "Jarayondagi bitim",
    "UC_X7T9BC": "Jarayondagi bitim",
}

UNKNOWN_STAGE = "Noma'lum ichki bosqich"

# Whole-word English term replacements (user-facing leaks)
_TERM_REPLACEMENTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bExecutive Summary\b", re.I), "Qisqacha xulosa"),
    (re.compile(r"\bDeal\b"), "Bitim"),
    (re.compile(r"\bDeals\b"), "Bitimlar"),
    (re.compile(r"\bLead\b"), "Mijoz so'rovi"),
    (re.compile(r"\bLeads\b"), "Mijoz so'rovlari"),
    (re.compile(r"\bPipeline\b"), "Sotuv jarayoni"),
    (re.compile(r"\bStage\b"), "Bosqich"),
    (re.compile(r"\bOpportunity\b"), "Bitim qiymati"),
    (re.compile(r"\bCustomer\b"), "Mijoz"),
    (re.compile(r"\bStatus\b"), "Holati"),
    (re.compile(r"\bRisk\b"), "Xavf"),
    (re.compile(r"\bRisks\b"), "Xavflar"),
    (re.compile(r"\bRecommendation\b"), "Tavsiya"),
    (re.compile(r"\bRecommendations\b"), "Tavsiyalar"),
    (re.compile(r"\bAction\b"), "Amal"),
    (re.compile(r"\bPriority\b"), "Muhimlik darajasi"),
    (re.compile(r"\bClose Date\b"), "Yakunlash muddati"),
    (re.compile(r"\bTask\b"), "Vazifa"),
    (re.compile(r"\bTasks\b"), "Vazifalar"),
    (re.compile(r"\bReport\b"), "Hisobot"),
    (re.compile(r"\bExecutive\b"), "Rahbar"),
    (re.compile(r"\bUZS\b"), "so'm"),
    (re.compile(r"\bUSD\b"), "AQSh dollari"),
]

_UC_STAGE_RE = re.compile(r"\bUC_[A-Z0-9]+\b")


def sanitize_user_output(text: str) -> str:
    """Best-effort cleanup so user-facing text stays Uzbek-only."""
    if not text:
        return text

    result = text
    for code, label in CRM_STAGE_LABELS.items():
        result = result.replace(code, label)

    result = _UC_STAGE_RE.sub(UNKNOWN_STAGE, result)

    for pattern, replacement in _TERM_REPLACEMENTS:
        result = pattern.sub(replacement, result)

    return result


def user_facing_ai_error(raw: str | None = None) -> str:
    """Map internal AI errors to Uzbek text — hide Claude/Anthropic/stack details."""
    text = (raw or "").strip().lower()
    if "vaqti tugadi" in text or "timeout" in text:
        return "OpenAI javobi vaqti tugadi — qayta urinib ko'ring."
    if "sozlanmagan" in text or "noto'g'ri" in text or "talab qilinadi" in text:
        return "OpenAI sozlamasi to'liq emas — administrator bilan bog'laning."
    return "OpenAI bilan javob olishda xato yuz berdi — keyinroq qayta urinib ko'ring."
