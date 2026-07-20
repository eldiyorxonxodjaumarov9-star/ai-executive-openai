import {
  ensureKnowledgeIndex,
  loadKnowledgeIndexWithStatus,
  indexPathFor,
  buildKnowledgeIndex,
} from "../knowledge-base/indexer";
import { listKnowledgeSourceFiles } from "../knowledge-base/extract";
import type { KnowledgeIndex } from "../knowledge-base/types";
import { getCustomerSuccessKnowledgeDir } from "../paths";

const AGENT_ID = "customer-success";

export async function loadCustomerSuccessKnowledgeIndex(
  forceRebuild = false
): Promise<KnowledgeIndex> {
  return ensureKnowledgeIndex({
    agentId: AGENT_ID,
    sourceDir: getCustomerSuccessKnowledgeDir(),
    forceRebuild,
  });
}

export function peekCustomerSuccessIndexStatus() {
  return loadKnowledgeIndexWithStatus(getCustomerSuccessKnowledgeDir());
}

export function getCustomerSuccessSourceFiles(): string[] {
  return listKnowledgeSourceFiles(getCustomerSuccessKnowledgeDir());
}

export async function rebuildCustomerSuccessKnowledgeIndex(): Promise<KnowledgeIndex> {
  return buildKnowledgeIndex({
    agentId: AGENT_ID,
    sourceDir: getCustomerSuccessKnowledgeDir(),
  });
}

export function peekCustomerSuccessKnowledgeIndex(): KnowledgeIndex | null {
  const status = loadKnowledgeIndexWithStatus(getCustomerSuccessKnowledgeDir());
  return status.ok ? status.index : null;
}

export function getCustomerSuccessIndexPath(): string {
  return indexPathFor(getCustomerSuccessKnowledgeDir());
}

export { getCustomerSuccessKnowledgeDir };
