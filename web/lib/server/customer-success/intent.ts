export type CustomerSuccessIntent =
  | "casual_chat"
  | "knowledge_only"
  | "crm_only"
  | "knowledge_plus_crm";

export interface CustomerSuccessIntentResult {
  intent: CustomerSuccessIntent;
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
  "retention",
  "ushlab",
  "nps",
  "satisfaction",
  "qoniqish",
  "health score",
  "onboarding",
  "renewal",
  "upsell",
  "cross-sell",
  "cross sell",
  "shikoyat",
  "sla",
  "customer journey",
  "journey",
  "loyal",
  "churn",
  "standart",
  "qoida",
  "reglament",
  "mezon",
  "kpi",
  "amaliy qo'llanma",
  "aq-04",
  "baholash",
  "tavsiya",
];

const CRM = [
  "bitrix",
  "crm",
  "mijoz",
  "kontakt",
  "kompaniya",
  "bitim",
  "activity",
  "aktivit",
  "qo'ng'iroq",
  "email",
  "task",
  "vazifa",
  "timeline",
  "faol",
  "aloqasiz",
  "risk",
  "yirik",
  "takroriy",
  "oxirgi",
  "bugun",
  "oy",
  "hafta",
  "qancha",
  "nechta",
  "jonli",
  "holat",
];

function hasAny(text: string, signals: string[]): string[] {
  return signals.filter((s) => text.includes(s));
}

export function analyzeCustomerSuccessIntent(question: string): CustomerSuccessIntentResult {
  const text = question.toLowerCase().trim();
  const casualHits = hasAny(text, CASUAL);
  const knowledgeHits = hasAny(text, KNOWLEDGE);
  const crmHits = hasAny(text, CRM);

  const aboutAgent =
    /mijozlar agenti|customer success|nima qiladi|kim san|o'zingni/.test(text) &&
    !/faol mijoz|risk|activity|aloqa|bitrix|holatni bahola/.test(text);

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
    /ushlab qolish|retention qanday|onboarding qanday|sla qoida|nps nima|health score|churnni kamaytir|standartlar/.test(
      text
    ) && !/bugun|oy|jonli|activity|holatni bahola|bormi\?$/.test(text);

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
    /faol mijoz|aloqasiz|riskdagi|oxirgi activity|activity qachon|uzoq vaqt aloqa|yirik mijoz|takroriy xarid|holatni bahola/.test(
      text
    );

  const impliedKnowledge =
    knowledgeHits.length > 0 ||
    /retention|nps|sla|onboarding|renewal|upsell|churn|qoida|standart|kpi|bahola/.test(text);

  let intent: CustomerSuccessIntent;
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
