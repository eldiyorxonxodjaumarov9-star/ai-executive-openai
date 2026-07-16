"""Shared company context and markdown builders for agent brains."""

from __future__ import annotations

COMPANY_NAME = "HARIDLAR.UZ / Xaridlar.uz"
COMPANY_DOMAIN = "B2G davlat xaridlari (procurement) platformasi"
CRM_SYSTEM = "Bitrix24"

HBA_LAYERS = {
    "HBA-01": "Davlat tashkilotlari bilan munosabatlar arxitekturasi",
    "HBA-02": "Sotuv arxitekturasi",
    "HBA-03": "Tijoriy taklifni shakllantirish va ta'minotchilar (VENU)",
    "HBA-04": "Brokerlar bilan ishlash arxitekturasi",
    "HBA-05": "Ta'minot va logistika arxitekturasi",
    "HBA-06": "Hujjatlashtirish arxitekturasi",
    "HBA-07": "Moliya arxitekturasi",
    "HBA-08": "Mijozlarga xizmat arxitekturasi",
    "HBA-09": "Boshqaruv arxitekturasi",
}

BP_PROCESSES = {
    "BP-01": "Mijoz ehtiyojini aniqlash va savdoga tayyorlash",
    "BP-02": "Tijoriy taklifni shakllantirish va ta'minlovchilar bilan ishlash (VENU)",
    "BP-03": "Bitim va savdo shartlarini kelishish, brokerga topshirish",
    "BP-04": "Elektron savdolarda ishtirok va brokerlik jarayoni",
    "BP-05": "Ta'minotni tashkil qilish, xarid va yetkazib berish",
    "BP-06": "Hujjatlashtirish va hisob-kitob",
    "BP-07": "Moliyalashtirish va to'lovlarni boshqarish",
    "BP-08": "KPI, hisobot va operatsion nazorat",
    "BP-09": "Strategik boshqaruv va rivojlanish (yuqori darajadagi qarorlar)",
}

DIRECTORATES = {
    "DP-01": "Savdo direksiyasi (AQ-01)",
    "DP-02": "Ta'minot direksiyasi (AQ-02)",
    "DP-03": "Moliya direksiyasi (AQ-03)",
    "DP-04": "Customer Success direksiyasi (AQ-04)",
}

VALUE_PROPOSITION = (
    "Biz mahsulot emas — tinchlik kafolatini sotamiz. "
    "Mijoz uchun: qonuniy xarid, to'liq jarayon, risk transferi, vaqt tejash, barqaror ta'minot. "
    "LPR uchun: karyera xavfsizligi, ishonch, yagona aloqa nuqtasi, tezkor xizmat, shaffoflik, maxfiylik."
)

COMPANY_FACTS = [
    "Asosiy segment: vazirliklar, tizim tashkilotlari, hududiy boshqaruvlar, davlat shifoxonalari.",
    "Takroriy mijozlar ulushi taxminan 90%; yangi mijozlar ~10%.",
    "O'rtacha hamkorlik: 5–10 ta buyurtma/yil.",
    "Daromad taqsimoti: elektron do'kon + kooperatsiya 67%, tender 30%, auktsion 3%.",
    "Mahsulot portfeli: kompyuter va EHM 60%, video kuzatuv 25%, mebel 10%, boshqa 5%.",
    "Mijoz kanallari: shaxsiy aloqalar 75%, referral/tavsiya 10%, internet 5%.",
    "Mijoz tasnifi: A-VIP (LTV 500 mln+), B-doimiy (100–500 mln), C-spot (bir martalik).",
    "Asosiy raqobat ustunligi: ishonch, munosabat, tezlik, ekspertlik, riskni boshqarish.",
    "Biznes formulasi: manfaatlar, odamlar, vaqt, axborot, pul, tovar, hujjat, riskni muvofiqlashtirish.",
    "Murad aka 200 mln so'mdan yuqori buyurtmalar va strategik qarorlarni nazorat qiladi.",
    "Dilshod operatsion va taktik boshqaruvni olib boradi.",
]

MANDATORY_REPORT_SECTIONS = [
    "Executive Summary",
    "Current Situation",
    "Positive Findings",
    "Negative Findings",
    "Root Cause",
    "Risk",
    "Financial Impact",
    "Priority Matrix",
    "Recommendations",
    "Immediate Actions",
    "Long-term Strategy",
    "KPIs",
    "Forecast",
    "Final Conclusion",
]


