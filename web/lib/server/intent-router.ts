export type IntentType = "casual_chat" | "knowledge_question" | "crm_question" | "hybrid_question";

export type DomainIntent =
  | "general_summary"
  | "kpi"
  | "risk"
  | "forecast"
  | "finance"
  | "sales_pipeline"
  | "hr_workload"
  | "marketing_sources"
  | "customer_retention"
  | "tasks"
  | "deals"
  | "leads"
  | "contacts"
  | "strategy"
  | "operations"
  | "unknown";

export interface RouteIntent {
  type: IntentType;
  domainIntent: DomainIntent;
  matchedKeywords: string[];
}

const DOMAIN_KEYWORD_MAP: Record<DomainIntent, string[]> = {
  kpi: ["kpi", "ko'rsatkich", "indikator", "metric"],
  risk: ["risk", "xavf", "muammo", "problem"],
  forecast: ["forecast", "prognoz", "bashorat"],
  finance: ["finance", "moliya", "cash", "pul oqimi", "profit", "marja", "qarzdor"],
  sales_pipeline: ["pipeline", "voronka", "savdo", "konversiya", "close rate", "sotuv"],
  hr_workload: ["hr", "xodim", "yuklama", "workload", "recruitment", "kadrlar"],
  marketing_sources: ["marketing", "source", "lead source", "campaign", "reklama", "targ'ibot"],
  customer_retention: ["retention", "renewal", "churn", "customer success", "upsell", "mijozlar"],
  tasks: ["task", "vazifa", "todo", "deadline", "topshiriq", "nima qildi", "nima ish"],
  deals: ["deal", "bitim", "opportunity", "stage", "yopildi", "sotildi"],
  leads: ["lead", "lid", "yangi mijoz", "mijoz so'rovi", "mijoz so‘rovi"],
  contacts: ["contact", "kontakt", "aloqa", "tashkilot"],
  strategy: ["strategy", "strategik", "yo'nalish", "roadmap"],
  operations: ["operations", "operatsion", "jarayon", "process"],
  general_summary: ["xulosa", "summary", "umumiy", "overview", "crm holati"],
  unknown: [],
};

