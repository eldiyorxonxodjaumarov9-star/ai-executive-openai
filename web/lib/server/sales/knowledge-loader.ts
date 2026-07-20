import { ensureKnowledgeIndex, loadKnowledgeIndexWithStatus, indexPathFor, buildKnowledgeIndex } from "../knowledge-base/indexer";
import { listKnowledgeSourceFiles } from "../knowledge-base/extract";
import type { KnowledgeIndex } from "../knowledge-base/types";
import { getSalesKnowledgeDir } from "../paths";

const AGENT_ID = "sales";

export async function loadSalesKnowledgeIndex(forceRebuild = false): Promise<KnowledgeIndex> {
  return ensureKnowledgeIndex({ agentId: AGENT_ID, sourceDir: getSalesKnowledgeDir(), forceRebuild });
}

export function peekSalesIndexStatus() {
  return loadKnowledgeIndexWithStatus(getSalesKnowledgeDir());
}

export function getSalesSourceFiles(): string[] {
  return listKnowledgeSourceFiles(getSalesKnowledgeDir());
}

export async function rebuildSalesKnowledgeIndex(): Promise<KnowledgeIndex> {
  return buildKnowledgeIndex({ agentId: AGENT_ID, sourceDir: getSalesKnowledgeDir() });
}

export function peekSalesKnowledgeIndex(): KnowledgeIndex | null {
  const status = loadKnowledgeIndexWithStatus(getSalesKnowledgeDir());
  return status.ok ? status.index : null;
}

export function getSalesIndexPath(): string {
  return indexPathFor(getSalesKnowledgeDir());
}

export { getSalesKnowledgeDir };
