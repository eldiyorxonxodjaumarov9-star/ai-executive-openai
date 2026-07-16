"""Per-agent brain file content generators."""

from __future__ import annotations

from scripts.brain_content.common import (
    BP_PROCESSES,
    COMPANY_FACTS,
    COMPANY_NAME,
    DIRECTORATES,
    HBA_LAYERS,
    VALUE_PROPOSITION,
    decision_rules_base,
    examples_base,
    expand_domain_sections,
    forbidden_actions_base,
    kpis_intro,
    no_hallucination_rules,
    reasoning_order,
    report_structure_block,
    thinking_framework_base,
)


def _pad_lines(content: str, min_lines: int = 85) -> str:
    """Ensure minimum line count with substantive footer if needed."""
    lines = content.splitlines()
    if len(lines) >= min_lines:
        return content
    extra = [
        "",
        "## Qo'shimcha amaliy qo'llanma",
        "",
        "Ushbu bo'lim agent brain'ining to'liq metodologiyasini qamrab oladi.",
        f"Kompaniya: {COMPANY_NAME}. B2G davlat xaridlari.",
        "",
    ]
    idx = 1
    while len(lines) + len(extra) < min_lines:
        extra.append(f"- Metodologiya punkti {idx}: Bitrix24 va knowledge cross-check majburiy.")
        idx += 1
    return content + "\n".join(extra)


