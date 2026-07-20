/**
 * Shared procurement knowledge access + cross-domain retrieval.
 * Single source of truth: web/data/knowledge/procurement (never copied into agent folders).
 */
import { retrieveFromIndexAudited, formatRetrievalForPrompt } from "./retriever";
import {
  emptyAuditedResult,
  wrapAuditedHits,
  type AuditedRetrievalResult,
} from "./retrieval-log";
import type { KnowledgeIndex, RetrievalHit } from "./types";
import {
  getProcurementIndexPath,
  loadProcurementKnowledgeIndex,
  peekProcurementIndexStatus,
} from "../procurement/knowledge-loader";

export type KnowledgeDomain =
  | "ceo"
  | "finance"
  | "sales"
  | "customer-success"
  | "business-analytics"
  | "hr"
  | "marketing"
  | "procurement";

/** Normalize agent ids used in routing (underscore) vs knowledge (hyphen). */
export function toKnowledgeDomain(agentId: string): KnowledgeDomain {
  const n = agentId.trim().toLowerCase().replace(/_/g, "-");
  if (n === "customer-success") return "customer-success";
  if (n === "business-analytics") return "business-analytics";
  return n as KnowledgeDomain;
}

const DIRECT_PROCUREMENT =
  /ta'?minot|taminot|yetkazib|yetkazib\s*beruv|xarid|ombor|zaxira|logistik|procurement|supplier|aq-02|shartnoma.*yetkaz|yetkaz.*shartnoma/i;

function hasDirectProcurementSignal(text: string): boolean {
  return DIRECT_PROCUREMENT.test(text);
}

/**
 * Agent access rules for attaching shared procurement knowledge.
 * Qoida: har bir chat agent faqat o'z knowledge bazasidan foydalanadi.
 * Ta'minot (procurement) faqat CEO ta'minot savollarida yoki BA domain ichida.
 */
export function shouldAttachProcurement(
  primaryAgent: string,
  query: string
): { attach: boolean; reason: string } {
  const agent = toKnowledgeDomain(primaryAgent);
  const direct = hasDirectProcurementSignal(query);

  // Chat agentlar: o'z knowledge faqat — procurement qo'shilmaydi
  if (
    agent === "sales" ||
    agent === "hr" ||
    agent === "marketing" ||
    agent === "customer-success" ||
    agent === "finance"
  ) {
    return {
      attach: false,
      reason: `${agent} — faqat o'z knowledge (procurement yo'q)`,
    };
  }

  // CEO va BA endi mustaqil agent pipeline orqali ta'minot tahlilini oladi
  if (agent === "ceo" || agent === "business-analytics") {
    return {
      attach: false,
      reason: `${agent} — ta'minot uchun sub-agent/procurement pipeline ishlatiladi`,
    };
  }

  if (agent === "procurement") {
    return { attach: true, reason: "procurement domain — to'liq access" };
  }

  return direct
    ? { attach: true, reason: "bevosita ta'minot signali" }
    : { attach: false, reason: "procurement kerak emas" };
}

export interface CrossDomainRetrievalOptions {
  primaryAgent: string;
  loadPrimaryIndex: (forceRebuild?: boolean) => Promise<KnowledgeIndex>;
  primaryIndexPath: string;
  query: string;
  topK?: number;
  forceRebuild?: boolean;
  log?: boolean;
  /** Skip primary domain (rare). */
  skipPrimary?: boolean;
}

export interface CrossDomainRetrievalResult extends AuditedRetrievalResult {
  primaryAgent: string;
  domainsUsed: string[];
  procurementAttached: boolean;
  procurementReason: string;
  promptIncluded: boolean;
}

function domainOfHit(hit: RetrievalHit): string {
  return hit.chunk.meta.agentId || "unknown";
}

function mergeHits(
  primary: RetrievalHit[],
  shared: RetrievalHit[],
  topK: number
): RetrievalHit[] {
  const byId = new Map<string, RetrievalHit>();
  for (const h of [...primary, ...shared]) {
    const prev = byId.get(h.chunk.id);
    if (!prev || h.score > prev.score) byId.set(h.chunk.id, h);
  }
  return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, topK);
}

export function logCrossDomainRetrieval(result: CrossDomainRetrievalResult): void {
  console.log(`\n[Knowledge]`);
  console.log(`Primary agent: ${result.primaryAgent}`);
  console.log(`Domains used:`);
  if (!result.domainsUsed.length) {
    console.log(`- (yo'q)`);
  } else {
    for (const d of result.domainsUsed) console.log(`- ${d}`);
  }
  console.log(`Used chunks.json: ${result.diagnostics.usedChunksJson ? "HA" : "YO'Q"}`);
  console.log(`index: ${result.diagnostics.indexPath}`);
  console.log(`query: ${result.query}`);
  if (result.procurementAttached) {
    console.log(`Procurement: HA (${result.procurementReason})`);
  } else {
    console.log(`Procurement: YO'Q (${result.procurementReason})`);
  }

  if (!result.hits.length) {
    console.log(`Matched files:`);
    console.log(`- (yo'q)`);
    console.log(`Chunks:\n0`);
    console.log(`Average score:\n0`);
    console.log(`Promptga kiritildi: YO'Q\n`);
    return;
  }

  console.log(`Matched files:`);
  for (const f of result.matchedFiles) console.log(`- ${f}`);
  console.log(`Chunks:\n${result.hits.length}`);
  console.log(`Average score:\n${result.averageSimilarity.toFixed(2)}`);
  console.log(`Chunk details:`);
  result.hits.forEach((hit, i) => {
    const sim = result.similarities[i] ?? 0;
    console.log(
      `  [${i + 1}] domain=${domainOfHit(hit)} id=${hit.chunk.id} score=${sim.toFixed(3)} file=${hit.chunk.meta.fileName} section=${hit.chunk.meta.sectionName}`
    );
  });
  console.log(`Promptga kiritildi: ${result.promptIncluded ? "HA" : "YO'Q"}\n`);
}

