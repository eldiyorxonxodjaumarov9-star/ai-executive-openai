import {
  TASHKENT_TZ,
  getDatePartsInTz,
  getTodayRange,
  getYesterdayRange,
  getLastNDaysRange,
  type DateRange,
} from "./tashkent-time";

export { TASHKENT_TZ };

export function getAllTimeRange(): DateRange {
  return {
    from: new Date("2000-01-01T00:00:00+05:00"),
    to: new Date("2099-12-31T23:59:59.999+05:00"),
    fromIso: "2000-01-01T00:00:00+05:00",
    toIso: "2099-12-31T23:59:59.999+05:00",
    label: "barcha vaqt",
  };
}

export function getThisWeekRange(tz = TASHKENT_TZ): DateRange {
  const now = new Date();
  const today = getDatePartsInTz(now, tz);
  const dayOfWeek = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = map[dayOfWeek.slice(0, 3)] ?? 0;
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const start = new Date(Date.UTC(today.y, today.m - 1, today.d));
  start.setUTCDate(start.getUTCDate() + mondayOffset);
  const end = getTodayRange(tz);
  const { iso: startIso } = getDatePartsInTz(start, tz);
  return {
    from: new Date(`${startIso}T00:00:00+05:00`),
    to: end.to,
    fromIso: `${startIso}T00:00:00+05:00`,
    toIso: end.toIso,
    label: "shu hafta",
  };
}

export function getLastWeekRange(tz = TASHKENT_TZ): DateRange {
  const thisWeek = getThisWeekRange(tz);
  const start = new Date(thisWeek.from);
  start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(thisWeek.from);
  end.setMilliseconds(end.getMilliseconds() - 1);
  const { iso: startIso } = getDatePartsInTz(start, tz);
  const { iso: endIso } = getDatePartsInTz(end, tz);
  return {
    from: new Date(`${startIso}T00:00:00+05:00`),
    to: new Date(`${endIso}T23:59:59.999+05:00`),
    fromIso: `${startIso}T00:00:00+05:00`,
    toIso: `${endIso}T23:59:59.999+05:00`,
    label: "o'tgan hafta",
  };
}

export function getThisMonthRange(tz = TASHKENT_TZ): DateRange {
  const today = getDatePartsInTz(new Date(), tz);
  const startIso = `${today.y}-${String(today.m).padStart(2, "0")}-01`;
  const end = getTodayRange(tz);
  return {
    from: new Date(`${startIso}T00:00:00+05:00`),
    to: end.to,
    fromIso: `${startIso}T00:00:00+05:00`,
    toIso: end.toIso,
    label: "shu oy",
  };
}

export function getLastMonthRange(tz = TASHKENT_TZ): DateRange {
  const today = getDatePartsInTz(new Date(), tz);
  const firstThisMonth = new Date(Date.UTC(today.y, today.m - 1, 1));
  const lastMonthEnd = new Date(firstThisMonth);
  lastMonthEnd.setUTCDate(0);
  const lastMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1));
  const { iso: startIso } = getDatePartsInTz(lastMonthStart, tz);
  const { iso: endIso } = getDatePartsInTz(lastMonthEnd, tz);
  return {
    from: new Date(`${startIso}T00:00:00+05:00`),
    to: new Date(`${endIso}T23:59:59.999+05:00`),
    fromIso: `${startIso}T00:00:00+05:00`,
    toIso: `${endIso}T23:59:59.999+05:00`,
    label: "o'tgan oy",
  };
}

export function getThisYearRange(tz = TASHKENT_TZ): DateRange {
  const today = getDatePartsInTz(new Date(), tz);
  const startIso = `${today.y}-01-01`;
  const end = getTodayRange(tz);
  return {
    from: new Date(`${startIso}T00:00:00+05:00`),
    to: end.to,
    fromIso: `${startIso}T00:00:00+05:00`,
    toIso: end.toIso,
    label: "shu yil",
  };
}

export interface ParsedDateRange extends DateRange {
  explicit: boolean;
}

export function parseDateRangeFromQuestion(question: string): ParsedDateRange {
  const text = question.toLowerCase().replace(/ʻ|’|`/g, "'");

  if (/\b(bugun|bugungi)\b/.test(text)) return { ...getTodayRange(), explicit: true };
  if (/\bkecha\b/.test(text)) return { ...getYesterdayRange(), explicit: true };
  if (/\boxirgi\s+7\s+kun(da|lik)?\b/.test(text) || /\b7\s+kunlik\b/.test(text)) return { ...getLastNDaysRange(7), explicit: true };
  if (/\boxirgi\s+30\s+kun(da|lik)?\b/.test(text) || /\b30\s+kunlik\b/.test(text)) return { ...getLastNDaysRange(30), explicit: true };
  if (/\bshu\s+hafta\b/.test(text)) return { ...getThisWeekRange(), explicit: true };
  if (/\b(o'tgan|otgan)\s+hafta\b/.test(text)) return { ...getLastWeekRange(), explicit: true };
  if (/\bshu\s+oy(da|da)?\b/.test(text)) return { ...getThisMonthRange(), explicit: true };
  if (/\b(o'tgan|otgan)\s+oy(da|da)?\b/.test(text)) return { ...getLastMonthRange(), explicit: true };
  if (/\bshu\s+yil(da|da)?\b/.test(text)) return { ...getThisYearRange(), explicit: true };

  return { ...getAllTimeRange(), explicit: false };
}
