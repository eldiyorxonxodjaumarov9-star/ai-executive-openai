import type { CustomerSuccessIntent } from "./intent";
import type { RewrittenQuery } from "./query-rewriter";
import type { CustomerSuccessToolPlan } from "./tool-planner";
import type { RetrievalResult } from "../knowledge-base/types";
import { formatCustomerSuccessKnowledgeContext } from "./retriever";
import {
  customerSuccessCrmPromptBlock,
  type CustomerSuccessCrmBundle,
} from "./crm-fetcher";
import { formatAgentScopeBlock } from "../org/structure";

export interface CustomerSuccessContextInput {
  intent: CustomerSuccessIntent;
  originalQuestion: string;
  rewritten: RewrittenQuery;
  knowledge?: RetrievalResult;
  crm?: CustomerSuccessCrmBundle;
  toolPlan?: CustomerSuccessToolPlan;
  crmMissing?: boolean;
}

export interface CustomerSuccessBuiltContext {
  systemPrompt: string;
  userPrompt: string;
  knowledgeFiles: string[];
  crmEntities: string[];
  knowledgeInPrompt: boolean;
}

const CS_SYSTEM = `Siz Xaridlar.uz Customer Success AI agentisiz — BP-04 va BP-07 Process Owner.

${formatAgentScopeBlock("customer_success")}

Bo'limlar: Account Manager, Service, Broker nazorati, Mijoz tajribasi.

Manbalar:
1) CUSTOMER SUCCESS HUJJATLARI — faqat AQ-04.
2) BITRIX24 — contacts, companies, activities, deals.

Qoidalar:
- Savdo/HR/Moliya knowledge ishlatmang.
- Raqam o'ylab topmang.
- Javob faqat o'zbek tilida. Valyuta: so'm. Vaqt: Asia/Tashkent.
- Ichki kodlar chiqmasin.`;

function instructionFor(intent: CustomerSuccessIntent): string {
  switch (intent) {
    case "casual_chat":
      return "Oddiy suhbat: 2–5 jumla. O'zingizni mijozlar (Customer Success) agenti sifatida qisqa tanishtiring.";
    case "knowledge_only":
      return "Faqat Customer Success hujjati bo'laklariga tayaning. CRM raqamlarini kiritmang.";
    case "crm_only":
      return `Faqat Bitrix24 faktlariga tayaning.
Agar ma'lumot bo'sh bo'lsa: "Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi."`;
    case "knowledge_plus_crm":
      return `Avval hujjatdagi Customer Success qoida/mezonlarni qo'llang, keyin Bitrix24 raqamlarini shu mezonlar orqali baholang.
Agar CRM bo'sh bo'lsa:
"Mavjud Customer Success qo'llanmasi asosida tushuntiraman, ammo Bitrix24 da jonli ma'lumot topilmadi."`;
  }
}

export function buildCustomerSuccessContext(
  input: CustomerSuccessContextInput
): CustomerSuccessBuiltContext {
  const knowledgeFiles = [
    ...new Set(input.knowledge?.hits.map((h) => h.chunk.meta.fileName) || []),
  ];
  const crmEntities = input.toolPlan?.tools || [];

  const systemPrompt = `${CS_SYSTEM}

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
    const block = input.knowledge
      ? formatCustomerSuccessKnowledgeContext(input.knowledge)
      : "Mos bo'lak yo'q.";
    parts.push("=== CUSTOMER SUCCESS HUJJATLARI (faqat mos bo'laklar) ===", block, "");
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
          "Bitrix24 da jonli ma'lumot topilmadi. Faqat Customer Success qo'llanmasi asosida tushuntiring va buni ochiq ayting.",
          ""
        );
      }
    } else if (input.crm) {
      parts.push(
        "=== BITRIX24 (jonli mijozlar ma'lumoti) ===",
        customerSuccessCrmPromptBlock(input.crm),
        ""
      );
    }
  }

  parts.push(
    "=== JAVOB YO'RIQNOMASI ===",
    "Qisqa, aniq Customer Success javobi yozing. Keraksiz uzun hisobot tuzmang."
  );

  return {
    systemPrompt,
    userPrompt: parts.join("\n"),
    knowledgeFiles,
    crmEntities,
    knowledgeInPrompt,
  };
}
