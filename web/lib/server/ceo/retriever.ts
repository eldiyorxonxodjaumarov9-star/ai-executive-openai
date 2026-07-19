import { formatRetrievalForPrompt, retrieveFromIndex } from "../knowledge-base/retriever";
import type { RetrievalResult } from "../knowledge-base/types";
import { loadCeoKnowledgeIndex } from "./knowledge-loader";

export async function retrieveCeoChunks(
  query: string,
  options: { topK?: number; forceRebuild?: boolean } = {}
): Promise<RetrievalResult> {
  const index = await loadCeoKnowledgeIndex(options.forceRebuild);
  return retrieveFromIndex(index, query, { topK: options.topK ?? 6, minScore: 0.4 });
}

export function formatCeoKnowledgeContext(result: RetrievalResult): string {
  return formatRetrievalForPrompt(result, 4500);
}
