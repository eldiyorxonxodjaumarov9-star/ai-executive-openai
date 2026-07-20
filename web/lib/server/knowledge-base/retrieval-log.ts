import type { RetrievalHit, RetrievalResult } from "./types";

export type RetrievalFailureReason =
  | "index_not_found"
  | "chunks_json_unreadable"
  | "empty_index"
  | "no_query_terms"
  | "metadata_mismatch"
  | "query_rewrite_issue"
  | "similarity_threshold_too_high"
  | "intent_skipped_knowledge"
  | "unknown";

export interface RetrievalDiagnostics {
  agentId: string;
  indexPath: string;
  usedChunksJson: boolean;
  indexLoaded: boolean;
  indexChunkCount: number;
  query: string;
  minScore: number;
  failureReason?: RetrievalFailureReason;
  failureDetail?: string;
}

export interface AuditedRetrievalResult extends RetrievalResult {
  diagnostics: RetrievalDiagnostics;
  /** Similarity in 0..1 for display. */
  similarities: number[];
  averageSimilarity: number;
  matchedFiles: string[];
}

function reasonLabel(reason: RetrievalFailureReason): string {
  switch (reason) {
    case "index_not_found":
      return "index topilmadi";
    case "chunks_json_unreadable":
      return "chunks.json o'qilmadi";
    case "empty_index":
      return "indeks bo'sh (chunk yo'q)";
    case "no_query_terms":
      return "query rewrite / tokenize natijasida so'z qolmadi";
    case "metadata_mismatch":
      return "metadata mos kelmadi";
    case "query_rewrite_issue":
      return "query rewrite noto'g'ri";
    case "similarity_threshold_too_high":
      return "similarity threshold juda baland";
    case "intent_skipped_knowledge":
      return "intent knowledge chaqirmadi";
    default:
      return "boshqa sabab";
  }
}

/** Normalize raw TF-IDF scores to 0..1 relative to the best score in the candidate set. */
export function toSimilarities(hits: RetrievalHit[], rawMax = 0): number[] {
  const max = Math.max(rawMax, ...hits.map((h) => h.score), 0.0001);
  return hits.map((h) => Math.min(1, Math.round((h.score / max) * 1000) / 1000));
}

export function logKnowledgeRetrieval(result: AuditedRetrievalResult): void {
  const d = result.diagnostics;
  console.log(`\n[Knowledge]`);
  console.log(`Agent: ${d.agentId}`);
  console.log(`Used chunks.json: ${d.usedChunksJson ? "HA" : "YO'Q"}`);
  console.log(`index: ${d.indexPath}`);
  console.log(`query: ${d.query}`);

  if (!result.hits.length) {
    const reason = d.failureReason || "unknown";
    console.log(`Retrieval: YO'Q`);
    console.log(`Sabab: ${reasonLabel(reason)}`);
    if (d.failureDetail) console.log(`Detail: ${d.failureDetail}`);
    console.log(`Matched files:`);
    console.log(`- (yo'q)`);
    console.log(`Chunks:\n0`);
    console.log(`Average score:\n0`);
    console.log(`Promptga kiritildi:\nYO'Q`);
    return;
  }

  console.log(`Retrieval: HA`);
  console.log(`Matched files:`);
  for (const f of result.matchedFiles) {
    console.log(`- ${f}`);
  }
  console.log(`Chunks:\n${result.hits.length}`);
  console.log(`Average score:\n${result.averageSimilarity.toFixed(2)}`);
  console.log(`Chunk details:`);
  result.hits.forEach((hit, i) => {
    const sim = result.similarities[i] ?? 0;
    console.log(
      `  [${i + 1}] id=${hit.chunk.id} score=${sim.toFixed(3)} raw=${hit.score.toFixed(3)} file=${hit.chunk.meta.fileName} section=${hit.chunk.meta.sectionName} topic=${hit.chunk.meta.topic} type=${hit.chunk.meta.documentType} line=${hit.chunk.meta.pageOrLine}`
    );
  });
  console.log("");
}

export function emptyAuditedResult(
  query: string,
  diagnostics: RetrievalDiagnostics
): AuditedRetrievalResult {
  return {
    hits: [],
    query,
    usedChunkIds: [],
    diagnostics,
    similarities: [],
    averageSimilarity: 0,
    matchedFiles: [],
  };
}

export function wrapAuditedHits(
  query: string,
  hits: RetrievalHit[],
  diagnostics: RetrievalDiagnostics,
  rawMaxForNorm?: number
): AuditedRetrievalResult {
  const similarities = toSimilarities(hits, rawMaxForNorm);
  const averageSimilarity =
    similarities.length > 0
      ? Math.round((similarities.reduce((a, b) => a + b, 0) / similarities.length) * 100) / 100
      : 0;
  const matchedFiles = [...new Set(hits.map((h) => h.chunk.meta.fileName))];
  return {
    hits,
    query,
    usedChunkIds: hits.map((h) => h.chunk.id),
    diagnostics: { ...diagnostics, usedChunksJson: diagnostics.indexLoaded },
    similarities,
    averageSimilarity,
    matchedFiles,
  };
}
