import { chatCompletion, chatCompletionStream } from "../openai";
import { sanitizeUserOutput } from "../sanitize";
import { appendFreshnessToAnswer } from "../agent-context";
import { getEnv } from "../env";
import type { IntentType } from "../intent-router";
import { analyzeFinanceIntent, type FinanceIntent } from "./intent";
import { rewriteFinanceQuery } from "./query-rewriter";
import { retrieveFinanceChunks } from "./retriever";
import { planFinanceCrmTools } from "./tool-planner";
import { fetchFinanceCrmData } from "./crm-fetcher";
import { buildFinanceContext } from "./context-builder";

export interface FinanceAnswerOptions {
  bypassCache?: boolean;
  conversationId?: string;
}

export interface FinanceAnswerResult {
  answer: string;
  intent: IntentType;
  financeIntent: FinanceIntent;
  domainIntent: string;
  crmSummary: Record<string, unknown>;
  brainFiles: string[];
  knowledgeFiles: string[];
  crmEntities: string[];
  dataFreshness?: { fetchedAt: string; cached: boolean };
  mode: "finance_v1";
  executionMs: number;
  rewrittenInternally: boolean;
}

function mapFinanceIntentToLegacy(intent: FinanceIntent): IntentType {
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

export async function runFinanceAnswer(
  question: string,
  _options: FinanceAnswerOptions = {}
): Promise<FinanceAnswerResult> {
  const started = Date.now();
  const q = question.trim();
  if (!q) throw new Error("Savol bo'sh bo'lishi mumkin emas.");

  const intentInfo = analyzeFinanceIntent(q);
  const rewritten = rewriteFinanceQuery(q);
  const analysisQuery = rewritten.rewritten;

  let knowledge;
  if (intentInfo.needsKnowledge) {
    knowledge = await retrieveFinanceChunks(analysisQuery, { topK: 6 });
  }

  let crm;
  let crmMissing = false;
  let toolPlan;
  if (intentInfo.needsCrm) {
    toolPlan = planFinanceCrmTools(analysisQuery);
    try {
      crm = await fetchFinanceCrmData(toolPlan.tools, toolPlan.focus);
      crmMissing = crm.empty;
    } catch {
      crmMissing = true;
    }
  }

  if (intentInfo.intent === "crm_only" && crmMissing) {
    return {
      answer: sanitizeUserOutput("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi."),
      intent: mapFinanceIntentToLegacy(intentInfo.intent),
      financeIntent: intentInfo.intent,
      domainIntent: "finance_crm",
      crmSummary: { empty: true },
      brainFiles: [],
      knowledgeFiles: [],
      crmEntities: toolPlan?.tools || [],
      mode: "finance_v1",
      executionMs: Date.now() - started,
      rewrittenInternally: rewritten.wasRewritten,
    };
  }

  const built = buildFinanceContext({
    intent: intentInfo.intent,
    originalQuestion: q,
    rewritten,
    knowledge,
    crm,
    toolPlan,
    crmMissing,
  });

  const { quickMaxTokens } = getEnv();
  const raw = await chatCompletion(built.systemPrompt, built.userPrompt, quickMaxTokens);
  let answer = sanitizeUserOutput(raw);

  if (intentInfo.needsCrm && crm && !crmMissing) {
    answer = appendFreshnessToAnswer(answer, crm.fetchedAt);
  }

  return {
    answer,
    intent: mapFinanceIntentToLegacy(intentInfo.intent),
    financeIntent: intentInfo.intent,
    domainIntent: "finance_document_crm",
    crmSummary: {
      financeIntent: intentInfo.intent,
      tools: toolPlan?.tools || [],
      focus: toolPlan?.focus || [],
      counts: crm?.counts,
      knowledgeChunks: knowledge?.usedChunkIds.length || 0,
      rewritten: rewritten.wasRewritten,
    },
    brainFiles: [],
    knowledgeFiles: built.knowledgeFiles,
    crmEntities: built.crmEntities,
    dataFreshness: crm ? { fetchedAt: crm.fetchedAt, cached: false } : undefined,
    mode: "finance_v1",
    executionMs: Date.now() - started,
    rewrittenInternally: rewritten.wasRewritten,
  };
}

export async function* runFinanceAnswerStream(
  question: string,
  options: FinanceAnswerOptions = {}
): AsyncGenerator<
  | { type: "status"; message: string; phase: "bitrix" | "reasoning" | "generating" }
  | { type: "delta"; text: string }
  | { type: "done"; answer: string; mode: "finance_v1" },
  void,
  unknown
> {
  const q = question.trim();
  if (!q) throw new Error("Savol bo'sh bo'lishi mumkin emas.");

  const intentInfo = analyzeFinanceIntent(q);
  const rewritten = rewriteFinanceQuery(q);
  const analysisQuery = rewritten.rewritten;

  yield { type: "status", message: "Moliyaviy savol tahlil qilinmoqda...", phase: "reasoning" };

  let knowledge;
  if (intentInfo.needsKnowledge) {
    knowledge = await retrieveFinanceChunks(analysisQuery, { topK: 6 });
  }

  let crm;
  let crmMissing = false;
  let toolPlan;
  if (intentInfo.needsCrm) {
    yield { type: "status", message: "Bitrix24 moliyaviy ma'lumotlari yuklanmoqda...", phase: "bitrix" };
    toolPlan = planFinanceCrmTools(analysisQuery);
    try {
      crm = await fetchFinanceCrmData(toolPlan.tools, toolPlan.focus);
      crmMissing = crm.empty;
    } catch {
      crmMissing = true;
    }
  }

  if (intentInfo.intent === "crm_only" && crmMissing) {
    const answer = sanitizeUserOutput("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi.");
    yield { type: "delta", text: answer };
    yield { type: "done", answer, mode: "finance_v1" };
    return;
  }

  const built = buildFinanceContext({
    intent: intentInfo.intent,
    originalQuestion: q,
    rewritten,
    knowledge,
    crm,
    toolPlan,
    crmMissing,
  });

  const { quickMaxTokens } = getEnv();
  yield { type: "status", message: "Moliyaviy javob generatsiya qilinmoqda...", phase: "generating" };

  let raw = "";
  for await (const chunk of chatCompletionStream(built.systemPrompt, built.userPrompt, quickMaxTokens)) {
    raw += chunk;
    yield { type: "delta", text: chunk };
  }

  let answer = sanitizeUserOutput(raw);
  if (intentInfo.needsCrm && crm && !crmMissing) {
    answer = appendFreshnessToAnswer(answer, crm.fetchedAt);
  }
  yield { type: "done", answer, mode: "finance_v1" };
}
