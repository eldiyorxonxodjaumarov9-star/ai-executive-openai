/**
 * Build CEO knowledge index from web/data/knowledge/ceo
 * Usage: npx tsx scripts/index-ceo-knowledge.ts
 */
import { rebuildCeoKnowledgeIndex, getCeoSourceFiles, getCeoKnowledgeDir } from "../lib/server/ceo/knowledge-loader";

async function main() {
  console.log("CEO knowledge dir:", getCeoKnowledgeDir());
  const files = getCeoSourceFiles();
  console.log(`Source files (${files.length}):`);
  for (const f of files) console.log(" -", f);

  const index = await rebuildCeoKnowledgeIndex();
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
