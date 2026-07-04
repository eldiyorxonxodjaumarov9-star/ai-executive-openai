const FULL_REPORT_KEYWORDS = [
  "to'liq hisobot",
  "to‘liq hisobot",
  "tolik hisobot",
  "batafsil tahlil",
  "umumiy holat",
  "rahbar uchun hisobot",
  "keng tahlil",
];

export function isFullReportQuestion(question: string): boolean {
  const text = question.toLowerCase().replace(/ʻ|’|`/g, "'");
  return FULL_REPORT_KEYWORDS.some((kw) => text.includes(kw));
}

export function modeForQuestion(question: string): "quick_answer" | "full_report" {
  return isFullReportQuestion(question) ? "full_report" : "quick_answer";
}
