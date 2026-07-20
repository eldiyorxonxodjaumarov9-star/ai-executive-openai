/**
 * Internal finance query rewriter — never shown to the end user.
 */

const REWRITE_RULES: Array<{ match: RegExp; rewrite: string }> = [
  {
    match: /^(pul|moliya)\s*(holati|qanday|qanaqa)?\??$/i,
    rewrite:
      "Bugungi va joriy oydagi yopilgan bitimlar, tushum, kechikkan to'lovlar, summasi aniqlanmagan bitimlar va asosiy moliyaviy xavflarni tahlil qil.",
  },
  {
    match: /qarzdorlik\s*(bormi|holati|qanday)?\??$/i,
    rewrite:
      "Qarzdorlik bilan bog'liq ochiq va kechikkan vazifalarni, mas'ullarni va ta'sirini aniqlang.",
  },
  {
    match: /bugungi\s*tushum/i,
    rewrite: "Bugungi yopilgan bitimlar soni va summasi (tushum) ni Asia/Tashkent bo'yicha hisobla.",
  },
  {
    match: /(bu\s*oy|oylik).*?(savdo|tushum|sotuv)/i,
    rewrite: "Joriy oydagi yopilgan bitimlar soni, jami summa va menejerlar kesimidagi savdoni tahlil qil.",
  },
  {
    match: /summasi\s*(0|nol|kiritilmagan|aniqlanmagan)/i,
    rewrite: "Summasi 0 yoki kiritilmagan bitimlarni topib, soni, ulushi va asosiy xavfini ko'rsat.",
  },
];

export interface RewrittenQuery {
  original: string;
  rewritten: string;
  wasRewritten: boolean;
}

export function rewriteFinanceQuery(question: string): RewrittenQuery {
  const original = question.trim();
  const compact = original.replace(/\s+/g, " ").trim();

  for (const rule of REWRITE_RULES) {
    if (rule.match.test(compact)) {
      return { original, rewritten: rule.rewrite, wasRewritten: true };
    }
  }

  if (compact.length < 32 && /qanday|holat|tahlil|pul|moliya/.test(compact.toLowerCase())) {
    return {
      original,
      rewritten: `${compact} — bugungi va joriy oy tushumi, yopilgan bitimlar, kechikkan to'lovlar, summasi 0 bitimlar va asosiy moliyaviy xavflarni chiqar.`,
      wasRewritten: true,
    };
  }

  return { original, rewritten: original, wasRewritten: false };
}
