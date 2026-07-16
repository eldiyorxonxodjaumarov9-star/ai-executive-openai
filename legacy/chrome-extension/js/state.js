/**
 * Persistent UI state via chrome.storage.local
 */
(function (global) {
  "use strict";

  const { STORAGE_KEYS } = global.AIEP.config;

  function get(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  function set(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, resolve);
    });
  }

  async function loadTheme() {
    const data = await get([STORAGE_KEYS.theme]);
    return data[STORAGE_KEYS.theme] || "light";
  }

  async function saveTheme(theme) {
    await set({ [STORAGE_KEYS.theme]: theme });
  }

  async function loadAgent() {
    const data = await get([STORAGE_KEYS.agent]);
    return data[STORAGE_KEYS.agent] || "ceo";
  }

  async function saveAgent(agentId) {
    await set({ [STORAGE_KEYS.agent]: agentId });
  }

  async function saveLastReport(report) {
    await set({ [STORAGE_KEYS.lastReport]: report });
  }

  async function loadLastReport() {
    const data = await get([STORAGE_KEYS.lastReport]);
    return data[STORAGE_KEYS.lastReport] || null;
  }

  async function saveScroll(position) {
    await set({ [STORAGE_KEYS.scroll]: position });
  }

  async function loadScroll() {
    const data = await get([STORAGE_KEYS.scroll]);
    return data[STORAGE_KEYS.scroll] || 0;
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.state = {
    loadTheme,
    saveTheme,
    loadAgent,
    saveAgent,
    saveLastReport,
    loadLastReport,
    saveScroll,
    loadScroll,
  };
})(typeof window !== "undefined" ? window : self);
