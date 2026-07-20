import { ensureKnowledgeIndex, loadKnowledgeIndex, buildKnowledgeIndex } from "../knowledge-base/indexer";
import { listKnowledgeSourceFiles } from "../knowledge-base/extract";
import type { KnowledgeIndex } from "../knowledge-base/types";
import { getFinanceKnowledgeDir } from "../paths";

const AGENT_ID = "finance";

export async function loadFinanceKnowledgeIndex(forceRebuild = false): Promise<KnowledgeIndex> {
  const sourceDir = getFinanceKnowledgeDir();
  return ensureKnowledgeIndex({ agentId: AGENT_ID, sourceDir, forceRebuild });
}

export function getFinanceSourceFiles(): string[] {
  return listKnowledgeSourceFiles(getFinanceKnowledgeDir());
}

export async function rebuildFinanceKnowledgeIndex(): Promise<KnowledgeIndex> {
  return buildKnowledgeIndex({ agentId: AGENT_ID, sourceDir: getFinanceKnowledgeDir() });
}

export function peekFinanceKnowledgeIndex(): KnowledgeIndex | null {
  return loadKnowledgeIndex(getFinanceKnowledgeDir());
}

export { getFinanceKnowledgeDir };
