/**
 * Rahbarlik AI platformasi — sozlama va agentlar ro'yxati
 */
(function (global) {
  "use strict";

  const C = global.AIEP?.constants;
  const API_BASE = C?.API_BASE || "https://ai-executive-platform.onrender.com";
  const LOADING_HINT =
    C?.LOADING_HINT || "Hisobot katta bo'lsa, javob 1–5 daqiqa davom etishi mumkin.";
  const LOADING_STAGES = (C?.LOADING_STAGES || []).map((s) =>
    typeof s === "string" ? s : s.label
  );

  const AGENT_REGISTRY = [
    { id: "ceo", label: "Bosh direktor agenti", icon: "briefcase", department: "Rahbariyat" },
    { id: "finance", label: "Moliya agenti", icon: "wallet", department: "Moliya" },
    { id: "sales", label: "Sotuv agenti", icon: "trending-up", department: "Sotuv" },
    { id: "hr", label: "Kadrlar agenti", icon: "users", department: "Kadrlar" },
    { id: "marketing", label: "Marketing agenti", icon: "target", department: "Marketing" },
    {
      id: "customer_success",
      label: "Mijozlar muvaffaqiyati agenti",
      icon: "circle-check",
      department: "Mijozlar",
    },
    { id: "legal", label: "Yuridik agent", icon: "shield-alert", department: "Yuridik", disabled: true },
    { id: "procurement", label: "Xarid agenti", icon: "building-2", department: "Xaridlar", disabled: true },
    { id: "warehouse", label: "Ombor agenti", icon: "clipboard-list", department: "Operatsiyalar", disabled: true },
    { id: "operations", label: "Operatsiyalar agenti", icon: "clock", department: "Operatsiyalar", disabled: true },
    { id: "analytics", label: "Tahlil agenti", icon: "file-text", department: "Tahlil", disabled: true },
    { id: "ai_research", label: "Tadqiqot agenti", icon: "target", department: "Tadqiqot", disabled: true },
  ];

  const SECTION_CONFIG = [
    {
      patterns: [/qisqacha\s+xulosa/i, /qisqa\s+xulosa/i],
      id: "executive-summary",
      title: "Qisqacha xulosa",
      theme: "summary",
      icon: "briefcase",
      defaultOpen: true,
    },
    {
      patterns: [/asosiy\s+muammolar/i, /muammolar/i],
      id: "problems",
      title: "Asosiy muammolar",
      theme: "problems",
      icon: "alert-triangle",
      defaultOpen: false,
    },
    {
      patterns: [/kuchli\s+tomonlar/i],
      id: "strengths",
      title: "Kuchli tomonlar",
      theme: "strengths",
      icon: "circle-check",
      defaultOpen: false,
    },
    {
      patterns: [/xavflar/i],
      id: "risks",
      title: "Xavflar",
      theme: "risks",
      icon: "shield-alert",
      defaultOpen: false,
    },
    {
      patterns: [/tavsiyalar/i],
      id: "recommendations",
      title: "Tavsiyalar",
      theme: "recommendations",
      icon: "target",
      defaultOpen: false,
    },
    {
      patterns: [/keyingi\s+bajarilishi/i, /keyingi\s+qadamlar/i, /keyingi\s+ishlar/i],
      id: "next-actions",
      title: "Keyingi bajarilishi kerak bo'lgan ishlar",
      theme: "actions",
      icon: "clipboard-list",
      timeline: true,
      defaultOpen: false,
    },
    {
      patterns: [/^#+\s*umumiy\s+xulosa/i, /\bumumiy\s+xulosa\b/i],
      id: "conclusion",
      title: "Umumiy xulosa",
      theme: "summary",
      icon: "file-text",
      defaultOpen: false,
    },
    {
      patterns: [/moliyaviy/i, /moliya/i, /daromad/i, /pul\s+oqimi/i],
      id: "financial",
      title: "Moliyaviy tahlil",
      theme: "financial",
      icon: "banknote",
      chartKeywords: ["daromad", "pul oqimi", "foyda", "marja"],
      defaultOpen: false,
    },
    {
      patterns: [/sotuv\s+jarayoni/i, /bitimlar/i, /mijoz\s+so'rovi/i],
      id: "pipeline",
      title: "Sotuv jarayoni tahlili",
      theme: "pipeline",
      icon: "trending-up",
      chartKeywords: ["sotuv", "bitim", "konversiya"],
      defaultOpen: false,
    },
  ];

  const PRIORITY_PATTERNS = [
    { level: "critical", patterns: [/\bjuda\s+muhim\b/i, /\bshoshilinch\b/i] },
    { level: "high", patterns: [/\byuqori\b/i] },
    { level: "medium", patterns: [/\bo'rta\b/i, /\borta\b/i] },
    { level: "low", patterns: [/\bpast\b/i] },
  ];

  const UPLOAD_ACCEPT = {
    "application/pdf": [".pdf"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    "text/csv": [".csv"],
    "text/plain": [".txt"],
  };

  const STORAGE_KEYS = {
    theme: "aiep_theme",
    agent: "selectedAgent",
    scroll: "aiep_scroll",
    lastReport: "aiep_last_report",
    panelOpen: "aiep_panel_open",
  };

  global.AIEP = global.AIEP || {};
  global.AIEP.config = {
    API_BASE,
    AGENT_REGISTRY,
    SECTION_CONFIG,
    LOADING_STAGES,
    LOADING_STAGES_META: C?.LOADING_STAGES || [],
    LOADING_HINT,
    PRIORITY_PATTERNS,
    UPLOAD_ACCEPT,
    STORAGE_KEYS,
    getVersion() {
      try {
        return chrome.runtime.getManifest().version;
      } catch {
        return "2.1.1";
      }
    },
    getActiveAgents() {
      return AGENT_REGISTRY.filter((a) => !a.disabled);
    },
    getAgent(id) {
      return AGENT_REGISTRY.find((a) => a.id === id);
    },
  };
})(typeof window !== "undefined" ? window : self);
