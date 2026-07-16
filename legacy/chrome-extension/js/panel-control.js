/**
 * Panel ochish/yopish — DOM dan mustaqil, event delegation orqali.
 */
(function (global) {
  "use strict";

  const LOG = "[AIEP]";

  function getRoot() {
    return document.getElementById("aiep-root");
  }

  function getBackdrop() {
    return getRoot()?.querySelector("#aiep-backdrop") || document.getElementById("aiep-backdrop");
  }

  function getPanel() {
    return getRoot()?.querySelector("#aiep-panel") || document.getElementById("aiep-panel");
  }

  function openPanel() {
    const backdrop = getBackdrop();
    const panel = getPanel();

    if (!panel) {
      console.error(`${LOG} ERROR openPanel: #aiep-panel topilmadi`);
      return false;
    }

    backdrop?.classList.add("aiep-open");
    panel.classList.add("aiep-open");

    if (backdrop) {
      backdrop.style.opacity = "1";
      backdrop.style.pointerEvents = "auto";
    }
    panel.style.transform = "translateX(0)";
    panel.style.pointerEvents = "auto";
    panel.style.zIndex = "2147483647";

    panel.setAttribute("aria-hidden", "false");
    console.debug(`${LOG} panel ochildi`);
    return true;
  }

  function closePanel() {
    const backdrop = getBackdrop();
    const panel = getPanel();

    backdrop?.classList.remove("aiep-open");
    panel?.classList.remove("aiep-open");

    if (backdrop) {
      backdrop.style.opacity = "";
      backdrop.style.pointerEvents = "";
    }
    if (panel) {
      panel.style.transform = "";
      panel.style.pointerEvents = "";
      panel.style.zIndex = "";
      panel.setAttribute("aria-hidden", "true");
    }

    console.debug(`${LOG} panel yopildi`);
    return true;
  }

  function isOpen() {
    return !!getPanel()?.classList.contains("aiep-open");
  }

  function installDelegation() {
    if (global.__aiepDelegation) return;
    global.__aiepDelegation = true;

    document.addEventListener(
      "click",
      (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;

        const fab = target.closest(".aiep-fab");
        if (fab) {
          e.preventDefault();
          e.stopPropagation();
          openPanel();
          const dash = global.AIEP?.activeDashboard;
          if (dash && typeof dash.onPanelOpen === "function") {
            dash.onPanelOpen();
          }
          return;
        }

        const closeBtn = target.closest(".aiep-close");
        if (closeBtn) {
          e.preventDefault();
          e.stopPropagation();
          closePanel();
          return;
        }

        const backdrop = target.closest("#aiep-backdrop.aiep-open, .aiep-backdrop.aiep-open");
        if (backdrop && target === backdrop) {
          e.preventDefault();
          closePanel();
        }
      },
      true
    );
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.panel = {
    getRoot,
    getBackdrop,
    getPanel,
    open: openPanel,
    close: closePanel,
    isOpen,
    installDelegation,
  };
})(typeof window !== "undefined" ? window : self);
