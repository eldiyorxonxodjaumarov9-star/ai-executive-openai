import {
  retrieveWithSharedDomains,
  formatCrossDomainKnowledgeContext,
  type CrossDomainRetrievalResult,
} from "../knowledge-base/cross-domain";
import {
  getBusinessAnalyticsIndexPath,
  loadBusinessAnalyticsKnowledgeIndex,
} from "./knowledge-loader";

export async function retrieveBusinessAnalyticsChunks(
  query: string,
  options: { topK?: number; forceRebuild?: boolean; log?: boolean } = {}
): Promise<CrossDomainRetrievalResult> {
  return retrieveWithSharedDomains({
    primaryAgent: "business-analytics",
    loadPrimaryIndex: loadBusinessAnalyticsKnowledgeIndex,
    primaryIndexPath: getBusinessAnalyticsIndexPath(),
    query,
    topK: options.topK ?? 6,
    forceRebuild: options.forceRebuild,
    log: options.log,
  });
}

export function formatBusinessAnalyticsKnowledgeContext(
  result: CrossDomainRetrievalResult
): string {
  return formatCrossDomainKnowledgeContext(result);
}
