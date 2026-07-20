import { chatCompletion, chatCompletionStream } from "../openai";
import { sanitizeUserOutput } from "../sanitize";
import { appendFreshnessToAnswer } from "../agent-context";
import { getEnv } from "../env";
import type { IntentType } from "../intent-router";
import { analyzeCeoIntent, type CeoIntent } from "./intent";
import { rewriteCeoQuery } from "./query-rewriter";
import { retrieveCeoChunks } from "./retriever";
import { planCeoCrmTools } from "./tool-planner";
import { fetchCeoCrmData } from "./crm-fetcher";
import { buildCeoContext } from "./context-builder";
import { gatherCeoDirectorReports, resolveCeoOrchestrationAgents } from "./orchestrator";

export interface CeoAnswerOptions {
  bypassCache?: boolean;
  conversationId?: string;
}

export interface CeoAnswerResult {
  answer: string;
  intent: IntentType;
  ceoIntent: CeoIntent;
  domainIntent: string;
  crmSummary: Record<string, unknown>;
  brainFiles: string[];
  knowledgeFiles: string[];
  crmEntities: string[];
  dataFreshness?: { fetchedAt: string; cached: boolean };
  mode: "ceo_v1";
  executionMs: number;
  rewrittenInternally: boolean;
}

function mapCeoIntentToLegacy(intent: CeoIntent): IntentType {
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

export async function runCeoAnswer(
  question: string,
  _options: CeoAnswerOptions = {}
): Promise<CeoAnswerResult> {
  const started = Date.now();
  const q = question.trim();
  if (!q) throw new Error("Savol bo'sh bo'lishi mumkin emas.");

  const intentInfo = analyzeCeoIntent(q);
  const rewritten = rewriteCeoQuery(q);
  const analysisQuery = rewritten.rewritten;

  // BP-09: sub-agent orchestration (delegatsiya)
  const orchestrationAgents = resolveCeoOrchestrationAgents(q);
  if (intentInfo.intent !== "casual_chat" && orchestrationAgents.length > 0) {
    const orchestration = await gatherCeoDirectorReports(q, orchestrationAgents);
    const built = buildCeoContext({
      intent: "knowledge_plus_crm",
      originalQuestion: q,
      rewritten,
      orchestration,
    });

    const { quickMaxTokens } = getEnv();
    const raw = await chatCompletion(built.systemPrompt, built.userPrompt, Math.max(quickMaxTokens, 1200));
    const answer = sanitizeUserOutput(raw);

    return {
      answer,
      intent: "hybrid_question",
      ceoIntent: "knowledge_plus_crm",
      domainIntent: "ceo_bp09_orchestration",
      crmSummary: {
        orchestration: true,
        agentsConsulted: orchestration.agentsConsulted,
        orchestrationAgents: orchestration.orchestrationAgents,
      },
      brainFiles: [],
      knowledgeFiles: built.knowledgeFiles,
      crmEntities: built.crmEntities,
      mode: "ceo_v1",
      executionMs: Date.now() - started,
      rewrittenInternally: rewritten.wasRewritten,
    };
  }

  let knowledge;
  if (intentInfo.needsKnowledge) {
    knowledge = await retrieveCeoChunks(analysisQuery, { topK: 6 });
  } else {
    console.log(`\n[Knowledge] agent=ceo`);
    console.log(`Retrieval: YO'Q`);
    console.log(`Sabab: intent knowledge chaqirmadi (${intentInfo.intent})`);
    console.log(`Chunks:\n0\n`);
  }

  let crm;
  let crmMissing = false;
  let toolPlan;
  if (intentInfo.needsCrm) {
    toolPlan = planCeoCrmTools(analysisQuery);
    try {
      crm = await fetchCeoCrmData(toolPlan.tools);
      crmMissing = crm.empty;
    } catch {
      crmMissing = true;
    }
  }

  if (intentInfo.intent === "crm_only" && crmMissing) {
    return {
      answer: sanitizeUserOutput("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi"),
      intent: mapCeoIntentToLegacy(intentInfo.intent),
      ceoIntent: intentInfo.intent,
      domainIntent: "ceo_crm",
      crmSummary: { empty: true },
      brainFiles: [],
      knowledgeFiles: [],
      crmEntities: toolPlan?.tools || [],
      mode: "ceo_v1",
      executionMs: Date.now() - started,
      rewrittenInternally: rewritten.wasRewritten,
    };
  }

  const built = buildCeoContext({
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
    intent: mapCeoIntentToLegacy(intentInfo.intent),
    ceoIntent: intentInfo.intent,
    domainIntent: "ceo_document_crm",
    crmSummary: {
      ceoIntent: intentInfo.intent,
      tools: toolPlan?.tools || [],
      counts: crm?.counts,
      knowledgeChunks: knowledge?.usedChunkIds.length || 0,
      rewritten: rewritten.wasRewritten,
    },
    brainFiles: [],
    knowledgeFiles: built.knowledgeFiles,
    crmEntities: built.crmEntities,
    dataFreshness: crm ? { fetchedAt: crm.fetchedAt, cached: false } : undefined,
    mode: "ceo_v1",
    executionMs: Date.now() - started,
    rewrittenInternally: rewritten.wasRewritten,
  };
}

export async function* runCeoAnswerStream(
  question: string,
  options: CeoAnswerOptions = {}
): AsyncGenerator<
  | { type: "status"; message: string; phase: "bitrix" | "reasoning" | "generating" }
  | { type: "delta"; text: string }
  | { type: "done"; answer: string; mode: "ceo_v1" },
  void,
  unknown
> {
  const q = question.trim();
  if (!q) throw new Error("Savol bo'sh bo'lishi mumkin emas.");

  const intentInfo = analyzeCeoIntent(q);
  const rewritten = rewriteCeoQuery(q);
  const analysisQuery = rewritten.rewritten;

  yield { type: "status", message: "Savol tahlil qilinmoqda...", phase: "reasoning" };

  const orchestrationAgents = resolveCeoOrchestrationAgents(q);
  if (intentInfo.intent !== "casual_chat" && orchestrationAgents.length > 0) {
    yield {
      type: "status",
      message: "Direktor agentlaridan hisobotlar yig'ilmoqda...",
      phase: "bitrix",
    };
    const orchestration = await gatherCeoDirectorReports(q, orchestrationAgents);
    const built = buildCeoContext({
      intent: "knowledge_plus_crm",
      originalQuestion: q,
      rewritten,
      orchestration,
    });
    const { quickMaxTokens } = getEnv();
    yield { type: "status", message: "Executive Report yozilmoqda...", phase: "generating" };
    let raw = "";
    for await (const chunk of chatCompletionStream(
      built.systemPrompt,
      built.userPrompt,
      Math.max(quickMaxTokens, 1200)
    )) {
      raw += chunk;
      yield { type: "delta", text: chunk };
    }
    yield { type: "done", answer: sanitizeUserOutput(raw), mode: "ceo_v1" };
    return;
  }

  let knowledge;
  if (intentInfo.needsKnowledge) {
    knowledge = await retrieveCeoChunks(analysisQuery, { topK: 6 });
  }

  let crm;
  let crmMissing = false;
  let toolPlan;
  if (intentInfo.needsCrm) {
    yield { type: "status", message: "Bitrix24 ma'lumotlari yuklanmoqda...", phase: "bitrix" };
    toolPlan = planCeoCrmTools(analysisQuery);
    try {
      crm = await fetchCeoCrmData(toolPlan.tools);
      crmMissing = crm.empty;
    } catch {
      crmMissing = true;
    }
  }

  if (intentInfo.intent === "crm_only" && crmMissing) {
    const answer = sanitizeUserOutput("Bitrix24 da bu savol bo'yicha aniq ma'lumot topilmadi");
    yield { type: "delta", text: answer };
    yield { type: "done", answer, mode: "ceo_v1" };
    return;
  }

  const built = buildCeoContext({
    intent: intentInfo.intent,
    originalQuestion: q,
    rewritten,
    knowledge,
    crm,
    toolPlan,
    crmMissing,
  });

  const { quickMaxTokens } = getEnv();
  yield { type: "status", message: "Javob generatsiya qilinmoqda...", phase: "generating" };

  let raw = "";
  for await (const chunk of chatCompletionStream(built.systemPrompt, built.userPrompt, quickMaxTokens)) {
    raw += chunk;
    yield { type: "delta", text: chunk };
  }

  let answer = sanitizeUserOutput(raw);
  if (intentInfo.needsCrm && crm && !crmMissing) {
    answer = appendFreshnessToAnswer(answer, crm.fetchedAt);
  }
  yield { type: "done", answer, mode: "ceo_v1" };
}
