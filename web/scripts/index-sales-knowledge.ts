/**
 * Build Sales knowledge index from web/data/knowledge/sales
 * Usage: npx tsx scripts/index-sales-knowledge.ts
 */
import {
  rebuildSalesKnowledgeIndex,
  getSalesSourceFiles,
  getSalesKnowledgeDir,
} from "../lib/server/sales/knowledge-loader";

async function main() {
  console.log("Sales knowledge dir:", getSalesKnowledgeDir());
  const files = getSalesSourceFiles();
  console.log(`Source files (${files.length}):`);
  for (const f of files) console.log(" -", f);

  const index = await rebuildSalesKnowledgeIndex();
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