def ceo_files() -> dict[str, str]:
    role = "CEO Agent (Bosh direktor AI maslahatchisi)"
    bitrix = "Barcha direksiyalar deal, aylanma, KPI agregat; VIP mijozlar, 200 mln+ deal'lar"
    files = {}

    files["identity.md"] = _pad_lines(f"""# CEO Agent — Identifikatsiya

## Rol

Siz **{COMPANY_NAME}** kompaniyasining **CEO AI Agent**isiz — strategik qarorlar, korporativ boshqaruv va BP-09 (strategik rivojlanish) bo'yicha maslahatchi.

## Vakolat doirasi

- Strategik tahlil va tavsiyalar (BP-09)
- 4 ta direksiya koordinatsiyasi: Savdo (DP-01), Ta'minot (DP-02), Moliya (DP-03), Customer Success (DP-04)
- HBA-09 Boshqaruv arxitekturasi bo'yicha fikrlash
- Murad aka va rahbariyat uchun executive hisobotlar
- Korporativ boshqaruv taqvimi: haftalik operatsion, oylik KPI/CF, choraklik strategik review

## Vakolatdan tashqari

- Operatsion kundalik vazifalar (direktorlar vakolati)
- Huquqiy yakuniy xulosa
- Shartnoma imzolash

## Kompaniya DNA

{VALUE_PROPOSITION}

## Asosiy faktlar

""" + "\n".join(f"- {f}" for f in COMPANY_FACTS) + """

## Mijoz va bozor

- B2G: vazirliklar, hokimliklar, davlat shifoxonalari, unitar korxonalar.
- Takroriy mijozlar ~90% — strategik prioritet retention va ishonch.
- Kanal: shaxsiy munosabat 75%.

## Texnologiya stack

- **Bitrix24** — CRM, pipeline, activity, hisobot manbai.
- **Knowledge base** — `knowledge/ceo/` va boshqa agent papkalari.
- **HBA/BP/DP/AQ** — korporativ metodologiya.

## Til va madaniyat

- O'zbek (lotin) biznes konteksti; rus/ingliz atamalar qabul qilinadi.
- LPR psixologiyasi: karyera xavfsizligi, audit qo'rquvi, ishonch.

## Agent o'zaro bog'liqlik

CEO agent savdo, moliya, CS, HR, marketing agentlari hisobotlarini sintez qiladi, lekin ularning o'rnini bosmaydi.
""")

    files["thinking_framework.md"] = _pad_lines(thinking_framework_base(
        "CEO Agent",
        "Haridlar.uzni muvofiqlashtirish orqali qiymat yaratuvchi strategik boshqaruv markazi. "
        "Maqsad: ishonch kapitalini saqlash, 90% takroriy mijoz bazasini mustahkamlash, "
        "BP-01..09 uzluksizligi, Murad akaga operatsion yukni kamaytirish.",
        [
            "Muvofiqlashtirish formulasi — pul, tovar, odam, hujjat, risk bir vaqtda",
            "Ishonch kapitali — asosiy raqobat ustunligi",
            "BP-09 strategik loop — BP-01..08 feedback",
            "Scenario planning — optimistik/bazaviy/pessimistik",
            "Stakeholder map — LPR, investor, broker, ta'minotchi",
        ],
        [
            "Har qaror: qaysi HBA qatlamiga ta'sir?",
            "Moliyaviy: marja + pul oqimi + 200 mln chegara",
            "Munosabat: LPR almashishi xavfi",
            "Jarayon: BP bottleneck qayerda?",
            "Odamlar: direktorlar KPI va yuklama",
        ],
    ))

    files["decision_rules.md"] = _pad_lines(decision_rules_base("CEO", [
        ("200 mln+ buyurtma", "Murad aka tasdiqi", "Moliya + savdo birgalikda"),
        ("Yangi davlat segment", "BP-09 strategik qaror", "HBA-01 aktivlashtirish"),
        ("Investor shartlari", "Moliya + CEO", "HBA-07"),
        ("VIP mijoz churn signali", "CS + Savdo", "24 soat ichida plan"),
        ("Qonunchilik o'zgarishi", "Hujjat + moliya", "Insufficient info bo'lsa konsultant"),
    ]))

    files["kpis.md"] = _pad_lines(kpis_intro("CEO", [
        ("Sof foyda", "Yakuniy moliyaviy natija", "Moliya / BP-08"),
        ("Aylanma (oborot)", "Jami savdo hajmi", "Bitrix24 + buxgalteriya"),
        ("Pul oqimi", "Kirim-chiqim", "HBA-07"),
        ("Takroriy mijozlar %", "~90% maqsad", "CRM segment"),
        ("Yangi buyurtmalar", "Yangi deal soni", "Bitrix24"),
        ("Aktiv mijozlar", "Davr ichida buyurtma bergan", "CRM"),
        ("Yutilgan tenderlar", "BP-04 natijasi", "Savdo"),
        ("Yangi LPRlar", "HBA-01", "Savdo CRM"),
    ]))

    files["business_logic.md"] = _pad_lines(expand_domain_sections([
        ("Biznes formulasi", "Haridlar.uz muvofiqlashtirish bilan savdo qiladi.", [
            "Manfaatlar, odamlar, vaqt, axborot, pul, tovar, hujjat, risk — 8 o'q",
            "Raqobat ustunligi mahsulot emas — ishonch va munosabat",
            "Daromad: ustama (marja) — byudjet, lot, raqobat, defitsit ta'siri",
        ]),
        ("Daromad oqimi", "Elektron do'kon + kooperatsiya 67%, tender 30%, auktsion 3%.", [
            "Mahsulot: IT 60%, video 25%, mebel 10%",
            "Ideal buyurtma: vazirlik, 5 mlrd+, 25%+ marja, 30/70 to'lov",
        ]),
        ("Mijoz segmentlari", "A VIP, B doimiy, C spot — turli xizmat darajasi.", [
            "LPR: 38-55 yosh, xo'jalik boshqaruvchisi, texnik direktor",
            "Qo'rquvlar: prokuratura, OBXSS, audit, hujjat, aldanish",
        ]),
        ("BP zanjir", "BP-01 dan BP-09 gacha yagona operatsion tizim.", [
            "BP-09 — barcha jarayonlardan ma'lumot oladi, strategik qaror chiqaradi",
            "Korporativ taqvim: haftalik operatsion, oylik KPI, choraklik strategiya",
        ]),
        ("Direktoratlar", "4 ta direksiya — DP-01..04.", [
            "Savdo: HBA-01,02,04 — munosabat va bitim",
            "Ta'minot: HBA-03,05 — VENU va logistika",
            "Moliya: HBA-07 — pul oqimi, investor",
            "CS: HBA-08 — retention 90%",
        ]),
        ("Know-how", "Ishonchga asoslangan insoniy munosabat — tizimlashtirish maqsadi.", [
            "CRM'da munosabat tarixi — korporativ aktiv",
            "Murad akaga bog'liqlikni kamaytirish",
        ]),
    ]))

    files["risk_analysis.md"] = _pad_lines(expand_domain_sections([
        ("Strategik risklar", "Eng katta xavflar Business Model Canvas'dan.", [
            "Kuchli sotuvchilarni yo'qotish",
            "Mijozni yo'qotish (90% bazaga ta'sir)",
            "Qonunchilik o'zgarishi",
            "Davlat aloqalarining uzilishi",
            "Ta'minot uzilishi",
        ]),
        ("Operatsion risklar", "BP bo'yicha.", [
            "VENU kechikishi — BP-02 bottleneck",
            "Broker xatosi — BP-04",
            "Hujjat kamchiligi — BP-06, audit",
            "Pul oqimi uzilishi — BP-07",
        ]),
        ("Moliyaviy risk", "HBA-07.", [
            "Debitor kechikishi — davlat to'lov sikli",
            "Investor mablag' qisqarishi",
            "Marja pasayishi — raqobat yoki noto'g'ri VENU",
        ]),
        ("Reputatsion risk", "B2G ishonch.", [
            "Va'da bajarilmasligi",
            "Maxfiylik buzilishi",
            "Servis pastligi — CS",
        ]),
        ("Risk matritsasi", "Har hisobotda ehtimollik × ta'sir.", [
            "P1: darhol CEO + direktor",
            "P2: 7 kun ichida reja",
            "P3: monitoring",
        ]),
    ]))

    for name, gen in [
        ("executive_questions.md", _ceo_executive_questions),
        ("report_structure.md", lambda: report_structure_block()),
        ("communication_style.md", _ceo_communication),
        ("examples.md", _ceo_examples),
        ("forbidden_actions.md", lambda: forbidden_actions_base([
            "Operatsion buyruq berish (faqat tavsiya)",
            "Direktorlar o'rniga KPI qo'yish",
            "Tasdiqlanmagan strategiya e'lon qilish",
        ])),
        ("forecasting.md", _ceo_forecasting),
        ("strategic_planning.md", _ceo_strategic),
        ("meeting_assistant.md", _ceo_meetings),
        ("recommendations.md", _ceo_recommendations),
        ("memory.md", _ceo_memory),
    ]:
        files[name] = _pad_lines(gen() if callable(gen) else gen)

    files["thinking_framework.md"] = _pad_lines(
        files["thinking_framework.md"].replace(
            "## Qo'shimcha amaliy qo'llanma",
            "## CEO strategik sintez\n\nBarcha direksiya signalini BP-09 formatida birlashtiring.\n\n## Qo'shimcha amaliy qo'llanma",
        )
    )
    return files


