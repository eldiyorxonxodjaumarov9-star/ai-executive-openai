import { formatRetrievalForPrompt, retrieveFromIndexAudited } from "../knowledge-base/retriever";
import {
  retrieveWithSharedDomains,
  formatCrossDomainKnowledgeContext,
  type CrossDomainRetrievalResult,
} from "../knowledge-base/cross-domain";
import type { AuditedRetrievalResult } from "../knowledge-base/retrieval-log";
import { getCeoIndexPath, loadCeoKnowledgeIndex } from "./knowledge-loader";

export async function retrieveCeoChunks(
  query: string,
  options: { topK?: number; forceRebuild?: boolean; log?: boolean } = {}
): Promise<CrossDomainRetrievalResult> {
  return retrieveWithSharedDomains({
    primaryAgent: "ceo",
    loadPrimaryIndex: loadCeoKnowledgeIndex,
    primaryIndexPath: getCeoIndexPath(),
    query,
    topK: options.topK ?? 6,
    forceRebuild: options.forceRebuild,
    log: options.log,
  });
}

export function formatCeoKnowledgeContext(
  result:
    | CrossDomainRetrievalResult
    | AuditedRetrievalResult
    | { hits: AuditedRetrievalResult["hits"]; query?: string; usedChunkIds?: string[] }
): string {
  if ("domainsUsed" in result) {
    return formatCrossDomainKnowledgeContext(result as CrossDomainRetrievalResult);
  }
  return formatRetrievalForPrompt(
    {
      hits: result.hits,
      query: "query" in result && result.query ? result.query : "",
      usedChunkIds:
        "usedChunkIds" in result && result.usedChunkIds
          ? result.usedChunkIds
          : result.hits.map((h) => h.chunk.id),
    },
    4500
  );
}

/** @deprecated kept for type compatibility */
export type { AuditedRetrievalResult };
export { retrieveFromIndexAudited };
