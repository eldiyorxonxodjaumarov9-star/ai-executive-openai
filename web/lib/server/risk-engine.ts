import type { NormalizedDeal } from "./deal-normalizer";
import type { CrmRecord } from "./bitrix";
import { formatMoney } from "./sales-analytics";
import { parseBitrixDate } from "./tashkent-time";

export type RiskType =
  | "stale_deal"
  | "deadline_near"
  | "high_value"
  | "no_owner"
  | "no_activity"
  | "high_risk";

export interface RiskItem {
  type: RiskType;
  score: number;
  title: string;
  detail: string;
  dealId?: string;
  amount?: number;
  amountFormatted?: string;
  manager?: string;
}

const STALE_DAYS = 30;
const DEADLINE_DAYS = 7;
const HIGH_VALUE_THRESHOLD = 50_000_000;

function daysSince(dateStr: string): number | null {
  const dt = parseBitrixDate(dateStr);
  if (!dt) return null;
  return Math.floor((Date.now() - dt.getTime()) / 86400000);
}

function daysUntil(dateStr: string): number | null {
  const dt = parseBitrixDate(dateStr);
  if (!dt) return null;
  return Math.floor((dt.getTime() - Date.now()) / 86400000);
}

export function calculateRisks(
  deals: NormalizedDeal[],
  activities: CrmRecord[] = []
): RiskItem[] {
  const activityDealIds = new Set(
    activities.map((a) => String(a.OWNER_ID || a.ASSOCIATED_ENTITY_ID || "")).filter(Boolean)
  );
  const risks: RiskItem[] = [];

  for (const d of deals) {
    if (!d.isOpen) continue;

    const staleDays = daysSince(d.dateCreate);
    if (staleDays !== null && staleDays >= STALE_DAYS) {
      risks.push({
        type: "stale_deal",
        score: Math.min(95, 40 + staleDays),
        title: d.title,
        detail: `${staleDays} kundan beri qimirlamagan ochiq bitim`,
        dealId: d.id,
        amount: d.opportunity,
        amountFormatted: formatMoney(d.opportunity),
        manager: d.assignedByName,
      });
    }

    const untilClose = daysUntil(d.closeDate);
    if (untilClose !== null && untilClose >= 0 && untilClose <= DEADLINE_DAYS) {
      risks.push({
        type: "deadline_near",
        score: 70 + (DEADLINE_DAYS - untilClose) * 4,
        title: d.title,
        detail: `Yopilish sanasiga ${untilClose} kun qoldi`,
        dealId: d.id,
        amount: d.opportunity,
        amountFormatted: formatMoney(d.opportunity),
        manager: d.assignedByName,
      });
    }

    if (d.opportunity >= HIGH_VALUE_THRESHOLD) {
      risks.push({
        type: "high_value",
        score: 55,
        title: d.title,
        detail: `Yuqori qiymatli ochiq bitim: ${formatMoney(d.opportunity)}`,
        dealId: d.id,
        amount: d.opportunity,
        amountFormatted: formatMoney(d.opportunity),
        manager: d.assignedByName,
      });
    }

    if (!d.assignedById || d.assignedByName === "Noma'lum xodim") {
      risks.push({
        type: "no_owner",
        score: 80,
        title: d.title,
        detail: "Mas'ul xodim tayinlanmagan",
        dealId: d.id,
        amount: d.opportunity,
        amountFormatted: formatMoney(d.opportunity),
      });
    }

    if (!activityDealIds.has(d.id)) {
      risks.push({
        type: "no_activity",
        score: 45,
        title: d.title,
        detail: "So'nggi activity yozuvi topilmadi",
        dealId: d.id,
        manager: d.assignedByName,
      });
    }
  }

  const sorted = risks.sort((a, b) => b.score - a.score);
  if (sorted.length >= 5) {
    sorted.unshift({
      type: "high_risk",
      score: Math.round(sorted.slice(0, 5).reduce((s, r) => s + r.score, 0) / 5),
      title: "Yuqori xavf holati",
      detail: `${sorted.length} ta risk signali aniqlandi`,
    });
  }

  return sorted.slice(0, 15);
}
