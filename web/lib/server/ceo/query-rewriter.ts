/**
 * Internal query rewriter — expands vague executive questions.
 * Rewritten text is NEVER shown to the end user.
 */

const REWRITE_RULES: Array<{ match: RegExp; rewrite: string }> = [
  {
    match: /^(savdo|sotuv)\s*(qanday|qanaqa|holati)?\??$/i,
    rewrite:
      "Bugungi va oxirgi 7 kunlik sotuv, yopilgan bitimlar, kechikkan bitimlar va asosiy xavflarni tahlil qil.",
  },
  {
    match: /^(moliya|pul|kassa)\s*(qanday|holati)?\??$/i,
    rewrite:
      "Joriy bitimlar summasi, yopilgan bitimlar qiymati va moliyaviy xavf signallarini tahlil qil.",
  },
  {
    match: /^(vazifa|tasklar?)\s*(qanday|holati)?\??$/i,
    rewrite: "Ochiq va kechikkan vazifalarni, mas'ul xodimlarni va asosiy xavflarni tahlil qil.",
  },
  {
    match: /^(xodimlar?|jamoa)\s*(qanday|holati)?\??$/i,
    rewrite: "Xodimlar kesimida bitimlar, vazifalar va ishlash samaradorligi signallarini tahlil qil.",
  },
  {
    match: /^(mijozlar?|lidlar?)\s*(qanday|holati)?\??$/i,
    rewrite: "Mijoz so'rovlari, kontaktlar va bitimga o'tish holatini tahlil qil.",
  },
  {
    match: /^(kompaniya|biznes)\s*(qanday|holati)?\??$/i,
    rewrite:
      "Kompaniya umumiy holati: sotuv, mijoz so'rovlari, vazifalar, asosiy xavflar va rahbariyat uchun keyingi qadamlarni tahlil qil.",
  },
];

export interface RewrittenQuery {
  original: string;
  rewritten: string;
  wasRewritten: boolean;
}

export function rewriteCeoQuery(question: string): RewrittenQuery {
  const original = question.trim();
  const compact = original.replace(/\s+/g, " ").trim();

  for (const rule of REWRITE_RULES) {
    if (rule.match.test(compact)) {
      return { original, rewritten: rule.rewrite, wasRewritten: true };
    }
  }

  // Short vague questions → executive analysis framing
  if (compact.length < 28 && /qanday|holat|nima gap|tahlil/.test(compact.toLowerCase())) {
    return {
      original,
      rewritten: `${compact} — bugungi va oxirgi 7 kunlik ko'rsatkichlar, asosiy xavflar va rahbariyat uchun aniq tavsiyalarni chiqar.`,
      wasRewritten: true,
    };
  }

  return { original, rewritten: original, wasRewritten: false };
}
