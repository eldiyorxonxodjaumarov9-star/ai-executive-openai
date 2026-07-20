export type FinanceIntent =
  | "casual_chat"
  | "knowledge_only"
  | "crm_only"
  | "knowledge_plus_crm";

export interface FinanceIntentResult {
  intent: FinanceIntent;
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
  "imkoniyat",
];

const KNOWLEDGE = [
  "qoida",
  "reglament",
  "mezon",
  "nazorat",
  "debitor",
  "qarzdor",
  "pul oqimi",
  "cashflow",
  "foyda",
  "zarar",
  "budjet",
  "byudjet",
  "kpi",
  "hisobot shakl",
  "tavsiya qoida",
  "amaliy qo'llanma",
  "aq-03",
  "moliyaviy qoida",
  "intizom",
  "baholash",
];

const CRM = [
  "bitrix",
  "crm",
  "bitim",
  "tushum",
  "savdo",
  "sotuv",
  "yopilgan",
  "summa",
  "qarz",
  "kechikkan",
  "to'lov",
  "bugun",
  "oy",
  "hafta",
  "menejer",
  "xodim",
  "0",
  "nol",
  "kiritilmagan",
  "aniqlanmagan",
  "daromad",
  "pul holat",
  "qancha",
  "nechta",
  "jonli",
  "raqam",
];

function hasAny(text: string, signals: string[]): string[] {
  return signals.filter((s) => text.includes(s));
}

export function analyzeFinanceIntent(question: string): FinanceIntentResult {
  const text = question.toLowerCase().trim();
  const casualHits = hasAny(text, CASUAL);
  const knowledgeHits = hasAny(text, KNOWLEDGE);
  const crmHits = hasAny(text, CRM);

  const aboutAgent =
    /moliya agenti|nima qiladi|kim san|o'zingni/.test(text) &&
    !/bitim|tushum|qarz|summa|bugun|oy/.test(text);

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

  const impliedCrm =
    crmHits.length > 0 ||
    /tushum|bitim|savdo|sotuv|qarz|to'lov|summa|menejer|bugun|oy/.test(text);
  const impliedKnowledge =
    knowledgeHits.length > 0 ||
    /qoida|mezon|nazorat|budjet|kpi|debitor|pul oqimi|bahola|reglament/.test(text);

  let intent: FinanceIntent;
  if (impliedKnowledge && impliedCrm) intent = "knowledge_plus_crm";
  else if (impliedCrm) intent = "crm_only";
  else if (impliedKnowledge) intent = "knowledge_only";
  else if (/holat|tahlil|qanday/.test(text)) intent = "knowledge_plus_crm";
  else intent = "knowledge_only";

  return {
    intent,
    matchedKeywords: [...new Set([...casualHits, ...knowledgeHits, ...crmHits])],
    needsKnowledge: intent === "knowledge_only" || intent === "knowledge_plus_crm",
    needsCrm: intent === "crm_only" || intent === "knowledge_plus_crm",
  };
}
