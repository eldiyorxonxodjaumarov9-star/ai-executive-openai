import { tokenize } from "./text-utils";
import type { KnowledgeChunk, KnowledgeIndex, RetrievalHit, RetrievalResult } from "./types";
import {
  emptyAuditedResult,
  logKnowledgeRetrieval,
  wrapAuditedHits,
  type AuditedRetrievalResult,
  type RetrievalDiagnostics,
  type RetrievalFailureReason,
} from "./retrieval-log";

function termFrequency(terms: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of terms) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

function buildIdf(chunks: KnowledgeChunk[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const chunk of chunks) {
    const unique = new Set(chunk.terms);
    for (const t of unique) df.set(t, (df.get(t) || 0) + 1);
  }
  const n = Math.max(chunks.length, 1);
  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    idf.set(term, Math.log(1 + n / (1 + count)));
  }
  return idf;
}

/** Light synonym expansion so Uzbek executive queries hit document topics. */
function expandQueryTerms(terms: string[]): string[] {
  const extra: string[] = [];
  const set = new Set(terms);
  const add = (...words: string[]) => {
    for (const w of words) {
      if (!set.has(w)) {
        set.add(w);
        extra.push(w);
      }
    }
  };

  if (set.has("boshqaruv") || set.has("tashkil") || set.has("tashkilot")) {
    add("boshqaruv", "rahbariyat", "direksiya", "tashkil", "hba-09");
  }
  if (set.has("pul") || set.has("oqimi") || set.has("cashflow") || set.has("nazorat")) {
    add("pul", "oqimi", "debitor", "tushum", "xarajat", "moliya", "nazorat");
  }
  if (set.has("kompaniya") && (set.has("boshqaruv") || set.has("tashkil"))) {
    add("boshqaruv", "arxitektura");
  }
  if (
    set.has("savdo") ||
    set.has("sotuv") ||
    set.has("lead") ||
    set.has("lid") ||
    set.has("konversiya") ||
    set.has("follow") ||
    set.has("pipeline") ||
    set.has("e'tiroz") ||
    set.has("etiroz")
  ) {
    add("savdo", "sotuv", "lead", "lid", "bitim", "konversiya", "follow", "pipeline", "menejer", "kpi");
  }
  if (
    set.has("taminot") ||
    set.has("ta'minot") ||
    set.has("yetkazib") ||
    set.has("xarid") ||
    set.has("ombor") ||
    set.has("zaxira") ||
    set.has("logistika") ||
    set.has("procurement")
  ) {
    add("taminot", "xarid", "yetkazib", "logistika", "ombor", "zaxira", "shartnoma", "sla", "kpi", "aq-02");
  }
  if (
    set.has("onboarding") ||
    set.has("rekrut") ||
    set.has("xodim") ||
    set.has("kpi") ||
    set.has("motivatsiya") ||
    set.has("turnover") ||
    set.has("performance") ||
    set.has("hr")
  ) {
    add("onboarding", "rekrut", "xodim", "kpi", "motivatsiya", "turnover", "performance", "hr", "aq-hr");
  }
  return [...terms, ...extra];
}

function scoreChunk(
  queryTerms: string[],
  chunk: KnowledgeChunk,
  idf: Map<string, number>
): number {
  if (!queryTerms.length || !chunk.terms.length) return 0;
  const tf = termFrequency(chunk.terms);
  let score = 0;
  for (const q of queryTerms) {
    const f = tf.get(q) || 0;
    if (!f) continue;
    score += (1 + Math.log(f)) * (idf.get(q) || 0.5);
  }

  const metaBlob =
    `${chunk.meta.topic} ${chunk.meta.sectionName} ${chunk.meta.documentType} ${chunk.meta.fileName}`.toLowerCase();
  for (const q of queryTerms) {
    if (metaBlob.includes(q)) score += 1.5;
  }

  // Phrase-ish boosts for common executive topics
  const textLower = chunk.text.toLowerCase();
  if (queryTerms.includes("boshqaruv") && (textLower.includes("boshqaruv") || metaBlob.includes("boshqaruv"))) {
    score += 2;
  }
  if (
    (queryTerms.includes("oqimi") || queryTerms.includes("pul")) &&
    (textLower.includes("pul oqimi") || textLower.includes("debitor") || metaBlob.includes("pul"))
  ) {
    score += 2;
  }
  if (
    (queryTerms.includes("savdo") || queryTerms.includes("sotuv") || queryTerms.includes("konversiya")) &&
    (textLower.includes("savdo") || textLower.includes("sotuv") || textLower.includes("lead") || metaBlob.includes("savdo"))
  ) {
    score += 2;
  }
  return score;
}

