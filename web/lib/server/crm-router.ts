import type { AgentId } from "./constants";
import { loadBitrixDataForAgent } from "./bitrix-data-loader";
import { BitrixError, type CrmPayload } from "./bitrix";
import { buildAgentAnalytics } from "./agent-analytics";
import {
  appendFreshnessToAnswer,
  buildAgentContextBlock,
  buildAgentContextStructured,
} from "./agent-context";
import { analyzeCrmQuery, isCrmDealQuery, type CrmQueryRouting } from "./crm-query-router";
import { buildCrmAnalyticsPreview, type CrmAnalyticsContext } from "./crm-analytics";
import type { SalesFetchStatus } from "./sales-analytics";

type CrmRecord = Record<string, unknown>;

const DEAL_KEYWORDS = [
  "sotuv", "savdo", "bitim", "jami", "umumiy", "menejer", "eng katta", "eng ko'p", "eng kop",
  "hisobot", "voronka", "yutqazilgan", "yopildi", "yopilgan", "yaratildi", "ochiq", "summasi",
  "mijoz", "lid", "kontakt", "xodim", "marketing", "moliya", "risk", "voronka",
];

const ENTITY_KEYWORDS: Record<string, string[]> = {
  deals: DEAL_KEYWORDS,
  tasks: ["vazifa", "kim nima qildi", "xodim", "ishchi", "bajarildi", "deadline", "nima qildi", "nima ish", "topshiriq", "faoliyat", "yuklama"],
  leads: ["lid", "so'rov", "so‘rov", "yangi mijoz", "mijoz so'rovi", "lead", "marketing", "source", "manba"],
  contacts: ["kontakt", "aloqa", "tashkilot", "kompaniya", "mijoz"],
};

const GREETING_RE = /^(salom|assalomu?|hayrli|hello|hi|rahmat|xayr)[\s!.,?]*$/i;

