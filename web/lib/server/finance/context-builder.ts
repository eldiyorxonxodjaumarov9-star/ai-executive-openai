import type { FinanceIntent } from "./intent";
import type { RewrittenQuery } from "./query-rewriter";
import type { FinanceToolPlan } from "./tool-planner";
import type { RetrievalResult } from "../knowledge-base/types";
import { formatFinanceKnowledgeContext } from "./retriever";
import { financeCrmPromptBlock, type FinanceCrmBundle } from "./crm-fetcher";
import { formatAgentScopeBlock } from "../org/structure";

export interface FinanceContextInput {
  intent: FinanceIntent;
  originalQuestion: string;
  rewritten: RewrittenQuery;
  knowledge?: RetrievalResult;
  crm?: FinanceCrmBundle;
  toolPlan?: FinanceToolPlan;
  crmMissing?: boolean;
}

export interface FinanceBuiltContext {
  systemPrompt: string;
  userPrompt: string;
  knowledgeFiles: string[];
  crmEntities: string[];
}

const FINANCE_SYSTEM = `Siz Xaridlar.uz Moliya direksiyasi AI agentisiz — BP-06 Moliyaviy hisob-kitob Process Owner.

${formatAgentScopeBlock("finance")}

Bo'limlar: Buxgalteriya, Debitor, G'aznachilik, Kreditor.

Manbalar:
1) MOLIYA HUJJATLARI — faqat AQ-03.
2) BITRIX24 — faqat deals (revenue / payments / invoice maydonlari).

Qoidalar:
- Boshqa direksiya knowledge ishlatmang.
- Raqam o'ylab topmang.
- Javob faqat o'zbek tilida (lotin).
- Valyuta: so'm. Vaqt: Asia/Tashkent.
- Ichki kodlar chiqmasin.`;

function instructionFor(intent: FinanceIntent): string {
  switch (intent) {
    case "casual_chat":
      return "Oddiy suhbat: 2–5 jumla. CRM/hujjat raqamlariga o'tmang. O'zingizni moliya agenti sifatida qisqa tanishtiring.";
    case "knowledge_only":
      return "Faqat moliya hujjati bo'laklariga tayaning. CRM raqamlarini kiritmang.";
    case "crm_only":
      return `Faqat Bitrix24 faktlariga tayaning.
Agar ma'lumot bo'sh bo'lsa aniq yozing: "Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi."`;
    case "knowledge_plus_crm":
      return `Avval hujjatdagi moliyaviy qoida/mezonlarni qo'llang, keyin Bitrix24 raqamlarini shu mezonlar orqali baholang.
Agar CRM bo'sh bo'lsa:
"Mavjud moliyaviy qoidalar asosida tushuntiraman, lekin Bitrix24 da jonli raqamlar topilmadi."`;
  }
}

export function buildFinanceContext(input: FinanceContextInput): FinanceBuiltContext {
  const knowledgeFiles = [
    ...new Set(input.knowledge?.hits.map((h) => h.chunk.meta.fileName) || []),
  ];
  const crmEntities = input.toolPlan?.tools || [];

  const systemPrompt = `${FINANCE_SYSTEM}

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

  if (input.intent === "knowledge_only" || input.intent === "knowledge_plus_crm") {
    parts.push(
      "=== MOLIYA HUJJATLARI (faqat mos bo'laklar) ===",
      input.knowledge ? formatFinanceKnowledgeContext(input.knowledge) : "Mos bo'lak yo'q.",
      ""
    );
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
          "Bitrix24 da jonli raqamlar topilmadi. Faqat hujjat qoidalari asosida tushuntiring va buni ochiq ayting.",
          ""
        );
      }
    } else if (input.crm) {
      parts.push("=== BITRIX24 (jonli moliyaviy ma'lumot) ===", financeCrmPromptBlock(input.crm), "");
    }
  }

  parts.push(
    "=== JAVOB YO'RIQNOMASI ===",
    "Qisqa, aniq moliyaviy javob yozing. Keraksiz uzun hisobot tuzmang."
  );

  return {
    systemPrompt,
    userPrompt: parts.join("\n"),
    knowledgeFiles,
    crmEntities,
  };
}
