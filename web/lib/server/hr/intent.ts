import type { HrIntent, HrIntentResult } from "./types";

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
  "onboarding",
  "rekrut",
  "rekruting",
  "yangi xodim",
  "kpi",
  "performance",
  "baholash",
  "motivatsiya",
  "retention",
  "turnover",
  "qoida",
  "reglament",
  "siyosat",
  "standart",
  "mezon",
  "hr qoida",
  "aq-hr",
  "qanday qilamiz",
  "tartib",
  "protsedura",
  "korporativ madaniyat",
  "hisobot",
  "dashboard",
  "analitika",
  "strategiya",
];

const CRM = [
  "bitrix",
  "crm",
  "vazifa",
  "task",
  "kechik",
  "deadline",
  "yuklama",
  "workload",
  "mas'ul",
  "bajardi",
  "bajarilgan",
  "ochiq vazifa",
  "bo'lim",
  "department",
  "faol xodim",
  "bugun",
  "oy",
  "hafta",
  "qancha",
  "nechta",
  "kimda",
  "kimning",
  "jonli",
  "holat",
  "activity",
  "aktivit",
];

function hasAny(text: string, signals: string[]): string[] {
  return signals.filter((s) => {
    if (s.length <= 3) {
      return new RegExp(`(^|\\s)${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$|[?.!,])`).test(text);
    }
    return text.includes(s);
  });
}

export function analyzeHrIntent(question: string): HrIntentResult {
  const text = question.toLowerCase().trim();
  const casualHits = hasAny(text, CASUAL);
  const knowledgeHits = hasAny(text, KNOWLEDGE);
  const crmHits = hasAny(text, CRM);

  const aboutAgent =
    /xodimlar agenti|kadrlar agenti|hr agent|nima qiladi|kim san|o'zingni/.test(text) &&
    !/vazifa|kechik|yuklama|bitrix|onboarding tartib|kpi/.test(text);

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
    hasAny(text, CRM).length > 0 ||
    /kimda kechik|kechikkan vazifa|ish yuklamasi|bugun kim|bajardi|vazifalar holati|xodimlar holati/.test(
      text
    );

  const processKnowledge =
    /onboarding.*tartib|onboarding qanday|kpi qanday|performance qanday|motivatsiya qanday|turnover qanday|siyosat qanday|rekruting tartib|yangi xodim.*onboarding|onboarding qilish tartib/i.test(
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
    /kimda kechik|kechikkan vazifa|ish yuklamasi|bugun kim|bajardi|vazifalar holati|xodimlar holati|faol xodim/.test(
      text
    );

  const impliedKnowledge =
    knowledgeHits.length > 0 ||
    /hr qoida|siyosat|standart|kpi|onboarding|motivatsiya|performance|turnover|bahola/.test(text);

  const hybridPhrase = /hr qoidalariga ko'ra|siyosatga ko'ra|qoidalarga ko'ra.*bahola|mezon.*bahola|kechikish.*bahola/i.test(
    text
  );

  let intent: HrIntent;
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
