/**
 * Audit CEO + Finance knowledge retrieval (chunks.json).
 * Usage: npx tsx scripts/audit-knowledge-retrieval.ts
 */
import { analyzeCeoIntent } from "../lib/server/ceo/intent";
import { rewriteCeoQuery } from "../lib/server/ceo/query-rewriter";
import { retrieveCeoChunks } from "../lib/server/ceo/retriever";
import { peekCeoIndexStatus, getCeoIndexPath } from "../lib/server/ceo/knowledge-loader";
import { analyzeFinanceIntent } from "../lib/server/finance/intent";
import { rewriteFinanceQuery } from "../lib/server/finance/query-rewriter";
import { retrieveFinanceChunks } from "../lib/server/finance/retriever";
import { peekFinanceIndexStatus, getFinanceIndexPath } from "../lib/server/finance/knowledge-loader";
import { buildCeoContext } from "../lib/server/ceo/context-builder";
import { buildFinanceContext } from "../lib/server/finance/context-builder";

async function auditCeo() {
  const q = "Kompaniya boshqaruvi qanday tashkil etilgan?";
  console.log("\n========== CEO AUDIT ==========");
  console.log("Savol:", q);
  const status = peekCeoIndexStatus();
  console.log("Index path:", getCeoIndexPath());
  console.log("Index status:", status.ok ? `OK (${status.index.chunks.length} chunks)` : status.reason);

  const intent = analyzeCeoIntent(q);
  console.log("Intent:", intent.intent, "needsKnowledge=", intent.needsKnowledge);
  const rw = rewriteCeoQuery(q);
  console.log("Rewritten:", rw.wasRewritten ? rw.rewritten : "(o'zgarmagan)");

  const result = await retrieveCeoChunks(rw.rewritten, { topK: 6 });
  const inPrompt = buildCeoContext({
    intent: intent.intent,
    originalQuestion: q,
    rewritten: rw,
    knowledge: result,
  });
  const usesKnowledge = inPrompt.userPrompt.includes("=== KOMPANIYA HUJJATLARI");
  const hasChunkText = result.hits.some((h) => inPrompt.userPrompt.includes(h.chunk.text.slice(0, 40)));

  console.log("Promptga knowledge kiritildi:", usesKnowledge && (result.hits.length === 0 || hasChunkText) ? "HA" : "YO'Q");
  return result;
}

async function auditFinance() {
  const q = "Pul oqimi qanday nazorat qilinadi?";
  console.log("\n========== FINANCE AUDIT ==========");
  console.log("Savol:", q);
  const status = peekFinanceIndexStatus();
  console.log("Index path:", getFinanceIndexPath());
  console.log("Index status:", status.ok ? `OK (${status.index.chunks.length} chunks)` : status.reason);

  const intent = analyzeFinanceIntent(q);
  console.log("Intent:", intent.intent, "needsKnowledge=", intent.needsKnowledge);
  const rw = rewriteFinanceQuery(q);
  console.log("Rewritten:", rw.wasRewritten ? rw.rewritten : "(o'zgarmagan)");

  const result = await retrieveFinanceChunks(rw.rewritten, { topK: 6 });
  const inPrompt = buildFinanceContext({
    intent: intent.intent,
    originalQuestion: q,
    rewritten: rw,
    knowledge: result,
  });
  const usesKnowledge = inPrompt.userPrompt.includes("=== MOLIYA HUJJATLARI");
  const hasChunkText = result.hits.some((h) => inPrompt.userPrompt.includes(h.chunk.text.slice(0, 40)));

  console.log("Promptga knowledge kiritildi:", usesKnowledge && (result.hits.length === 0 || hasChunkText) ? "HA" : "YO'Q");
  return result;
}

async function main() {
  const ceo = await auditCeo();
  const fin = await auditFinance();

  console.log("\n========== SUMMARY ==========");
  console.log("CEO retrieval:", ceo.hits.length ? "HA" : "YO'Q");
  console.log("CEO files:", ceo.matchedFiles.join(", ") || "-");
  console.log("CEO chunks:", ceo.hits.length, "avg score:", ceo.averageSimilarity);
  console.log("Finance retrieval:", fin.hits.length ? "HA" : "YO'Q");
  console.log("Finance files:", fin.matchedFiles.join(", ") || "-");
  console.log("Finance chunks:", fin.hits.length, "avg score:", fin.averageSimilarity);

  const ok = ceo.hits.length > 0 && fin.hits.length > 0 && ceo.diagnostics.usedChunksJson && fin.diagnostics.usedChunksJson;
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
