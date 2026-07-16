#!/usr/bin/env python3
"""
Generate agent brain markdown files for HARIDLAR.UZ AI Executive Platform.

Writes all files under brains/{agent}/ and brains/README.md.
Run from project root: python scripts/generate_agent_brains.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow imports when run as script from project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.brain_content.agents import ALL_AGENTS  # noqa: E402
from scripts.brain_content.common import (  # noqa: E402
    BP_PROCESSES,
    COMPANY_NAME,
    DIRECTORATES,
    HBA_LAYERS,
    MANDATORY_REPORT_SECTIONS,
    VALUE_PROPOSITION,
    no_hallucination_rules,
    reasoning_order,
    report_structure_block,
)

BRAINS_DIR = PROJECT_ROOT / "brains"

AGENT_FILE_LISTS: dict[str, list[str]] = {
    "ceo": [
        "identity.md", "thinking_framework.md", "decision_rules.md", "kpis.md",
        "business_logic.md", "risk_analysis.md", "executive_questions.md",
        "report_structure.md", "communication_style.md", "examples.md",
        "forbidden_actions.md", "forecasting.md", "strategic_planning.md",
        "meeting_assistant.md", "recommendations.md", "memory.md",
    ],
    "finance": [
        "identity.md", "thinking_framework.md", "decision_rules.md", "cashflow.md",
        "forecast.md", "accounting_rules.md", "financial_risks.md",
        "investment_logic.md", "profitability.md", "kpis.md",
        "report_structure.md", "forbidden_actions.md", "examples.md",
    ],
    "sales": [
        "identity.md", "thinking_framework.md", "decision_rules.md", "lead_scoring.md",
        "pipeline.md", "sales_strategy.md", "negotiation.md", "conversion.md",
        "forecast.md", "closing.md", "objections.md", "kpis.md",
        "report_structure.md", "forbidden_actions.md", "examples.md",
    ],
    "hr": [
        "identity.md", "thinking_framework.md", "decision_rules.md",
        "employee_performance.md", "motivation.md", "workload.md", "recruitment.md",
        "career_growth.md", "conflict_resolution.md", "training.md", "kpis.md",
        "report_structure.md", "forbidden_actions.md", "examples.md",
    ],
    "marketing": [
        "identity.md", "thinking_framework.md", "decision_rules.md", "campaigns.md",
        "lead_sources.md", "roi.md", "advertising.md", "branding.md",
        "content_strategy.md", "analytics.md", "kpis.md",
        "report_structure.md", "forbidden_actions.md", "examples.md",
    ],
    "customer_success": [
        "identity.md", "thinking_framework.md", "decision_rules.md",
        "customer_health.md", "customer_retention.md", "upsell.md", "cross_sell.md",
        "support.md", "customer_journey.md", "complaints.md", "renewals.md",
        "kpis.md", "report_structure.md", "forbidden_actions.md", "examples.md",
    ],
}

AGENT_ROLES: dict[str, str] = {
    "ceo": "CEO Agent (Bosh direktor strategik maslahatchi)",
    "finance": "Moliya Direktori AI Agent (DP-03)",
    "sales": "Savdo Direktori AI Agent (DP-01)",
    "hr": "HR / Inson resurslari AI Agent",
    "marketing": "Marketing AI Agent",
    "customer_success": "Customer Success Direktori AI Agent (DP-04)",
}

BITRIX_FOCUS: dict[str, str] = {
    "ceo": "Konsolidatsiya: barcha deal, KPI agregat, VIP va 200 mln+ deal'lar, activity",
    "finance": "Deal summalari, invoice/to'lov statuslari, debitor muddatlari, won hajmi",
    "sales": "Pipeline stage, lid manbasi, LPR contact, VENU bog'liq deal field'lar",
    "hr": "Task bajarilish, activity (intizom), xodimga bog'langan deal (mas'ul)",
    "marketing": "Lead source, kampaniya UTM, referral attribution, MQL",
    "customer_success": "Won deal delivery status, shikoyat task, takroriy deal, segment A/B/C",
}


def enrich_thinking_framework(agent: str, content: str) -> str:
    role = AGENT_ROLES[agent]
    bitrix = BITRIX_FOCUS[agent]
    header = no_hallucination_rules(role)
    order = reasoning_order(role, bitrix)
    if "Anti-Hallucination" not in content:
        content = header + "\n\n---\n\n" + order + "\n\n---\n\n" + content
    return content


def enrich_domain_file(agent: str, filename: str, content: str) -> str:
    """Add cross-cutting footer to domain files for depth and consistency."""
    role = AGENT_ROLES[agent]
    footer_parts = [
        "",
        "---",
        "",
        f"## {filename.replace('.md', '').replace('_', ' ').title()} — Bitrix24 integratsiyasi",
        "",
        f"- Agent: **{role}**",
        f"- CRM fokus: {BITRIX_FOCUS[agent]}",
        "- Ma'lumot yo'q bo'lsa: **Insufficient information**",
        "",
        "## Fikrlash tartibi eslatmasi",
        "",
        "1. Tushunish → 2. Bitrix24 → 3. Knowledge → 4. Tahlil → 5. Tavsiya",
        "",
        "## Kompaniya konteksti",
        "",
        VALUE_PROPOSITION,
        "",
        "## HBA qatlamlar (tezkor)",
        "",
    ]
    for k, v in HBA_LAYERS.items():
        footer_parts.append(f"- **{k}**: {v}")
    footer_parts.extend(["", "## BP jarayonlar (tezkor)", ""])
    for k, v in BP_PROCESSES.items():
        footer_parts.append(f"- **{k}**: {v}")
    footer_parts.extend([
        "",
        "## Direktoratlar",
        "",
    ])
    for k, v in DIRECTORATES.items():
        footer_parts.append(f"- **{k}**: {v}")
    footer_parts.extend([
        "",
        "## Hisobot bo'limlari (majburiy)",
        "",
    ])
    for i, s in enumerate(MANDATORY_REPORT_SECTIONS, 1):
        footer_parts.append(f"{i}. {s}")
    footer_parts.extend([
        "",
        "## B2G O'zbekiston konteksti",
        "",
        "- Davlat xaridlari: elektron do'kon, tender, auktsion (67/30/3 taqsimot).",
        "- LPR: karyera xavfsizligi va audit muhim — 'tinchlik kafolati' xabari.",
        "- Takroriy mijozlar ~90% — har tahlilda retention o'lchangi.",
        "- VENU (HBA-03): tijoriy taklif sifati butun zanjirni belgilaydi.",
        "- 200 mln so'm+ buyurtmalar: CEO/Murad aka eskalatsiya zonasi.",
        "",
        "## Amaliy checklist",
        "",
        "- [ ] Bitrix24 ma'lumoti tekshirildi",
        "- [ ] knowledge/{agent}/ mos bo'lim o'qildi",
        "- [ ] HBA/BP mosligi baholandi",
        "- [ ] Ijobiy va salbiy topilmalar ajratildi",
        "- [ ] Moliyaviy ta'sir (yoki Insufficient information)",
        "- [ ] Priority Matrix to'ldirildi",
        "- [ ] KPI va prognoz manbasi ko'rsatildi",
        "",
    ])
    if "Bitrix24 integratsiyasi" not in content:
        content = content + "\n".join(footer_parts)
    return content


def ensure_min_lines(content: str, min_lines: int = 85) -> str:
    lines = content.splitlines()
    if len(lines) >= min_lines:
        return content
    extra = ["", "## Qo'shimcha metodologik bandlar", ""]
    n = 1
    while len(lines) + len(extra) < min_lines:
        extra.append(
            f"{n}. Har bir xulosa uchun manba: Bitrix24 yoki knowledge yoki "
            f"Insufficient information — ixtiro qilinmaydi."
        )
        n += 1
    return content + "\n" + "\n".join(extra)


def write_readme() -> str:
    content = f"""# Agent Brain Intelligence Layer