function normalize(text: string): string {
  return text.toLowerCase().replace(/ʻ|’|`/g, "'");
}

export function isSalesQuery(question: string): boolean {
  const text = normalize(question);
  return DEAL_KEYWORDS.some((k) => text.includes(k)) || isCrmDealQuery(question);
}

export function detectQuickCrmEntities(question: string | null): string[] {
  if (!question?.trim()) return [];
  if (GREETING_RE.test(question.trim())) return [];

  const text = normalize(question);
  const selected: string[] = [];

  for (const [entity, keywords] of Object.entries(ENTITY_KEYWORDS)) {
    if (keywords.some((k) => text.includes(k))) selected.push(entity);
  }

  if (text.includes("mijoz") && !selected.includes("leads")) selected.push("leads");
  if (isCrmDealQuery(question) && !selected.includes("deals")) selected.push("deals");

  return [...new Set(selected)];
}

function emptyPayload(): CrmPayload {
  return {
    fetched_at: new Date().toISOString(),
    leads: [],
    deals: [],
    contacts: [],
    tasks: [],
    summary: { leads_count: 0, deals_count: 0, contacts_count: 0, tasks_count: 0, total_opportunity: 0 },
    mode: "quick",
  };
}

export function hasCrmData(data: CrmPayload): boolean {
  if (data.crmAnalytics) return data.crmAnalytics.totalDealsLoaded > 0;
  if (data.salesBlock) return true;
  return data.leads.length + data.deals.length + data.contacts.length + data.tasks.length > 0;
}

export interface CrmFetchResult {
  entities: string[];
  data: CrmPayload;
  routing: CrmQueryRouting;
  analytics: CrmAnalyticsContext | null;
  fetchStatus: SalesFetchStatus;
  fetchLogReason?: string;
  fetchedAt?: string;
  cached?: boolean;
  limitations?: string[];
  contextStructured?: Record<string, unknown>;
}

export async function fetchCrmAnalytics(
  question: string,
  agent: AgentId,
  options: { bypassCache?: boolean } = {}
): Promise<CrmFetchResult> {
  const routing = analyzeCrmQuery(question);
  const payload = emptyPayload();
  payload.mode = "agent_crm_analytics";

  try {
    const loaded = await loadBitrixDataForAgent(agent, {
      bypassCache: options.bypassCache,
      question,
    });

    const bundle = buildAgentAnalytics(agent, loaded, routing, question);
    const structured = buildAgentContextStructured(agent, question, routing, loaded, bundle);
    const contextBlock = buildAgentContextBlock(agent, structured);

    payload.fetched_at = loaded.fetchedAt;
    payload.deals = loaded.deals.slice(0, 12);
    payload.leads = loaded.leads.slice(0, 12);
    payload.contacts = loaded.contacts.slice(0, 12);
    payload.tasks = loaded.tasks.slice(0, 12);
    payload.summary = {
      leads_count: loaded.leads.length,
      deals_count: loaded.deals.length,
      contacts_count: loaded.contacts.length,
      tasks_count: loaded.tasks.length,
      total_opportunity: loaded.deals.reduce((s, d) => s + Number(d.OPPORTUNITY || 0), 0),
    };
    payload.crmAnalytics = bundle.base;
    payload.salesBlock = contextBlock;
    payload.fetchStatus = loaded.deals.length === 0 && loaded.leads.length === 0 ? "empty_crm" : "ok";
    payload.fetchLogReason = [...bundle.base.notes, ...loaded.limitations].join(" ") || undefined;

    console.info("[CRM] Agent analytics", {
      agent,
      question: question.slice(0, 80),
      metric: routing.metric,
      cached: loaded.cached,
      entities: loaded.entitiesFetched,
    });

    return {
      entities: Object.keys(loaded.entitiesFetched),
      data: payload,
      routing,
      analytics: bundle.base,
      fetchStatus: payload.fetchStatus as SalesFetchStatus,
      fetchLogReason: payload.fetchLogReason,
      fetchedAt: loaded.fetchedAt,
      cached: loaded.cached,
      limitations: loaded.limitations,
      contextStructured: structured as unknown as Record<string, unknown>,
    };
  } catch (e) {
    let status: SalesFetchStatus = "webhook_error";
    let logReason = "Bitrix24 webhook xatosi";

    if (e instanceof BitrixError) {
      status = e.code === "permission_denied" ? "permission_denied" : "webhook_error";
      logReason = e.message;
      console.error("[CRM] Agent analytics xato", { agent, code: e.code, reason: logReason });
    } else {
      console.error("[CRM] Agent analytics kutilmagan xato", {
        agent,
        error: e instanceof Error ? e.message : "unknown",
      });
    }

    payload.fetchStatus = status;
    payload.fetchLogReason = logReason;
    return {
      entities: ["deals"],
      data: payload,
      routing,
      analytics: null,
      fetchStatus: status,
      fetchLogReason: logReason,
    };
  }
}

export async function fetchCrmForQuick(
  question: string,
  agent: AgentId,
  options: { bypassCache?: boolean } = {}
): Promise<CrmFetchResult & { entities: string[] }> {
  const entities = detectQuickCrmEntities(question);

  if (!entities.length) {
    return {
      entities: [],
      data: emptyPayload(),
      routing: analyzeCrmQuery(question),
      analytics: null,
      fetchStatus: "ok",
    };
  }

  return fetchCrmAnalytics(question, agent, options);
}

function formatCrmBlockQuick(data: CrmPayload, mode: "crm_only" | "hybrid" = "crm_only"): string {
  if (data.salesBlock) return data.salesBlock;

  const hasData = hasCrmData(data);
  if (!hasData) {
    const reason = data.fetchLogReason || "Bitrix24 dan ma'lumot olinmadi";
    if (mode === "hybrid") return `Bitrix24: ${reason}. Bilim bazasi qismini ishlating.`;
    return `Bitrix24: ${reason}.`;
  }

  return `Ma'lumot olingan vaqt: ${data.fetched_at}\n${JSON.stringify(data.summary, null, 2)}`;
}

export { formatCrmBlockQuick, buildCrmAnalyticsPreview };