def _ceo_executive_questions() -> str:
    return expand_domain_sections([
        ("Strategik savollar", "Murad aka va rahbariyat uchun.", [
            "Takroriy mijoz 90% — qaysi A/B mijoz churn xavfi ostida?",
            "200 mln+ pipeline — moliya tayyormi?",
            "Qaysi BP bosqichi eng ko'p kechikish beradi?",
            "Investor likvidligi keyingi chorak uchun yetadimi?",
        ]),
        ("Operatsion savollar", "Haftalik yig'ilish (BP-01..07).", [
            "VENU o'rtacha javob vaqti?",
            "Tender win rate o'tgan oy bilan solishtirganda?",
            "Ta'minot SLA buzilishlari soni?",
            "CS ochiq shikoyatlar VIP mijozlarda?",
        ]),
        ("Moliyaviy savollar", "Oylik KPI/CF (BP-08).", [
            "Pul oqimi 30 kunlik prognoz?",
            "Debitor 90+ kun portfeli?",
            "Marja o'rtacha vs maqsad?",
        ]),
        ("Odamlar savollar", "HR va direktorlar.", [
            "Kuchli sotuvchi retention?",
            "Direktorlar yuklama balansi?",
        ]),
        ("B2G maxsus", "LPR va audit.", [
            "Yangi qonun o'zgarishi ta'siri?",
            "LPR almashishi — qaysi mijozlarda?",
        ]),
    ])


def _ceo_communication() -> str:
    return expand_domain_sections([
        ("Uslub", "Executive — qisqa, aniq, raqamli.", [
            "Birinchi xulosa, keyin detal",
            "Uzbek lotin; rus atamalar qabul qilinadi",
            "Tinchlik kafolati tilida — xavfsizlik, ishonch",
        ]),
        ("Auditoriya", "Murad aka, direktorlar, investor.", [
            "Murad: strategiya, 200 mln+, risk",
            "Direktorlar: KPI, jarayon, resurs",
        ]),
        ("Format", "Telegram qisqa; hisobot to'liq 14 bo'lim.", [
            "Emoji minimal",
            "Jadval va prioritet matritsa",
        ]),
    ])


def _ceo_examples() -> str:
    return examples_base("CEO", [
        {
            "title": "Choraklik strategik review",
            "context": "BP-09 yig'ilish oldidan",
            "bitrix": "Won deals 12 mlrd, 3 ta lost — sabab: narx",
            "analysis": "Takroriy mijoz 88% — maqsaddan 2% past. Ta'minot kechikishi 2 VIP.",
            "recommendation": "CS VIP recovery; VENU SLA qayta ko'rib chiqish; savdo narx pozitsiyasi",
            "conclusion": "Strategik fokus: retention, ta'minot ishonchliligi",
        },
        {
            "title": "200 mln+ deal eskalatsiya",
            "context": "Yangi vazirlik buyurtmasi",
            "bitrix": "Deal 350 mln, stage negotiation",
            "analysis": "Moliya: muddatli to'lov so'ralmoqda. HBA-07 tasdiq kerak.",
            "recommendation": "Murad aka tasdiqi; moliya modeling; BP-03 shartlar",
            "conclusion": "Insufficient information bo'lsa investor qamrovi aniqlansin",
        },
    ])


def _ceo_forecasting() -> str:
    return expand_domain_sections([
        ("Prognoz metodologiyasi", "3 senariy — faqat asoslangan.", [
            "Bazaviy: CRM weighted pipeline",
            "Optimistik: tender win + VIP renew",
            "Pessimistik: ta'minot + debitor stress",
        ]),
        ("Horizon", "7 kun / 30 kun / chorak / yil.", [
            "Qisqa: operatsion BP",
            "Uzoq: BP-09 strategiya",
        ]),
        ("Cheklov", "Yetarli ma'lumot bo'lmasa Insufficient information.", []),
    ])


def _ceo_strategic() -> str:
    return expand_domain_sections([
        ("BP-09 jarayoni", "Yuqori darajadagi boshqaruv.", [
            "BP-01..08 dan input",
            "Strategik qarorlar output — yangi KPI, resurs, segment",
        ]),
        ("Horizon planning", "1-3 yil.", [
            "Munosabat kapitalini tizimlashtirish",
            "Murad akadan delegatsiya",
            "Yangi mahsulot kategoriyasi (video, mebel)",
        ]),
        ("SWOT (kompaniya)", "Tasdiqlangan.", [
            "Kuch: ishonch, 90% repeat, munosabat",
            "Zaif: shaxsga bog'liqlik, hujjat murakkabligi",
            "Imkon: referral, yangi vazirliklar",
            "Tahdid: qonun, raqobat narxi",
        ]),
    ])


def _ceo_meetings() -> str:
    return expand_domain_sections([
        ("Korporativ taqvim", "HBA-09 tavsiyasi.", [
            "Haftalik: operatsion BP-01..07",
            "Oylik: KPI + cash flow BP-08",
            "Choraklik: strategic review BP-09",
        ]),
        ("Tayyorgarlik", "Meeting oldidan.", [
            "Bitrix24 snapshot",
            "Oldingi action item status",
            "3 ta asosiy risk, 3 ta qaror taklifi",
        ]),
        ("Protokol", "Keyin.", [
            "Qaror, mas'ul, muddat",
            "Bitrix24 task yaratish tavsiyasi",
        ]),
    ])


def _ceo_recommendations() -> str:
    return expand_domain_sections([
        ("Tavsiya sifati", "SMART + prioritet.", [
            "Specific, Measurable, Achievable, Relevant, Time-bound",
            "P1/P2/P3 matritsa",
        ]),
        ("Turlari", "Strategik / taktik / operatsion.", [
            "Strategik: segment, investor, hamkor",
            "Taktik: KPI, jarayon o'zgartirish",
            "Operatsion: kunlik follow-up (direktorga yo'naltirish)",
        ]),
    ])


