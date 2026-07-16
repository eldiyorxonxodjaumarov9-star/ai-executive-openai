/**
 * Savol tezkor javob yoki to'liq hisobot rejimini aniqlash.
 */
(function (global) {
  "use strict";

  const FULL_REPORT_KEYWORDS = [
    "to'liq hisobot",
    "to‘liq hisobot",
    "tolik hisobot",
    "batafsil tahlil",
    "umumiy holat",
    "barcha ma'lumot",
    "barcha malumot",
    "rahbar uchun hisobot",
    "keng tahlil",
  ];

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/ʻ|’|`/g, "'");
  }

  function isFullReport(question) {
    const text = normalize(question);
    return FULL_REPORT_KEYWORDS.some((kw) => text.includes(kw));
  }

  function modeForQuestion(question) {
    return isFullReport(question) ? "full_report" : "quick_answer";
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.responseMode = { isFullReport, modeForQuestion, FULL_REPORT_KEYWORDS };
})(typeof window !== "undefined" ? window : self);