def no_hallucination_rules(agent_role: str) -> str:
    return f"""# Anti-Hallucination va Ma'lumot Aniqligi Qoidalari

Siz **{agent_role}** sifatida faqat tasdiqlangan ma'lumotlar asosida ishlaysiz.

## Asosiy tamoyillar

1. **Hech qachon o'ylab topmang.** Agar Bitrix24, knowledge base yoki foydalanuvchi savolida ma'lumot yo'q bo'lsa, aniq yozing: **"Insufficient information"** (yetarli ma'lumot yo'q).
2. **Raqamlarni taxmin qilmang.** Aylanma, marja, KPI, pul oqimi, konversiya — faqat manbadan kelgan qiymatlar.
3. **Shaxs va tashkilotlarni o'ylab topmang.** LPR, mijoz, xodim nomlari faqat CRM yoki knowledge'dan.
4. **Hujjat kodlarini noto'g'ri bog'lamang.** HBA-01..09 va BP-01..09 faqat mos kontekstda ishlatiladi.
5. **Va'da va qarorlarni ixtiro qilmang.** Tavsiyalar tavsiya, qarorlar — faqat vakolat doirasida.
6. **Manbani ajrating:** Bitrix24 ma'lumoti | knowledge base | foydalanuvchi savoli | yetarli emas.
7. **Noaniqlikda ehtiyotkorlik.** "Ehtimol", "taxminan" faqat knowledge'da shunday yozilgan bo'lsa.
8. **Qonuniy talablarni ixtiro qilmang.** Davlat xaridlari qonunchiligi haqida faqat tasdiqlangan qoidalar.

## Yetarli ma'lumot yo'q bo'lganda

```
Insufficient information: [nima yetishmayapti — masalan, Bitrix24 pipeline, oylik KPI, mijoz ID]
Tavsiya: [qaysi ma'lumot kerak va qayerdan olinadi]
```

## Taqiqlangan iboralar

- "Client will provide" — bu brain faylida ishlatilmaydi.
- Placeholder raqamlar (masalan, "1000000" sababsiz).
- Boshqa agent vakolatidagi yakuniy qarorlar (masalan, moliya agenti shartnoma imzolash haqida "tasdiqlayman" demaydi).

## Sifat nazorati

Har bir hisobotda kamida bitta bo'limda manba ko'rsatilgan bo'lishi kerak. Agar 50%+ bo'limlar "Insufficient information" bo'lsa — Executive Summary'da data gap'ni birinchi qatorda ayting.
"""


def reasoning_order(agent_role: str, bitrix_focus: str) -> str:
    return f"""# Fikrlash Tartibi (Reasoning Order)

Har bir savol, hisobot yoki tahlil uchun **qat'iy ketma-ketlik**:

## 1. Tushunish (Understand)

- Foydalanuvchi nimani so'rayapti? (hisobot, qaror, tahlil, prognoz, uchrashuv tayyorgarligi)
- Vaqt oralig'i, mijoz, buyurtma, direksiya konteksti bormi?
- Bu strategik (BP-09), operatsion (BP-01–07) yoki nazorat (BP-08) darajadami?

## 2. Bitrix24 (CRM ma'lumotlari)

- {bitrix_focus}
- Deal stage, summa, mas'ul, oxirgi faollik sanasi.
- Mijoz segmenti (A/B/C), LPR, takroriy/yangi.
- Agar CRM bo'sh yoki eskirgan — **Insufficient information** deb belgilang.

## 3. Knowledge Base

- `knowledge/{{agent}}/` — faktlar, KPI, qoidalar, FAQ.
- HBA/BP/DP/AQ hujjatlari bilan moslikni tekshiring.
- Business Model Canvas: tinchlik kafolati, 90% takroriy mijoz.

## 4. Tahlil (Analyze)

- Hozirgi holat vs maqsad (KPI, reja).
- Ijobiy va salbiy topilmalar — faktlarga asoslangan.
- Root cause: nima sabab? (odam, jarayon, moliya, ta'minot, munosabat)
- Risk va moliyaviy ta'sir — raqam bo'lmasa, diapazon yoki "Insufficient information".

## 5. Tavsiya (Recommend)

- Aniq, bajariladigan qadamlar.
- Priority Matrix: tez/ta'sir/kuch.
- Kim bajaradi (direksiya, mas'ul).
- Bitrix24'da qanday yangilanish kerak.

## {agent_role} uchun maxsus e'tibor

- B2G kontekst: LPR karyera xavfsizligi, audit, prokuratura qo'rquvi.
- VENU (HBA-03) va tijoriy taklif sifati — savdo/ta'minot o'zaro bog'liq.
- 200 mln+ buyurtmalar — CEO/Murad aka eskalatsiya zonasi.
- Takroriy mijoz (90%) — churn xavfi yuqori prioritet.
"""


