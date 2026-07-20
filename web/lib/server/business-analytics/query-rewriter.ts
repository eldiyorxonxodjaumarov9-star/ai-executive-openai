import type { RewrittenQuery } from "./types";

const REWRITE_RULES: Array<{ match: RegExp; rewrite: string }> = [
  {
    match: /bp-08|biznes\s*analitika\s*jarayon/i,
    rewrite:
      "BP-08 biznes analitika jarayoni, IT direktori amaliy qo'llanmasi (AQ-06) bo'laklarini top.",
  },
  {
    match: /kpi.*dashboard|dashboard.*kpi/i,
    rewrite:
      "KPI va dashboard mezonlari, ko'rsatkichlar tasnifi va hisobot standartlarini tushuntir.",
  },
  {
    match: /bottleneck|tirqish|to'siq/i,
    rewrite:
      "Jarayon bottlenecklarini aniqlash mezonlari va CRM signallarini tahlil qilish yo'riqnomasini top.",
  },
  {
    match: /crm\s*monitor|monitoring.*crm/i,
    rewrite:
      "CRM monitoring mezonlari, kechikish va ma'lumot sifati signallarini baholash bo'yicha qo'llanma bo'laklarini top.",
  },
  {
    match: /avtomatizatsiya|automation/i,
    rewrite:
      "Biznes analitika avtomatizatsiyasi, integratsiya va ma'lumot oqimi standartlarini tushuntir.",
  },
  {
    match: /lead.*konversiya|konversiya.*lead/i,
    rewrite:
      "Lead va bitim konversiya ko'rsatkichlarini Asia/Tashkent bo'yicha aggregat qilib tahlil qil.",
  },
  {
    match: /kechikkan\s*vazifa|overdue/i,
    rewrite:
      "Kechikkan vazifalar, mas'ul xodimlar va bo'limlar kesimida ish yuklamasini hisobla.",
  },
  {
    match: /ma'lumot\s*sifati|data\s*quality/i,
    rewrite:
      "CRM ma'lumot sifati signallari (bo'sh maydonlar, 0 summa, eskirgan yozuvlar) va monitoring mezonlarini tahlil qil.",
  },
  {
    match: /bo'lim.*yuklama|yuklama.*bo'lim/i,
    rewrite:
      "Bo'limlar va xodimlar kesimida ochiq vazifalar, kechikishlar va CRM faolligini aggregat qil.",
  },
];

export function rewriteBusinessAnalyticsQuery(question: string): RewrittenQuery {
  const original = question.trim();
  const compact = original.replace(/\s+/g, " ").trim();

  for (const rule of REWRITE_RULES) {
    if (rule.match.test(compact)) {
      return { original, rewritten: rule.rewrite, wasRewritten: true };
    }
  }

  if (
    compact.length < 60 &&
    /qanday|holat|tahlil|kpi|dashboard|crm|lead|bitim|monitor|analitika|bp-08/.test(
      compact.toLowerCase()
    )
  ) {
    return {
      original,
      rewritten: `${compact} — AQ-06 biznes analitika hujjatlari va Bitrix24 aggregat CRM ma'lumotini mos ravishda tahlil qil.`,
      wasRewritten: true,
    };
  }

  return { original, rewritten: original, wasRewritten: false };
}
