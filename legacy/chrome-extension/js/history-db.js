/**
 * IndexedDB history store for executive reports
 */
(function (global) {
  "use strict";

  const DB_NAME = "aiep_executive";
  const DB_VERSION = 1;
  const STORE = "reports";

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("agent", "agent", { unique: false });
        }
      };
    });
  }

  async function saveReport(report) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(report);
      tx.oncomplete = () => resolve(report);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function listReports(limit = 50) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).index("timestamp").openCursor(null, "prev");
      const items = [];
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && items.length < limit) {
          items.push(cursor.value);
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteReport(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function searchReports(query) {
    const all = await listReports(100);
    const q = query.toLowerCase().trim();
    if (!q) return all;
    return all.filter(
      (r) =>
        r.question?.toLowerCase().includes(q) ||
        r.markdown?.toLowerCase().includes(q) ||
        r.agentLabel?.toLowerCase().includes(q)
    );
  }

  function createReportId() {
    return `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.history = { saveReport, listReports, deleteReport, searchReports, createReportId };
})(typeof window !== "undefined" ? window : self);
