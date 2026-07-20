/**
 * Build Business Analytics knowledge index from web/data/knowledge/business-analytics
 * Usage: npx tsx scripts/index-business-analytics-knowledge.ts
 */
import { buildKnowledgeIndex } from "../lib/server/knowledge-base/indexer";
import { listKnowledgeSourceFiles } from "../lib/server/knowledge-base/extract";
import { getBusinessAnalyticsKnowledgeDir } from "../lib/server/paths";

const AGENT_ID = "business-analytics";

async function main() {
  const sourceDir = getBusinessAnalyticsKnowledgeDir();
  console.log("Business Analytics knowledge dir:", sourceDir);
  const files = listKnowledgeSourceFiles(sourceDir);
  console.log(`Source files (${files.length}):`);
  for (const f of files) console.log(" -", f);

  const index = await buildKnowledgeIndex({ agentId: AGENT_ID, sourceDir });
  console.log(`Indexed documents: ${index.documents.length}`);
  console.log(`Chunks: ${index.chunks.length}`);
  console.log(`Built at: ${index.builtAt}`);
  for (const d of index.documents) {
    console.log(`  ${d.fileName} [${d.topic}] → ${d.chunkCount} chunks`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
