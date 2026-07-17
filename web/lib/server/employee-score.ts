import type { EmployeeTrendProfile } from "./trend-engine";
import type { EmployeeProfile } from "./employee-analytics";

export interface EmployeeScore {
  assignedById: string;
  name: string;
  score: number;
  scoreOutOf10: number;
  grade: string;
  reasons: string[];
  trendSummary: string;
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function scoreEmployee(
  profile: EmployeeProfile,
  trend?: EmployeeTrendProfile
): EmployeeScore {
  let score = 55;
  const reasons: string[] = [];

  // Workload balance
  if (profile.openDeals >= 3 && profile.openDeals <= 8) {
    score += 8;
    reasons.push("Yuklama muvozanatli");
  } else if (profile.openDeals > 12) {
    score -= 12;
    reasons.push("Juda yuqori yuklama");
  } else if (profile.openDeals <= 1 && profile.totalDeals > 0) {
    score -= 4;
    reasons.push("Past yuklama");
  }

  // Conversion / wins
  if (profile.wonDeals > 0) {
    score += Math.min(15, profile.wonDeals * 5);
    reasons.push(`${profile.wonDeals} ta yutuq`);
  } else if (profile.totalDeals >= 3) {
    score -= 10;
    reasons.push("Yutuq yo'q — konversiya past");
  }

  // Stale / risk
  if (profile.staleDeals30d === 0) {
    score += 8;
    reasons.push("Harakatsiz bitim yo'q");
  } else {
    score -= Math.min(20, profile.staleDeals30d * 4);
    reasons.push(`${profile.staleDeals30d} ta 30+ kunlik bitim`);
  }

  if (profile.riskLevel === "Past") score += 6;
  else if (profile.riskLevel === "Yuqori") {
    score -= 12;
    reasons.push("Yuqori risk");
  }

  // Pipeline contribution
  if (profile.pipeline > 1_000_000_000) {
    score += 5;
    reasons.push("Katta pipeline hissasi");
  }

  // Trend bonuses
  if (trend) {
    if (trend.trends.deals.direction === "up") {
      score += 6;
      reasons.push(`Bitimlar o'sgan (${trend.trends.deals.formattedDelta})`);
    }
    if (trend.trends.pipeline.direction === "up") {
      score += 6;
      reasons.push(`Pipeline o'sgan (${trend.trends.pipeline.formattedDelta})`);
    }
    if (trend.trends.activities.direction === "up") {
      score += 5;
      reasons.push("Faollik oshgan");
    }
    if (trend.trends.risk.direction === "down") {
      score += 4;
      reasons.push("Risk kamaygan");
    }
    if (trend.trends.deals.direction === "down" && trend.trends.pipeline.direction === "down") {
      score -= 8;
      reasons.push("Bitim va pipeline pasaygan");
    }
    if (trend.trends.activities.direction === "down") {
      score -= 5;
      reasons.push("Faollik pasaygan");
    }
  }

  score = clamp(score);
  const outOf10 = Math.round((score / 10) * 10) / 10;
  const grade = score >= 85 ? "A'lo" : score >= 70 ? "Yaxshi" : score >= 55 ? "O'rtacha" : "Past";

  return {
    assignedById: profile.assignedById,
    name: profile.name,
    score,
    scoreOutOf10: outOf10,
    grade,
    reasons: reasons.slice(0, 5),
    trendSummary: trend?.summary || "Barqaror.",
  };
}

export function scoreAllEmployees(
  profiles: EmployeeProfile[],
  trends: EmployeeTrendProfile[]
): EmployeeScore[] {
  const byId = new Map(trends.map((t) => [t.assignedById, t]));
  return profiles
    .map((p) => scoreEmployee(p, byId.get(p.assignedById)))
    .sort((a, b) => b.score - a.score);
}
