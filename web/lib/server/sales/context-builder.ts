import type { SalesIntent } from "./intent";
import type { RewrittenQuery } from "./query-rewriter";
import type { SalesToolPlan } from "./tool-planner";
import type { RetrievalResult } from "../knowledge-base/types";
import { formatSalesKnowledgeContext } from "./retriever";
import { salesCrmPromptBlock, type SalesCrmBundle } from "./crm-fetcher";

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

const SALES_SYSTEM = `Siz Xaridlar.uz sotuv (Sales) AI agentisiz.

Rol: savdo jarayoni, leadlar, bitimlar, konversiya, menejer samaradorligi va xavflarni qisqa tahlil qilasiz.

Manbalar qat'iy ajratiladi:
1) SAVDO HUJJATLARI (knowledge) — jarayon, skriptlar, e'tirozlar, KPI, yopish usullari, tavsiya qoidalari.
2) BITRIX24 (CRM) — faqat jonli leadlar, bitimlar, vazifalar, menejerlar.

Qoidalar:
- Hujjatda yo'q narsani o'ylab topmang.
- Bitrix24 da yo'q raqamni uydirmang.
- Knowledge o'rniga CRM yoki CRM o'rniga knowledge ishlatmang.
- Javob faqat o'zbek tilida (lotin).
- Valyuta: so'm (masalan 250 000 000 so'm).
- Ichki kodlar chiqmasin: STAGE_ID, CATEGORY_ID, SOURCE_ID, UF_*, raw JSON.
- Oddiy savolga 2–8 jumla. Katta hisobot faqat so'ralganda.
- Format: qisqa xulosa / raqamlar / muammolar / kuchli tomonlar / risklar / tavsiyalar / keyingi qadamlar — savolga mos tanlang.
- Vaqt zonasi: Asia/Tashkent.`;

function instructionFor(intent: SalesIntent): string {
  switch (intent) {
    case "casual_chat":
      return "Oddiy suhbat: 2–5 jumla. O'zingizni sotuv agenti sifatida qisqa tanishtiring.";
    case "knowledge_only":
      return "Faqat savdo hujjati bo'laklariga tayaning. CRM raqamlarini kiritmang.";
    case "crm_only":
      return `Faqat Bitrix24 faktlariga tayaning.
Agar ma'lumot bo'sh bo'lsa: "Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi."`;
    case "knowledge_plus_crm":
      return `Avval hujjatdagi savdo qoida/mezonlarni qo'llang, keyin Bitrix24 raqamlarini shu mezonlar orqali baholang.
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
    const block = input.knowledge ? formatSalesKnowledgeContext(input.knowledge) : "Mos bo'lak yo'q.";
    parts.push("=== SAVDO HUJJATLARI (faqat mos bo'laklar) ===", block, "");
    knowledgeInPrompt = Boolean(input.knowledge?.hits.length);
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
