"""CRM-based Uzbek template answers when AI_PROVIDER=none."""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from app.agents.response_mode import detect_response_mode
from app.config import get_settings
from app.services.bitrix import Bitrix24Service
from app.utils.logger import get_logger
from app.utils.uzbek_output import sanitize_user_output

logger = get_logger(__name__)

_TASK_STATUS_UZ: dict[str, str] = {
    "1": "Yangi",
    "2": "Kutilmoqda",
    "3": "Bajarilmoqda",
    "4": "Ko'rib chiqilmoqda",
    "5": "Bajarildi",
    "6": "Kechiktirilgan",
    "7": "Rad etilgan",
}

_STOPWORDS = frozenset(
    {
        "bugun",
        "kecha",
        "nima",
        "qildi",
        "qilgan",
        "necha",
        "nechta",
        "qancha",
        "bo'ldi",
        "boldi",
        "uchun",
        "kim",
        "qanday",
        "hisobot",
        "to'liq",
        "tolik",
        "batafsil",
        "lead",
        "leadlar",
        "lid",
        "lidlari",
        "sotuv",
        "savdo",
        "bitim",
        "bitimlar",
        "vazifa",
        "vazifalar",
        "crm",
        "agent",
    }
)


def _normalize(text: str) -> str:
    return text.lower().replace("ʻ", "'").replace("’", "'").replace("`", "'")


def _local_tz() -> ZoneInfo:
    try:
        return ZoneInfo(get_settings().daily_report_timezone)
    except Exception:
        return ZoneInfo("Asia/Tashkent")


