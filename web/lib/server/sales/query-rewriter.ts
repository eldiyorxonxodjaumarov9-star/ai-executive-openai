/**
 * Internal sales query rewriter — never shown to the end user.
 */

const REWRITE_RULES: Array<{ match: RegExp; rewrite: string }> = [
  {
    match: /^(savdo|sotuv)\s*(qanday|qanaqa|holati)?\??$/i,
    rewrite:
      "Bugungi, oxirgi 7 kunlik va joriy oydagi savdo holati, yangi leadlar, yopilgan bitimlar, konversiya, uzoq turib qolgan bitimlar va asosiy xavflarni tahlil qil.",
  },
  {
    match: /qaysi\s*menejer.*(yaxshi|ishlay)/i,
    rewrite:
      "Menejerlar bo'yicha yopilgan bitimlar soni, summasi, konversiya va kechikkan vazifalarni solishtir.",
  },
  {
    match: /nega\s*savdo\s*tush/i,
    rewrite:
      "Oldingi davr bilan taqqoslab leadlar, konversiya, bosqichlarda turib qolish, menejer faolligi va yo'qotilgan bitimlar sabablarini aniqlang.",
  },
  {
    match: /bugungi\s*savdo/i,
    rewrite: "Bugungi yangi leadlar, yopilgan bitimlar soni va summasini Asia/Tashkent bo'yicha hisobla.",
  },
  {
    match: /(bu\s*oy|oylik).*(bitim|savdo|yopil)/i,
    rewrite: "Joriy oydagi yopilgan bitimlar soni, jami summa va menejerlar kesimidagi savdoni tahlil qil.",
  },
  {
    match: /uzoq\s*turib\s*qolgan/i,
    rewrite: "Uzoq turib qolgan faol bitimlarni, bosqichlari va muddatini aniqlang.",
  },
  {
    match: /follow-?up\s*qilinmagan/i,
    rewrite: "Follow-up qilinmagan mijozlar/leadlar va kechikkan vazifalarni toping.",
  },
  {
    match: /konversiya/i,
    rewrite: "Leadlardan yopilgan bitimlarga konversiya, bosqichlar va menejerlar kesimini hisobla.",
  },
];

export interface RewrittenQuery {
  original: string;
  rewritten: string;
  wasRewritten: boolean;
}

export function rewriteSalesQuery(question: string): RewrittenQuery {
  const original = question.trim();
  const compact = original.replace(/\s+/g, " ").trim();

  for (const rule of REWRITE_RULES) {
    if (rule.match.test(compact)) {
      return { original, rewritten: rule.rewrite, wasRewritten: true };
    }
  }

  if (compact.length < 36 && /qanday|holat|tahlil|savdo|sotuv|nega/.test(compact.toLowerCase())) {
    return {
      original,
      rewritten: `${compact} — leadlar, yopilgan/yutqazilgan bitimlar, konversiya, turib qolgan bitimlar va asosiy savdo xavflarini chiqar.`,
      wasRewritten: true,
    };
  }

  return { original, rewritten: original, wasRewritten: false };
}
