# Agent Brain Intelligence Layer

> **HARIDLAR.UZ / Xaridlar.uz** — AI Executive Platform uchun agent miya qatlami.

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
| Knowledge | `knowledge/{agent}/` | Kompaniya faktlari, KPI, FAQ, qoidalar |
| Brain | `brains/{agent}/` | Qanday fikrlash, tahlil, hisobot metodologiyasi |
| Prompt | `prompts/{agent}.md` | Tizim ko'rsatmasi |

Agent ishlash tartibi:

1. System prompt (`prompts/`)
2. Agent brain (`brains/`) — metodologiya
3. Company knowledge (`knowledge/`)
4. Bitrix24 CRM ma'lumotlari
5. Foydalanuvchi savoli

---

## Majburiy hisobot bo'limlari

Har bir agent hisobotida:

1. Executive Summary
2. Current Situation
3. Positive Findings
4. Negative Findings
5. Root Cause
6. Risk
7. Financial Impact
8. Priority Matrix
9. Recommendations
10. Immediate Actions
11. Long-term Strategy
12. KPIs
13. Forecast
14. Final Conclusion

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
