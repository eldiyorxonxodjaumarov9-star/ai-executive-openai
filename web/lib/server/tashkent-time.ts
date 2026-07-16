export const TASHKENT_TZ = "Asia/Tashkent";

/** Bugungi sana qismlari (YYYY-MM-DD) Asia/Tashkent bo'yicha */
export function getDatePartsInTz(date: Date, tz = TASHKENT_TZ): { y: number; m: number; d: number; iso: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { y, m, d, iso };
}

export interface DateRange {
  from: Date;
  to: Date;
  fromIso: string;
  toIso: string;
  label: string;
}

export function getTodayRange(tz = TASHKENT_TZ): DateRange {
  const { iso } = getDatePartsInTz(new Date(), tz);
  const fromIso = `${iso}T00:00:00+05:00`;
  const toIso = `${iso}T23:59:59.999+05:00`;
  return {
    from: new Date(fromIso),
    to: new Date(toIso),
    fromIso,
    toIso,
    label: "bugun",
  };
}

export function getYesterdayRange(tz = TASHKENT_TZ): DateRange {
  const today = getDatePartsInTz(new Date(), tz);
  const base = new Date(Date.UTC(today.y, today.m - 1, today.d));
  base.setUTCDate(base.getUTCDate() - 1);
  const { iso } = getDatePartsInTz(base, tz);
  const fromIso = `${iso}T00:00:00+05:00`;
  const toIso = `${iso}T23:59:59.999+05:00`;
  return { from: new Date(fromIso), to: new Date(toIso), fromIso, toIso, label: "kecha" };
}

export function getLastNDaysRange(days: number, tz = TASHKENT_TZ): DateRange {
  const end = getTodayRange(tz);
  const todayParts = getDatePartsInTz(new Date(), tz);
  const startBase = new Date(Date.UTC(todayParts.y, todayParts.m - 1, todayParts.d));
  startBase.setUTCDate(startBase.getUTCDate() - (days - 1));
  const { iso: startIso } = getDatePartsInTz(startBase, tz);
  const fromIso = `${startIso}T00:00:00+05:00`;
  return {
    from: new Date(fromIso),
    to: end.to,
    fromIso,
    toIso: end.toIso,
    label: `oxirgi ${days} kun`,
  };
}

export function parseBitrixDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isDateInRange(date: Date, from: Date, to: Date): boolean {
  return date.getTime() >= from.getTime() && date.getTime() <= to.getTime();
}

export function isSameDayInTz(a: Date, b: Date, tz = TASHKENT_TZ): boolean {
  return getDatePartsInTz(a, tz).iso === getDatePartsInTz(b, tz).iso;
}