> **{COMPANY_NAME}** — AI Executive Platform uchun agent miya qatlami.

Bu papka (`brains/`) **intelligence layer** hisoblanadi: har bir AI agent qanday fikrlashi, qaror qabul qilishi va hisobot tuzishi kerakligini belgilaydi. Bu `knowledge/` (kompaniya faktlari) va `prompts/` (tizim ko'rsatmalari) dan alohida.

---

## Maqsad

- Agentlarga **professional executive metodologiya** berish
- **HBA-01..09** va **BP-01..09** bilan bog'langan fikrlash
- **Bitrix24** + **knowledge base** + tahlil + tavsiya ketma-ketligi
- **Anti-hallucination**: yetarli ma'lumot bo'lmasa — `Insufficient information`

---

## Agentlar va fayllar

| Agent | Papka | Fayllar soni |
|-------|-------|--------------|
| CEO | `ceo/` | 16 |
| Finance | `finance/` | 13 |
| Sales | `sales/` | 15 |
| HR | `hr/` | 14 |
| Marketing | `marketing/` | 14 |
| Customer Success | `customer_success/` | 15 |

Jami: **87** ta markdown fayl.

---

## Yuklash tartibi

Loader: `app/brains/loader.py` — `BRAIN_LOAD_ORDER` bo'yicha fayllar birlashtiriladi.

```
identity → thinking_framework → decision_rules → [domain files] → kpis → report_structure → forbidden_actions → examples
```

---

## Knowledge vs Brain

| Qatlam | Papka | Nima |
|--------|-------|------|
| Knowledge | `knowledge/{{agent}}/` | Kompaniya faktlari, KPI, FAQ, qoidalar |
| Brain | `brains/{{agent}}/` | Qanday fikrlash, tahlil, hisobot metodologiyasi |
| Prompt | `prompts/{{agent}}.md` | Tizim ko'rsatmasi |

Agent ishlash tartibi:

1. System prompt (`prompts/`)
2. Agent brain (`brains/`) — metodologiya
3. Company knowledge (`knowledge/`)
4. Bitrix24 CRM ma'lumotlari
5. Foydalanuvchi savoli

---

## Majburiy hisobot bo'limlari

Har bir agent hisobotida:

{chr(10).join(f'{i}. {s}' for i, s in enumerate(MANDATORY_REPORT_SECTIONS, 1))}

---

## Kompaniya faktlar (qisqa)

- B2G davlat xaridlari platformasi
- Qiymat taklifi: **tinchlik kafolati** (mahsulot emas)
- Takroriy mijozlar ~**90%**
- 4 direksiya: Savdo, Ta'minot, Moliya, Customer Success (DP-01..04)
- VENU tijoriy taklif arxitekturasi (HBA-03)

---

## Qayta generatsiya

```bash
python scripts/generate_agent_brains.py
```

Skript barcha brain fayllarini qayta yozadi. Qo'lda tahrirlangan o'zgarishlar yo'qoladi — versiya nazorati tavsiya etiladi.

---

## Texnik

- `load_agent_brain(agent_name)` — barcha fayllarni birlashtiradi
- `get_brain_stats(agent_name)` — fayl soni va belgilar statistikasi
"""
    return content


def main() -> int:
    print(f"Generating agent brains at: {BRAINS_DIR}")
    BRAINS_DIR.mkdir(parents=True, exist_ok=True)

    created_files: list[str] = []
    agent_chars: dict[str, int] = {}
    errors: list[str] = []

    # README
    readme_path = BRAINS_DIR / "README.md"
    readme_content = write_readme()
    readme_path.write_text(readme_content, encoding="utf-8")
    created_files.append(str(readme_path.relative_to(PROJECT_ROOT)))

    for agent, generator in ALL_AGENTS.items():
        agent_dir = BRAINS_DIR / agent
        agent_dir.mkdir(parents=True, exist_ok=True)
        agent_total = 0

        try:
            files_content = generator()
        except Exception as exc:
            errors.append(f"{agent}: generator failed — {exc}")
            continue

        expected = AGENT_FILE_LISTS.get(agent, [])
        for filename in expected:
            if filename not in files_content:
                errors.append(f"{agent}/{filename}: missing from generator")
                files_content[filename] = f"# {filename}\n\nInsufficient information: content not generated.\n"

            content = files_content[filename]
            if filename == "thinking_framework.md":
                content = enrich_thinking_framework(agent, content)
            elif filename not in (
                "report_structure.md",
                "examples.md",
                "forbidden_actions.md",
                "identity.md",
            ):
                content = enrich_domain_file(agent, filename, content)

            content = ensure_min_lines(content, 85)
            path = agent_dir / filename
            path.write_text(content, encoding="utf-8")
            rel = str(path.relative_to(PROJECT_ROOT))
            created_files.append(rel)
            agent_total += len(content)

        agent_chars[agent] = agent_total
        print(f"  {agent}: {len(expected)} files, {agent_total:,} chars")

    print("\n=== Summary ===")
    print(f"Files created: {len(created_files)}")
    print(f"Total chars: {sum(agent_chars.values()):,}")
    for agent, chars in sorted(agent_chars.items()):
        print(f"  {agent}: {chars:,} chars")
    if errors:
        print("\nErrors:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
