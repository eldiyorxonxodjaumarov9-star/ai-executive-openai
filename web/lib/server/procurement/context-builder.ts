import type { ProcurementIntent } from "./types";
import type { RewrittenQuery } from "./types";
import type { ProcurementToolPlan } from "./tool-planner";
import { formatProcurementKnowledgeContext, type ProcurementRetrievalResult } from "./retriever";
import { procurementCrmPromptBlock, type ProcurementCrmBundle } from "./crm-fetcher";
import {
  BUSINESS_PROCESSES,
  formatAgentScopeBlock,
} from "../org/structure";

export interface ProcurementContextInput {
  intent: ProcurementIntent;
  originalQuestion: string;
  rewritten: RewrittenQuery;
  knowledge?: ProcurementRetrievalResult;
  crm?: ProcurementCrmBundle;
  toolPlan?: ProcurementToolPlan;
  crmMissing?: boolean;
}

export interface ProcurementBuiltContext {
  systemPrompt: string;
  userPrompt: string;
  knowledgeFiles: string[];
  crmEntities: string[];
  knowledgeInPrompt: boolean;
}

function procurementScopeBlock(): string {
  const fromOrg = formatAgentScopeBlock("procurement");
  if (fromOrg) return fromOrg;

  const bps = BUSINESS_PROCESSES.filter((bp) => bp.id === "BP-02" || bp.id === "BP-05")
    .map((bp) => `${bp.id} (${bp.name})`)
    .join("; ");

  return [
    "=== TASHKILIY DOIRA ===",
    `Direksiya: Ta'minot direksiyasi`,
    `Process Owner: ${bps}`,
    "Bo'limlar: Xarid, Yetkazib berish, Ombor, Logistika",
    "Knowledge: faqat procurement (AQ-02)",
    "Bitrix24: companies, contacts, deals, tasks, activities",
    "Qoida: Faqat ta'minot hujjatlari (AQ-02) va ta'minot Bitrix24 ma'lumotlari. Boshqa agent knowledge ishlatmang.",
  ].join("\n");
}

const PROCUREMENT_SYSTEM = `Siz Xaridlar.uz Ta'minot direksiyasi AI agentisiz — BP-02 va BP-05 Process Owner.

${procurementScopeBlock()}

Bo'limlar: Xarid, Yetkazib berish, Ombor, Logistika.

Manbalar:
1) TA'MINOT HUJJATLARI — faqat AQ-02.
2) BITRIX24 — companies, contacts, deals, tasks, activities.

Qoidalar:
- Savdo/HR/Moliya/CS knowledge ishlatmang.
- Raqam o'ylab topmang.
- Javob faqat o'zbek tilida (lotin). Valyuta: so'm. Vaqt: Asia/Tashkent.
- Ichki ID, STAGE_ID, UF_* va raw JSON ko'rsatmang.
- Bitrix24 da alohida supplier entity yo'q — yetkazib beruvchilarni faqat kompaniyalar ro'yxati orqali taxminiy tavsiflang va cheklovni ochiq ayting.
- Knowledge qoidasini CRM faktidan ajrating.
- Yetarli ma'lumot bo'lmasa: "Bitrix24 dagi mavjud ma'lumot bu savolni to'liq baholash uchun yetarli emas."
- Qisman ma'lumot bo'lsa: "Bitrix24 dagi mavjud ma'lumotlar asosida qisman tahlil qilaman."`;

function instructionFor(intent: ProcurementIntent): string {
  switch (intent) {
    case "casual_chat":
      return "Oddiy suhbat: 2–5 jumla. O'zingizni ta'minot (procurement) agenti sifatida qisqa tanishtiring.";
    case "knowledge_only":
      return "Faqat ta'minot hujjati bo'laklariga tayaning. CRM raqamlarini kiritmang.";
    case "crm_only":
      return `Faqat Bitrix24 faktlariga tayaning.
Agar ma'lumot bo'sh bo'lsa: "Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi."`;
    case "knowledge_plus_crm":
      return `Avval ta'minot qo'llanmasi mezonlarini qo'llang, keyin Bitrix24 faktlarini shu mezonlar orqali baholang.
Agar CRM bo'sh bo'lsa:
"Mavjud ta'minot qo'llanmasi asosida tushuntiraman, ammo Bitrix24 da jonli ma'lumot topilmadi."`;
  }
}

export function buildProcurementContext(input: ProcurementContextInput): ProcurementBuiltContext {
  const knowledgeFiles = [
    ...new Set(input.knowledge?.hits.map((h) => h.chunk.meta.fileName) || []),
  ];
  const crmEntities = input.toolPlan?.tools || [];

  const systemPrompt = `${PROCUREMENT_SYSTEM}

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
      ? formatProcurementKnowledgeContext(input.knowledge)
      : "Mos ta'minot hujjat bo'lagi topilmadi yoki similarity past.";
    parts.push("=== TA'MINOT HUJJATLARI (faqat mos bo'laklar) ===", block, "");
    knowledgeInPrompt = Boolean(input.knowledge?.knowledgeUsed && input.knowledge.hits.length);
  }

  if (input.intent === "crm_only" || input.intent === "knowledge_plus_crm") {
    if (input.crmMissing || input.crm?.empty) {
      if (input.intent === "crm_only") {
        parts.push(
          "=== BITRIX24 ===",
          "Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi.",
          ""
        );
      } else {
        parts.push(
          "=== BITRIX24 ===",
          "Bitrix24 da jonli ma'lumot topilmadi. Faqat ta'minot qo'llanmasi asosida tushuntiring va buni ochiq ayting.",
          ""
        );
      }
    } else if (input.crm) {
      parts.push(
        "=== BITRIX24 (jonli ta'minot ma'lumoti) ===",
        procurementCrmPromptBlock(input.crm),
        ""
      );
    }
  }

  parts.push(
    "=== JAVOB YO'RIQNOMASI ===",
    "Qisqa, aniq ta'minot javobi yozing. Yetkazib beruvchi/supplier ma'lumotida cheklovlarni ochiq ayting."
  );

  return {
    systemPrompt,
    userPrompt: parts.join("\n"),
    knowledgeFiles,
    crmEntities,
    knowledgeInPrompt,
  };
}