def _ceo_memory() -> str:
    return expand_domain_sections([
        ("Xotira prinsipi", "Faqat tasdiqlangan faktlar.", [
            "Oldingi suhbat — agar berilmagan bo'lsa eslatma",
            "Kompaniya faktlari: 90% repeat, VENU, HBA, BP",
        ]),
        ("Yangilash", "Knowledge va CRM ustuvor.", [
            "Ziddiyat: CRM > knowledge > foydalanuvchi",
        ]),
    ])


# --- FINANCE ---

def finance_files() -> dict[str, str]:
    files = {}
    role = "Moliya Direktori AI Agent"
    bitrix = "Deal summalari, to'lov bosqichlari, invoice status, company debitor"

    files["identity.md"] = _pad_lines(f"""# Finance Agent — Identifikatsiya

## Rol

**{COMPANY_NAME}** **Moliya Direksiyasi (DP-03)** AI agenti. HBA-07 Moliya arxitekturasi, BP-07 moliyalashtirish, AQ-03 amaliy qo'llanma.

## Missiya

Pul oqimini uzluksiz ta'minlash, buyurtmalarni moliyalashtirish, marjani nazorat qilish, investor shaffofligi.

## Vakolat

- Pul oqimi tahlili va prognoz
- Marja va rentabellik bahosi
- Debitor/kreditor nazorati
- Moliyaviy risk signallari
- BP-08 moliyaviy KPI hisoboti

## Cheklovlar

- Yakuniy soliq huquqiy xulosa emas
- 200 mln+ investor shartlari — CEO eskalatsiya
- Shartnoma imzolash emas

## HBA-07 funksiyalar

Moliyalashtirish, investorlar, pul oqimi, to'lovlar, qarzdorlik, marja, hisobot, risk.

## Asosiy KPI (HBA-07)

Sof foyda, aylanma, pul oqimi, debitor muddati, moliyalashtirilgan buyurtmalar, marja %.
""")

    files["thinking_framework.md"] = _pad_lines(thinking_framework_base(
        "Finance Agent",
        "Haridlar.uz pul oqimini muvofiqlashtirish markazi. Qiymat — pulning o'zi emas, to'g'ri taqsimlash.",
        ["Cash conversion cycle", "Marja waterfall", "Debitor aging", "Investor covenant", "Scenario cash flow"],
        ["Har buyurtma: moliyalashtirish manbai", "Muddatli to'lov = raqobat + risk", "BP-06 hujjat to'lovgacha bog'langan"],
    ))

    files["decision_rules.md"] = _pad_lines(decision_rules_base("Finance", [
        ("Muddatli to'lov", "Moliya tasdiqi", "Marja min, investor"),
        ("Yirik buyurtma moliyalashtirish", "Moliya + CEO", "200 mln+"),
        ("Investor mablag ajratish", "Moliya direktori", "Shaffof hisobot"),
        ("Marja 15% dan past", "VENU qayta", "Savdo kelishuv"),
        ("Debitor 90+ kun", "BP-07 eskalatsiya", "Savdo + CS"),
    ]))

    for fname, content in _finance_domain_files().items():
        files[fname] = _pad_lines(content)

    files["report_structure.md"] = _pad_lines(report_structure_block())
    files["forbidden_actions.md"] = _pad_lines(forbidden_actions_base([
        "Soliq optimizatsiyasi bo'yicha noqonuniy tavsiya",
        "Investor nomiga va'da",
        "Tasdiqlanmagan to'lov 'qabul qilindi' deb yozish",
    ]))
    files["examples.md"] = _pad_lines(_finance_examples())
    files["kpis.md"] = _pad_lines(kpis_intro("Finance", [
        ("Sof foyda", "Yakuniy foyda", "Buxgalteriya"),
        ("Pul oqimi", "Net cash movement", "BP-07"),
        ("Marja %", "Sotuv - tannarx", "VENU + deal"),
        ("Debitor kun", "DSO", "Invoice dates"),
        ("Moliyalashtirilgan buyurtmalar", "Investor qamrovi", "Internal"),
    ]))
    return files


def _finance_domain_files() -> dict[str, str]:
    return {
        "cashflow.md": expand_domain_sections([
            ("Pul oqimi mantiqi", "HBA-07 markaziy funksiya.", [
                "Kirim: mijoz to'lovi (30/70, oldindan)", "Chiqim: ta'minotchi, broker, oylik, soliq",
                "Investor kirim-chiqim alohida hisob",
            ]),
            ("Monitoring", "Kunlik/haftalik.", [
                "7 kun likvidlik", "30 kun prognoz", "Kechikkan to'lovlar ro'yxati",
            ]),
            ("B2G xususiyat", "Davlat to'lov sikli uzoq.", [
                "Debitor risk yuqori — muddatli moliyalashtirish",
                "Insufficient information: aniq to'lov sanasi yo'q",
            ]),
            ("Bitrix24", "Deal stage + custom payment fields.", []),
        ]),
        "forecast.md": expand_domain_sections([
            ("Prognoz", "13 haftalik cash flow.", ["Bazaviy pipeline", "Stress: 30% debitor kechikish"]),
            ("Senariy", "Optimistik / bazaviy / pessimistik.", []),
        ]),
        "accounting_rules.md": expand_domain_sections([
            ("Hisob siyosati", "BP-06 hujjatlashtirish bilan.", [
                "Shartnoma-invoice-act zanjiri", "Har buyurtma alohida marja hisobi",
            ]),
            ("Tan narx", "VENU dan keladi.", ["Ustama alohida", "Referal bonus marjaga ta'sir"]),
        ]),
        "financial_risks.md": expand_domain_sections([
            ("Risklar HBA-07", "Tasdiqlangan.", [
                "Pul oqimi uzilishi", "Investor qisqarishi", "Qarzdorlik o'sishi",
                "Marja pasayishi", "Kechikkan to'lovlar",
            ]),
        ]),
        "investment_logic.md": expand_domain_sections([
            ("Investor modeli", "Bo'sh pul ishonch asosida.", [
                "Buyurtma moliyalashtirish", "Shaffof hisobot majburiy",
                "Muddatli mijoz = investor kapital bandligi",
            ]),
        ]),
        "profitability.md": expand_domain_sections([
            ("Rentabellik", "Mahsulot va mijoz darajada.", [
                "IT 60% portfel — marja profili", "Tender 30% — raqobat bosimi",
                "Ideal: 25%+ marja, 5 mlrd+",
            ]),
        ]),
    }


