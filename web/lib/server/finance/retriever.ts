import { formatRetrievalForPrompt, retrieveFromIndex } from "../knowledge-base/retriever";
import type { RetrievalResult } from "../knowledge-base/types";
import { loadFinanceKnowledgeIndex } from "./knowledge-loader";

export async function retrieveFinanceChunks(
  query: string,
  options: { topK?: number; forceRebuild?: boolean } = {}
): Promise<RetrievalResult> {
  const index = await loadFinanceKnowledgeIndex(options.forceRebuild);
  return retrieveFromIndex(index, query, { topK: options.topK ?? 6, minScore: 0.4 });
}

export function formatFinanceKnowledgeContext(result: RetrievalResult): string {
  return formatRetrievalForPrompt(result, 4500);
}
