import { ensureKnowledgeIndex, loadKnowledgeIndexWithStatus, indexPathFor, buildKnowledgeIndex } from "../knowledge-base/indexer";
import { listKnowledgeSourceFiles } from "../knowledge-base/extract";
import type { KnowledgeIndex } from "../knowledge-base/types";
import { getCeoKnowledgeDir } from "../paths";

const AGENT_ID = "ceo";

export async function loadCeoKnowledgeIndex(forceRebuild = false): Promise<KnowledgeIndex> {
  const sourceDir = getCeoKnowledgeDir();
  return ensureKnowledgeIndex({ agentId: AGENT_ID, sourceDir, forceRebuild });
}

export function peekCeoIndexStatus() {
  return loadKnowledgeIndexWithStatus(getCeoKnowledgeDir());
}

export function getCeoSourceFiles(): string[] {
  return listKnowledgeSourceFiles(getCeoKnowledgeDir());
}

export async function rebuildCeoKnowledgeIndex(): Promise<KnowledgeIndex> {
  return buildKnowledgeIndex({ agentId: AGENT_ID, sourceDir: getCeoKnowledgeDir() });
}

export function peekCeoKnowledgeIndex(): KnowledgeIndex | null {
  const status = loadKnowledgeIndexWithStatus(getCeoKnowledgeDir());
  return status.ok ? status.index : null;
}

export function getCeoIndexPath(): string {
  return indexPathFor(getCeoKnowledgeDir());
}

export { getCeoKnowledgeDir };
