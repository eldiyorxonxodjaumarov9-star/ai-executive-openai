import type { BusinessAnalyticsIntent } from "./types";
import type { RewrittenQuery } from "./types";
import type { BusinessAnalyticsToolPlan } from "./tool-planner";
import {
  formatBusinessAnalyticsKnowledgeContext,
  type BusinessAnalyticsRetrievalResult,
} from "./retriever";
import {
  businessAnalyticsCrmPromptBlock,
  type BusinessAnalyticsCrmBundle,
} from "./crm-fetcher";
import { formatAgentScopeBlock } from "../org/structure";

export interface BusinessAnalyticsContextInput {
  intent: BusinessAnalyticsIntent;
  originalQuestion: string;
  rewritten: RewrittenQuery;
  knowledge?: BusinessAnalyticsRetrievalResult;
  crm?: BusinessAnalyticsCrmBundle;
  toolPlan?: BusinessAnalyticsToolPlan;
  crmMissing?: boolean;
}

export interface BusinessAnalyticsBuiltContext {
  systemPrompt: string;
  userPrompt: string;
  knowledgeFiles: string[];
  crmEntities: string[];
  knowledgeInPrompt: boolean;
}

const BA_SYSTEM = `Siz Xaridlar.uz IT va Biznes Analitika AI agentisiz — BP-08 Process Owner.

${formatAgentScopeBlock("business_analytics")}

Bo'lim: IT (Biznes analitika, CRM monitoring, dashboard, avtomatizatsiya).

Manbalar:
1) BIZNES ANALITIKA HUJJATLARI — faqat AQ-06 (1–5 qismlar).
2) BITRIX24 — leads, deals, contacts, companies, tasks, activities, users, departments (aggregat).

Qoidalar:
- Savdo/HR/Moliya/CS knowledge ishlatmang.
- Ta'minot (procurement) hujjatlarini biriktirmang — faqat business-analytics indeksi.
- Raqam o'ylab topmang; faqat aggregat faktlarga tayaning.
- Javob faqat o'zbek tilida (lotin). Valyuta: so'm. Vaqt: Asia/Tashkent.
- Ichki ID, STAGE_ID, UF_* va raw JSON ko'rsatmang — faqat odam o'qiydigan nomlar va aggregat raqamlar.
- Knowledge mezonini CRM aggregatidan ajrating.
- Yetarli ma'lumot bo'lmasa: "Bitrix24 dagi mavjud aggregat ma'lumot bu savol uchun to'liq tahlil uchun yetarli emas."
- Qisman ma'lumot bo'lsa: "Mavjud CRM aggregati asosida qisman tahlil qilaman."`;

function instructionFor(intent: BusinessAnalyticsIntent): string {
  switch (intent) {
    case "casual_chat":
      return "Oddiy suhbat: 2–5 jumla. O'zingizni IT/biznes analitika agenti sifatida qisqa tanishtiring.";
    case "knowledge_only":
      return "Faqat AQ-06 hujjat bo'laklariga tayaning. CRM raqamlarini kiritmang.";
    case "crm_only":
      return `Faqat Bitrix24 aggregat faktlariga tayaning.
Agar ma'lumot bo'sh bo'lsa: "Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi."`;
    case "knowledge_plus_crm":
      return `Avval AQ-06 mezonlarini qo'llang, keyin Bitrix24 aggregatini shu mezonlar orqali baholang.
Agar CRM bo'sh bo'lsa:
"Mavjud biznes analitika qo'llanmasi asosida tushuntiraman, ammo Bitrix24 da jonli aggregat topilmadi."`;
  }
}

export function buildBusinessAnalyticsContext(
  input: BusinessAnalyticsContextInput
): BusinessAnalyticsBuiltContext {
  const knowledgeFiles = [
    ...new Set(input.knowledge?.hits.map((h) => h.chunk.meta.fileName) || []),
  ];
  const crmEntities = input.toolPlan?.tools || [];

  const systemPrompt = `${BA_SYSTEM}

${instructionFor(input.intent)}`;

  const parts: string[] = [];
  parts.push("=== FOYDALANUVCHI SAVOLI ===", input.originalQuestion, "");

  if (input.rewritten.wasRewritten) {
    parts.push(
      "=== ICHKI TAHLIL REJASI (foydalanuvchiga ko'rsatilmasin) ===",
      input.rewritten.rewritten,
      ""
    );
  }

  let knowledgeInPrompt = false;
  if (input.intent === "knowledge_only" || input.intent === "knowledge_plus_crm") {
    const block = input.knowledge?.knowledgeUsed
      ? formatBusinessAnalyticsKnowledgeContext(input.knowledge)
      : "Mos biznes analitika hujjat bo'lagi topilmadi yoki similarity past.";
    parts.push("=== BIZNES ANALITIKA HUJJATLARI (faqat AQ-06) ===", block, "");
    knowledgeInPrompt = Boolean(input.knowledge?.knowledgeUsed && input.knowledge.hits.length);
  }

  if (input.intent === "crm_only" || input.intent === "knowledge_plus_crm") {
    if (input.crmMissing || input.crm?.empty) {
      if (input.intent === "crm_only") {
        parts.push(
          "=== BITRIX24 (aggregat) ===",
          "Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi.",
          ""
        );
      } else {
        parts.push(
          "=== BITRIX24 (aggregat) ===",
          "Bitrix24 da jonli aggregat topilmadi. Faqat AQ-06 qo'llanmasi asosida tushuntiring va buni ochiq ayting.",
          ""
        );
      }
    } else if (input.crm) {
      parts.push(
        "=== BITRIX24 (jonli aggregat) ===",
        businessAnalyticsCrmPromptBlock(input.crm),
        ""
      );
    }
  }

  parts.push(
    "=== JAVOB YO'RIQNOMASI ===",
    "Qisqa, aniq analitik javob yozing. KPI, bottleneck va ma'lumot sifati bo'yicha amaliy xulosa bering."
  );

  return {
    systemPrompt,
    userPrompt: parts.join("\n"),
    knowledgeFiles,
    crmEntities,
    knowledgeInPrompt,
  };
}
