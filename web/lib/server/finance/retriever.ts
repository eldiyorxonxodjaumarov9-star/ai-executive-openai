import { formatRetrievalForPrompt, retrieveFromIndexAudited } from "../knowledge-base/retriever";
import type { AuditedRetrievalResult } from "../knowledge-base/retrieval-log";
import { emptyAuditedResult, logKnowledgeRetrieval } from "../knowledge-base/retrieval-log";
import { getFinanceIndexPath, loadFinanceKnowledgeIndex, peekFinanceIndexStatus } from "./knowledge-loader";

export async function retrieveFinanceChunks(
  query: string,
  options: { topK?: number; forceRebuild?: boolean; log?: boolean } = {}
): Promise<AuditedRetrievalResult> {
  const indexPath = getFinanceIndexPath();
  const status = peekFinanceIndexStatus();

  if (!options.forceRebuild && !status.ok) {
    const result = emptyAuditedResult(query, {
      agentId: "finance",
      indexPath,
      usedChunksJson: false,
      indexLoaded: false,
      indexChunkCount: 0,
      query,
      minScore: 0.2,
      failureReason: status.reason,
      failureDetail: `Finance indeks: ${status.path}`,
    });
    if (options.log !== false) logKnowledgeRetrieval(result);
    try {
      const index = await loadFinanceKnowledgeIndex(true);
      return retrieveFromIndexAudited(index, query, {
        topK: options.topK ?? 6,
        minScore: 0.2,
        agentId: "finance",
        indexPath,
        log: options.log !== false,
      });
    } catch (e) {
      result.diagnostics.failureDetail = e instanceof Error ? e.message : "rebuild failed";
      return result;
    }
  }

  const index = await loadFinanceKnowledgeIndex(options.forceRebuild);
  return retrieveFromIndexAudited(index, query, {
    topK: options.topK ?? 6,
    minScore: 0.2,
    agentId: "finance",
    indexPath,
    log: options.log !== false,
  });
}

export function formatFinanceKnowledgeContext(result: AuditedRetrievalResult | { hits: AuditedRetrievalResult["hits"]; query?: string; usedChunkIds?: string[] }): string {
  return formatRetrievalForPrompt(
    {
      hits: result.hits,
      query: "query" in result && result.query ? result.query : "",
      usedChunkIds: "usedChunkIds" in result && result.usedChunkIds ? result.usedChunkIds : result.hits.map((h) => h.chunk.id),
    },
    4500
  );
}
