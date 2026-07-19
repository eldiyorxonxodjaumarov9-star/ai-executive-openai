import { tokenize } from "./text-utils";
import type { KnowledgeChunk, KnowledgeIndex, RetrievalHit, RetrievalResult } from "./types";

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

  const metaBlob = `${chunk.meta.topic} ${chunk.meta.sectionName} ${chunk.meta.documentType}`.toLowerCase();
  for (const q of queryTerms) {
    if (metaBlob.includes(q)) score += 1.25;
  }
  return score;
}

/**
 * Lexical-semantic retrieval (TF-IDF + metadata boost).
 * Reusable for any agent index; no full-document dump.
 */
export function retrieveFromIndex(
  index: KnowledgeIndex,
  query: string,
  options: { topK?: number; minScore?: number } = {}
): RetrievalResult {
  const topK = options.topK ?? 6;
  const minScore = options.minScore ?? 0.35;
  const queryTerms = tokenize(query);
  const idf = buildIdf(index.chunks);

  const ranked: RetrievalHit[] = index.chunks
    .map((chunk) => ({ chunk, score: scoreChunk(queryTerms, chunk, idf) }))
    .filter((h) => h.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Fallback: if nothing matched, take top by weak score without min threshold (still capped).
  const hits =
    ranked.length > 0
      ? ranked
      : index.chunks
          .map((chunk) => ({ chunk, score: scoreChunk(queryTerms, chunk, idf) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, Math.min(3, topK))
          .filter((h) => h.score > 0);

  return {
    hits,
    query,
    usedChunkIds: hits.map((h) => h.chunk.id),
  };
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
