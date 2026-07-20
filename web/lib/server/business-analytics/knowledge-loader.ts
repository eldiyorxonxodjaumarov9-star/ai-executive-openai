import {
  ensureKnowledgeIndex,
  loadKnowledgeIndexWithStatus,
  indexPathFor,
  buildKnowledgeIndex,
} from "../knowledge-base/indexer";
import { listKnowledgeSourceFiles } from "../knowledge-base/extract";
import type { KnowledgeIndex } from "../knowledge-base/types";
import { getBusinessAnalyticsKnowledgeDir } from "../paths";

const AGENT_ID = "business-analytics";

export async function loadBusinessAnalyticsKnowledgeIndex(
  forceRebuild = false
): Promise<KnowledgeIndex> {
  return ensureKnowledgeIndex({
    agentId: AGENT_ID,
    sourceDir: getBusinessAnalyticsKnowledgeDir(),
    forceRebuild,
  });
}

export function peekBusinessAnalyticsIndexStatus() {
  return loadKnowledgeIndexWithStatus(getBusinessAnalyticsKnowledgeDir());
}

export function getBusinessAnalyticsSourceFiles(): string[] {
  return listKnowledgeSourceFiles(getBusinessAnalyticsKnowledgeDir());
}

export async function rebuildBusinessAnalyticsKnowledgeIndex(): Promise<KnowledgeIndex> {
  return buildKnowledgeIndex({
    agentId: AGENT_ID,
    sourceDir: getBusinessAnalyticsKnowledgeDir(),
  });
}

export function getBusinessAnalyticsIndexPath(): string {
  return indexPathFor(getBusinessAnalyticsKnowledgeDir());
}

export { getBusinessAnalyticsKnowledgeDir };
