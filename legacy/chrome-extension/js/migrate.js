/**
 * Storage schema migration — runs on install, update, and startup.
 * Preserves connector secret, history keys, theme, agent, last report.
 */
(function (global) {
  "use strict";

  const SCHEMA_KEY = "aiep_schema_version";
  const VERSION_KEY = "aiep_extension_version";
  const LEGACY_KEYS = ["secret", "connector_secret", "xConnectorSecret"];
  const SECRET_KEY = "connectorSecret";

  function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function storageSet(data) {
    return new Promise((resolve) => chrome.storage.local.set(data, resolve));
  }

  function storageRemove(keys) {
    return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
  }

  async function migrateConnectorSecret() {
    const data = await storageGet([SECRET_KEY, ...LEGACY_KEYS]);
    const current = (data[SECRET_KEY] || "").trim();
    if (current) {
      if (LEGACY_KEYS.some((k) => data[k])) {
        await storageRemove(LEGACY_KEYS);
      }
      return current;
    }
    for (const key of LEGACY_KEYS) {
      const legacy = (data[key] || "").trim();
      if (legacy) {
        await storageSet({ [SECRET_KEY]: legacy });
        await storageRemove(LEGACY_KEYS.filter((k) => k !== key));
        return legacy;
      }
    }
    return "";
  }

  async function trimOversizedLastReport() {
    const data = await storageGet(["aiep_last_report"]);
    const report = data.aiep_last_report;
    if (!report?.markdown || report.markdown.length <= 500_000) return;
    report.markdown = report.markdown.slice(0, 500_000);
    await storageSet({ aiep_last_report: report });
  }

  async function runMigrations() {
    const targetSchema =
      global.AIEP?.constants?.STORAGE_SCHEMA_VERSION || 2;
    const data = await storageGet([SCHEMA_KEY, VERSION_KEY]);
    let schema = data[SCHEMA_KEY] || 1;

    await migrateConnectorSecret();

    if (schema < 2) {
      await trimOversizedLastReport();
      schema = 2;
    }

    let extVersion = "2.1.0";
    try {
      extVersion = chrome.runtime.getManifest().version;
    } catch {
      /* content script may not have manifest in some contexts */
    }

    await storageSet({
      [SCHEMA_KEY]: targetSchema,
      [VERSION_KEY]: extVersion,
    });

    return { schema, extensionVersion: extVersion };
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.migrate = { runMigrations, migrateConnectorSecret, SCHEMA_KEY, VERSION_KEY };
})(typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : globalThis);
