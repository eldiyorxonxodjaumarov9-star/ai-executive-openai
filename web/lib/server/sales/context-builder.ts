import type { SalesIntent } from "./intent";
import type { RewrittenQuery } from "./query-rewriter";
import type { SalesToolPlan } from "./tool-planner";
import type { RetrievalResult } from "../knowledge-base/types";
import { formatSalesKnowledgeContext } from "./retriever";
import { salesCrmPromptBlock, type SalesCrmBundle } from "./crm-fetcher";
import { formatAgentScopeBlock } from "../org/structure";

export interface SalesContextInput {
  intent: SalesIntent;
  originalQuestion: string;
  rewritten: RewrittenQuery;
  knowledge?: RetrievalResult;
  crm?: SalesCrmBundle;
  toolPlan?: SalesToolPlan;
  crmMissing?: boolean;
}

export interface SalesBuiltContext {
  systemPrompt: string;
  userPrompt: string;
  knowledgeFiles: string[];
  crmEntities: string[];
  knowledgeInPrompt: boolean;
}

const SALES_SYSTEM = `Siz Xaridlar.uz Savdo direksiyasi AI agentisiz — BP-01 Lead generation va BP-03 Bitim/shartnoma Process Owner.

${formatAgentScopeBlock("sales")}

Bo'limlar: Liderlar, Sotuv, Narxlar va taklif, Shartnomalar.

Manbalar:
1) SAVDO HUJJATLARI — faqat savdo knowledge.
2) BITRIX24 — leads, deals, managers (employees), revenue.

Qoidalar:
- HR/Moliya/CS/Ta'minot knowledge ishlatmang.
- Raqam o'ylab topmang.
- Javob faqat o'zbek tilida. Valyuta: so'm. Vaqt: Asia/Tashkent.
- Ichki kodlar chiqmasin.`;

function instructionFor(intent: SalesIntent): string {
  switch (intent) {
    case "casual_chat":
      return "Oddiy suhbat: 2–5 jumla. O'zingizni sotuv agenti sifatida qisqa tanishtiring.";
    case "knowledge_only":
      return `Faqat savdo hujjati bo'laklariga tayaning. CRM raqamlarini kiritmang.
Agar hujjat bo'lagi yo'q bo'lsa, aniq shunday yozing: "Ushbu mavzu bo'yicha ichki qo'llanma mavjud emas."
O'ylab topilgan qoida yoki fakt bermang.`;
    case "crm_only":
      return `Faqat Bitrix24 faktlariga tayaning.
Agar ma'lumot bo'sh bo'lsa: "Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi."`;
    case "knowledge_plus_crm":
      return `Avval hujjatdagi savdo qoida/mezonlarni qo'llang, keyin Bitrix24 raqamlarini shu mezonlar orqali baholang.
Agar hujjat yo'q bo'lsa: "Ushbu mavzu bo'yicha ichki qo'llanma mavjud emas." deb ayting va faqat CRM faktlariga tayaning.
Agar CRM bo'sh bo'lsa:
"Mavjud savdo qoidalari asosida tushuntiraman, lekin Bitrix24 da jonli ma'lumot topilmadi."`;
  }
}

export function buildSalesContext(input: SalesContextInput): SalesBuiltContext {
  const knowledgeFiles = [
    ...new Set(input.knowledge?.hits.map((h) => h.chunk.meta.fileName) || []),
  ];
  const crmEntities = input.toolPlan?.tools || [];

  const systemPrompt = `${SALES_SYSTEM}

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
    const hasHits = Boolean(input.knowledge?.hits.length);
    const block = hasHits
      ? formatSalesKnowledgeContext(input.knowledge!)
      : "Ushbu mavzu bo'yicha ichki qo'llanma mavjud emas. (Mos bo'lak yo'q yoki knowledge bazasi bo'sh.)";
    parts.push("=== SAVDO HUJJATLARI (faqat mos bo'laklar) ===", block, "");
    knowledgeInPrompt = hasHits;
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
          "Bitrix24 da jonli ma'lumot topilmadi. Faqat hujjat qoidalari asosida tushuntiring va buni ochiq ayting.",
          ""
        );
      }
    } else if (input.crm) {
      parts.push("=== BITRIX24 (jonli savdo ma'lumoti) ===", salesCrmPromptBlock(input.crm), "");
    }
  }

  parts.push(
    "=== JAVOB YO'RIQNOMASI ===",
    "Qisqa, aniq sotuv javobi yozing. Keraksiz uzun hisobot tuzmang."
  );

  return {
    systemPrompt,
    userPrompt: parts.join("\n"),
    knowledgeFiles,
    crmEntities,
    knowledgeInPrompt,
  };
}
