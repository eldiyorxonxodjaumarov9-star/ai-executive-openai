/**
 * Build Finance knowledge index from web/data/knowledge/finance
 * Usage: npx tsx scripts/index-finance-knowledge.ts
 */
import {
  rebuildFinanceKnowledgeIndex,
  getFinanceSourceFiles,
  getFinanceKnowledgeDir,
} from "../lib/server/finance/knowledge-loader";

async function main() {
  console.log("Finance knowledge dir:", getFinanceKnowledgeDir());
  const files = getFinanceSourceFiles();
  console.log(`Source files (${files.length}):`);
  for (const f of files) console.log(" -", f);

  const index = await rebuildFinanceKnowledgeIndex();
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
