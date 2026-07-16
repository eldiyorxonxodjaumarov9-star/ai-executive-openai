import type { NormalizedDeal } from "./deal-normalizer";
import { formatMoney } from "./sales-analytics";
import { parseBitrixDate } from "./tashkent-time";
import type { KpiSnapshot } from "./kpi-engine";
import type { RiskItem } from "./risk-engine";

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

  const workload = new Map<string, number>();
  for (const d of deals.filter((x) => x.isOpen)) {
    workload.set(d.assignedByName, (workload.get(d.assignedByName) || 0) + 1);
  }
  const overloaded = [...workload.entries()].sort((a, b) => b[1] - a[1])[0];
  if (overloaded && overloaded[1] >= 8) {
    recs.push({
      priority: "high",
      category: "hr",
      text: `${overloaded[0]}dagi ${overloaded[1]} ta ochiq bitimni qayta taqsimlash tavsiya etiladi.`,
    });
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
      text: `${topRisks.length} ta risk deal mavjud — ${topRisks.map((r) => r.title).join(", ")}.`,
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

  if (kpis.managerRanking.length >= 2) {
    const top = kpis.managerRanking[0];
    const bottom = kpis.managerRanking[kpis.managerRanking.length - 1];
    if (top.wonCount === 0 && bottom.wonCount === 0 && kpis.open > 0) {
      recs.push({
        priority: "medium",
        category: "executive",
        text: "Hozircha yopilgan bitim yo'q — pipeline aktivligini oshiring.",
      });
    }
  }

  if (recs.length === 0 && kpis.open > 0) {
    recs.push({
      priority: "low",
      category: "executive",
      text: `Pipeline barqaror: ${kpis.open} ochiq bitim, jami ${kpis.pipelineFormatted}.`,
    });
  }

  return recs.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
}
