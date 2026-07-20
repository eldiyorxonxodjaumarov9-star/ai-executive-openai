import {
  ensureKnowledgeIndex,
  loadKnowledgeIndexWithStatus,
  indexPathFor,
  buildKnowledgeIndex,
} from "../knowledge-base/indexer";
import { listKnowledgeSourceFiles } from "../knowledge-base/extract";
import type { KnowledgeIndex } from "../knowledge-base/types";
import { getHrKnowledgeDir } from "../paths";

const AGENT_ID = "hr";

export async function loadHrKnowledgeIndex(forceRebuild = false): Promise<KnowledgeIndex> {
  return ensureKnowledgeIndex({
    agentId: AGENT_ID,
    sourceDir: getHrKnowledgeDir(),
    forceRebuild,
  });
}

export function peekHrIndexStatus() {
  return loadKnowledgeIndexWithStatus(getHrKnowledgeDir());
}

export function getHrSourceFiles(): string[] {
  return listKnowledgeSourceFiles(getHrKnowledgeDir());
}

export async function rebuildHrKnowledgeIndex(): Promise<KnowledgeIndex> {
  return buildKnowledgeIndex({
    agentId: AGENT_ID,
    sourceDir: getHrKnowledgeDir(),
  });
}

export function peekHrKnowledgeIndex(): KnowledgeIndex | null {
  const status = loadKnowledgeIndexWithStatus(getHrKnowledgeDir());
  return status.ok ? status.index : null;
}

export function getHrIndexPath(): string {
  return indexPathFor(getHrKnowledgeDir());
}

export { getHrKnowledgeDir };