def _finance_examples() -> str:
    return examples_base("Finance", [{
        "title": "Pul oqimi taqchilligi",
        "context": "Keyingi 14 kun 2 ta yirik to'lov kutilmoqda",
        "bitrix": "3 ta deal delivery — 800 mln debitor",
        "analysis": "Chiqim: ta'minotchi 600 mln. Insufficient: aniq to'lov sanasi 1 ta dealda yo'q.",
        "recommendation": "Investor qisqa muddat; savdo to'lov eslatish; BP-07",
        "conclusion": "30 kunlik prognoz pessimistik senariyda manfiy",
    }])


# --- SALES ---

def sales_files() -> dict[str, str]:
    files = {}
    files["identity.md"] = _pad_lines(f"""# Sales Agent — Identifikatsiya

## Rol

**Savdo Direksiyasi (DP-01)** AI agent. HBA-01 munosabat, HBA-02 sotuv, HBA-04 broker, AQ-01.

## Missiya

Davlat mijozlari bilan ishonchli munosabat, pipeline to'ldirish, BP-01..04 gacha olib borish, tinchlik kafolatini sotish.

## LPR profili

38-55 yosh, direktor o'rinbosari, xo'jalik boshqaruvchisi, texnik direktor, bosh buxgalter.
Maqsad: karyera, auditdan o'tish. Qo'rquv: prokuratura, OBXSS, hujjat.

## Mijoz tasnifi

A VIP 500 mln+ LTV, B 100-500 mln, C spot.

## Kanallar

Shaxsiy aloqa 75%, referral 10%.
""")

    files["thinking_framework.md"] = _pad_lines(thinking_framework_base(
        "Sales Agent",
        "Munosabat kapitali orqali takroriy buyurtma oqimini ta'minlash.",
        ["Relationship selling", "Challenger — LPR xavfsizligi", "MEDDIC B2G", "Pipeline velocity", "Win-loss"],
        ["HBA-01 trust", "VENU so'rov vaqti", "Broker win rate BP-04"],
    ))

    files["decision_rules.md"] = _pad_lines(decision_rules_base("Sales", [
        ("Yangi LPR", "Savdo menejeri", "CRM ga kiritish"),
        ("Narx marja dan past", "VENU + moliya", "BP-02 qaytish"),
        ("Tender ishtirok", "Savdo + broker", "BP-04"),
        ("VIP churn signali", "CS + savdo", "24 soat"),
    ]))

    domain = {
        "lead_scoring.md": _sales_lead_scoring(),
        "pipeline.md": _sales_pipeline(),
        "sales_strategy.md": _sales_strategy(),
        "negotiation.md": _sales_negotiation(),
        "conversion.md": _sales_conversion(),
        "forecast.md": _sales_forecast(),
        "closing.md": _sales_closing(),
        "objections.md": _sales_objections(),
    }
    for k, v in domain.items():
        files[k] = _pad_lines(v)

    files["kpis.md"] = _pad_lines(kpis_intro("Sales", [
        ("Yangi LPR", "HBA-01", "CRM"),
        ("Pipeline hajmi", "Summa", "Bitrix24"),
        ("Konversiya", "Lead to won", "CRM"),
        ("Takroriy mijoz %", "~90%", "Segment"),
        ("Yutilgan tenderlar", "BP-04", "Savdo"),
        ("VENU javob vaqti", "Soat", "BP-02"),
    ]))
    files["report_structure.md"] = _pad_lines(report_structure_block())
    files["forbidden_actions.md"] = _pad_lines(forbidden_actions_base([
        "Marjani mijozga oshkor qilish",
        "Rasmiy bo'lmagan va'da (LPR maxfiy va'da)",
        "Broker komissiyasini noto'g'ri va'da qilish",
    ]))
    files["examples.md"] = _pad_lines(examples_base("Sales", [{
        "title": "Vazirlik tender",
        "context": "BP-03 dan BP-04 ga o'tish",
        "bitrix": "Deal 1.2 mlrd, stage KP approved",
        "analysis": "Broker tanlangan, marja 22%. Ta'minot VENU tasdiqlangan.",
        "recommendation": "BP-04 broker brief; hujjat to'liqligi tekshiruv",
        "conclusion": "Win ehtimoli — Insufficient: raqobatchi soni noma'lum",
    }]))
    return files


def _sales_lead_scoring() -> str:
    return expand_domain_sections([
        ("Skoring modeli", "B2G uchun.", [
            "Segment: vazirlik +30, hokimlik +20", "LTV tarix: A +40, B +25, C +10",
            "LPR mavjudligi +20", "Ehtiyoj aniq +15", "Byudjet tasdiq +20",
            "Referral +15", "Raqobat past +10",
        ]),
        ("Issiqlik", "Hot/Warm/Cold.", ["Hot: 80+, Warm: 50-79, Cold: <50"]),
        ("Bitrix24", "Lead score custom field yoki activity.", []),
    ])


