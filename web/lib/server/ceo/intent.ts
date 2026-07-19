export type CeoIntent =
  | "casual_chat"
  | "knowledge_only"
  | "crm_only"
  | "knowledge_plus_crm";

export interface CeoIntentResult {
  intent: CeoIntent;
  matchedKeywords: string[];
  needsKnowledge: boolean;
  needsCrm: boolean;
}

const CASUAL = [
  "salom",
  "assalom",
  "hello",
  "hi",
  "qalesan",
  "qalaysiz",
  "rahmat",
  "tashakkur",
  "who are you",
  "sen kimsan",
  "o'zingni tanishtir",
];

const KNOWLEDGE = [
  "arxitektura",
  "qatlam",
  "hba",
  "qoida",
  "reglament",
  "jarayon",
  "standart",
  "mezon",
  "baholash",
  "boshqaruv",
  "broker",
  "taminot",
  "logistika",
  "hujjatlashtirish",
  "davlat",
  "tijoriy taklif",
  "kompaniya qoida",
  "qanday ishlaydi",
  "nima degani",
  "ta'rif",
  "tamoyil",
  "politika",
];

const CRM = [
  "bitrix",
  "crm",
  "bitim",
  "sotuv",
  "savdo",
  "lid",
  "lead",
  "mijoz so'rov",
  "vazifa",
  "task",
  "xodim",
  "kontakt",
  "kompaniya",
  "bugun",
  "kecha",
  "hafta",
  "oy",
  "pipeline",
  "yopilgan",
  "kechikkan",
  "daromad",
  "summa",
  "statistika",
  "hisobot",
  "nechta",
  "qancha",
  "jonli",
  "hozirgi",
  "real",
];

function hasAny(text: string, signals: string[]): string[] {
  return signals.filter((s) => text.includes(s));
}

export function analyzeCeoIntent(question: string): CeoIntentResult {
  const text = question.toLowerCase().trim();
  const casualHits = hasAny(text, CASUAL);
  const knowledgeHits = hasAny(text, KNOWLEDGE);
  const crmHits = hasAny(text, CRM);

  const shortCasual =
    text.length < 40 &&
    casualHits.length > 0 &&
    knowledgeHits.length === 0 &&
    crmHits.length === 0;

  if (shortCasual || (casualHits.length > 0 && knowledgeHits.length === 0 && crmHits.length === 0 && text.split(/\s+/).length <= 6)) {
    return {
      intent: "casual_chat",
      matchedKeywords: casualHits,
      needsKnowledge: false,
      needsCrm: false,
    };
  }

  const needsKnowledge = knowledgeHits.length > 0;
  const needsCrm = crmHits.length > 0;

  // Vague performance questions imply CRM; architecture/rules imply knowledge.
  const vagueBusiness = /qanday|holat|vaziyat|tahlil|xavf|tavsiya/.test(text);
  const impliedCrm =
    needsCrm ||
    (/sotuv|savdo|bitim|mijoz|xodim|vazifa|pipeline/.test(text) && !/arxitektura|qatlam|hba|qoida|reglament/.test(text));
  const impliedKnowledge =
    needsKnowledge ||
    /arxitektura|qatlam|qoida|mezon|baholash|jarayon|standart|broker|taminot|hujjat/.test(text);

  let intent: CeoIntent;
  if (impliedKnowledge && impliedCrm) intent = "knowledge_plus_crm";
  else if (impliedCrm) intent = "crm_only";
  else if (impliedKnowledge) intent = "knowledge_only";
  else if (vagueBusiness) intent = "knowledge_plus_crm";
  else intent = "knowledge_only";

  return {
    intent,
    matchedKeywords: [...new Set([...casualHits, ...knowledgeHits, ...crmHits])],
    needsKnowledge: intent === "knowledge_only" || intent === "knowledge_plus_crm",
    needsCrm: intent === "crm_only" || intent === "knowledge_plus_crm",
  };
}
