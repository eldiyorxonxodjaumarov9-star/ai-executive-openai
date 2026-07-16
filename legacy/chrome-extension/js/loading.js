/**
 * Premium staged loading — driven by background progress stage IDs.
 */
(function (global) {
  "use strict";

  const C = global.AIEP?.constants;

  function getStages(quick) {
    return quick ? C?.LOADING_STAGES_QUICK || [] : C?.LOADING_STAGES || [];
  }

  function getHint(quick) {
    if (quick) return C?.LOADING_HINT_QUICK || "Javob tayyorlanmoqda...";
    return C?.LOADING_HINT || C?.LOADING_HINT_FULL || "";
  }

  function firstStageLabel(quick) {
    const stages = getStages(quick);
    return stages[0]?.label || "Ulanmoqda...";
  }

  function createLoadingUI(container, quick) {
    const el = document.createElement("div");
    el.className = "aiep-loading-overlay";
    el.dataset.quick = quick ? "1" : "0";
    el.innerHTML = `
      <div class="aiep-loading-card">
        <div class="aiep-loading-spinner" aria-hidden="true"></div>
        <p class="aiep-loading-stage" aria-live="polite">${firstStageLabel(quick)}</p>
        <p class="aiep-loading-hint">${getHint(quick)}</p>
        <div class="aiep-loading-progress"><div class="aiep-loading-bar"></div></div>
        <div class="aiep-skeleton">
          <div class="aiep-skeleton-line wide"></div>
          <div class="aiep-skeleton-line"></div>
          <div class="aiep-skeleton-line medium"></div>
        </div>
      </div>
    `;
    container.appendChild(el);
    return el;
  }

  function setStage(overlay, stageIdOrLabel, labelOverride) {
    if (!overlay) return;
    const quick = overlay.dataset.quick === "1";
    const stages = getStages(quick);
    const stageEl = overlay.querySelector(".aiep-loading-stage");
    const bar = overlay.querySelector(".aiep-loading-bar");
    const label = labelOverride || C?.stageLabel?.(stageIdOrLabel) || stageIdOrLabel || firstStageLabel(quick);
    if (stageEl) stageEl.textContent = label;
    if (bar) {
      const idx = C?.stageIndex?.(stageIdOrLabel, quick) ?? 0;
      const total = stages.length || 1;
      const pct = Math.min(100, Math.max(8, ((idx + 1) / total) * 100));
      bar.style.width = `${pct}%`;
    }
  }

  function showPortDriven(container, options = {}) {
    const quick = Boolean(options.quick);
    const existing = container.querySelector(".aiep-loading-overlay");
    if (existing) existing.remove();
    const overlay = createLoadingUI(container, quick);
    overlay.classList.add("aiep-visible");
    const stages = getStages(quick);
    setStage(overlay, stages[0]?.id || "connect");
    return {
      overlay,
      cancel: () => {},
      setStage: (id, label) => setStage(overlay, id, label),
    };
  }

  function hide(overlay) {
    overlay?.classList.add("aiep-fade-out");
    setTimeout(() => overlay?.remove(), 300);
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.loading = { showPortDriven, hide, setStage };
})(typeof window !== "undefined" ? window : self);
