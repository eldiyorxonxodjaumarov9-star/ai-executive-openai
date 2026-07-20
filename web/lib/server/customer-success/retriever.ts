import { formatRetrievalForPrompt } from "../knowledge-base/retriever";
import {
  retrieveWithSharedDomains,
  formatCrossDomainKnowledgeContext,
  type CrossDomainRetrievalResult,
} from "../knowledge-base/cross-domain";
import type { AuditedRetrievalResult } from "../knowledge-base/retrieval-log";
import {
  getCustomerSuccessIndexPath,
  loadCustomerSuccessKnowledgeIndex,
} from "./knowledge-loader";

export async function retrieveCustomerSuccessChunks(
  query: string,
  options: { topK?: number; forceRebuild?: boolean; log?: boolean } = {}
): Promise<CrossDomainRetrievalResult> {
  return retrieveWithSharedDomains({
    primaryAgent: "customer-success",
    loadPrimaryIndex: loadCustomerSuccessKnowledgeIndex,
    primaryIndexPath: getCustomerSuccessIndexPath(),
    query,
    topK: options.topK ?? 6,
    forceRebuild: options.forceRebuild,
    log: options.log,
  });
}

export function formatCustomerSuccessKnowledgeContext(
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
