import { retrieveFromIndexAudited } from "../knowledge-base/retriever";
import { toSimilarities } from "../knowledge-base/retrieval-log";
import type { AuditedRetrievalResult } from "../knowledge-base/retrieval-log";
import type { RetrievalHit } from "../knowledge-base/types";
import { formatRetrievalForPrompt } from "../knowledge-base/retriever";
import {
  getBusinessAnalyticsIndexPath,
  loadBusinessAnalyticsKnowledgeIndex,
} from "./knowledge-loader";

const CANDIDATE_TOP_K = 18;
const PROMPT_TOP_K = 5;
const MIN_AVG_SIMILARITY = 0.22;

function preferredBusinessAnalyticsFilePatterns(query: string): RegExp[] {
  const q = query.toLowerCase();
  if (/bp-08|strategiya|direktor|tashkiliy|ramka/.test(q)) return [/aq-06_1/i];
  if (/kpi|dashboard|dashbord|ko'rsatkich|metrika|hisobot/.test(q)) return [/aq-06_2/i];
  if (/crm monitor|monitoring|nazorat|signal|kechikish/.test(q)) return [/aq-06_3/i];
  if (/bottleneck|tirqish|to'siq|jarayon/.test(q)) return [/aq-06_4/i];
  if (/avtomatizatsiya|automation|integratsiya|data quality|ma'lumot sifati/.test(q))
    return [/aq-06_5/i];
  return [];
}

function rerankBusinessAnalyticsHits(query: string, hits: RetrievalHit[]): RetrievalHit[] {
  const preferred = preferredBusinessAnalyticsFilePatterns(query);
  return [...hits].sort((a, b) => {
    let boostA = 0;
    let boostB = 0;
    for (const pat of preferred) {
      if (pat.test(a.chunk.meta.fileName)) boostA += 3;
      if (pat.test(b.chunk.meta.fileName)) boostB += 3;
    }
    return b.score + boostB - (a.score + boostA);
  });
}

function dedupeHits(hits: RetrievalHit[]): RetrievalHit[] {
  const seen = new Set<string>();
  const out: RetrievalHit[] = [];
  for (const hit of hits) {
    const key = hit.chunk.text.slice(0, 120).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

function logBusinessAnalyticsKnowledgeRetrieval(
  query: string,
  candidates: AuditedRetrievalResult,
  selected: AuditedRetrievalResult,
  promptIncluded: boolean
): void {
  console.log(`\n[Business Analytics Knowledge]`);
  console.log(`Query:\n${query}`);
  console.log(`Matched files:`);
  if (candidates.matchedFiles.length) {
    for (const f of candidates.matchedFiles) console.log(`- ${f}`);
  } else {
    console.log(`- (yo'q)`);
  }
  console.log(`Candidate chunks:\n${candidates.hits.length}`);
  console.log(`Selected chunks:\n${selected.hits.length}`);
  if (selected.similarities.length) {
    console.log(`Scores:\n${selected.similarities.map((s) => s.toFixed(3)).join(", ")}`);
  } else {
    console.log(`Scores:\n0`);
  }
  console.log(`Promptga kiritildi:\n${promptIncluded ? "HA" : "YO'Q"}\n`);
}

export interface BusinessAnalyticsRetrievalResult extends AuditedRetrievalResult {
  knowledgeUsed: boolean;
  candidateCount: number;
}

export async function retrieveBusinessAnalyticsChunks(
  query: string,
  options: { topK?: number; forceRebuild?: boolean; log?: boolean } = {}
): Promise<BusinessAnalyticsRetrievalResult> {
  const index = await loadBusinessAnalyticsKnowledgeIndex(options.forceRebuild);
  const indexPath = getBusinessAnalyticsIndexPath();
  const promptTopK = options.topK ?? PROMPT_TOP_K;

  const candidates = retrieveFromIndexAudited(index, query, {
    topK: CANDIDATE_TOP_K,
    agentId: "business-analytics",
    indexPath,
    log: false,
  });

  const reranked = dedupeHits(rerankBusinessAnalyticsHits(query, candidates.hits));
  const selectedHits = reranked.slice(0, promptTopK);
  const similarities = toSimilarities(selectedHits, candidates.hits[0]?.score);
  const averageSimilarity =
    similarities.length > 0
      ? Math.round((similarities.reduce((a, b) => a + b, 0) / similarities.length) * 100) / 100
      : 0;

  const knowledgeUsed = selectedHits.length > 0 && averageSimilarity >= MIN_AVG_SIMILARITY;
  const finalHits = knowledgeUsed ? selectedHits : [];

  const selected: AuditedRetrievalResult = {
    hits: finalHits,
    query,
    usedChunkIds: finalHits.map((h) => h.chunk.id),
    diagnostics: {
      ...candidates.diagnostics,
      query,
    },
    similarities: knowledgeUsed ? similarities.slice(0, finalHits.length) : [],
    averageSimilarity: knowledgeUsed ? averageSimilarity : 0,
    matchedFiles: [...new Set(finalHits.map((h) => h.chunk.meta.fileName))],
  };

  if (options.log !== false) {
    logBusinessAnalyticsKnowledgeRetrieval(query, candidates, selected, knowledgeUsed);
  }

  return {
    ...selected,
    knowledgeUsed,
    candidateCount: candidates.hits.length,
  };
}

export function formatBusinessAnalyticsKnowledgeContext(
  result: BusinessAnalyticsRetrievalResult
): string {
  if (!result.knowledgeUsed || !result.hits.length) {
    return "Mos biznes analitika hujjat bo'lagi topilmadi yoki similarity past.";
  }
  return formatRetrievalForPrompt(
    {
      hits: result.hits,
      query: result.query,
      usedChunkIds: result.usedChunkIds,
    },
    4500
  );
}