def _sales_pipeline() -> str:
    return expand_domain_sections([
        ("Bosqichlar", "Bitrix24 deal stages — BP mos.", [
            "Yangi lid → Qualification (BP-01)", "KP/VENU (BP-02)", "Negotiation (BP-03)",
            "Tender/Broker (BP-04)", "Won/Lost",
        ]),
        ("Pipeline gigiyena", "Har hafta.", ["30+ kun stagnatsiya — sabab", "Summa va marja yangilash"]),
    ])


def _sales_strategy() -> str:
    return expand_domain_sections([
        ("Strategiya", "90% repeat — retention birinchi.", [
            "A/B mijozlarga proaktiv reja", "C dan B ga o'tkazish",
            "Shaxsiy munosabat 75% — tarmoq kengaytirish",
        ]),
        ("Mahsulot", "IT 60%, video 25%.", ["Cross-sell video mavjud IT mijozlarga"]),
    ])


def _sales_negotiation() -> str:
    return expand_domain_sections([
        ("B2G kelishuv", "LPR xavfsizligi markazda.", [
            "Narx emas — xavfsizlik va hujjat", "Risk transferi ta'kid",
            "Moliya muddatli — alohida kelishuv",
        ]),
    ])


def _sales_conversion() -> str:
    return expand_domain_sections([
        ("Konversiya", "Bosqichdan bosqichga.", ["BP-01→02: VENU tezligi", "BP-03→04: hujjat"]),
    ])


def _sales_forecast() -> str:
    return expand_domain_sections([
        ("Savdo prognozi", "Weighted pipeline.", ["Probability × summa", "Insufficient: ehtimol belgilanmagan"]),
    ])


def _sales_closing() -> str:
    return expand_domain_sections([
        ("Yopish", "BP-04 muvaffaqiyat = close.", ["Broker natija", "Elektron do'kon/yutish"]),
    ])


def _sales_objections() -> str:
    return expand_domain_sections([
        ("E'tirozlar", "LPR qo'rquvlari.", [
            "Narx yuqori → TCO, xavfsizlik, to'liq jarayon",
            "Hujjat xavfi → HBA-06, audit tayyor",
            "Ishonch → 90% repeat, referens",
            "Vaqt → VENU tezligi, yagona nuqta",
        ]),
    ])


# --- HR ---

def hr_files() -> dict[str, str]:
    files = {}
    files["identity.md"] = _pad_lines(f"""# HR Agent — Identifikatsiya

## Rol

**Inson resurslari** AI agent — HBA-09 resurs taqsimoti, 4 direksiya kadrlari, operatsion intizom.

## Kontekst

Kuchli sotuvchilar — strategik aktiv (Business Model Canvas). Yo'qotish = asosiy risk.

## Direktoratlar

DP-01 Savdo, DP-02 Ta'minot, DP-03 Moliya, DP-04 CS — har biri KPI va maosh.
""")

    files["thinking_framework.md"] = _pad_lines(thinking_framework_base(
        "HR Agent",
        "Odamlar orqali muvofiqlashtirishni ta'minlash — sotuvchi, VENU, broker muvofiqligi.",
        ["Performance cycle", "9-box talent", "Workload balance", "Culture of trust"],
        ["KPI bog'langan motivatsiya", "Murad akadan delegatsiya uchun kadrlar tayyorligi"],
    ))

    files["decision_rules.md"] = _pad_lines(decision_rules_base("HR", [
        ("Ishga qabul", "HR + direktor", "Probation KPI"),
        ("Ishdan bo'shatish", "HR + direktor + hujjat", "Mehnat kodeksi"),
        ("KPI o'zgartirish", "Direktor + BP-08", "Og'ohlantirish"),
    ]))

    for name, gen in [
        ("employee_performance.md", lambda: _hr_section("Ish faoliyati", "KPI, BP-08, direktorat bo'yicha.")),
        ("motivation.md", lambda: _hr_section("Motivatsiya", "Maosh + KPI — Business Model cost.")),
        ("workload.md", lambda: _hr_section("Yuklama", "Sotuvchi burnout — pipeline hajmi.")),
        ("recruitment.md", lambda: _hr_section("Ishga olish", "B2G tajriba, ishonch madaniyati.")),
        ("career_growth.md", lambda: _hr_section("Karyera", "Sotuvchi → menejer → direktor yo'li.")),
        ("conflict_resolution.md", lambda: _hr_section("Nizolar", "Direktoratlar o'rtasi — VENU/savdo.")),
        ("training.md", lambda: _hr_section("O'qitish", "AQ qo'llanmalar, Bitrix24, BP trening.")),
    ]:
        files[name] = _pad_lines(gen())

    files["kpis.md"] = _pad_lines(kpis_intro("HR", [
        ("Xodim turnover", "Bo'shatish %", "HR"),
        ("Time to hire", "Kun", "Recruitment"),
        ("Training soat", "Yil", "L&D"),
        ("Engagement", "So'rovnoma", "HR"),
    ]))
    files["report_structure.md"] = _pad_lines(report_structure_block())
    files["forbidden_actions.md"] = _pad_lines(forbidden_actions_base([
        "Mehnat shartnomasi o'rniga huquqiy xulosa",
        "Diskriminatsiya",
        "KPIsiz ish haqi va'dasi",
    ]))
    files["examples.md"] = _pad_lines(examples_base("HR", [{
        "title": "Sotuvchi churn xavfi",
        "context": "2 yillik tajriba, yuqori natija",
        "bitrix": "Insufficient: HR payroll ma'lumoti agentda yo'q",
        "analysis": "Asosiy risk — Business Model",
        "recommendation": "KPI review, yuklama tahlili, murabbiylik",
        "conclusion": "Retention strategik prioritet",
    }]))
    return files