/**
 * Lexical-semantic retrieval (TF-IDF + metadata boost).
 * Always reads from the provided KnowledgeIndex (loaded from .index/chunks.json).
 */
export function retrieveFromIndex(
  index: KnowledgeIndex,
  query: string,
  options: { topK?: number; minScore?: number } = {}
): RetrievalResult {
  const audited = retrieveFromIndexAudited(index, query, {
    ...options,
    agentId: index.agentId,
    indexPath: `${index.sourceDir}/.index/chunks.json`,
    log: false,
  });
  return {
    hits: audited.hits,
    query: audited.query,
    usedChunkIds: audited.usedChunkIds,
  };
}

export function retrieveFromIndexAudited(
  index: KnowledgeIndex,
  query: string,
  options: {
    topK?: number;
    minScore?: number;
    agentId?: string;
    indexPath?: string;
    log?: boolean;
  } = {}
): AuditedRetrievalResult {
  const topK = options.topK ?? 6;
  // Lowered from 0.4 — relative fallback still applies if nothing passes.
  const minScore = options.minScore ?? 0.2;
  const baseDiagnostics: RetrievalDiagnostics = {
    agentId: options.agentId || index.agentId,
    indexPath: options.indexPath || `${index.sourceDir}/.index/chunks.json`,
    usedChunksJson: true,
    indexLoaded: true,
    indexChunkCount: index.chunks.length,
    query,
    minScore,
  };

  if (!index.chunks.length) {
    const result = emptyAuditedResult(query, {
      ...baseDiagnostics,
      failureReason: "empty_index",
      failureDetail: "chunks.json yuklandi, lekin chunklar ro'yxati bo'sh",
    });
    if (options.log !== false) logKnowledgeRetrieval(result);
    return result;
  }

  const queryTerms = expandQueryTerms(tokenize(query));
  if (!queryTerms.length) {
    const result = emptyAuditedResult(query, {
      ...baseDiagnostics,
      failureReason: "no_query_terms",
      failureDetail: "so'rovdan token chiqmadi",
    });
    if (options.log !== false) logKnowledgeRetrieval(result);
    return result;
  }

  const idf = buildIdf(index.chunks);
  const scored = index.chunks
    .map((chunk) => ({ chunk, score: scoreChunk(queryTerms, chunk, idf) }))
    .sort((a, b) => b.score - a.score);

  const rawMax = scored[0]?.score || 0;
  let ranked: RetrievalHit[] = scored.filter((h) => h.score >= minScore).slice(0, topK);

  let failureReason: RetrievalFailureReason | undefined;
  let failureDetail: string | undefined;

  if (!ranked.length && rawMax > 0) {
    // Threshold too high relative to this query — take relative top hits.
    failureReason = "similarity_threshold_too_high";
    failureDetail = `minScore=${minScore}, eng yuqori raw=${rawMax.toFixed(3)}; nisbiy top-${Math.min(3, topK)} olindi`;
    ranked = scored.filter((h) => h.score > 0).slice(0, Math.min(3, topK));
  } else if (!ranked.length) {
    failureReason = "metadata_mismatch";
    failureDetail = "hech qanday chunk query termlari bilan mos kelmadi";
  }

  const result = wrapAuditedHits(query, ranked, {
    ...baseDiagnostics,
    failureReason: ranked.length ? undefined : failureReason,
    failureDetail: ranked.length ? undefined : failureDetail,
  }, rawMax);

  // Keep note if we used relative fallback after threshold failure but still have hits
  if (ranked.length && failureReason === "similarity_threshold_too_high") {
    result.diagnostics.failureDetail = failureDetail;
  }

  if (options.log !== false) logKnowledgeRetrieval(result);
  return result;
}

export function formatRetrievalForPrompt(result: RetrievalResult, maxChars = 4500): string {
  if (!result.hits.length) {
    return "Hujjatlar bo'yicha mos bo'lak topilmadi.";
  }

  const parts: string[] = [];
  let used = 0;
  for (const hit of result.hits) {
    const block = [
      `### ${hit.chunk.meta.fileName} · ${hit.chunk.meta.sectionName}`,
      `Mavzu: ${hit.chunk.meta.topic} | Tur: ${hit.chunk.meta.documentType} | Qator/sahifa: ${hit.chunk.meta.pageOrLine}`,
      hit.chunk.text,
    ].join("\n");
    if (used + block.length > maxChars) break;
    parts.push(block);
    used += block.length;
  }
  return parts.join("\n\n---\n\n");
}

export type { AuditedRetrievalResult };
