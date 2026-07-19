import type { CeoIntent } from "./intent";
import type { RewrittenQuery } from "./query-rewriter";
import type { CeoToolPlan } from "./tool-planner";
import type { RetrievalResult } from "../knowledge-base/types";
import { formatCeoKnowledgeContext } from "./retriever";
import { ceoCrmPromptBlock, type CeoCrmBundle } from "./crm-fetcher";

export interface CeoContextInput {
  intent: CeoIntent;
  originalQuestion: string;
  rewritten: RewrittenQuery;
  knowledge?: RetrievalResult;
  crm?: CeoCrmBundle;
  toolPlan?: CeoToolPlan;
  crmMissing?: boolean;
}

export interface CeoBuiltContext {
  systemPrompt: string;
  userPrompt: string;
  knowledgeFiles: string[];
  crmEntities: string[];
}

const CEO_SYSTEM = `Siz Xaridlar.uz bosh direktor (CEO) AI maslahatchisisiz.

Rol: kompaniya rahbari sifatida fikrlaysiz — qisqa, aniq, amaliy.

Manbalar qat'iy ajratiladi:
1) KOMPANIYA HUJJATLARI (knowledge) — qoidalar, arxitektura, mezonlar, tajriba.
2) BITRIX24 (CRM) — faqat jonli raqamlar va faktlar.

Qoidalar:
- Hujjatda yo'q narsani o'ylab topmang.
- Bitrix24 da yo'q raqamni uydirmang.
- Knowledge o'rniga CRM yoki CRM o'rniga knowledge ishlatmang.
- Javob faqat o'zbek tilida (lotin).
- Ichki CRM kodlarini (STAGE_ID, STATUS_ID va h.k.) ko'rsatmang.
- Valyuta: so'm.
- Vaqt zonasi: Asia/Tashkent.
- Har safar katta hisobot yozmang. Savolga mos format tanlang:
  qisqa javob / tahlil / xavflar / tavsiyalar / keyingi qadamlar.
- Agar Bitrix24 bo'sh yoki mos ma'lumot yo'q bo'lsa, aniq yozing:
  "Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi"`;

function instructionFor(intent: CeoIntent): string {
  switch (intent) {
    case "casual_chat":
      return "Oddiy suhbat: 2–5 jumla, iliq va professional. CRM/hujjat raqamlariga o'tmang.";
    case "knowledge_only":
      return "Faqat hujjat bo'laklariga tayaning. CRM faktlarini kiritmang.";
    case "crm_only":
      return "Faqat Bitrix24 faktlariga tayaning. Hujjat qoidalarini kiritmang (agar alohida berilmasa).";
    case "knowledge_plus_crm":
      return `Avval hujjatdagi baholash mezonlari/qoidalarni qo'llang, keyin Bitrix24 faktlarini shu mezonlar orqali tahlil qiling.
Ikkalasini birlashtirib rahbar darajasida xulosa bering.`;
  }
}

export function buildCeoContext(input: CeoContextInput): CeoBuiltContext {
  const knowledgeFiles = [
    ...new Set(input.knowledge?.hits.map((h) => h.chunk.meta.fileName) || []),
  ];
  const crmEntities = input.toolPlan?.tools || [];

  const systemPrompt = `${CEO_SYSTEM}

${instructionFor(input.intent)}`;

  const parts: string[] = [];
  parts.push("=== FOYDALANUVCHI SAVOLI ===", input.originalQuestion, "");
  // Rewritten query is internal analysis guidance — not labeled as user-visible rewrite.
  if (input.rewritten.wasRewritten) {
    parts.push("=== ICHKI TAHLIL REJASI (foydalanuvchiga ko'rsatilmasin) ===", input.rewritten.rewritten, "");
  }

  if (input.intent === "knowledge_only" || input.intent === "knowledge_plus_crm") {
    parts.push(
      "=== KOMPANIYA HUJJATLARI (faqat mos bo'laklar) ===",
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

  parts.push(
    "=== JAVOB YO'RIQNOMASI ===",
    "Rahbar sifatida qisqa va amaliy javob yozing. Keraksiz uzun hisobot tuzmang."
  );

  return {
    systemPrompt,
    userPrompt: parts.join("\n"),
    knowledgeFiles,
    crmEntities,
  };
}