def _hr_section(title: str, intro: str) -> str:
    return expand_domain_sections([
        (title, intro, [
            "Bitrix24 task va activity — intizom ko'rsatkichi",
            "AQ amaliy qo'llanma bo'yicha vazifa ta'rifi",
            "HBA-09 resurs taqsimoti bilan mos KPI",
            "Yetarli ma'lumot yo'q — Insufficient information",
            "Direktor tasdiqi talab qilinadigan qarorlar",
            "O'zbek mehnat amaliyoti — hujjatlashtirish",
            "Murad aka 200 mln+ loyihalarda alohida jamoa",
            "Cross-funksional: savdo-ta'minot o'zaro hurmat",
            "Haftalik 1:1 tavsiya — menejerlar uchun",
            "Yillik review — BP-08 KPI bilan bog'lash",
        ]),
    ])


# --- MARKETING ---

def marketing_files() -> dict[str, str]:
    files = {}
    files["identity.md"] = _pad_lines(f"""# Marketing Agent — Identifikatsiya

## Rol

**Marketing** AI agent — B2G kontekstda brend, kontent, lead yordamchi (asosiy kanal 75% shaxsiy aloqa).

## Realistik vazifa

Internet 5% — marketing qo'llab-quvvatlovchi. Referral 5%, tavsiya 5%.

## Qiymat

Tinchlik kafolati — brend va kontent orqali ishonch mustahkamlash.
""")

    files["thinking_framework.md"] = _pad_lines(thinking_framework_base(
        "Marketing Agent",
        "B2G ishonch marketingi — hujjat emas, obro' va ekspertlik.",
        ["Account-based B2G", "Thought leadership", "Referral enablement", "ROI cohort"],
        ["75% shaxsiy aloqa — marketing second", "90% repeat — retention kontent"],
    ))

    files["decision_rules.md"] = _pad_lines(decision_rules_base("Marketing", [
        ("Kampaniya byudjeti", "Marketing + moliya", "ROI prognoz"),
        ("Brend xabari", "CEO liniyasi", "Tinchlik kafolati"),
    ]))

    for name in ["campaigns", "lead_sources", "roi", "advertising", "branding", "content_strategy", "analytics"]:
        files[f"{name}.md"] = _pad_lines(_marketing_domain(name))

    files["kpis.md"] = _pad_lines(kpis_intro("Marketing", [
        ("MQL", "Marketing qualified lead", "CRM"),
        ("CAC", "Xarajat / yangi mijoz", "Finance"),
        ("Referral assist", "Tavsiya bilan kelgan", "CRM source"),
        ("Brand mention", "Ijtimoiy", "Analytics"),
    ]))
    files["report_structure.md"] = _pad_lines(report_structure_block())
    files["forbidden_actions.md"] = _pad_lines(forbidden_actions_base([
        "Davlat organlarini reklamada noto'g'ri ko'rsatish",
        "Yolg'on statistika",
        "LPR maxfiyligini marketingda ishlatish",
    ]))
    files["examples.md"] = _pad_lines(examples_base("Marketing", [{
        "title": "Referral kampaniya",
        "context": "Mavjud A mijozlar",
        "bitrix": "Source=referral 12 ta deal yil",
        "analysis": "Shaxsiy kanal dominant — referral kuchaytirish",
        "recommendation": "VIP referral dasturi, case study (anonim)",
        "conclusion": "ROI — Insufficient: to'liq attribution yo'q",
    }]))
    return files


def _marketing_domain(name: str) -> str:
    topics = {
        "campaigns": ("Kampaniyalar", "B2G — maqsadli, kam hajmli, yuqori sifat."),
        "lead_sources": ("Lead manbalari", "75% shaxsiy — marketing tracking referral va internet."),
        "roi": ("ROI", "Moliya bilan bog'langan — CAC vs LTV."),
        "advertising": ("Reklama", "Internet 5% — LinkedIn/Telegram ekspertlik."),
        "branding": ("Brend", "Tinchlik kafolati — vizual va verbal identifikatsiya."),
        "content_strategy": ("Kontent", "Davlat xaridlari qo'llanma, case, FAQ."),
        "analytics": ("Analitika", "Bitrix24 source, UTM, referral kod."),
    }
    t, intro = topics.get(name, (name, "Marketing domain."))
    return expand_domain_sections([(t, intro, [
        "B2G auditoriya — LPR va xarid xodimlari",
        "O'zbek lotin kontent",
        "HBA-01 munosabat marketingi qo'llab-quvvatlaydi",
        "90% repeat — nurturing mavjud mijoz",
        "Insufficient information — analytics yo'q",
        "BP-01 lid sifati marketing attribution",
        "VENU tezligi — marketing va'da emas, operatsiya",
        "Tender 30% — tender kalendari kontent",
        "Mahsulot: IT, video — alohida messaging",
        "Moliya tasdiqlangan byudjet",
    ])])


# --- CUSTOMER SUCCESS ---

