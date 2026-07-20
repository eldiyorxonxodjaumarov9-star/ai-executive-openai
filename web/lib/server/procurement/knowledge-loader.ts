import {
  ensureKnowledgeIndex,
  loadKnowledgeIndexWithStatus,
  indexPathFor,
  buildKnowledgeIndex,
} from "../knowledge-base/indexer";
import { listKnowledgeSourceFiles } from "../knowledge-base/extract";
import type { KnowledgeIndex } from "../knowledge-base/types";
import { getProcurementKnowledgeDir } from "../paths";

const AGENT_ID = "procurement";

export async function loadProcurementKnowledgeIndex(
  forceRebuild = false
): Promise<KnowledgeIndex> {
  return ensureKnowledgeIndex({
    agentId: AGENT_ID,
    sourceDir: getProcurementKnowledgeDir(),
    forceRebuild,
  });
}

export function peekProcurementIndexStatus() {
  return loadKnowledgeIndexWithStatus(getProcurementKnowledgeDir());
}

export function getProcurementSourceFiles(): string[] {
  return listKnowledgeSourceFiles(getProcurementKnowledgeDir());
}

export async function rebuildProcurementKnowledgeIndex(): Promise<KnowledgeIndex> {
  return buildKnowledgeIndex({
    agentId: AGENT_ID,
    sourceDir: getProcurementKnowledgeDir(),
  });
}

export function getProcurementIndexPath(): string {
  return indexPathFor(getProcurementKnowledgeDir());
}

export { getProcurementKnowledgeDir };