def _parse_bitrix_date(value: Any) -> date | None:
    if not value:
        return None
    raw = str(value).strip()
    try:
        if "T" in raw:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return dt.astimezone(_local_tz()).date()
        return datetime.strptime(raw[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _format_money(amount: float, currency: str = "UZS") -> str:
    rounded = int(round(amount))
    formatted = f"{rounded:,}".replace(",", " ")
    if currency in {"UZS", "SUM", "so'm"}:
        return f"{formatted} so'm"
    return f"{formatted} {currency}"


def _stage_label(stage_id: Any) -> str:
    if not stage_id:
        return "Aniqlanmagan bosqich"
    code = str(stage_id).upper()
    if code.startswith("UC_"):
        return "Jarayondagi bitim"
    mapping = {
        "NEW": "Yangi bitim",
        "WON": "Muvaffaqiyatli yakunlangan",
        "LOSE": "Bekor qilingan",
        "PREPARATION": "Tayyorgarlik bosqichi",
        "PREPAYMENT_INVOICE": "To'lov kutilmoqda",
        "EXECUTING": "Ijro etilmoqda",
        "FINAL_INVOICE": "Yakuniy hisob-faktura",
    }
    return mapping.get(code, "Jarayondagi bitim")


def _task_status_label(status: Any) -> str:
    return _TASK_STATUS_UZ.get(str(status), "Faol vazifa")


def _extract_person_name(question: str) -> str | None:
    structured_patterns = (
        r"bugun\s+([A-Za-zА-Яа-яЁё'-]{3,})",
        r"([A-Za-zА-Яа-яЁё'-]{3,})\s+nima\s+qildi",
        r"([A-Za-zА-Яа-яЁё'-]{3,})\s+bugun",
    )
    for pattern in structured_patterns:
        match = re.search(pattern, question, re.I)
        if match:
            name = match.group(1).strip()
            if _normalize(name) not in _STOPWORDS:
                return name[:1].upper() + name[1:]

    for match in re.finditer(r"[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё'-]{2,}", question):
        word = match.group(0)
        if _normalize(word) not in _STOPWORDS:
            return word
    tokens = re.findall(r"[a-zA-Zа-яА-ЯёЁ'-]{3,}", text)
    for token in tokens:
        if token not in _STOPWORDS and not token.isdigit():
            return token[:1].upper() + token[1:]
    return None


def _classify_question(question: str) -> str:
    if detect_response_mode(question) == "full_report":
        return "full_report"
    text = _normalize(question)
    if any(k in text for k in ("lid", "lead", "so'rov", "so‘rov")):
        return "leads"
    if any(k in text for k in ("sotuv", "savdo", "bitim", "qancha")):
        return "sales"
    if any(k in text for k in ("vazifa", "nima qildi", "qildi", "ish", "faoliyat")):
        return "person"
    if _extract_person_name(question):
        return "person"
    return "summary"


def _summary_block(crm_data: dict[str, Any]) -> dict[str, Any]:
    summary = crm_data.get("summary") or {}
    if summary:
        return summary
    leads = crm_data.get("leads") or []
    deals = crm_data.get("deals") or []
    contacts = crm_data.get("contacts") or []
    tasks = crm_data.get("tasks") or []
    return {
        "leads_count": len(leads),
        "deals_count": len(deals),
        "contacts_count": len(contacts),
        "tasks_count": len(tasks),
        "total_opportunity": sum(float(d.get("OPPORTUNITY", 0) or 0) for d in deals),
    }


def _deals_for_today(deals: list[dict[str, Any]], *, today_only: bool) -> list[dict[str, Any]]:
    if not today_only:
        return deals
    today = datetime.now(_local_tz()).date()
    matched: list[dict[str, Any]] = []
    for deal in deals:
        for field in ("DATE_MODIFY", "DATE_CREATE", "CLOSEDATE"):
            parsed = _parse_bitrix_date(deal.get(field))
            if parsed == today:
                matched.append(deal)
                break
    return matched


def _answer_leads(question: str, crm_data: dict[str, Any]) -> str:
    summary = _summary_block(crm_data)
    count = int(summary.get("leads_count", 0))
    leads = crm_data.get("leads") or []
    lines = [f"CRMda jami **{count}** ta lid mavjud."]
    if leads:
        lines.append("")
        lines.append("So'nggi lidlar:")
        for lead in leads[:5]:
            title = lead.get("TITLE") or " ".join(
                filter(None, [lead.get("NAME"), lead.get("LAST_NAME")])
            )
            title = title or "Nomsiz lid"
            amount = float(lead.get("OPPORTUNITY", 0) or 0)
            if amount > 0:
                lines.append(f"- {title} — {_format_money(amount)}")
            else:
                lines.append(f"- {title}")
    return "\n".join(lines)


def _answer_sales(question: str, crm_data: dict[str, Any]) -> str:
    deals = crm_data.get("deals") or []
    today_only = "bugun" in _normalize(question)
    scoped = _deals_for_today(deals, today_only=today_only)
    total = sum(float(d.get("OPPORTUNITY", 0) or 0) for d in scoped)
    period = "Bugun" if today_only else "Joriy tanlovdagi"
    if not scoped:
        return (
            f"{period} CRMda ko'rinadigan bitimlar topilmadi. "
            "Ma'lumotlar yangilanganini yoki bitimlar kiritilganini tekshiring."
        )
    lines = [
        f"{period} **{len(scoped)}** ta bitim qayd etilgan, umumiy qiymati **{_format_money(total)}**.",
        "",
        "Asosiy bitimlar:",
    ]
    for deal in scoped[:6]:
        title = deal.get("TITLE") or "Nomsiz bitim"
        amount = float(deal.get("OPPORTUNITY", 0) or 0)
        stage = _stage_label(deal.get("STAGE_ID"))
        lines.append(f"- {title} — {_format_money(amount)}, holati: {stage}")
    return "\n".join(lines)


async def _resolve_user_ids(
    bitrix: Bitrix24Service | None,
    person_name: str,
) -> set[str]:
    if not bitrix or not person_name:
        return set()
    ids: set[str] = set()
    try:
        for field in ("NAME", "LAST_NAME"):
            users = await bitrix.search_users_by_name(person_name, field=field)
            for user in users:
                uid = user.get("ID")
                if uid is not None:
                    ids.add(str(uid))
    except Exception as exc:
        logger.warning("User search failed for %s: %s", person_name, exc)
    return ids


async def _answer_person(
    question: str,
    crm_data: dict[str, Any],
    *,
    bitrix: Bitrix24Service | None,
) -> str:
    person = _extract_person_name(question) or "xodim"
    today_only = "bugun" in _normalize(question)
    tasks = crm_data.get("tasks") or []
    user_ids = await _resolve_user_ids(bitrix, person)
    person_lower = person.lower()

    matched: list[dict[str, Any]] = []
    for task in tasks:
        title = str(task.get("TITLE") or "")
        description = str(task.get("DESCRIPTION") or "")
        responsible = str(task.get("RESPONSIBLE_ID") or "")
        haystack = f"{title} {description}".lower()
        by_name = person_lower in haystack
        by_id = responsible in user_ids if user_ids else False
        if not by_name and not by_id:
            continue
        if today_only:
            changed = _parse_bitrix_date(task.get("CHANGED_DATE") or task.get("CREATED_DATE"))
            if changed and changed != datetime.now(_local_tz()).date():
                continue
        matched.append(task)

    if today_only and not matched:
        for task in tasks:
            title = str(task.get("TITLE") or "")
            description = str(task.get("DESCRIPTION") or "")
            responsible = str(task.get("RESPONSIBLE_ID") or "")
            haystack = f"{title} {description}".lower()
            by_name = person_lower in haystack
            by_id = responsible in user_ids if user_ids else False
            if by_name or by_id:
                matched.append(task)

    if not matched:
        period = "bugun" if today_only else "so'nggi davrda"
        return (
            f"**{person.title()}** uchun {period} CRM vazifalarida aniq yozuv topilmadi. "
            "Vazifa sarlavhasida ism ko'rsatilganini yoki mas'ul biriktirilganini tekshiring."
        )

    lines = [
        f"**{person.title()}** bo'yicha {('bugungi' if today_only else 'topilgan')} vazifalar:",
        "",
    ]
    for task in matched[:8]:
        title = task.get("TITLE") or "Nomsiz vazifa"
        status = _task_status_label(task.get("STATUS"))
        deadline = task.get("DEADLINE")
        deadline_text = ""
        if deadline:
            parsed = _parse_bitrix_date(deadline)
            deadline_text = f", muddat: {parsed.isoformat()}" if parsed else ""
        lines.append(f"- {title} — holati: {status}{deadline_text}")
    return "\n".join(lines)


def _answer_summary(crm_data: dict[str, Any], agent_name: str) -> str:
    summary = _summary_block(crm_data)
    fetched = crm_data.get("fetched_at", "")
    lines = [
        "CRM bo'yicha qisqa holat:",
        "",
        f"- Lidlar: **{summary.get('leads_count', 0)}** ta",
        f"- Bitimlar: **{summary.get('deals_count', 0)}** ta",
        f"- Kontaktlar: **{summary.get('contacts_count', 0)}** ta",
        f"- Vazifalar: **{summary.get('tasks_count', 0)}** ta",
        f"- Bitimlar umumiy qiymati: **{_format_money(float(summary.get('total_opportunity', 0) or 0))}**",
    ]
    if fetched:
        lines.extend(["", f"Ma'lumot olingan vaqt: {fetched[:19].replace('T', ' ')} UTC."])
    lines.extend(
        [
            "",
            f"({agent_name} agenti — shablon javob, AI ulanishi yo'q.)",
        ]
    )
    return "\n".join(lines)


def _answer_full_report(crm_data: dict[str, Any], agent_name: str, question: str) -> str:
    summary = _summary_block(crm_data)
    deals = crm_data.get("deals") or []
    leads = crm_data.get("leads") or []
    tasks = crm_data.get("tasks") or []
    today_deals = _deals_for_today(deals, today_only=True)
    today_sales = sum(float(d.get("OPPORTUNITY", 0) or 0) for d in today_deals)

    lines = [
        "# Rahbarlik hisoboti (shablon)",
        "",
        "## Qisqacha xulosa",
        f"- Lidlar: **{summary.get('leads_count', 0)}** ta",
        f"- Bitimlar: **{summary.get('deals_count', 0)}** ta",
        f"- Kontaktlar: **{summary.get('contacts_count', 0)}** ta",
        f"- Vazifalar: **{summary.get('tasks_count', 0)}** ta",
        f"- Bugungi bitimlar: **{len(today_deals)}** ta, jami **{_format_money(today_sales)}**",
        "",
        "## Sotuv va bitimlar",
    ]
    if deals:
        for deal in deals[:8]:
            title = deal.get("TITLE") or "Nomsiz bitim"
            amount = float(deal.get("OPPORTUNITY", 0) or 0)
            stage = _stage_label(deal.get("STAGE_ID"))
            lines.append(f"- {title} — {_format_money(amount)}, {stage}")
    else:
        lines.append("- Hozircha bitimlar ro'yxati bo'sh.")

    lines.extend(["", "## Lidlar"])
    if leads:
        for lead in leads[:6]:
            title = lead.get("TITLE") or "Nomsiz lid"
            lines.append(f"- {title}")
    else:
        lines.append("- Yangi lidlar ko'rinmayapti.")

    lines.extend(["", "## Vazifalar"])
    if tasks:
        for task in tasks[:6]:
            title = task.get("TITLE") or "Nomsiz vazifa"
            status = _task_status_label(task.get("STATUS"))
            lines.append(f"- {title} — {status}")
    else:
        lines.append("- Faol vazifalar topilmadi.")

    lines.extend(
        [
            "",
            "## Eslatma",
            "Bu hisobot AI siz CRM ma'lumotlaridan avtomatik tuzildi. "
            "Chuqur tahlil uchun `.env` da `AI_PROVIDER=claude` (yoki openai/gemini) "
            "va tegishli API kalitini sozlang.",
            "",
            f"*Agent: {agent_name} | Savol: {question.strip() or 'umumiy hisobot'}*",
        ]
    )
    return "\n".join(lines)


async def generate_template_answer(
    question: str,
    crm_data: dict[str, Any],
    *,
    mode: str,
    agent_name: str,
    bitrix: Bitrix24Service | None = None,
) -> str:
    """Build a Uzbek CRM template answer without calling external AI APIs."""
    q = (question or "").strip()
    intent = "full_report" if mode == "full_report" else _classify_question(q)

    if intent == "full_report":
        text = _answer_full_report(crm_data, agent_name, q)
    elif intent == "leads":
        text = _answer_leads(q, crm_data)
    elif intent == "sales":
        text = _answer_sales(q, crm_data)
    elif intent == "person":
        text = await _answer_person(q, crm_data, bitrix=bitrix)
    else:
        text = _answer_summary(crm_data, agent_name)

    return sanitize_user_output(text)
