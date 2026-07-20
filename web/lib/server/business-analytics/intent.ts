import type { BusinessAnalyticsIntent, BusinessAnalyticsIntentResult } from "./types";

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
  "bp-08",
  "bp 08",
  "biznes analitika",
  "analitika",
  "kpi",
  "dashboard",
  "dashbord",
  "hisobot",
  "metrika",
  "ko'rsatkich",
  "bottleneck",
  "tirqish",
  "to'siq",
  "avtomatizatsiya",
  "automation",
  "integratsiya",
  "data quality",
  "ma'lumot sifati",
  "monitoring",
  "nazorat",
  "qoida",
  "reglament",
  "mezon",
  "standart",
  "aq-06",
  "it qo'llanma",
  "tahlil ramka",
  "executive",
  "strategiya",
  "qanday qilamiz",
  "tartib",
  "protsedura",
];

const CRM = [
  "bitrix",
  "crm",
  "lead",
  "lid",
  "bitim",
  "deal",
  "kontakt",
  "kompaniya",
  "vazifa",
  "task",
  "activity",
  "aktivit",
  "kechik",
  "deadline",
  "yuklama",
  "workload",
  "konversiya",
  "conversion",
  "bo'lim",
  "department",
  "xodim",
  "menejer",
  "bugun",
  "oy",
  "hafta",
  "qancha",
  "nechta",
  "jonli",
  "holat",
  "monitor",
  "aggregat",
  "yig'ilgan",
];

function hasAny(text: string, signals: string[]): string[] {
  return signals.filter((s) => {
    if (s.length <= 3) {
      return new RegExp(`(^|\\s)${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$|[?.!,])`).test(text);
    }
    return text.includes(s);
  });
}

export function analyzeBusinessAnalyticsIntent(question: string): BusinessAnalyticsIntentResult {
  const text = question.toLowerCase().trim();
  const casualHits = hasAny(text, CASUAL);
  const knowledgeHits = hasAny(text, KNOWLEDGE);
  const crmHits = hasAny(text, CRM);

  const aboutAgent =
    /analitika agenti|it agenti|biznes analitika agenti|nima qiladi|kim san|o'zingni/.test(text) &&
    !/kpi|dashboard|bitrix|crm|lead|bitim|kechik|bottleneck|bp-08/.test(text);

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

  const hasCrmSignals =
    crmHits.length > 0 ||
    /crm holati|lead konversiya|bitim holati|kechikkan vazifa|ma'lumot sifati signal|bo'lim yuklamasi|aggregat/.test(
      text
    );

  const processKnowledge =
    /bp-08.*qanday|kpi.*mezon|dashboard.*qanday|bottleneck.*aniqlash|avtomatizatsiya.*qanday|crm monitoring.*mezon|ma'lumot sifati.*qanday|aq-06.*tushuntir/i.test(
      text
    ) && !hasCrmSignals;

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
    /crm holati|lead konversiya|bitim pipeline|kechikkan vazifa|bo'lim yuklamasi|data quality signal|jonli tahlil/.test(
      text
    );

  const impliedKnowledge =
    knowledgeHits.length > 0 ||
    /bp-08|kpi|dashboard|bottleneck|avtomatizatsiya|monitoring|aq-06|analitika qoida|mezon/.test(text);

  const hybridPhrase = /aq-06 ga ko'ra|bp-08 ga ko'ra|kpi mezon.*crm|qoidalarga ko'ra.*tahlil|mezon.*bahola/i.test(
    text
  );

  let intent: BusinessAnalyticsIntent;
  if (hybridPhrase || (impliedKnowledge && impliedCrm)) intent = "knowledge_plus_crm";
  else if (impliedCrm) intent = "crm_only";
  else if (impliedKnowledge) intent = "knowledge_only";
  else if (/holat|tahlil|qanday|nega|monitor/.test(text)) intent = "knowledge_plus_crm";
  else intent = "knowledge_only";

  return {
    intent,
    matchedKeywords: [...new Set([...casualHits, ...knowledgeHits, ...crmHits])],
    needsKnowledge: intent === "knowledge_only" || intent === "knowledge_plus_crm",
    needsCrm: intent === "crm_only" || intent === "knowledge_plus_crm",
  };
}
