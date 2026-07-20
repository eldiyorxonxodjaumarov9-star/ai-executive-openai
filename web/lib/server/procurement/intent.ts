import type { ProcurementIntent, ProcurementIntentResult } from "./types";

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
  "ta'minot",
  "taminot",
  "xarid",
  "yetkazib",
  "yetkazib beruv",
  "supplier",
  "ombor",
  "zaxira",
  "logistika",
  "shartnoma",
  "sla",
  "kpi",
  "qoida",
  "reglament",
  "siyosat",
  "standart",
  "mezon",
  "aq-02",
  "bp-02",
  "bp-05",
  "commercial offer",
  "taklif",
  "tanlash",
  "risk",
  "tavsiya",
  "hisobot",
  "qanday qilamiz",
  "tartib",
  "protsedura",
];

const CRM = [
  "bitrix",
  "crm",
  "kompaniya",
  "kontakt",
  "bitim",
  "vazifa",
  "task",
  "activity",
  "aktivit",
  "yetkazib beruvchi",
  "supplier",
  "kechik",
  "deadline",
  "mas'ul",
  "bugun",
  "oy",
  "hafta",
  "qancha",
  "nechta",
  "jonli",
  "holat",
  "ochiq",
  "bajardi",
];

function hasAny(text: string, signals: string[]): string[] {
  return signals.filter((s) => {
    if (s.length <= 3) {
      return new RegExp(`(^|\\s)${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$|[?.!,])`).test(text);
    }
    return text.includes(s);
  });
}

export function analyzeProcurementIntent(question: string): ProcurementIntentResult {
  const text = question.toLowerCase().trim();
  const casualHits = hasAny(text, CASUAL);
  const knowledgeHits = hasAny(text, KNOWLEDGE);
  const crmHits = hasAny(text, CRM);

  const aboutAgent =
    /ta'?minot agenti|procurement agent|nima qiladi|kim san|o'zingni/.test(text) &&
    !/yetkazib|xarid|bitrix|holat|vazifa|kompaniya/.test(text);

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
    /yetkazib beruvchi holati|kechikkan yetkaz|ombor holati|xarid holati|bitrix holat|vazifalar holati/.test(
      text
    );

  const processKnowledge =
    /xarid.*tartib|yetkazib.*qanday|ombor.*qoida|zaxira.*sla|shartnoma.*mezon|supplier.*tanlash|bp-02|bp-05|aq-02/.test(
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
    /yetkazib beruvchi|kechikkan vazifa|xarid holati|ombor holati|jonli ma'lumot|kompaniyalar holati/.test(
      text
    );

  const impliedKnowledge =
    knowledgeHits.length > 0 ||
    /ta'?minot qoida|xarid qoida|sla|kpi|shartnoma|logistika|zaxira|ombor|bp-02|bp-05|aq-02/.test(text);

  const hybridPhrase = /qoidalariga ko'ra|mezon.*bahola|standartga ko'ra.*yetkaz|sla.*bahola/i.test(text);

  let intent: ProcurementIntent;
  if (hybridPhrase || (impliedKnowledge && impliedCrm)) intent = "knowledge_plus_crm";
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
