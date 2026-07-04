const STAGE_LABELS: Record<string, string> = {
  PREPAYMENT_INVOICE: "To'lov kutilayotgan bosqich",
  NEW: "Yangi bitim",
  WON: "Yakunlangan bitim",
  WIN: "Yakunlangan bitim",
  LOSE: "Bekor bo'lgan bitim",
  SUCCESS: "Muvaffaqiyatli yakunlangan",
};

const TERM_REPLACEMENTS: [RegExp, string][] = [
  [/\bExecutive Summary\b/gi, "Qisqacha xulosa"],
  [/\bDeal\b/g, "Bitim"],
  [/\bDeals\b/g, "Bitimlar"],
  [/\bLead\b/g, "Mijoz so'rovi"],
  [/\bLeads\b/g, "Mijoz so'rovlari"],
  [/\bPipeline\b/g, "Sotuv jarayoni"],
  [/\bStage\b/g, "Bosqich"],
  [/\bOpportunity\b/g, "Bitim qiymati"],
  [/\bStatus\b/g, "Holati"],
  [/\bUZS\b/g, "so'm"],
  [/\bUSD\b/g, "AQSh dollari"],
];

export function sanitizeUserOutput(text: string): string {
  if (!text) return text;
  let result = text;
  for (const [code, label] of Object.entries(STAGE_LABELS)) {
    result = result.replaceAll(code, label);
  }
  result = result.replace(/\bUC_[A-Z0-9]+\b/g, "Jarayondagi bitim");
  for (const [pattern, replacement] of TERM_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