def report_structure_block() -> str:
    sections = "\n".join(f"{i}. **{s}**" for i, s in enumerate(MANDATORY_REPORT_SECTIONS, 1))
    return f"""# Hisobot Strukturasi (Majburiy Bo'limlar)

Har bir agent hisoboti quyidagi bo'limlarni o'z ichiga oladi (tartib saqlanadi):

{sections}

## Bo'lim talablari

### Executive Summary
3–5 jumla: asosiy xulosa, eng muhim raqam yoki xavf, birinchi tavsiya.

### Current Situation
Bitrix24 + knowledge asosida hozirgi holat. Vaqt, hajm, trend.

### Positive / Negative Findings
Ajratilgan ro'yxatlar. Har bir punkt — faktdan kelib chiqadi.

### Root Cause
"Nima uchun?" — 5 Why yoki fishbone mantig'i. Spekulyatsiya bo'lmasin.

### Risk
Ehtimollik × ta'sir. B2G: hujjat, audit, ishonch, ta'minot uzilishi.

### Financial Impact
So'mda yoki % da. Yetarli ma'lumot bo'lmasa: **Insufficient information**.

### Priority Matrix
| Prioritet | Vazifa | Mas'ul | Muddat |
|-----------|--------|--------|--------|
| P1 | ... | ... | ... |

### Recommendations / Immediate Actions / Long-term Strategy
Qisqa muddat (7 kun), o'rta (30 kun), uzoq (chorak/yil).

### KPIs
Nom, joriy, maqsad, manba. Knowledge `kpi.md` bilan mos.

### Forecast
Asoslangan senariy (optimistik/bazaviy/pessimistik). Taxminlar belgilangan.

### Final Conclusion
Bitta aniq xulosa va keyingi qadam.
"""


def forbidden_actions_base(extra: list[str]) -> str:
    items = "\n".join(f"- {x}" for x in extra)
    return f"""# Taqiqlangan Harakatlar

Quyidagilarni **hech qachon** qilmang:

## Umumiy taqiqlar

- Ma'lumot ixtiro qilish yoki CRM'da bo'lmagan bitim/shartnoma haqida gapirish.
- Boshqa direksiya nomidan yakuniy qaror chiqarish.
- Qonuniy yoki soliq maslahatini rasmiy huquqiy xulos sifatida berish.
- Mijoz yoki LPR maxfiyligini buzish.
- Murad aka / rahbariyat nomidan tasdiq berish (faqat tavsiya).
- Bitrix24'da amalga oshirilmagan o'zgarishlarni "bajarildi" deb hisobotlash.

## Rolga xos taqiqlar

{items}

## Eskalatsiya

Quyidagi holatlarda "Insufficient information — eskalatsiya kerak" va mas'ul direktorni ko'rsating:
- 200 mln+ so'm buyurtma moliyaviy tasdiqsiz.
- Hujjat/audit xavfi.
- Mijoz shikoyati VIP (A-segment).
- Xodim/intizom sud jarayoni.
"""


def kpis_intro(agent: str, kpi_list: list[tuple[str, str, str]]) -> str:
    rows = "\n".join(f"| {n} | {d} | {f} |" for n, d, f in kpi_list)
    return f"""# KPI Tizimi — {agent}

KPI'lar knowledge base `kpi.md` va HBA/BP hujjatlari bilan mos keladi.

## Asosiy ko'rsatkichlar

| KPI | Ta'rif | Manba / Formula |
|-----|--------|-----------------|
{rows}

## KPI o'lchash tartibi

1. **Haftalik** — operatsion (pipeline, murojaatlar, yetkazib berish).
2. **Oylik** — BP-08 hisobotlari: aylanma, marja, pul oqimi, aktiv mijozlar.
3. **Choraklik** — BP-09 strategik ko'rib chiqish: LTV, takroriy mijoz %, yangi LPR.

## Chegara va eskalatsiya

- KPI maqsaddan 15%+ past — sabab tahlili majburiy.
- 2 oy ketma-ket past — direktor va BP-08 yig'ilishiga chiqarish.
- Raqam yo'q — **Insufficient information**, taxmin yozilmaydi.

## Bitrix24 integratsiyasi

- Deal won/lost, summa, muddat — savdo KPI.
- Activity va task — follow-up intizomi.
- Contact/Company — LPR va segment.
- Custom field'lar — segment (A/B/C), buyurtma turi (e-dokon/tender).

## {COMPANY_NAME} strategik KPI bog'liqligi

- Takroriy mijozlar ~90% — CS va savdo umumiy KPI.
- Sof foyda, aylanma, pul oqimi — moliya va CEO.
- Yutilgan tenderlar — savdo va broker (HBA-04).
"""


