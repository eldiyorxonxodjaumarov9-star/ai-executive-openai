import type { RewrittenQuery } from "./types";

const REWRITE_RULES: Array<{ match: RegExp; rewrite: string }> = [
  {
    match: /yetkazib\s*beruvchi.*tanlash/i,
    rewrite:
      "Commercial offer va yetkazib beruvchi tanlash mezonlari (BP-02) bo'yicha ta'minot qo'llanmasi bo'laklarini top.",
  },
  {
    match: /yetkazib\s*beruvchi.*holat/i,
    rewrite:
      "Yetkazib beruvchi kompaniyalar, bog'liq bitimlar, kechikkan vazifalar va oxirgi activities holatini Asia/Tashkent bo'yicha tahlil qil.",
  },
  {
    match: /xarid.*tartib|xarid.*qanday/i,
    rewrite: "Xarid jarayoni, ta'minot tartibi va BP-02/BP-05 qo'llanma bo'laklarini tushuntir.",
  },
  {
    match: /ombor|zaxira/i,
    rewrite: "Ombor, zaxira boshqaruvi va SLA mezonlarini ta'minot hujjatlari va CRM ma'lumotlari orqali bahola.",
  },
  {
    match: /logistika|yetkazib\s*berish/i,
    rewrite: "Yetkazib berish va logistika bo'yicha ta'minot qo'llanmasi va Bitrix24 vazifa/bitim holatini tahlil qil.",
  },
  {
    match: /shartnoma.*kpi|kpi.*ta'?minot/i,
    rewrite: "Ta'minot shartnoma va KPI mezonlarini AQ-02 hujjatlari bo'yicha tushuntir.",
  },
  {
    match: /kechik.*yetkaz|yetkaz.*kechik/i,
    rewrite: "Kechikkan vazifalar, yetkazib berish muddatlari va mas'ul xodimlarni aniqlash.",
  },
  {
    match: /ta'?minot.*risk|risk.*ta'?minot/i,
    rewrite: "Ta'minot risklari, yetkazib beruvchi ishonchliligi va tavsiyalar bo'yicha qo'llanma bo'laklarini top.",
  },
];

export function rewriteProcurementQuery(question: string): RewrittenQuery {
  const original = question.trim();
  const compact = original.replace(/\s+/g, " ").trim();

  for (const rule of REWRITE_RULES) {
    if (rule.match.test(compact)) {
      return { original, rewritten: rule.rewrite, wasRewritten: true };
    }
  }

  if (
    compact.length < 50 &&
    /qanday|holat|tahlil|ta'?minot|xarid|yetkazib|ombor|shartnoma|supplier/.test(compact.toLowerCase())
  ) {
    return {
      original,
      rewritten: `${compact} — ta'minot hujjatlari (AQ-02) va Bitrix24 kompaniya/bitim/vazifa ma'lumotini mos ravishda tahlil qil.`,
      wasRewritten: true,
    };
  }

  return { original, rewritten: original, wasRewritten: false };
}
