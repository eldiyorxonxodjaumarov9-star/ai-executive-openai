import type { NormalizedDeal } from "./deal-normalizer";
import type { CrmRecord } from "./bitrix";
import { formatMoney } from "./sales-analytics";
import { parseBitrixDate } from "./tashkent-time";

export type EmployeeRiskLevel = "Past" | "O'rtacha" | "Yuqori";

export interface EmployeeProfile {
  assignedById: string;
  name: string;
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  pipeline: number;
  pipelineFormatted: string;
  averageDeal: number;
  averageDealFormatted: string;
  largestDeal: number;
  largestDealFormatted: string;
  largestDealTitle: string;
  lastActivityDate: string | null;
  staleDeals30d: number;
  riskLevel: EmployeeRiskLevel;
  riskScore: number;
  recommendation: string;
}

export interface EmployeeAnalyticsBundle {
  employees: EmployeeProfile[];
  ranking: EmployeeProfile[];
  mostBusy: EmployeeProfile[];
  leastBusy: EmployeeProfile[];
  atRisk: EmployeeProfile[];
  executiveRecommendations: string[];
  totalEmployees: number;
}

const STALE_MS = 30 * 24 * 60 * 60 * 1000;
const HIGH_VALUE = 50_000_000;

function daysSince(dateStr: string): number | null {
  const dt = parseBitrixDate(dateStr);
  if (!dt) return null;
  return Math.floor((Date.now() - dt.getTime()) / 86400000);
}

function lastActivityForEmployee(
  deals: NormalizedDeal[],
  activities: CrmRecord[],
  assignedById: string
): string | null {
  const dealIds = new Set(deals.filter((d) => d.assignedById === assignedById).map((d) => d.id));
  let latest: Date | null = null;

  for (const a of activities) {
    const owner = String(a.OWNER_ID || a.ASSOCIATED_ENTITY_ID || "");
    if (!dealIds.has(owner) && String(a.RESPONSIBLE_ID || "") !== assignedById) continue;
    const raw = String(a.LAST_UPDATED || a.CREATED || a.START_TIME || "");
    const dt = parseBitrixDate(raw);
    if (dt && (!latest || dt > latest)) latest = dt;
  }

  for (const d of deals) {
    if (d.assignedById !== assignedById) continue;
    for (const raw of [d.closeDate, d.dateCreate]) {
      const dt = parseBitrixDate(raw);
      if (dt && (!latest || dt > latest)) latest = dt;
    }
  }

  if (!latest) return null;
  return latest.toISOString();
}

