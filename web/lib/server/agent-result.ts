export interface AgentStructuredResult {
  status: "ok" | "partial" | "error";
  summary: string;
  keyMetrics: Record<string, string | number>;
  risks: string[];
  strengths: string[];
  recommendations: string[];
  dataLimitations: string[];
  knowledgeUsed: boolean;
  crmUsed: boolean;
}

export interface PipelineStructuredInput {
  answer: string;
  /** Domain-specific intent label, e.g. procurementIntent or businessAnalyticsIntent */
  domainIntent?: string;
  /** @deprecated use domainIntent */
  procurementIntent?: string;
  crmSummary?: Record<string, unknown>;
  knowledgeFiles?: string[];
  crmEntities?: string[];
  knowledgeInPrompt?: boolean;
  crmMissing?: boolean;
  limitations?: string[];
  knowledgeLabel?: string;
}

function asRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number") out[k] = v;
  }
  return out;
}

function pickLimitations(input: PipelineStructuredInput): string[] {
  const fromInput = input.limitations || [];
  const fromCrm = Array.isArray(input.crmSummary?.limitations)
    ? (input.crmSummary?.limitations as string[])
    : [];
  return [...new Set([...fromInput, ...fromCrm])];
}

export function buildStructuredFromPipeline(input: PipelineStructuredInput): AgentStructuredResult {
  const domainIntent = input.domainIntent ?? input.procurementIntent;
  const counts = asRecord(input.crmSummary?.counts);
  const knowledgeUsed = Boolean(
    input.knowledgeInPrompt ??
      input.crmSummary?.knowledgeUsed ??
      (input.knowledgeFiles && input.knowledgeFiles.length > 0)
  );
  const crmUsed = Boolean(
    !input.crmMissing &&
      input.crmEntities &&
      input.crmEntities.length > 0 &&
      Object.values(counts).some((n) => n > 0)
  );

  const dataLimitations = pickLimitations(input);
  if (!knowledgeUsed) {
    dataLimitations.push(
      `${input.knowledgeLabel || "Hujjat"} bo'laklari promptga kiritilmadi yoki similarity past.`
    );
  }
  if (input.crmMissing) {
    dataLimitations.push("Bitrix24 dan jonli ma'lumot olinmadi yoki bo'sh qaytdi.");
  }

  const keyMetrics: Record<string, string | number> = {
    knowledgeFiles: input.knowledgeFiles?.length ?? 0,
    knowledgeChunks: Number(input.crmSummary?.knowledgeChunks ?? 0),
    crmEntities: input.crmEntities?.length ?? 0,
  };

  for (const [k, v] of Object.entries(counts)) {
    keyMetrics[k] = v;
  }

  const risks: string[] = [];
  const strengths: string[] = [];
  const recommendations: string[] = [];

  if (typeof counts.tasks === "number" && counts.tasks > 0 && domainIntent?.includes("crm")) {
    risks.push(`Vazifalar soni: ${counts.tasks} — kechikishlar alohida tekshirilishi kerak.`);
  }
  if (dataLimitations.some((l) => /supplier|yetkazib beruvchi/i.test(l))) {
    risks.push("Yetkazib beruvchi ma'lumoti to'liq emas — alohida supplier entity yo'q.");
    recommendations.push("Yetkazib beruvchilarni kompaniya nomi va shartnoma bitimlari bilan qo'lda tekshiring.");
  }
  if (knowledgeUsed) {
    strengths.push(
      `${input.knowledgeLabel || "Knowledge"} bo'laklari ishlatildi (${input.knowledgeFiles?.length ?? 0} ta fayl).`
    );
  }
  if (crmUsed) {
    strengths.push("Bitrix24 jonli ma'lumotlari tahlilga qo'shildi.");
  }
  if (!knowledgeUsed && !crmUsed) {
    recommendations.push("Savolni aniqroq qayta yozing yoki tegishli hujjat/CRM maydonlarini tekshiring.");
  }

  let status: AgentStructuredResult["status"] = "ok";
  const emptyAnswer = !input.answer.trim();
  const crmOnlyEmpty = domainIntent === "crm_only" && input.crmMissing;

  if (emptyAnswer || crmOnlyEmpty) {
    status = "error";
  } else if (!knowledgeUsed || input.crmMissing || dataLimitations.length > 0) {
    status = "partial";
  }

  const uniqueLimitations = [...new Set(dataLimitations)];

  return {
    status,
    summary: input.answer.trim(),
    keyMetrics,
    risks,
    strengths,
    recommendations,
    dataLimitations: uniqueLimitations,
    knowledgeUsed,
    crmUsed,
  };
}
