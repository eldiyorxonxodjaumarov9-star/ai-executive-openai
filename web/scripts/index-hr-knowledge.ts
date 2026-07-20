/**
 * Build HR knowledge index from web/data/knowledge/hr
 * Usage: npm run index:hr
 */
import {
  rebuildHrKnowledgeIndex,
  getHrSourceFiles,
  getHrKnowledgeDir,
} from "../lib/server/hr/knowledge-loader";

async function main() {
  console.log("HR knowledge dir:", getHrKnowledgeDir());
  const files = getHrSourceFiles();
  console.log(`Source files (${files.length}):`);
  for (const f of files) console.log(" -", f);

  const parseFailures = Math.max(0, files.length);
  let index;
  try {
    index = await rebuildHrKnowledgeIndex();
  } catch (e) {
    console.error("Index build failed:", e);
    process.exit(1);
  }

  const indexedFiles = new Set(index.documents.map((d) => d.fileName));
  const failed = files.filter((f) => {
    const base = f.split(/[/\\]/).pop() || f;
    return !indexedFiles.has(base);
  });
  const parseFailureCount = failed.length;

  const emptyChunks = index.chunks.filter((c) => !c.text.trim() || c.text.trim().length < 20);
  const oversized = index.chunks.filter((c) => c.text.length > 2500);
  const avgLen =
    index.chunks.length > 0
      ? Math.round(index.chunks.reduce((s, c) => s + c.text.length, 0) / index.chunks.length)
      : 0;

  console.log(`\n=== Index natijasi ===`);
  console.log(`Documents count: ${index.documents.length}`);
  console.log(`Chunks count: ${index.chunks.length}`);
  console.log(`Parse failures: ${parseFailureCount}`);
  if (failed.length) {
    for (const f of failed) console.log(`  - ${f}`);
  }
  console.log(`Empty chunks (<20 char): ${emptyChunks.length}`);
  console.log(`Oversized chunks (>2500 char): ${oversized.length}`);
  console.log(`Average chunk length: ${avgLen} chars`);
  console.log(`Built at: ${index.builtAt}`);

  for (const d of index.documents) {
    console.log(`  ${d.fileName} [${d.topic}] → ${d.chunkCount} chunks`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
