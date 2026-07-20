export type SalesIntent =
  | "casual_chat"
  | "knowledge_only"
  | "crm_only"
  | "knowledge_plus_crm";

export interface SalesIntentResult {
  intent: SalesIntent;
  matchedKeywords: string[];
  needsKnowledge: boolean;
  needsCrm: boolean;
}

const CASUAL = [
  "salom",
  "assalom",
  "hello",
  "hi",
  "rahmat",
  "tashakkur",
  "nima qiladi",
  "kim san",
  "sen kimsan",
  "o'zingni tanishtir",
];

const KNOWLEDGE = [
  "jarayon",
  "skript",
  "e'tiroz",
  "etiroz",
  "follow-up",
  "follow up",
  "qoida",
  "reglament",
  "mezon",
  "kpi",
  "konversiya mezon",
  "yopish usul",
  "savdo bosqich",
  "lead bilan",
  "ehtiyoj",
  "amaliy qo'llanma",
  "aq-06",
  "aq-01",
  "baholash",
];

const CRM = [
  "bitrix",
  "crm",
  "bitim",
  "lead",
  "lid",
  "savdo",
  "sotuv",
  "yopilgan",
  "yutqazilgan",
  "yo'qotilgan",
  "konversiya",
  "menejer",
  "pipeline",
  "bosqich",
  "bugun",
  "oy",
  "hafta",
  "summa",
  "kechikkan",
  "turib qolgan",
  "follow-up",
  "manba",
  "qancha",
  "nechta",
  "jonli",
];

function hasAny(text: string, signals: string[]): string[] {
  return signals.filter((s) => text.includes(s));
}

export function analyzeSalesIntent(question: string): SalesIntentResult {
  const text = question.toLowerCase().trim();
  const casualHits = hasAny(text, CASUAL);
  const knowledgeHits = hasAny(text, KNOWLEDGE);
  const crmHits = hasAny(text, CRM);

  const aboutAgent =
    /sales agent|sotuv agenti|nima qiladi|kim san|o'zingni/.test(text) &&
    !/bitim|lead|savdo qancha|bugun|oy|menejer/.test(text);

  if (
    aboutAgent ||
    (casualHits.length > 0 &&
      knowledgeHits.length === 0 &&
      crmHits.length === 0 &&
      text.split(/\s+/).length <= 8)
  ) {
    return {
      intent: "casual_chat",
      matchedKeywords: casualHits,
      needsKnowledge: false,
      needsCrm: false,
    };
  }

  const processKnowledge =
    /jarayon qanday|qanday bo'lishi kerak|skript|e'?tiroz bilan|follow-up qoida/.test(text) &&
    !/bugun|oy|bitim|menejer|qancha|jonli|holatni bahola/.test(text);

  if (processKnowledge) {
    return {
      intent: "knowledge_only",
      matchedKeywords: [...new Set([...casualHits, ...knowledgeHits, ...crmHits])],
      needsKnowledge: true,
      needsCrm: false,
    };
  }

  const impliedCrm =
    crmHits.length > 0 ||
    /bitim|lead|lid|savdo|sotuv|menejer|konversiya|bugun|oy|pipeline|turib qol|holatni bahola/.test(
      text
    );

  const impliedKnowledge =
    knowledgeHits.length > 0 ||
    /jarayon|qoida|skript|e'?tiroz|kpi|mezon|bahola/.test(text);

  let intent: SalesIntent;
  if (impliedKnowledge && impliedCrm) intent = "knowledge_plus_crm";
  else if (impliedCrm) intent = "crm_only";
  else if (impliedKnowledge) intent = "knowledge_only";
  else if (/holat|tahlil|qanday|nega/.test(text)) intent = "knowledge_plus_crm";
  else intent = "knowledge_only";

  return {
    intent,
    matchedKeywords: [...new Set([...casualHits, ...knowledgeHits, ...crmHits])],
    needsKnowledge: intent === "knowledge_only" || intent === "knowledge_plus_crm",
    needsCrm: intent === "crm_only" || intent === "knowledge_plus_crm",
  };
}
