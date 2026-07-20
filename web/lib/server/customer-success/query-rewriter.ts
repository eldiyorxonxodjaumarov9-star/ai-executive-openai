/**
 * Internal Customer Success query rewriter — never shown to the end user.
 */

const REWRITE_RULES: Array<{ match: RegExp; rewrite: string }> = [
  {
    match: /mijozlar\s*holati\s*qanday\??$/i,
    rewrite:
      "Faol mijozlar, uzoq vaqt aloqasiz qolgan mijozlar, riskdagi mijozlar, oxirgi activity va customer health holatini tahlil qil.",
  },
  {
    match: /mijozlarni\s*yo.?qotyapmizmi\??$/i,
    rewrite:
      "Oxirgi davrdagi faol bo'lmagan mijozlar, qayta aloqa qilinmagan kontaktlar va churn xavfini bahola.",
  },
  {
    match: /mijozlar\s*bilan\s*ishlash\s*qanday\??$/i,
    rewrite: "Customer Success standartlari asosida CRM ma'lumotlarini bahola.",
  },
  {
    match: /riskdagi\s*mijoz/i,
    rewrite:
      "Uzoq vaqt aloqasiz kontaktlar, to'xtab qolgan bitimlar va kechikkan vazifalar orqali riskdagi mijozlarni aniqlang.",
  },
  {
    match: /oxirgi\s*activity/i,
    rewrite: "Oxirgi activity, qo'ng'iroq va email tarixlarini Asia/Tashkent bo'yicha ko'rsat.",
  },
  {
    match: /uzoq\s*vaqt\s*aloqa/i,
    rewrite: "Uzoq vaqt aloqa qilinmagan kontaktlar va kompaniyalarni toping.",
  },
  {
    match: /mijozlarni\s*ushlab\s*qolish/i,
    rewrite: "Retention, Customer Health Score, churn xavfi va Customer Success KPI mezonlarini tushuntir.",
  },
];

export interface RewrittenQuery {
  original: string;
  rewritten: string;
  wasRewritten: boolean;
}

export function rewriteCustomerSuccessQuery(question: string): RewrittenQuery {
  const original = question.trim();
  const compact = original.replace(/\s+/g, " ").trim();

  for (const rule of REWRITE_RULES) {
    if (rule.match.test(compact)) {
      return { original, rewritten: rule.rewrite, wasRewritten: true };
    }
  }

  if (
    compact.length < 40 &&
    /qanday|holat|tahlil|mijoz|retention|churn|risk/.test(compact.toLowerCase())
  ) {
    return {
      original,
      rewritten: `${compact} — faol/faol bo'lmagan mijozlar, oxirgi activity, risklar va Customer Success mezonlarini chiqar.`,
      wasRewritten: true,
    };
  }

  return { original, rewritten: original, wasRewritten: false };
}
