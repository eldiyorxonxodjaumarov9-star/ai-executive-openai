import type { RewrittenQuery } from "./types";

const REWRITE_RULES: Array<{ match: RegExp; rewrite: string }> = [
  {
    match: /yangi\s*xodim.*onboarding/i,
    rewrite:
      "Yangi xodim onboarding tartibi, rekruting va ishga qabul qilish bosqichlari bo'yicha HR qo'llanmasi bo'laklarini top.",
  },
  {
    match: /kimda\s*kechik/i,
    rewrite:
      "Kechikkan vazifalar, mas'ul xodimlar va deadline holatini Asia/Tashkent bo'yicha tahlil qil.",
  },
  {
    match: /ish\s*yuklamasi|yuklama\s*ko'p/i,
    rewrite:
      "Xodimlar bo'yicha ochiq vazifalar, kechikkan vazifalar va ish yuklamasi taqsimotini hisobla.",
  },
  {
    match: /bugun\s*kim.*bajardi/i,
    rewrite:
      "Bugun Asia/Tashkent vaqtida bajarilgan vazifalar va eng faol xodimlarni ko'rsat.",
  },
  {
    match: /hr\s*qoidalariga\s*ko'ra|siyosatga\s*ko'ra.*bahola/i,
    rewrite:
      "HR qo'llanmasi mezonlarini qo'llab, kechikkan vazifalar va jamoa yuklamasini bahola.",
  },
  {
    match: /kpi.*baholanadi|performance.*bahola/i,
    rewrite: "Xodimlarni boshqarish, KPI va performance baholash mezonlarini tushuntir.",
  },
  {
    match: /turnover.*hisoblan/i,
    rewrite: "Turnover, HR analitika va executive hisobot mezonlarini tushuntir.",
  },
  {
    match: /motivatsiya.*qilish/i,
    rewrite: "Motivatsiya, retention va korporativ madaniyat bo'yicha HR tavsiyalarini tushuntir.",
  },
];

export function rewriteHrQuery(question: string): RewrittenQuery {
  const original = question.trim();
  const compact = original.replace(/\s+/g, " ").trim();

  for (const rule of REWRITE_RULES) {
    if (rule.match.test(compact)) {
      return { original, rewritten: rule.rewrite, wasRewritten: true };
    }
  }

  if (
    compact.length < 50 &&
    /qanday|holat|tahlil|xodim|vazifa|onboarding|kpi|motivatsiya/.test(compact.toLowerCase())
  ) {
    return {
      original,
      rewritten: `${compact} — HR hujjatlari va Bitrix24 vazifalar/xodimlar ma'lumotini mos ravishda tahlil qil.`,
      wasRewritten: true,
    };
  }

  return { original, rewritten: original, wasRewritten: false };
}