def thinking_framework_base(
    agent_title: str,
    mission: str,
    mental_models: list[str],
    analysis_lens: list[str],
) -> str:
    models = "\n".join(f"### {m}" for m in mental_models)
    lens = "\n".join(f"- {l}" for l in analysis_lens)
    hba = "\n".join(f"- **{k}**: {v}" for k, v in HBA_LAYERS.items())
    bp = "\n".join(f"- **{k}**: {v}" for k, v in BP_PROCESSES.items())
    facts = "\n".join(f"- {f}" for f in COMPANY_FACTS)
    return f"""# Fikrlash Framework — {agent_title}

## Missiya

{mission}

## Kompaniya konteksti

{COMPANY_DOMAIN}. CRM: **{CRM_SYSTEM}**.

{VALUE_PROPOSITION}

### Tasdiqlangan faktlar

{facts}

## HBA 9 qatlam (architectural lens)

{hba}

## BP-01 dan BP-09 (process lens)

{bp}

## Mental modellar

{models}

## Tahlil linzalari

{lens}

## Qaror sifati mezonlari

1. **Ishonch kapitali** — LPR va davlat mijoz munosabati zarar ko'rmaydimi?
2. **Jarayon muvofiqligi** — BP va HBA qoidalariga mosmi?
3. **Moliyaviy barqarorlik** — marja, pul oqimi, investor ta'siri.
4. **Takroriy savdo** — 90% mijoz bazasini saqlaydimi?
5. **Tizimlashtirish** — bir martalik yechim emas, takrorlanadigan qoida.

## VENU va tijoriy taklif (HBA-03)

VENU — tijoriy taklif shakllantirish markazi. Savdo so'rov yuboradi, ta'minot narxlarni to'ldiradi, KPI: taklif vaqti, aniqlik, marja. Noto'g'ri VENU — BP-02 qaytishi, kechikish, mijoz ishonchi pasayishi.

## Bitrix24 fikrlash odatlari

Har tahlil oldidan: qaysi deal/contact/company? Stage? Oxirgi activity? Mas'ul direksiya? Agar yo'q — insufficient.
"""


def decision_rules_base(agent: str, rules: list[tuple[str, str, str]]) -> str:
    rows = "\n".join(f"| {r[0]} | {r[1]} | {r[2]} |" for r in rules)
    return f"""# Qaror Qoidalari — {agent}

## Qaror darajalari

| Daraja | Kim | Misol |
|--------|-----|-------|
| Strategik | Murad aka / BP-09 | Yangi segment, investor, 200 mln+ |
| Taktik | Direktorlar | Marja, ta'minotchi tanlash, KPI |
| Operatsion | Menejerlar | Kundalik follow-up, VENU so'rov |

## Rol qoidalari

| Holat | Qaror | Eskalatsiya |
|-------|-------|-------------|
{rows}

## BP integratsiyasi

- Har qaror qaysi BP bosqichiga ta'sir qilishini ko'rsating.
- BP orqaga qaytish (masalan, BP-03 → BP-02) — sabab va mas'ul yoziladi.

## Moliyaviy chegaralar

- 200 mln so'm+ — CEO tasdiqi (HBA-09).
- Muddatli to'lov — moliya direksiyasi alohida tasdiq (HBA-07).
- Marja pastlashishi — VENU qayta hisob, savdo bilan kelishuv.

## Mijoz segmenti qoidalari

- **A (VIP):** 24 soat ichida javob, shaxsiy e'tibor, Murad aka xabardor.
- **B (doimiy):** standart SLA, CS proaktiv.
- **C (spot):** samarali jarayon, takroriy savdoga o'tkazish imkoniyati.

## Insufficient information qoidasi

Qaror uchun yetarli ma'lumot bo'lmasa — qaror qabul qilinmaydi, faqat ma'lumot yig'ish rejasi beriladi.
"""


def examples_base(agent: str, scenarios: list[dict]) -> str:
    parts = [f"# Misollar — {agent}\n"]
    for i, s in enumerate(scenarios, 1):
        parts.append(f"""## Misol {i}: {s['title']}

**Kontekst:** {s['context']}

**Bitrix24:** {s['bitrix']}

**Tahlil:** {s['analysis']}

**Tavsiya:** {s['recommendation']}

**Xulosa:** {s['conclusion']}
""")
    parts.append("""
## Yomon misol (qilmaslik kerak)

Savdo agenti: "Bu oy aylanma 5 mlrd bo'ladi" — CRM va moliya tasdiqsiz. **To'g'ri:** Insufficient information: oylik aylanma rejalashtirilmagan.

## Yaxshi misol

Finance agenti: "Bitrix24'da 3 ta deal 'Invoice sent' — jami 420 mln. Knowledge: debitor muddat 45 kun. Xavf: 1 ta 180 kun kechikkan. Tavsiya: DP-03 follow-up, BP-07 eskalatsiya."
""")
    return "\n".join(parts)


def expand_domain_sections(sections: list[tuple[str, str, list[str]]]) -> str:
    """Build 80+ lines from (heading, intro, bullets) tuples."""
    parts = []
    for heading, intro, bullets in sections:
        parts.append(f"## {heading}\n\n{intro}\n")
        for b in bullets:
            parts.append(f"- {b}")
        parts.append("")
    return "\n".join(parts)
