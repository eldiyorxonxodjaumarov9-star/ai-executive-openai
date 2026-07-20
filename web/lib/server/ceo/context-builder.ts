import type { CeoIntent } from "./intent";
import type { RewrittenQuery } from "./query-rewriter";
import type { CeoToolPlan } from "./tool-planner";
import type { RetrievalResult } from "../knowledge-base/types";
import { formatCeoKnowledgeContext } from "./retriever";
import { ceoCrmPromptBlock, type CeoCrmBundle } from "./crm-fetcher";
import { formatAgentScopeBlock } from "../org/structure";
import type { CeoOrchestrationBundle } from "./orchestrator";

export interface CeoContextInput {
  intent: CeoIntent;
  originalQuestion: string;
  rewritten: RewrittenQuery;
  knowledge?: RetrievalResult;
  crm?: CeoCrmBundle;
  toolPlan?: CeoToolPlan;
  crmMissing?: boolean;
  orchestration?: CeoOrchestrationBundle;
}

export interface CeoBuiltContext {
  systemPrompt: string;
  userPrompt: string;
  knowledgeFiles: string[];
  crmEntities: string[];
}

const CEO_SYSTEM = `Siz Xaridlar.uz bosh direktor (CEO) AI maslahatchisisiz — BP-09 Korporativ boshqaruv Process Owner.

Rol: kompaniyaning umumiy boshqaruvi, barcha natijalar uchun javobgarlik, strategik tavsiyalar.

${formatAgentScopeBlock("ceo")}

Bo'limlar nazorati: Savdo, Ta'minot, Moliya, Customer Success, HR, IT.

Manbalar:
1) CEO HUJJATLARI (knowledge) — HBA korporativ arxitektura.
2) DIREKTOR HISOBOTLARI — sub-agent pipeline strukturali natijalari.
3) BITRIX24 — faqat kerakli hollarda (orchestration bo'lmasa).

Qoidalar:
- Boshqa agentning knowledge bazasini to'g'ridan-to'g'ri o'qimang — sub-agent hisobotlaridan foydalaning.
- Raqam o'ylab topmang.
- Javob faqat o'zbek tilida (lotin).
- Ichki CRM kodlarini ko'rsatmang.
- Valyuta: so'm. Vaqt zonasi: Asia/Tashkent.`;

function instructionFor(intent: CeoIntent, orchestrated: boolean): string {
  if (orchestrated) {
    return `Kompaniya miqyosidagi savol: direktor hisobotlarini birlashtirib Executive Report yozing.
Format: qisqa xulosa / bo'limlar / risklar / tavsiyalar / keyingi qadamlar.`;
  }
  switch (intent) {
    case "casual_chat":
      return "Oddiy suhbat: 2–5 jumla. O'zingizni bosh direktor (CEO) agenti sifatida tanishtiring.";
    case "knowledge_only":
      return "Faqat CEO hujjat bo'laklariga tayaning.";
    case "crm_only":
      return "Faqat berilgan Bitrix24 faktlariga tayaning.";
    case "knowledge_plus_crm":
      return "CEO hujjat mezonlari + Bitrix24 faktlarini birlashtiring.";
  }
}

export function buildCeoContext(input: CeoContextInput): CeoBuiltContext {
  const knowledgeFiles = [
    ...new Set(input.knowledge?.hits.map((h) => h.chunk.meta.fileName) || []),
  ];

  const crmEntities = input.orchestration
    ? [...(input.orchestration.agentsConsulted || [])]
    : input.toolPlan?.tools || [];

  const systemPrompt = `${CEO_SYSTEM}

${instructionFor(input.intent, Boolean(input.orchestration))}`;

  const parts: string[] = [];
  parts.push("=== FOYDALANUVCHI SAVOLI ===", input.originalQuestion, "");

  if (input.rewritten.wasRewritten) {
    parts.push(
      "=== ICHKI TAHLIL REJASI (foydalanuvchiga ko'rsatilmasin) ===",
      input.rewritten.rewritten,
      ""
    );
  }

  if (input.orchestration) {
    parts.push(input.orchestration.promptBlock, "");
  } else {
    if (input.intent === "knowledge_only" || input.intent === "knowledge_plus_crm") {
      parts.push(
        "=== CEO HUJJATLARI (faqat mos bo'laklar) ===",
        input.knowledge ? formatCeoKnowledgeContext(input.knowledge) : "Mos bo'lak yo'q.",
        ""
      );
    }

    if (input.intent === "crm_only" || input.intent === "knowledge_plus_crm") {
      if (input.crmMissing || input.crm?.empty) {
        parts.push(
          "=== BITRIX24 ===",
          "Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi",
          ""
        );
      } else if (input.crm) {
        parts.push("=== BITRIX24 (jonli ma'lumot) ===", ceoCrmPromptBlock(input.crm), "");
      }
    }
  }

  parts.push(
    "=== JAVOB YO'RIQNOMASI ===",
    "Rahbar sifatida qisqa va amaliy javob yozing."
  );

  return {
    systemPrompt,
    userPrompt: parts.join("\n"),
    knowledgeFiles: [...new Set(knowledgeFiles)],
    crmEntities,
  };
}