const CASUAL_PATTERNS: RegExp[] = [
  /^(salom|assalomu?\s*alaykum|hayrli\s+(tong|kun|kech)|hello|hi|xayr|rahmat|sog'? bo'ling)[\s!.,?]*$/i,
  /\b(qalaysiz|qandaysiz|yaxshimisiz|ahvolingiz)\b/i,
  /\b(nimalar qila olasiz|nima qila olasiz|qanday yordam bera olasiz|qanday yordam)\b/i,
  /\b(o['']?zingiz haqingizda|kim siz|siz kimsiz|o['']?zingizni tanishtiring)\b/i,
  /\b(yordam bering|yordam kerak|yordamchi)\b/i,
  /\b(rahbar|moliya|sotuv|targ'ibot|mijozlar|xodimlar|bosh direktor)\s+agenti\s+nima\s+qiladi\b/i,
  /\bagent\s+nima\s+qiladi\b/i,
  /\b(imkoniyat(lar)?ingiz|vazifangiz|rolingiz)\b/i,
];

const KNOWLEDGE_SIGNALS: string[] = [
  "qoida",
  "qoidalar",
  "qoidalariga",
  "baholanadi",
  "baholash",
  "tushuntir",
  "tushuntiring",
  "nima degani",
  "qanday ishlash",
  "qanday ishlaydi",
  "strategiya",
  "siyosat",
  "metod",
  "bilim bazasi",
  "o'qitilgan",
  "ko'rsatkich nima",
  "nima uchun",
  "qanday qilinadi",
  "standart",
  "reglament",
];

const CRM_SIGNALS: string[] = [
  "bugun",
  "kecha",
  "shu hafta",
  "nechta",
  "qancha sot",
  "qancha sotuv",
  "qancha sotildi",
  "bugungi savdo",
  "kim qancha",
  "nima qildi",
  "yangi mijoz",
  "vazifalar holati",
  "qarzdor",
  "bitimlar soni",
  "bitim soni",
  "qaysi bitim",
  "bugungi topshiriq",
  "bugungi vazifa",
  "xodim faoliyati",
  "crm holati",
  "bitrix",
  "bitrix24",
  "sotuv bo'ldi",
  "savdo bo'ldi",
  "sotuv",
  "savdo",
  "qancha sotildi",
  "qancha sotuv",
  "bugungi savdo",
  "7 kunlik",
  "oxirgi 7 kun",
  "yopilgan bitim",
  "ochiq bitim",
  "lid soni",
  "konversiya",
  "jami",
  "umumiy",
  "menejer",
  "mas'ul",
  "eng katta",
  "eng ko'p",
  "eng kop",
  "hisobot",
  "yutqazilgan",
  "voronka",
  "bosqich",
  "pipeline",
  "summasi",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/ʻ|’|`/g, "'");
}

function matchSignals(text: string, signals: string[]): string[] {
  return signals.filter((s) => text.includes(s));
}

function inferDomainIntent(text: string): DomainIntent {
  const matches: { intent: DomainIntent; keyword: string }[] = [];
  for (const [intent, keywords] of Object.entries(DOMAIN_KEYWORD_MAP) as [DomainIntent, string[]][]) {
    if (intent === "unknown") continue;
    for (const keyword of keywords) {
      if (text.includes(keyword)) matches.push({ intent, keyword });
    }
  }
  if (!matches.length) return "unknown";
  return matches[0].intent;
}

function isCasualChat(text: string, raw: string): boolean {
  const trimmed = raw.trim();
  if (CASUAL_PATTERNS.some((re) => re.test(trimmed) || re.test(text))) return true;
  if (trimmed.length <= 20 && /^(salom|hi|hello|rahmat)/i.test(trimmed)) return true;
  return false;
}

function hasPersonActivityQuestion(text: string): boolean {
  return /\b(nima qildi|nima ish|qanday ishladi|bugun nima)\b/i.test(text);
}

function hasCapitalizedName(raw: string): boolean {
  return /\b[A-Z\u0410-\u042F][a-z\u0430-\u044f]{2,}\b/.test(raw);
}

export function analyzeRouteIntent(question: string): RouteIntent {
  const raw = question.trim();
  const text = normalize(raw);

  if (!text) {
    return { type: "casual_chat", domainIntent: "unknown", matchedKeywords: [] };
  }

  if (isCasualChat(text, raw)) {
    return { type: "casual_chat", domainIntent: "unknown", matchedKeywords: ["casual"] };
  }

  const crmHits = matchSignals(text, CRM_SIGNALS);
  const knowledgeHits = matchSignals(text, KNOWLEDGE_SIGNALS);

  if (hasPersonActivityQuestion(text) && hasCapitalizedName(raw)) {
    if (!crmHits.includes("nima qildi")) crmHits.push("nima qildi");
  }

  const domainIntent = inferDomainIntent(text);
  const matchedKeywords = [...new Set([...crmHits, ...knowledgeHits])];

  const wantsCrmData =
    crmHits.some((h) => !["sotuv", "savdo"].includes(h)) ||
    /\b(bugun|kecha|nechta|qancha|nima qildi|oxirgi|7 kun|30 kun|yopildi|yaratildi|bitim|jami|umumiy|menejer|eng katta|eng ko'p|eng kop|hisobot|voronka|yutqazilgan|shu oy|shu hafta|shu yil)\b/.test(text) ||
    (domainIntent === "tasks" && hasCapitalizedName(raw)) ||
    (hasPersonActivityQuestion(text) && hasCapitalizedName(raw));

  const wantsCrm = wantsCrmData;

  const wantsKnowledge =
    knowledgeHits.length > 0 ||
    /\b(qoidalariga ko'ra|qoidalar bo'yicha|standart bo'yicha)\b/.test(text);

  if (wantsCrm && wantsKnowledge) {
    return { type: "hybrid_question", domainIntent, matchedKeywords };
  }
  if (wantsCrm) {
    return { type: "crm_question", domainIntent, matchedKeywords };
  }
  if (wantsKnowledge) {
    return { type: "knowledge_question", domainIntent, matchedKeywords };
  }

  // Umumiy tushuntirish — bilim bazasi, CRM emas
  if (
    /\b(nima|qanday|nega|kim|qaysi|tushuntir|ma'lumot ber|qoida|qoidalar)\b/.test(text) &&
    !/\b(bugun|nechta|qancha sot|bitim yop|bitim yarat)\b/.test(text)
  ) {
    return { type: "knowledge_question", domainIntent, matchedKeywords };
  }

  return { type: "casual_chat", domainIntent: "unknown", matchedKeywords: ["default_casual"] };
}
