import { analyzeRouteIntent, type IntentType } from "./intent-router";
import { parseDateRangeFromQuestion, type ParsedDateRange } from "./date-range-parser";

export type CrmMetric =
  | "total_count"
  | "total_amount"
  | "won_count"
  | "won_amount"
  | "lost_count"
  | "open_count"
  | "created_count"
  | "top_deal"
  | "manager_performance"
  | "manager_open_deals"
  | "stage_breakdown"
  | "executive_report"
  | "today_sales"
  | "general";

export type CrmAggregation = "count" | "sum" | "avg" | "max" | "rank" | "breakdown" | "report";

export type DealStatusFilter = "all" | "won" | "lost" | "open" | "created_in_period" | "won_in_period";

export interface CrmQueryRouting {
  intent: IntentType;
  domain: "sales" | "tasks" | "leads" | "general";
  metric: CrmMetric;
  dateRange: ParsedDateRange;
  employee: string | null;
  stage: string | null;
  aggregation: CrmAggregation;
  dealStatusFilter: DealStatusFilter;
  matchedKeywords: string[];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/ʻ|’|`/g, "'");
}

function inferMetric(text: string): CrmMetric {
  if (/\b(bugun|bugungi).*(sotuv|savdo)\b/.test(text) || /\bqancha sotuv\b/.test(text) || /\bbugungi sotuvlar\b/.test(text)) return "today_sales";
  if (/\b(direktor|rahbar|bosh direktor|ceo).*(hisobot|xulosa)\b/.test(text) || /\bumumiy sotuv hisoboti\b/.test(text)) {
    return "executive_report";
  }
  if (/\beng katta bitim\b/.test(text) || /\beng yuqori bitim\b/.test(text)) return "top_deal";
  if (/\b(menejer|xodim|mas'ul).*(eng ko'p|eng kop)\b/.test(text) && /\bochiq\b/.test(text)) return "manager_open_deals";
  if (/\b(menejer|xodim|mas'ul|kim).*(eng ko'p|eng kop|qancha|nechta)\b/.test(text)) return "manager_performance";
  if (/\bvoronka|bosqich|stage\b/.test(text) && /\b(tahlil|holat|breakdown)\b/.test(text)) return "stage_breakdown";
  if (/\byutqazilgan\b/.test(text) || /\b(yutqazdi|mag'lub|maglub)\b/.test(text)) return "lost_count";
  if (/\b(muvaffaqiyatli|yopilgan|yopildi).*(summa|qancha)\b/.test(text)) return "won_amount";
  if (/\b(muvaffaqiyatli|yopilgan|yopildi)\b/.test(text)) return "won_count";
  if (/\b(yaratilgan|yangi bitim|yaratildi)\b/.test(text)) return "created_count";
  if (/\b(ochiq bitim|faol bitim)\b/.test(text)) return "open_count";
  if (/\b(jami|umumiy).*(summa|qancha)\b/.test(text) || /\bumumiy.*summasi\b/.test(text)) return "total_amount";
  if (/\b(jami|umumiy|nechta).*(bitim|savdo|sotuv)\b/.test(text)) return "total_count";
  if (/\bnechta\b/.test(text)) return "total_count";
  if (/\bqancha\b/.test(text)) return "total_amount";
  return "general";
}

function inferAggregation(metric: CrmMetric): CrmAggregation {
  switch (metric) {
    case "top_deal":
      return "max";
    case "manager_performance":
    case "manager_open_deals":
      return "rank";
    case "stage_breakdown":
      return "breakdown";
    case "executive_report":
      return "report";
    case "total_amount":
    case "won_amount":
      return "sum";
    default:
      return "count";
  }
}

function inferDealStatusFilter(text: string, metric: CrmMetric, dateExplicit: boolean): DealStatusFilter {
  if (metric === "won_count" || metric === "won_amount" || metric === "today_sales") {
    return dateExplicit ? "won_in_period" : "won";
  }
  if (metric === "lost_count") return "lost";
  if (metric === "open_count" || metric === "manager_open_deals") return "open";
  if (/\b(yaratilgan|yaratildi|yangi bitim)\b/.test(text) && dateExplicit) return "created_in_period";
  if (/\b(yaratilgan|yaratildi)\b/.test(text) && dateExplicit) return "created_in_period";
  if (/\b(yopilgan|yopildi|savdo yop)\b/.test(text) && dateExplicit) return "won_in_period";
  return "all";
}

function extractEmployeeName(question: string): string | null {
  const skip = new Set([
    "Bugun", "Bugungi", "Kecha", "Oxirgi", "Nechta", "Qancha", "Kim", "Savdo", "Sotuv", "Bitim",
    "Jami", "Umumiy", "Eng", "Shu", "Direktor", "Menejer", "Qaysi",
  ]);
  const words = question.split(/\s+/);
  for (const w of words) {
    const clean = w.replace(/[^a-zA-Z\u0400-\u04FF']/g, "");
    if (clean.length >= 3 && /^[A-Z\u0410-\u042F]/.test(clean) && !skip.has(clean)) return clean;
  }
  return null;
}

export function analyzeCrmQuery(question: string): CrmQueryRouting {
  const route = analyzeRouteIntent(question);
  const text = normalize(question);
  const dateRange = parseDateRangeFromQuestion(question);
  const metric = inferMetric(text);
  const employee = extractEmployeeName(question);

  let domain: CrmQueryRouting["domain"] = "sales";
  if (/\b(vazifa|topshiriq)\b/.test(text)) domain = "tasks";
  else if (/\b(lid|mijoz so'rovi|yangi mijoz)\b/.test(text)) domain = "leads";
  else if (route.domainIntent === "sales_pipeline" || route.domainIntent === "deals") domain = "sales";

  return {
    intent: route.type,
    domain,
    metric,
    dateRange,
    employee,
    stage: null,
    aggregation: inferAggregation(metric),
    dealStatusFilter: inferDealStatusFilter(text, metric, dateRange.explicit),
    matchedKeywords: route.matchedKeywords,
  };
}

export function isCrmDealQuery(question: string): boolean {
  const route = analyzeRouteIntent(question);
  if (route.type === "crm_question" || route.type === "hybrid_question") return true;
  const text = normalize(question);
  return /\b(jami|umumiy|bitim|savdo|sotuv|menejer|voronka|hisobot|eng katta|eng ko'p|eng kop)\b/.test(text);
}
