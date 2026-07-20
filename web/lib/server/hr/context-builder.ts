import type { HrIntent } from "./types";
import type { RewrittenQuery } from "./types";
import type { HrToolPlan } from "./tool-planner";
import { formatHrKnowledgeContext, type HrRetrievalResult } from "./retriever";
import { hrCrmPromptBlock, type HrCrmBundle } from "./crm-fetcher";

export interface HrContextInput {
  intent: HrIntent;
  originalQuestion: string;
  rewritten: RewrittenQuery;
  knowledge?: HrRetrievalResult;
  crm?: HrCrmBundle;
  toolPlan?: HrToolPlan;
  crmMissing?: boolean;
}

export interface HrBuiltContext {
  systemPrompt: string;
  userPrompt: string;
  knowledgeFiles: string[];
  crmEntities: string[];
  knowledgeInPrompt: boolean;
}

const HR_SYSTEM = `Siz Xaridlar.uz HR (Kadrlar / Xodimlar) AI agentisiz.

Rol: xodimlar, vazifalar, ish yuklamasi, onboarding, KPI, motivatsiya va jamoa holatini tahlil qilasiz.

Manbalar qat'iy ajratiladi:
1) HR HUJJATLARI (knowledge) — siyosat, onboarding, KPI, motivatsiya, turnover, executive hisobot mezonlari.
2) BITRIX24 (CRM) — faqat kuzatiladigan faktlar: xodimlar, vazifalar, kechikishlar, yuklama, activities.

Qoidalar:
- Xodimni dalilsiz yomon deb baholamang.
- Tibbiy, oilaviy yoki shaxsiy sabablarni taxmin qilmang.
- "Ishdan bo'shatish kerak" degan keskin hukmni avtomatik bermang.
- Knowledge qoidasini CRM faktidan ajrating.
- Raqam o'ylab topmang.
- Javob faqat o'zbek tilida (lotin).
- Ichki ID, STAGE_ID, UF_* va raw JSON ko'rsatmang — faqat xodim ismlari.
- Davomat (attendance) haqida ma'lumot bermang — bu modul ulanmagan.
- Yetarli ma'lumot bo'lmasa: "Bitrix24 dagi mavjud ma'lumot bu xodimning umumiy ish sifatini to'liq baholash uchun yetarli emas."
- Qisman ma'lumot bo'lsa: "Bitrix24 dagi mavjud ma'lumotlar asosida qisman tahlil qilaman."
- Vaqt zonasi: Asia/Tashkent.`;

function instructionFor(intent: HrIntent): string {
  switch (intent) {
    case "casual_chat":
      return "Oddiy suhbat: 2–5 jumla. O'zingizni kadrlar (HR) agenti sifatida qisqa tanishtiring.";
    case "knowledge_only":
      return "Faqat HR hujjati bo'laklariga tayaning. CRM raqamlarini kiritmang.";
    case "crm_only":
      return `Faqat Bitrix24 faktlariga tayaning.
Agar ma'lumot bo'sh bo'lsa: "Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi."`;
    case "knowledge_plus_crm":
      return `Avval HR qo'llanmasi mezonlarini qo'llang, keyin Bitrix24 faktlarini shu mezonlar orqali baholang.
Agar CRM bo'sh bo'lsa:
"Mavjud HR qo'llanmasi asosida tushuntiraman, ammo Bitrix24 da jonli ma'lumot topilmadi."`;
  }
}

export function buildHrContext(input: HrContextInput): HrBuiltContext {
  const knowledgeFiles = [
    ...new Set(input.knowledge?.hits.map((h) => h.chunk.meta.fileName) || []),
  ];
  const crmEntities = input.toolPlan?.tools || [];

  const systemPrompt = `${HR_SYSTEM}

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
      ? formatHrKnowledgeContext(input.knowledge)
      : "Mos HR hujjat bo'lagi topilmadi yoki similarity past.";
    parts.push("=== HR HUJJATLARI (faqat mos bo'laklar) ===", block, "");
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
          "Bitrix24 da jonli ma'lumot topilmadi. Faqat HR qo'llanmasi asosida tushuntiring va buni ochiq ayting.",
          ""
        );
      }
    } else if (input.crm) {
      parts.push("=== BITRIX24 (jonli HR ma'lumoti) ===", hrCrmPromptBlock(input.crm), "");
    }
  }

  parts.push(
    "=== JAVOB YO'RIQNOMASI ===",
    "Qisqa, aniq HR javobi yozing. Shaxsiy taxmin va keskin hukmlardan qoching."
  );

  return {
    systemPrompt,
    userPrompt: parts.join("\n"),
    knowledgeFiles,
    crmEntities,
    knowledgeInPrompt,
  };
}
