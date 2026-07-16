/**
 * Permanent connector secret storage + legacy key migration.
 * Never cleared by panel refresh, history delete, or page reload.
 */
(function (global) {
  "use strict";

  const STORAGE_SECRET_KEY = "connectorSecret";
  const LEGACY_KEYS = ["secret", "connector_secret", "xConnectorSecret"];

  function migrateConnectorSecret() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_SECRET_KEY, ...LEGACY_KEYS], (data) => {
        const current = (data[STORAGE_SECRET_KEY] || "").trim();
        if (current) {
          resolve(current);
          return;
        }

        for (const key of LEGACY_KEYS) {
          const legacy = (data[key] || "").trim();
          if (legacy) {
            const removeKeys = LEGACY_KEYS.filter((k) => k !== key);
            chrome.storage.local.set({ [STORAGE_SECRET_KEY]: legacy }, () => {
              if (removeKeys.length) {
                chrome.storage.local.remove(removeKeys);
              }
              console.log("[AIEP secret] migrated from", key, "→ connectorSecret");
              resolve(legacy);
            });
            return;
          }
        }

        resolve("");
      });
    });
  }

  function getConnectorSecret() {
    return migrateConnectorSecret();
  }

  function saveConnectorSecret(value) {
    return new Promise((resolve) => {
      const trimmed = (value || "").trim();
      chrome.storage.local.set({ [STORAGE_SECRET_KEY]: trimmed }, () => {
        chrome.storage.local.remove(LEGACY_KEYS, resolve);
      });
    });
  }

  /** Only callable from popup — explicit user action */
  function clearConnectorSecret() {
    return new Promise((resolve) => {
      chrome.storage.local.remove([STORAGE_SECRET_KEY, ...LEGACY_KEYS], resolve);
    });
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.secretStorage = {
    STORAGE_SECRET_KEY,
    LEGACY_KEYS,
    migrateConnectorSecret,
    getConnectorSecret,
    saveConnectorSecret,
    clearConnectorSecret,
  };
})(typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : globalThis);
