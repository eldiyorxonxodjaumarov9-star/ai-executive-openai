/**
 * Rahbarlik AI — content script (UI only; API via background port/message).
 */
(function () {
  "use strict";

  const LOG = "[AIEP]";
  let bootTimer = null;
  let bootAttempts = 0;

  function logDiag(phase) {
    const root = document.getElementById("aiep-root");
    const fab = root?.querySelector(".aiep-fab");
    console.debug(
      `${LOG} ${phase}`,
      "ready=",
      root?.dataset.aiepReady,
      "fabBound=",
      fab?.dataset.aiepBound,
      "dashboard=",
      !!window.AIEP?.activeDashboard,
      "panel=",
      !!document.getElementById("aiep-panel")
    );
  }

  function isRootHealthy(root) {
    if (!root || !root.isConnected) return false;
    if (!root.dataset.aiepReady) return false;
    const fab = root.querySelector(".aiep-fab");
    if (!fab || !fab.dataset.aiepBound) return false;
    if (!root.querySelector("#aiep-panel")) return false;
    return true;
  }

  function needsRemount() {
    if (window.__aiepMounting) return false;
    const root = document.getElementById("aiep-root");
    return !isRootHealthy(root);
  }

  function getMountParent() {
    return document.documentElement || document.body;
  }

  function boot() {
    if (window.__aiepMounting) return;

    window.AIEP?.panel?.installDelegation?.();

    const existing = document.getElementById("aiep-root");
    if (existing && isRootHealthy(existing)) {
      if (!window.AIEP?.activeDashboard && window.AIEP?.ExecutiveDashboard) {
        try {
          window.__aiepMounting = true;
          const dash = new AIEP.ExecutiveDashboard();
          dash.adopt(existing);
          window.AIEP.activeDashboard = dash;
          logDiag("relink");
        } catch (err) {
          console.error(`${LOG} ERROR relink:`, err);
          existing.remove();
        } finally {
          window.__aiepMounting = false;
        }
      }
      return;
    }

    if (existing) {
      existing.remove();
    }
    if (window.AIEP) {
      window.AIEP.activeDashboard = null;
    }

    if (!window.AIEP?.ExecutiveDashboard) {
      console.error(`${LOG} ERROR ExecutiveDashboard yuklanmadi — config.js tekshiring`);
      return;
    }

    window.__aiepMounting = true;
    bootAttempts += 1;
    try {
      const dashboard = new AIEP.ExecutiveDashboard();
      dashboard.mount(getMountParent());
      window.AIEP.activeDashboard = dashboard;
      logDiag(`mount#${bootAttempts}`);
    } catch (err) {
      console.error(`${LOG} ERROR mount:`, err);
      document.getElementById("aiep-root")?.remove();
      if (window.AIEP) window.AIEP.activeDashboard = null;
    } finally {
      window.__aiepMounting = false;
    }
  }

  function scheduleBoot() {
    clearTimeout(bootTimer);
    bootTimer = setTimeout(() => {
      if (needsRemount()) {
        boot();
      }
    }, 400);
  }

  function watchSpaNavigation() {
    const ensure = () => {
      if (!document.getElementById("aiep-root")?.isConnected) {
        scheduleBoot();
      }
    };
    const wrap = (fn) =>
      function (...args) {
        const result = fn.apply(this, args);
        ensure();
        return result;
      };
    try {
      history.pushState = wrap(history.pushState);
      history.replaceState = wrap(history.replaceState);
    } catch {
      /* ignore */
    }
    window.addEventListener("popstate", ensure);
  }

  function watchDom() {
    const obs = new MutationObserver(() => {
      const root = document.getElementById("aiep-root");
      if (!root || !root.isConnected) {
        scheduleBoot();
      }
    });
    const target = document.documentElement;
    if (target) {
      obs.observe(target, { childList: true, subtree: true });
    }
  }

  window.AIEP?.panel?.installDelegation?.();
  watchSpaNavigation();
  watchDom();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
