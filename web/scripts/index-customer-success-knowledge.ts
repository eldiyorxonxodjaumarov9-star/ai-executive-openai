/**
 * Build Customer Success knowledge index from web/data/knowledge/customer-success
 * Usage: npx tsx scripts/index-customer-success-knowledge.ts
 */
import {
  rebuildCustomerSuccessKnowledgeIndex,
  getCustomerSuccessSourceFiles,
  getCustomerSuccessKnowledgeDir,
} from "../lib/server/customer-success/knowledge-loader";

async function main() {
  console.log("Customer Success knowledge dir:", getCustomerSuccessKnowledgeDir());
  const files = getCustomerSuccessSourceFiles();
  console.log(`Source files (${files.length}):`);
  for (const f of files) console.log(" -", f);

  const index = await rebuildCustomerSuccessKnowledgeIndex();
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
