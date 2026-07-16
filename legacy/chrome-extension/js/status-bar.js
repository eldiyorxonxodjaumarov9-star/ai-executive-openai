/**
 * Server va CRM holati — polling pause during agent runs.
 */
(function (global) {
  "use strict";

  let pollingPaused = false;

  function renderStatusBar(el) {
    el.innerHTML = `
      <div class="aiep-status-bar">
        <span class="aiep-status-item" data-status="backend">
          <span class="aiep-status-dot"></span>
          <span class="aiep-status-label">Server tekshirilmoqda…</span>
        </span>
        <span class="aiep-status-item" data-status="crm">
          <span class="aiep-status-dot"></span>
          <span class="aiep-status-label">CRM tekshirilmoqda…</span>
        </span>
      </div>
    `;
  }

  function setBackendStatus(el, state, label) {
    const item = el.querySelector('[data-status="backend"]');
    if (!item) return;
    item.className = `aiep-status-item aiep-status-${state}`;
    item.querySelector(".aiep-status-label").textContent = label;
  }

  function setCrmStatus(el, state, label) {
    const item = el.querySelector('[data-status="crm"]');
    if (!item) return;
    item.className = `aiep-status-item aiep-status-${state}`;
    item.querySelector(".aiep-status-label").textContent = label;
  }

  function pausePolling() {
    pollingPaused = true;
  }

  function resumePolling() {
    pollingPaused = false;
  }

  function pollStatus(statusEl) {
    if (pollingPaused) return;

    const messaging = global.AIEP?.messaging;
    if (!messaging) {
      setBackendStatus(statusEl, "offline", "Server ulanmagan");
      setCrmStatus(statusEl, "unknown", "CRM noma'lum");
      return;
    }

    messaging.sendToBackground({ type: "CHECK_STATUS" }).then((envelope) => {
      if (pollingPaused) return;
      if (envelope.ok === false || !envelope.data) {
        setBackendStatus(statusEl, "offline", "Server ulanmagan");
        setCrmStatus(statusEl, "unknown", "CRM noma'lum");
        return;
      }

      const response = envelope.data;

      if (response.busy) {
        setBackendStatus(statusEl, "online", "Server band — tahlil davom etmoqda");
        setCrmStatus(statusEl, "unknown", "CRM tekshirilmadi");
        return;
      }

      const backendLabels = {
        online: "Server ulandi",
        sleeping: "Server uyg'onmoqda",
        offline: "Server ulanmagan",
      };
      setBackendStatus(statusEl, response.backend || "offline", backendLabels[response.backend] || "Server ulanmagan");

      const crmLabels = {
        connected: "CRM ulandi",
        error: "CRM xatosi",
        unknown: "CRM noma'lum",
      };
      setCrmStatus(statusEl, response.crm || "unknown", crmLabels[response.crm] || "CRM noma'lum");
    });
  }

  function startPolling(statusEl, intervalMs = 60_000) {
    pollStatus(statusEl);
    return setInterval(() => pollStatus(statusEl), intervalMs);
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.statusBar = {
    renderStatusBar,
    pollStatus,
    startPolling,
    pausePolling,
    resumePolling,
    setBackendStatus,
    setCrmStatus,
  };
})(typeof window !== "undefined" ? window : self);
