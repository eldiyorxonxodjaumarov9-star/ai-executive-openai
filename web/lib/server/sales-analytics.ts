import type { CrmRecord, DealStageInfo } from "./bitrix";
import {
  TASHKENT_TZ,
  getLastNDaysRange,
  getTodayRange,
  getYesterdayRange,
  isDateInRange,
  parseBitrixDate,
  type DateRange,
} from "./tashkent-time";

export type SalesFetchStatus =
  | "ok"
  | "webhook_error"
  | "permission_denied"
  | "empty_crm"
  | "no_filter_match";

export interface DealSummary {
  id: string;
  title: string;
  amount: number;
  amountFormatted: string;
  stageName: string;
  assignedName?: string;
  closedAt?: string;
  createdAt?: string;
}

export interface SalesBucket {
  count: number;
  total: number;
  totalFormatted: string;
  deals: DealSummary[];
}

export interface SalesAnalytics {
  timezone: string;
  range: DateRange;
  createdToday: SalesBucket;
  wonToday: SalesBucket;
  modifiedActiveToday: SalesBucket;
  personFilter?: string;
  fetchStatus: SalesFetchStatus;
  logReason?: string;
  totalDealsFetched: number;
  stagesLoaded: number;
}

export function dealAmount(deal: CrmRecord): number {
  const n = Number(deal.OPPORTUNITY ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(amount: number, currencyId?: unknown): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(Math.round(safe));
  const cur = typeof currencyId === "string" ? currencyId.toUpperCase() : "UZS";
  if (cur === "UZS" || cur === "SUM") return `${formatted} so'm`;
  return `${formatted} ${cur}`;
}

function stageLabel(stageId: string, stages: Map<string, DealStageInfo>): string {
  const info = stages.get(stageId);
  return info?.name || "Noma'lum bosqich";
}

export function isDealSuccessful(deal: CrmRecord, stages: Map<string, DealStageInfo>): boolean {
  const stageId = String(deal.STAGE_ID || "");
  const info = stages.get(stageId);

  if (deal.STAGE_SEMANTIC_ID === "S") return true;
  if (deal.STAGE_SEMANTIC_ID === "F") return false;
  if (info?.isSuccess) return true;
  if (info?.isFail) return false;

  if (deal.CLOSED === "Y") {
    if (info?.semantics === "F") return false;
    if (info?.semantics === "S") return true;
    return info?.semantics !== "F";
  }

  return false;
}

export function isDealActive(deal: CrmRecord, stages: Map<string, DealStageInfo>): boolean {
  if (deal.CLOSED === "Y" && isDealSuccessful(deal, stages)) return false;
  if (deal.CLOSED === "Y" && stages.get(String(deal.STAGE_ID || ""))?.isFail) return false;
  return deal.CLOSED !== "Y";
}

function toSummary(deal: CrmRecord, stages: Map<string, DealStageInfo>): DealSummary {
  return {
    id: String(deal.ID || ""),
    title: String(deal.TITLE || "Nomsiz bitim"),
    amount: dealAmount(deal),
    amountFormatted: formatMoney(dealAmount(deal), deal.CURRENCY_ID),
    stageName: stageLabel(String(deal.STAGE_ID || ""), stages),
    closedAt: typeof deal.CLOSEDATE === "string" ? deal.CLOSEDATE : undefined,
    createdAt: typeof deal.DATE_CREATE === "string" ? deal.DATE_CREATE : undefined,
  };
}

export function parseSalesPeriod(question: string): DateRange {
  const text = question.toLowerCase().replace(/ʻ|’|`/g, "'");
  if (/\boxirgi\s+7\s+kun\b/.test(text) || /\b7\s+kunlik\b/.test(text)) {
    return getLastNDaysRange(7);
  }
  if (/\bkecha\b/.test(text)) {
    return getYesterdayRange();
  }
  if (/\bbugun\b/.test(text) || /\bbugungi\b/.test(text)) {
    return getTodayRange();
  }
  if (/\b(qancha|nechta)\b/.test(text) && /\b(savdo|sotuv|bitim)\b/.test(text)) {
    return getLastNDaysRange(30);
  }
  return getTodayRange();
}

export function computeSalesAnalytics(
  deals: CrmRecord[],
  stages: Map<string, DealStageInfo>,
  range: DateRange,
  personUserIds?: Set<string>
): SalesAnalytics {
  const created: CrmRecord[] = [];
  const won: CrmRecord[] = [];
  const modifiedActive: CrmRecord[] = [];

  for (const deal of deals) {
    if (personUserIds?.size) {
      const assignee = String(deal.ASSIGNED_BY_ID || "");
      if (!personUserIds.has(assignee)) continue;
    }

    const createdAt = parseBitrixDate(deal.DATE_CREATE);
    const modifiedAt = parseBitrixDate(deal.DATE_MODIFY);
    const closedAt = parseBitrixDate(deal.CLOSEDATE);
    const successful = isDealSuccessful(deal, stages);
    const active = isDealActive(deal, stages);

    if (createdAt && isDateInRange(createdAt, range.from, range.to)) {
      created.push(deal);
    }

    if (successful && closedAt && isDateInRange(closedAt, range.from, range.to)) {
      won.push(deal);
    }

    if (active && modifiedAt && isDateInRange(modifiedAt, range.from, range.to)) {
      modifiedActive.push(deal);
    }
  }

  const bucket = (items: CrmRecord[]): SalesBucket => {
    const total = items.reduce((s, d) => s + dealAmount(d), 0);
    return {
      count: items.length,
      total,
      totalFormatted: formatMoney(total, items[0]?.CURRENCY_ID),
      deals: items.slice(0, 20).map((d) => toSummary(d, stages)),
    };
  };

  return {
    timezone: TASHKENT_TZ,
    range,
    createdToday: bucket(created),
    wonToday: bucket(won),
    modifiedActiveToday: bucket(modifiedActive),
    fetchStatus: deals.length === 0 ? "empty_crm" : won.length + created.length + modifiedActive.length === 0 ? "no_filter_match" : "ok",
    logReason:
      deals.length === 0
        ? "Bitrix24 bo'sh natija qaytardi"
        : won.length + created.length + modifiedActive.length === 0
          ? `Sana filtri bo'yicha bitim yo'q (${range.fromIso} — ${range.toIso})`
          : undefined,
    totalDealsFetched: deals.length,
    stagesLoaded: stages.size,
  };
}

export function formatSalesBlock(analytics: SalesAnalytics, question: string): string {
  const lines: string[] = [
    `Vaqt zonasi: ${analytics.timezone}`,
    `Davr: ${analytics.range.label} (${analytics.range.fromIso} — ${analytics.range.toIso})`,
    `Jami yuklangan bitimlar: ${analytics.totalDealsFetched}`,
  ];

  if (analytics.personFilter) {
    lines.push(`Xodim filtri: ${analytics.personFilter}`);
  }

  lines.push(
    "",
    "=== BUGUNGI SOTUV (asosiy natija: muvaffaqiyatli yopilgan bitimlar) ===",
    `Soni: ${analytics.wonToday.count} ta`,
    `Summasi: ${analytics.wonToday.totalFormatted}`,
  );

  if (analytics.wonToday.deals.length) {
    lines.push("Yopilgan bitimlar:");
    for (const d of analytics.wonToday.deals) {
      lines.push(`- ${d.title}: ${d.amountFormatted} (${d.stageName})`);
    }
  }

  lines.push(
    "",
    "=== QO'SHIMCHA ===",
    `Bugun yaratilgan bitimlar: ${analytics.createdToday.count} ta (${analytics.createdToday.totalFormatted})`,
    `Bugun o'zgartirilgan faol bitimlar: ${analytics.modifiedActiveToday.count} ta`,
  );

  if (/\bnechta.*yaratil/i.test(question)) {
    lines.push("", "DIQQAT: Foydalanuvchi yangi yaratilgan bitimlar sonini so'radi.");
  }
  if (/\bnechta.*yopil/i.test(question)) {
    lines.push("", "DIQQAT: Foydalanuvchi yopilgan bitimlar sonini so'radi.");
  }
  if (/\bqancha sotuv|\bsavdo qancha/i.test(question)) {
    lines.push("", "DIQQAT: Asosiy javob — muvaffaqiyatli yopilgan bitimlar summasi va soni.");
  }

  if (analytics.fetchStatus === "no_filter_match") {
    lines.push("", `Izoh: ${analytics.logReason || "Tanlangan davrda bitim topilmadi."}`);
  }

  return lines.join("\n");
}

export function getTodaySalesDebugStats(
  deals: CrmRecord[],
  stages: Map<string, DealStageInfo>
): {
  timezone: string;
  from: string;
  to: string;
  created_today: number;
  won_today: number;
  won_total: number;
  modified_today: number;
} {
  const range = getTodayRange();
  const stats = computeSalesAnalytics(deals, stages, range);
  return {
    timezone: TASHKENT_TZ,
    from: range.fromIso,
    to: range.toIso,
    created_today: stats.createdToday.count,
    won_today: stats.wonToday.count,
    won_total: stats.wonToday.total,
    modified_today: stats.modifiedActiveToday.count,
  };
}
