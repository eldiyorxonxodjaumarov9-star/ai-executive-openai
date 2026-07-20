import { chatCompletion, chatCompletionStream } from "../openai";
import { sanitizeUserOutput } from "../sanitize";
import { appendFreshnessToAnswer } from "../agent-context";
import { getEnv } from "../env";
import type { IntentType } from "../intent-router";
import { buildStructuredFromPipeline, type AgentStructuredResult } from "../agent-result";
import { analyzeProcurementIntent } from "./intent";
import type { ProcurementIntent } from "./types";
import { rewriteProcurementQuery } from "./query-rewriter";
import { retrieveProcurementChunks } from "./retriever";
import { planProcurementCrmTools } from "./tool-planner";
import { fetchProcurementCrmData } from "./crm-fetcher";
import { buildProcurementContext } from "./context-builder";

export interface ProcurementAnswerOptions {
  bypassCache?: boolean;
  conversationId?: string;
}

export interface ProcurementAnswerResult {
  answer: string;
  intent: IntentType;
  procurementIntent: ProcurementIntent;
  domainIntent: string;
  crmSummary: Record<string, unknown>;
  brainFiles: string[];
  knowledgeFiles: string[];
  crmEntities: string[];
  dataFreshness?: { fetchedAt: string; cached: boolean };
  mode: "procurement_v1";
  executionMs: number;
  rewrittenInternally: boolean;
  structured: AgentStructuredResult;
}

function mapIntentToLegacy(intent: ProcurementIntent): IntentType {
  switch (intent) {
    case "casual_chat":
      return "casual_chat";
    case "knowledge_only":
      return "knowledge_question";
    case "crm_only":
      return "crm_question";
    case "knowledge_plus_crm":
      return "hybrid_question";
  }
}

function buildStructuredResult(params: {
  answer: string;
  intent: ProcurementIntent;
  built: ReturnType<typeof buildProcurementContext>;
  crmSummary: Record<string, unknown>;
  crmMissing: boolean;
  limitations?: string[];
}): AgentStructuredResult {
  return buildStructuredFromPipeline({
    answer: params.answer,
    domainIntent: params.intent,
    crmSummary: params.crmSummary,
    knowledgeFiles: params.built.knowledgeFiles,
    crmEntities: params.built.crmEntities,
    knowledgeInPrompt: params.built.knowledgeInPrompt,
    crmMissing: params.crmMissing,
    limitations: params.limitations,
    knowledgeLabel: "AQ-02 ta'minot hujjati",
  });
}

export async function runProcurementAnswer(
  question: string,
  _options: ProcurementAnswerOptions = {}
): Promise<ProcurementAnswerResult> {
  const started = Date.now();
  const q = question.trim();
  if (!q) throw new Error("Savol bo'sh bo'lishi mumkin emas.");

  const intentInfo = analyzeProcurementIntent(q);
  const rewritten = rewriteProcurementQuery(q);
  const analysisQuery = rewritten.rewritten;

  let knowledge;
  if (intentInfo.needsKnowledge) {
    knowledge = await retrieveProcurementChunks(analysisQuery, { topK: 5 });
  } else {
    console.log(`\n[Procurement Knowledge]`);
    console.log(`Query:\n${q}`);
    console.log(`Matched files:\n- (intent knowledge chaqirmadi)`);
    console.log(`Candidate chunks:\n0`);
    console.log(`Selected chunks:\n0`);
    console.log(`Scores:\n0`);
    console.log(`Promptga kiritildi:\nYO'Q\n`);
  }

  let crm;
  let crmMissing = false;
  let toolPlan;
  let limitations: string[] = [];

  if (intentInfo.needsCrm) {
    toolPlan = planProcurementCrmTools(analysisQuery);
    try {
      crm = await fetchProcurementCrmData(toolPlan.tools, toolPlan.focus);
      crmMissing = crm.empty;
      limitations = crm.limitations;
    } catch {
      crmMissing = true;
    }
  }

  if (intentInfo.intent === "crm_only" && crmMissing) {
    const answer = sanitizeUserOutput("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi.");
    const crmSummary = { empty: true, limitations };
    const built = buildProcurementContext({
      intent: intentInfo.intent,
      originalQuestion: q,
      rewritten,
      toolPlan,
      crmMissing,
    });

    return {
      answer,
      intent: mapIntentToLegacy(intentInfo.intent),
      procurementIntent: intentInfo.intent,
      domainIntent: "procurement_crm",
      crmSummary,
      brainFiles: [],
      knowledgeFiles: [],
      crmEntities: toolPlan?.tools || [],
      mode: "procurement_v1",
      executionMs: Date.now() - started,
      rewrittenInternally: rewritten.wasRewritten,
      structured: buildStructuredResult({
        answer,
        intent: intentInfo.intent,
        built,
        crmSummary,
        crmMissing: true,
        limitations,
      }),
    };
  }

  const built = buildProcurementContext({
    intent: intentInfo.intent,
    originalQuestion: q,
    rewritten,
    knowledge,
    crm,
    toolPlan,
    crmMissing,
  });

  if (knowledge) {
    console.log(`Promptga kiritildi:\n${built.knowledgeInPrompt ? "HA" : "YO'Q"}`);
  }

  const { quickMaxTokens } = getEnv();
  const raw = await chatCompletion(built.systemPrompt, built.userPrompt, quickMaxTokens);
  let answer = sanitizeUserOutput(raw);

  if (intentInfo.needsCrm && crm && !crmMissing) {
    answer = appendFreshnessToAnswer(answer, crm.fetchedAt);
  }

  const crmSummary = {
    procurementIntent: intentInfo.intent,
    tools: toolPlan?.tools || [],
    focus: toolPlan?.focus || [],
    counts: crm?.counts,
    knowledgeChunks: knowledge?.usedChunkIds.length || 0,
    knowledgeUsed: knowledge?.knowledgeUsed ?? false,
    rewritten: rewritten.wasRewritten,
    knowledgeInPrompt: built.knowledgeInPrompt,
    limitations,
  };

  return {
    answer,
    intent: mapIntentToLegacy(intentInfo.intent),
    procurementIntent: intentInfo.intent,
    domainIntent: "procurement_document_crm",
    crmSummary,
    brainFiles: [],
    knowledgeFiles: built.knowledgeFiles,
    crmEntities: built.crmEntities,
    dataFreshness: crm ? { fetchedAt: crm.fetchedAt, cached: false } : undefined,
    mode: "procurement_v1",
    executionMs: Date.now() - started,
    rewrittenInternally: rewritten.wasRewritten,
    structured: buildStructuredResult({
      answer,
      intent: intentInfo.intent,
      built,
      crmSummary,
      crmMissing,
      limitations,
    }),
  };
}