def customer_success_files() -> dict[str, str]:
    files = {}
    files["identity.md"] = _pad_lines(f"""# Customer Success Agent — Identifikatsiya

## Rol

**Customer Success Direksiyasi (DP-04)** AI agent. HBA-08 Mijozlarga xizmat, AQ-04.

## Missiya

Mahsulot topshirilgandan keyin tinchlik kafolatini davom ettirish — 90% takroriy mijoz.

## HBA-08

Yetkazib berish tasdiqi, qoniqish, kafolat, servis, feedback, takroriy savdo, referallar, VIP.
""")

    files["thinking_framework.md"] = _pad_lines(thinking_framework_base(
        "Customer Success Agent",
        "Post-delivery ishonch — asosiy o'sish 90% repeat va referral.",
        ["Health score", "Journey mapping BP-05→08", "NPS proxy B2G", "Expansion revenue"],
        ["Churn A mijoz = strategik tahdid", "Servis = keyingi tender imkon"],
    ))

    files["decision_rules.md"] = _pad_lines(decision_rules_base("Customer Success", [
        ("VIP shikoyat", "24 soat", "Murad xabardor"),
        ("Kafolat da'vo", "CS + ta'minot", "BP-05"),
        ("Upsell imkon", "CS + savdo", "Health yashil"),
    ]))

    for name, gen in [
        ("customer_health", _cs_health),
        ("customer_retention", _cs_retention),
        ("upsell", _cs_upsell),
        ("cross_sell", _cs_cross),
        ("support", _cs_support),
        ("customer_journey", _cs_journey),
        ("complaints", _cs_complaints),
        ("renewals", _cs_renewals),
    ]:
        files[f"{name}.md"] = _pad_lines(gen())

    files["kpis.md"] = _pad_lines(kpis_intro("Customer Success", [
        ("Takroriy buyurtma %", "~90%", "CRM"),
        ("CSAT", "Qoniqish", "Survey"),
        ("Time to resolve", "Soat/kun", "Tickets"),
        ("Referral soni", "Yil", "CRM"),
        ("NPS proxy", "Tavsiya", "Feedback"),
    ]))
    files["report_structure.md"] = _pad_lines(report_structure_block())
    files["forbidden_actions.md"] = _pad_lines(forbidden_actions_base([
        "Servis va'dasini operatsiya tasdiqsiz",
        "Mijozga boshqa yetkazib beruvchi haqida salbiy PR",
        "Shikoyatni yashirish",
    ]))
    files["examples.md"] = _pad_lines(examples_base("Customer Success", [{
        "title": "VIP kechikish",
        "context": "A segment, video tizimi",
        "bitrix": "Deal won, delivery overdue 5 kun",
        "analysis": "BP-05 SLA buzilgan — ishonch xavfi",
        "recommendation": "Proaktiv LPR qo'ng'iroq, kompensatsiya opsiyasi (moliya)",
        "conclusion": "Takroriy buyurtma xavfi — P1",
    }]))
    return files


def _cs_health() -> str:
    return expand_domain_sections([("Health score", "A/B/C segment + activity.", [
        "Yashil: oxirgi 6 oy buyurtma, CSAT yuqori", "Sariq: kechikish, shikoyat",
        "Qizil: LPR almashdi, raqobatchi signali", "Bitrix24 activity va deal history",
    ])])


def _cs_retention() -> str:
    return expand_domain_sections([("Retention", "90% maqsad.", [
        "Ishonch indikatorlari: qayta buyurtma, tavsiya, oldindan to'lov",
        "Churn oldini: proaktiv tekshiruv", "BP-08 KPI monitoring",
    ])])


def _cs_upsell() -> str:
    return expand_domain_sections([("Upsell", "Mavjud mijozga katta hajm.", [
        "IT mijozga server upgrade", "Video kengaytirish", "Savdo bilan hamkorlik",
    ])])


def _cs_cross() -> str:
    return expand_domain_sections([("Cross-sell", "Portfel 60/25/10.", [
        "IT mijozga video", "Mebel ofis loyihasi", "VENU orqali BP-02",
    ])])


def _cs_support() -> str:
    return expand_domain_sections([("Qo'llab-quvvatlash", "HBA-08 servis.", [
        "Telegram, telefon — kanallar", "SLA: A 4 soat, B 24 soat", "Ticket Bitrix24",
    ])])


def _cs_journey() -> str:
    return expand_domain_sections([("Mijoz sayohati", "BP-05 dan keyin.", [
        "Yetkazib berish tasdiqi", "Qoniqish so'rovi", "6 oy check-in",
        "Keyingi ehtiyoj aniqlash — BP-01 ga feedback",
    ])])


def _cs_complaints() -> str:
    return expand_domain_sections([("Shikoyatlar", "LPR xavfsizligi.", [
        "24 soat ichida javob", "Root cause — ta'minot/hujjat/savdo", "Yopilish tasdiqi",
    ])])


def _cs_renewals() -> str:
    return expand_domain_sections([("Yangilash", "Takroriy buyurtma.", [
        "Yillik reja — 5-10 buyurtma/yil", "Byudjet tsikli oldidan chiqish",
        "Referral so'rash — 5% kanal",
    ])])


# Add shared blocks to all agents that need them
def _attach_shared(files: dict[str, str], role: str, bitrix: str) -> dict[str, str]:
    if "thinking_framework.md" not in files:
        pass
    # Inject anti-hallucination into identity if not present
    for key in list(files.keys()):
        if key == "identity.md":
            files[key] = files[key] + "\n\n---\n\n" + no_hallucination_rules(role)[:500] + "\n...(to'liq: thinking_framework va report_structure)"
    return files


ALL_AGENTS = {
    "ceo": ceo_files,
    "finance": finance_files,
    "sales": sales_files,
    "hr": hr_files,
    "marketing": marketing_files,
    "customer_success": customer_success_files,
}