function formatLastActivity(iso: string | null): string {
  if (!iso) return "Noma'lum";
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function riskLevelFromScore(score: number): EmployeeRiskLevel {
  if (score >= 60) return "Yuqori";
  if (score >= 30) return "O'rtacha";
  return "Past";
}

function buildRecommendation(p: EmployeeProfile): string {
  if (p.openDeals >= 10) {
    return `${p.name}ning yuklamasi yuqori (${p.openDeals} ochiq bitim) — qayta taqsimlash tavsiya etiladi.`;
  }
  if (p.staleDeals30d >= 3) {
    return `${p.name}da ${p.staleDeals30d} ta 30+ kunlik bitim bor — follow-up reja tuzing.`;
  }
  if (p.totalDeals >= 3 && p.wonDeals === 0) {
    return `${p.name}da konversiya past (yutuq: 0) — koaching va bitim yopish jarayonini kuchaytiring.`;
  }
  if (p.lostDeals > p.wonDeals && p.lostDeals > 0) {
    return `${p.name}da yo'qotishlar ko'p (${p.lostDeals}) — sabablarni tahlil qiling.`;
  }
  if (p.openDeals <= 2 && p.totalDeals > 0) {
    return `${p.name} past yuklamada — yangi bitimlar biriktirish mumkin.`;
  }
  return `${p.name}: holat barqaror — joriy pipeline ni kuzatib boring.`;
}

export function buildEmployeeAnalytics(
  deals: NormalizedDeal[],
  activities: CrmRecord[] = []
): EmployeeAnalyticsBundle {
  const byEmployee = new Map<string, NormalizedDeal[]>();

  for (const d of deals) {
    const id = d.assignedById || "unknown";
    const list = byEmployee.get(id) || [];
    list.push(d);
    byEmployee.set(id, list);
  }

  const employees: EmployeeProfile[] = [];

  for (const [assignedById, empDeals] of byEmployee) {
    const name = empDeals[0]?.assignedByName || "Noma'lum xodim";
    const open = empDeals.filter((d) => d.isOpen);
    const won = empDeals.filter((d) => d.isWon);
    const lost = empDeals.filter((d) => d.isLost);
    const pipeline = empDeals.reduce((s, d) => s + d.opportunity, 0);
    const avg = empDeals.length ? pipeline / empDeals.length : 0;
    const largest = [...empDeals].sort((a, b) => b.opportunity - a.opportunity)[0];
    const stale = open.filter((d) => {
      const days = daysSince(d.dateCreate);
      return days !== null && days >= 30;
    });
    const lastActivityDate = lastActivityForEmployee(empDeals, activities, assignedById);

    let riskScore = 0;
    riskScore += stale.length * 12;
    riskScore += open.length >= 10 ? 25 : open.length >= 5 ? 10 : 0;
    riskScore += won.length === 0 && empDeals.length >= 3 ? 20 : 0;
    riskScore += lost.length > won.length ? 15 : 0;
    if (open.some((d) => d.opportunity >= HIGH_VALUE) && stale.length > 0) riskScore += 15;
    if (!assignedById || assignedById === "unknown" || name === "Noma'lum xodim") riskScore += 20;

    const profile: EmployeeProfile = {
      assignedById,
      name,
      totalDeals: empDeals.length,
      openDeals: open.length,
      wonDeals: won.length,
      lostDeals: lost.length,
      pipeline,
      pipelineFormatted: formatMoney(pipeline),
      averageDeal: avg,
      averageDealFormatted: formatMoney(avg),
      largestDeal: largest?.opportunity ?? 0,
      largestDealFormatted: formatMoney(largest?.opportunity ?? 0),
      largestDealTitle: largest?.title ?? "—",
      lastActivityDate,
      staleDeals30d: stale.length,
      riskLevel: riskLevelFromScore(riskScore),
      riskScore: Math.min(100, riskScore),
      recommendation: "",
    };
    profile.recommendation = buildRecommendation(profile);
    employees.push(profile);
  }

  const ranking = [...employees].sort(
    (a, b) => b.wonDeals - a.wonDeals || b.pipeline - a.pipeline || b.totalDeals - a.totalDeals
  );
  const mostBusy = [...employees].sort((a, b) => b.openDeals - a.openDeals).slice(0, 5);
  const leastBusy = [...employees]
    .filter((e) => e.totalDeals > 0)
    .sort((a, b) => a.openDeals - b.openDeals || a.totalDeals - b.totalDeals)
    .slice(0, 5);
  const atRisk = employees
    .filter((e) => e.riskLevel !== "Past" || e.staleDeals30d >= 2 || e.openDeals >= 10)
    .sort((a, b) => b.riskScore - a.riskScore);

  const executiveRecommendations = [
    ...employees.filter((e) => e.openDeals >= 8).map((e) => e.recommendation),
    ...employees.filter((e) => e.staleDeals30d >= 3).map((e) => e.recommendation),
    ...employees.filter((e) => e.totalDeals >= 3 && e.wonDeals === 0).map((e) => e.recommendation),
  ];
  const uniqueRecs = [...new Set(executiveRecommendations)].slice(0, 8);
  if (uniqueRecs.length === 0 && employees.length) {
    uniqueRecs.push("Xodimlar yuklamasi barqaror — joriy taqsimotni saqlang.");
  }
  if (employees.some((e) => e.openDeals >= 8) && employees.some((e) => e.openDeals <= 2)) {
    uniqueRecs.push("Xodimlarni qayta taqsimlash tavsiya etiladi — band va bo'sh yuklama farqi katta.");
  }

  return {
    employees: ranking,
    ranking,
    mostBusy,
    leastBusy,
    atRisk,
    executiveRecommendations: uniqueRecs,
    totalEmployees: employees.length,
  };
}

export function formatEmployeeMarkdown(bundle: EmployeeAnalyticsBundle): string {
  const lines: string[] = [
    "## Xodimlar bo'yicha tahlil",
    "",
    `_Bitrix24 ASSIGNED_BY_ID → user.get asosida ${bundle.totalEmployees} ta xodim tahlil qilindi._`,
    "",
  ];

  for (const e of bundle.employees) {
    lines.push(
      `👤 **${e.name}**`,
      "",
      `- Jami bitimlar: **${e.totalDeals}**`,
      `- Ochiq bitimlar: **${e.openDeals}**`,
      `- Yutilgan bitimlar: **${e.wonDeals}**`,
      `- Yutqazilgan bitimlar: **${e.lostDeals}**`,
      `- Pipeline summasi: **${e.pipelineFormatted}**`,
      `- O'rtacha bitim: **${e.averageDealFormatted}**`,
      `- Eng katta bitim: **${e.largestDealFormatted}** (${e.largestDealTitle})`,
      `- Oxirgi faoliyat sanasi: **${formatLastActivity(e.lastActivityDate)}**`,
      `- 30 kundan beri harakatsiz bitimlar: **${e.staleDeals30d}**`,
      `- Risk darajasi: **${e.riskLevel}** (${e.riskScore}/100)`,
      "",
      `**Tavsiya:** ${e.recommendation}`,
      "",
      "---",
      ""
    );
  }

  lines.push("## Xodimlar reytingi", "");
  const medals = ["🥇 1-o'rin", "🥈 2-o'rin", "🥉 3-o'rin"];
  rankingSlice(bundle.ranking, 10).forEach((e, i) => {
    const label = medals[i] || `${i + 1}-o'rin`;
    lines.push(
      `**${label}: ${e.name}**`,
      `- Bitimlar: ${e.totalDeals} (ochiq: ${e.openDeals}, yutuq: ${e.wonDeals})`,
      `- Pipeline: ${e.pipelineFormatted}`,
      `- Natija: yutuq ${e.wonDeals} / yo'qotish ${e.lostDeals}`,
      ""
    );
  });

  lines.push("## Eng band xodimlar", "", "TOP 5", "");
  for (const e of bundle.mostBusy) {
    lines.push(`- **${e.name}** — ${e.openDeals} ochiq bitim, pipeline ${e.pipelineFormatted}`);
  }

  lines.push("", "## Eng kam yuklangan xodimlar", "", "TOP 5", "");
  for (const e of bundle.leastBusy) {
    lines.push(`- **${e.name}** — ${e.openDeals} ochiq / ${e.totalDeals} jami bitim`);
  }

  lines.push("", "## Riskdagi xodimlar", "");
  if (bundle.atRisk.length) {
    for (const e of bundle.atRisk.slice(0, 8)) {
      const reasons: string[] = [];
      if (e.staleDeals30d > 0) reasons.push(`${e.staleDeals30d} ta 30+ kunlik bitim`);
      if (e.openDeals >= 10) reasons.push(`juda ko'p ochiq deal (${e.openDeals})`);
      if (e.wonDeals === 0 && e.totalDeals >= 3) reasons.push("konversiya past");
      if (e.largestDeal >= HIGH_VALUE && e.staleDeals30d > 0) reasons.push("katta summali tiqilib qolgan bitim");
      lines.push(`- **${e.name}** [${e.riskLevel}]: ${reasons.join("; ") || e.recommendation}`);
    }
  } else {
    lines.push("_Yuqori riskdagi xodimlar topilmadi._");
  }

  lines.push("", "## Rahbar uchun tavsiyalar", "");
  for (const rec of bundle.executiveRecommendations) {
    lines.push(`- ${rec}`);
  }

  return lines.join("\n");
}

function rankingSlice(list: EmployeeProfile[], n: number): EmployeeProfile[] {
  return list.slice(0, n);
}
