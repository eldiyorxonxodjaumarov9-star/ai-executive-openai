/**
 * Single source of truth — shared by background (importScripts) and content scripts.
 */
(function (global) {
  "use strict";

  const API_BASE = "https://ai-executive-platform.onrender.com";
  const PORT_NAME = "aiep-agent";
  const STORAGE_SCHEMA_VERSION = 2;

  const TIMEOUT = {
    HEALTH_MS: 25_000,
    QUICK_MS: 65_000,
    JOB_START_MS: 120_000,
    POLL_MS: 45_000,
    POLL_INTERVAL_MS: 3_000,
    POLL_MAX_MS: 480_000,
    PORT_CLIENT_QUICK_MS: 70_000,
    PORT_CLIENT_FULL_MS: 500_000,
    POLL_ERROR_MAX: 8,
    COLD_START_MS: 2_000,
    WAKE_MAX_ATTEMPTS: 8,
    WAKE_BACKOFF_MS: 150,
    KEEPALIVE_INTERVAL_MS: 10_000,
  };

  const MESSAGES = {
    TIMEOUT:
      "Hisobot tayyorlash vaqti tugadi (10 daqiqagacha kutildi). Qayta urinish tugmasini bosing — server hali ishlayotgan bo'lishi mumkin.",
    TIMEOUT_START:
      "Server javob bermadi (uyg'onish yoki ulanish sekin). 30 soniyadan keyin qayta urinib ko'ring.",
    TIMEOUT_POLL:
      "Server bilan aloqa vaqtincha uzildi, lekin tahlil fon rejimida davom etishi mumkin. «Davom etish» tugmasini bosing.",
    TIMEOUT_WITH_JOB:
      "Tahlil hali tugamagan bo'lishi mumkin. «Davom etish» tugmasi orqali natijani kuting — qayta CRM so'ralmaydi.",
    STILL_RUNNING:
      "Hisobot hali tayyorlanmoqda. Biroz kuting yoki qayta urinib ko'ring.",
    SECRET_MISSING:
      "Ulanish kaliti kiritilmagan. Kengaytma sozlamalaridan kalitni saqlang.",
    PORT_DISCONNECTED:
      "Kengaytma xizmati uzildi. chrome://extensions sahifasida qayta yuklang, so'ng sahifani yangilang.",
    WORKER_UNAVAILABLE:
      "Kengaytma xizmati tayyor emas. chrome://extensions sahifasida qayta yuklang.",
    CONTEXT_INVALID:
      "Kengaytma konteksti yangilandi — sahifani yangilang yoki kengaytmani qayta yuklang.",
    SERVER_WAKING:
      "Server uyg'onmoqda — biroz kutib, qayta urinib ko'ring.",
    NETWORK:
      "Tarmoq mavjud emas — internet ulanishini tekshiring.",
    AGENT_FAILED: "Agent so'rovni bajarib bo'lmadi.",
    DUPLICATE_SUBMIT: "Tahlil allaqachon bajarilmoqda — kuting.",
  };

  const JOB_STAGE_MAP = {
    navbat: "wake",
    crm: "crm",
    claude: "report",
    done: "recommend",
    failed: "connect",
  };
  const LOADING_HINT_QUICK = "Oddiy savollar odatda 10–40 soniyada javob beriladi.";
  const LOADING_HINT_FULL =
    "To'liq hisobot 2–8 daqiqa davom etishi mumkin. Iltimos, kuting — oyna yopilmasin.";

  const LOADING_STAGES_QUICK = [
    { id: "validate", label: "Savol tekshirilmoqda..." },
    { id: "crm", label: "Kerakli CRM ma'lumotlari olinmoqda..." },
    { id: "answer", label: "Javob tayyorlanmoqda..." },
    { id: "done", label: "Tayyor." },
  ];

  const LOADING_STAGES = [
    { id: "connect", label: "Ulanmoqda..." },
    { id: "wake", label: "Server uyg'onmoqda..." },
    { id: "crm", label: "CRM ma'lumotlari o'qilmoqda..." },
    { id: "report", label: "Hisobot tayyorlanmoqda..." },
    { id: "hint", label: LOADING_HINT_FULL },
    { id: "recommend", label: "Tavsiyalar shakllantirilmoqda..." },
    { id: "done", label: "Tayyor." },
  ];

  const STAGE_BY_ID = Object.fromEntries([
    ...LOADING_STAGES.map((s) => [s.id, s.label]),
    ...LOADING_STAGES_QUICK.map((s) => [s.id, s.label]),
  ]);

  function stageLabel(stageIdOrText) {
    if (!stageIdOrText) return LOADING_STAGES[0].label;
    if (STAGE_BY_ID[stageIdOrText]) return STAGE_BY_ID[stageIdOrText];
    return String(stageIdOrText);
  }

  function stageIndex(stageIdOrText, quick = false) {
    const list = quick ? LOADING_STAGES_QUICK : LOADING_STAGES;
    const id = STAGE_BY_ID[stageIdOrText] ? stageIdOrText : null;
    if (id) return list.findIndex((s) => s.id === id);
    const idx = list.findIndex((s) => s.label === stageIdOrText);
    return idx >= 0 ? idx : 0;
  }

  const PORT_CLOSED_RE =
    /message port closed|response was received|extension context invalidated/i;

  global.AIEP = global.AIEP || {};
  global.AIEP.constants = {
    API_BASE,
    PORT_NAME,
    STORAGE_SCHEMA_VERSION,
    TIMEOUT,
    MESSAGES,
    LOADING_HINT: LOADING_HINT_FULL,
    LOADING_HINT_QUICK,
    LOADING_HINT_FULL,
    LOADING_STAGES,
    LOADING_STAGES_QUICK,
    STAGE_BY_ID,
    JOB_STAGE_MAP,
    stageLabel,
    stageIndex,
    PORT_CLOSED_RE,
  };
})(typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : globalThis);
