import type { NormalizedDeal } from "./deal-normalizer";
import { parseBitrixDate } from "./tashkent-time";
import type { KpiSnapshot } from "./kpi-engine";
import type { RiskItem } from "./risk-engine";
import { buildEmployeeAnalytics } from "./employee-analytics";

export interface Recommendation {
  priority: "high" | "medium" | "low";
  category: "sales" | "finance" | "hr" | "marketing" | "customer" | "executive";
  text: string;
}

export function generateRecommendations(
  deals: NormalizedDeal[],
  kpis: KpiSnapshot,
  risks: RiskItem[]
): Recommendation[] {
  const recs: Recommendation[] = [];
  const emp = buildEmployeeAnalytics(deals);

  for (const text of emp.executiveRecommendations.slice(0, 6)) {
    recs.push({ priority: "high", category: "executive", text });
  }

  if (kpis.conversionRate < 20 && kpis.open > 5) {
    recs.push({
      priority: "high",
      category: "sales",
      text: `Konversiya ${kpis.conversionRate}% — voronka bosqichlarini tekshiring va yopish jarayonini kuchaytiring.`,
    });
  }

  if (kpis.growthPercent < 0) {
    recs.push({
      priority: "high",
      category: "finance",
      text: `Revenue kamaymoqda (${kpis.growthPercent}%). Ochiq pipeline: ${kpis.pipelineFormatted}.`,
    });
  }

  const topRisks = risks.filter((r) => r.type !== "high_risk").slice(0, 3);
  if (topRisks.length) {
    recs.push({
      priority: "high",
      category: "executive",
      text: `${topRisks.length} ta risk deal mavjud — ${topRisks.map((r) => `${r.title}${r.manager ? ` (${r.manager})` : ""}`).join(", ")}.`,
    });
  }

  if (kpis.lost > kpis.won && kpis.lost > 0) {
    recs.push({
      priority: "medium",
      category: "sales",
      text: `${kpis.lost} ta yutqazilgan bitim — sabablarni tahlil qiling.`,
    });
  }

  const staleCount = deals.filter((d) => {
    if (!d.isOpen) return false;
    const dt = parseBitrixDate(d.dateCreate);
    return dt && Date.now() - dt.getTime() > 30 * 86400000;
  }).length;
  if (staleCount >= 3) {
    recs.push({
      priority: "medium",
      category: "sales",
      text: `${staleCount} ta bitim 30+ kundan beri qimirlamagan — follow-up reja tuzing.`,
    });
  }

  if (recs.length === 0 && kpis.open > 0) {
    recs.push({
      priority: "low",
      category: "executive",
      text: `Pipeline barqaror: ${kpis.open} ochiq bitim, jami ${kpis.pipelineFormatted}.`,
    });
  }

  const seen = new Set<string>();
  return recs
    .filter((r) => {
      if (seen.has(r.text)) return false;
      seen.add(r.text);
      return true;
    })
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
}
