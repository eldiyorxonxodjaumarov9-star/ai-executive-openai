/**
 * Build Procurement knowledge index from web/data/knowledge/procurement
 * Usage: npx tsx scripts/index-procurement-knowledge.ts
 */
import {
  rebuildProcurementKnowledgeIndex,
  getProcurementSourceFiles,
  getProcurementKnowledgeDir,
} from "../lib/server/procurement/knowledge-loader";

async function main() {
  console.log("Procurement knowledge dir:", getProcurementKnowledgeDir());
  const files = getProcurementSourceFiles();
  console.log(`Source files (${files.length}):`);
  for (const f of files) console.log(" -", f);

  const index = await rebuildProcurementKnowledgeIndex();
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