export async function retrieveWithSharedDomains(
  options: CrossDomainRetrievalOptions
): Promise<CrossDomainRetrievalResult> {
  const primaryAgent = toKnowledgeDomain(options.primaryAgent);
  const topK = Math.min(6, Math.max(3, options.topK ?? 6));
  const query = options.query;
  const shouldLog = options.log !== false;

  const access = shouldAttachProcurement(primaryAgent, query);

  let primaryHits: RetrievalHit[] = [];
  let primaryLoaded = false;
  let primaryPath = options.primaryIndexPath;
  let primaryChunkCount = 0;

  if (!options.skipPrimary) {
    try {
      const index = await options.loadPrimaryIndex(options.forceRebuild);
      primaryLoaded = true;
      primaryChunkCount = index.chunks.length;
      primaryPath = `${index.sourceDir}/.index/chunks.json`;
      const primaryResult = retrieveFromIndexAudited(index, query, {
        topK,
        minScore: 0.2,
        agentId: primaryAgent,
        indexPath: primaryPath,
        log: false,
      });
      primaryHits = primaryResult.hits;
    } catch {
      primaryLoaded = false;
    }
  }

  let procurementHits: RetrievalHit[] = [];
  let procurementPath = getProcurementIndexPath();

  if (access.attach) {
    const status = peekProcurementIndexStatus();
    try {
      const procIndex = status.ok
        ? await loadProcurementKnowledgeIndex(options.forceRebuild)
        : await loadProcurementKnowledgeIndex(true);
      procurementPath = getProcurementIndexPath();
      const procResult = retrieveFromIndexAudited(procIndex, query, {
        topK: Math.min(4, topK),
        minScore: 0.2,
        agentId: "procurement",
        indexPath: procurementPath,
        log: false,
      });
      procurementHits = procResult.hits;
    } catch {
      procurementHits = [];
    }
  }

  const merged = mergeHits(primaryHits, procurementHits, topK);
  const rawMax = Math.max(0, ...merged.map((h) => h.score));

  const domainsUsed = [...new Set(merged.map(domainOfHit))];
  // If primary returned hits but domain tag missing, ensure primary listed
  if (primaryHits.length && !domainsUsed.includes(primaryAgent)) {
    domainsUsed.unshift(primaryAgent);
  }

  const base = wrapAuditedHits(
    query,
    merged,
    {
      agentId: primaryAgent,
      indexPath: access.attach
        ? `${primaryPath} + ${procurementPath}`
        : primaryPath,
      usedChunksJson: primaryLoaded || access.attach,
      indexLoaded: primaryLoaded || access.attach,
      indexChunkCount: primaryChunkCount,
      query,
      minScore: 0.2,
    },
    rawMax
  );

  const result: CrossDomainRetrievalResult = {
    ...base,
    primaryAgent,
    domainsUsed,
    procurementAttached: access.attach && procurementHits.length > 0,
    procurementReason: access.reason,
    promptIncluded: merged.length > 0,
  };

  // Access said attach but no hits — keep reason, mark not attached for domains
  if (access.attach && !procurementHits.length) {
    result.procurementAttached = false;
    result.procurementReason = `${access.reason} (mos chunk topilmadi)`;
  }

  if (shouldLog) logCrossDomainRetrieval(result);
  return result;
}

export function formatCrossDomainKnowledgeContext(
  result: CrossDomainRetrievalResult | AuditedRetrievalResult,
  maxChars = 4500
): string {
  if (!result.hits.length) return "Hujjatlar bo'yicha mos bo'lak topilmadi.";

  const parts: string[] = [];
  let used = 0;
  for (const hit of result.hits) {
    const domain = domainOfHit(hit);
    const block = [
      `### [${domain}] ${hit.chunk.meta.fileName} · ${hit.chunk.meta.sectionName}`,
      `Mavzu: ${hit.chunk.meta.topic} | Tur: ${hit.chunk.meta.documentType} | Qator/sahifa: ${hit.chunk.meta.pageOrLine}`,
      hit.chunk.text,
    ].join("\n");
    if (used + block.length > maxChars) break;
    parts.push(block);
    used += block.length;
  }
  return parts.join("\n\n---\n\n");
}

/** Re-export for callers that only need prompt formatting helper. */
export { formatRetrievalForPrompt };
