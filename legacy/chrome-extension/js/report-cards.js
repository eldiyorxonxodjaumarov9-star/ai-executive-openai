/**
 * Executive report cards with collapse/expand
 */
(function (global) {
  "use strict";

  const { icons, markdown, charts, tables, timeline } = global.AIEP;

  function buildReportCards(markdownText, container, options = {}) {
    const sections = markdown.splitSections(markdownText);
    container.innerHTML = "";

    sections.forEach((section, index) => {
      const cfg = section.config || {
        id: `section-${index}`,
        title: section.title,
        theme: "default",
        icon: "file-text",
        defaultOpen: index === 0,
      };

      const isOpen = cfg.defaultOpen === true;
      const card = document.createElement("article");
      card.className = `aiep-card aiep-theme-${cfg.theme}${isOpen ? " is-open" : ""}`;
      card.dataset.sectionId = cfg.id;
      card.style.animationDelay = `${index * 40}ms`;

      card.innerHTML = `
        <button type="button" class="aiep-card-header" aria-expanded="${isOpen}">
          <span class="aiep-card-icon">${icons.icon(cfg.icon, 18)}</span>
          <span class="aiep-card-title">${markdown.escapeHtml(cfg.title || section.title)}</span>
          <span class="aiep-card-chevron">${icons.icon("chevron", 16)}</span>
        </button>
        <div class="aiep-card-body" ${isOpen ? "" : 'hidden'}></div>
      `;

      const bodyEl = card.querySelector(".aiep-card-body");
      const headerBtn = card.querySelector(".aiep-card-header");

      if (cfg.timeline) {
        const usedTimeline = timeline.renderTimeline(bodyEl, section.body);
        if (!usedTimeline) {
          bodyEl.innerHTML = markdown.render(section.body);
        }
      } else {
        bodyEl.innerHTML = markdown.render(section.body);
        timeline.injectPriorityBadges(bodyEl);
      }

      if (cfg.chartKeywords || cfg.theme === "pipeline" || cfg.theme === "financial") {
        charts.renderChartsInSection(card, section.body, cfg.chartKeywords);
      }

      headerBtn.addEventListener("click", () => {
        const open = card.classList.toggle("is-open");
        headerBtn.setAttribute("aria-expanded", String(open));
        bodyEl.hidden = !open;
      });

      container.appendChild(card);
    });

    tables.enhanceTables(container);

    if (options.searchQuery) {
      highlightSearch(container, options.searchQuery);
    }
  }

  function buildQuickAnswer(text, container) {
    container.innerHTML = "";
    const card = document.createElement("article");
    card.className = "aiep-card aiep-theme-summary aiep-quick-answer is-open";
    card.innerHTML = `
      <div class="aiep-quick-header">
        ${icons.icon("file-text", 18)}
        <span>Tezkor javob</span>
      </div>
      <div class="aiep-quick-body"></div>
    `;
    const bodyEl = card.querySelector(".aiep-quick-body");
    bodyEl.innerHTML = markdown.render(text);
    container.appendChild(card);
  }

  function highlightSearch(container, query) {
    const q = query.trim();
    if (!q) {
      container.querySelectorAll(".aiep-search-hit").forEach((el) => {
        el.outerHTML = el.textContent;
      });
      return;
    }

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    const regex = new RegExp(`(${escapeRegex(q)})`, "gi");
    nodes.forEach((node) => {
      if (!node.nodeValue.trim() || node.parentElement?.closest(".aiep-card-header")) return;
      if (regex.test(node.nodeValue)) {
        const span = document.createElement("span");
        span.innerHTML = node.nodeValue.replace(regex, '<mark class="aiep-search-hit">$1</mark>');
        node.replaceWith(...span.childNodes);
      }
    });

    container.querySelectorAll(".aiep-card").forEach((card) => {
      if (card.querySelector(".aiep-search-hit")) {
        card.classList.add("is-open");
        card.querySelector(".aiep-card-body").hidden = false;
        card.querySelector(".aiep-card-header")?.setAttribute("aria-expanded", "true");
      }
    });
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.reportCards = { buildReportCards, buildQuickAnswer, highlightSearch };
})(typeof window !== "undefined" ? window : self);