export async function* runProcurementAnswerStream(
  question: string,
  _options: ProcurementAnswerOptions = {}
): AsyncGenerator<
  | { type: "status"; message: string; phase: "bitrix" | "reasoning" | "generating" }
  | { type: "delta"; text: string }
  | { type: "done"; answer: string; mode: "procurement_v1"; structured?: AgentStructuredResult },
  void,
  unknown
> {
  const q = question.trim();
  if (!q) throw new Error("Savol bo'sh bo'lishi mumkin emas.");

  const intentInfo = analyzeProcurementIntent(q);
  const rewritten = rewriteProcurementQuery(q);
  const analysisQuery = rewritten.rewritten;

  yield { type: "status", message: "Ta'minot savoli tahlil qilinmoqda...", phase: "reasoning" };

  let knowledge;
  if (intentInfo.needsKnowledge) {
    knowledge = await retrieveProcurementChunks(analysisQuery, { topK: 5 });
  }

  let crm;
  let crmMissing = false;
  let toolPlan;
  let limitations: string[] = [];

  if (intentInfo.needsCrm) {
    yield { type: "status", message: "Bitrix24 ta'minot ma'lumotlari yuklanmoqda...", phase: "bitrix" };
    toolPlan = planProcurementCrmTools(analysisQuery);
    try {
      crm = await fetchProcurementCrmData(toolPlan.tools, toolPlan.focus);
      crmMissing = crm.empty;
      limitations = crm.limitations;
    } catch {
      crmMissing = true;
    }
  }

  if (intentInfo.intent === "crm_only" && crmMissing) {
    const answer = sanitizeUserOutput("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi.");
    yield { type: "delta", text: answer };
    yield {
      type: "done",
      answer,
      mode: "procurement_v1",
      structured: buildStructuredFromPipeline({
        answer,
        domainIntent: intentInfo.intent,
        crmSummary: { empty: true, limitations },
        crmEntities: toolPlan?.tools || [],
        crmMissing: true,
        limitations,
        knowledgeLabel: "AQ-02 ta'minot hujjati",
      }),
    };
    return;
  }

  const built = buildProcurementContext({
    intent: intentInfo.intent,
    originalQuestion: q,
    rewritten,
    knowledge,
    crm,
    toolPlan,
    crmMissing,
  });

  const { quickMaxTokens } = getEnv();
  yield { type: "status", message: "Ta'minot javobi generatsiya qilinmoqda...", phase: "generating" };

  let raw = "";
  for await (const chunk of chatCompletionStream(built.systemPrompt, built.userPrompt, quickMaxTokens)) {
    raw += chunk;
    yield { type: "delta", text: chunk };
  }

  let answer = sanitizeUserOutput(raw);
  if (intentInfo.needsCrm && crm && !crmMissing) {
    answer = appendFreshnessToAnswer(answer, crm.fetchedAt);
  }

  yield {
    type: "done",
    answer,
    mode: "procurement_v1",
    structured: buildStructuredFromPipeline({
      answer,
      domainIntent: intentInfo.intent,
      crmSummary: {
        counts: crm?.counts,
        knowledgeChunks: knowledge?.usedChunkIds.length || 0,
        knowledgeUsed: knowledge?.knowledgeUsed ?? false,
        limitations,
      },
      knowledgeFiles: built.knowledgeFiles,
      crmEntities: built.crmEntities,
      knowledgeInPrompt: built.knowledgeInPrompt,
      crmMissing,
      limitations,
      knowledgeLabel: "AQ-02 ta'minot hujjati",
    }),
  };
}
