import { ensureKnowledgeIndex, loadKnowledgeIndexWithStatus, indexPathFor, buildKnowledgeIndex } from "../knowledge-base/indexer";
import { listKnowledgeSourceFiles } from "../knowledge-base/extract";
import type { KnowledgeIndex } from "../knowledge-base/types";
import { getFinanceKnowledgeDir } from "../paths";

const AGENT_ID = "finance";

export async function loadFinanceKnowledgeIndex(forceRebuild = false): Promise<KnowledgeIndex> {
  const sourceDir = getFinanceKnowledgeDir();
  return ensureKnowledgeIndex({ agentId: AGENT_ID, sourceDir, forceRebuild });
}

export function peekFinanceIndexStatus() {
  return loadKnowledgeIndexWithStatus(getFinanceKnowledgeDir());
}

export function getFinanceSourceFiles(): string[] {
  return listKnowledgeSourceFiles(getFinanceKnowledgeDir());
}

export async function rebuildFinanceKnowledgeIndex(): Promise<KnowledgeIndex> {
  return buildKnowledgeIndex({ agentId: AGENT_ID, sourceDir: getFinanceKnowledgeDir() });
}

export function peekFinanceKnowledgeIndex(): KnowledgeIndex | null {
  const status = loadKnowledgeIndexWithStatus(getFinanceKnowledgeDir());
  return status.ok ? status.index : null;
}

export function getFinanceIndexPath(): string {
  return indexPathFor(getFinanceKnowledgeDir());
}

export { getFinanceKnowledgeDir };
