/**
 * Next Actions timeline renderer + priority badges
 */
(function (global) {
  "use strict";

  const { PRIORITY_PATTERNS } = global.AIEP.config;

  function detectPriority(text) {
    for (const { level, patterns } of PRIORITY_PATTERNS) {
      if (patterns.some((p) => p.test(text))) return level;
    }
    return null;
  }

  function parseActionItems(body) {
    const items = [];
    const lines = body.split("\n");

    lines.forEach((line) => {
      const trimmed = line.trim();
      const bullet = trimmed.match(/^[-*+]\s+(.+)/) || trimmed.match(/^\d+\.\s+(.+)/);
      if (bullet) {
        const text = bullet[1].replace(/^\[[ xX]\]\s*/, "");
        items.push({ text, priority: detectPriority(text), done: /^\[[xX]\]/.test(bullet[1]) });
      }
    });

    if (!items.length && body.trim()) {
      items.push({ text: body.trim(), priority: detectPriority(body), done: false });
    }

    return items;
  }

  function renderTimeline(container, body) {
    const items = parseActionItems(body);
    if (!items.length) return false;

    const ul = document.createElement("ul");
    ul.className = "aiep-timeline";

    items.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = `aiep-timeline-item${item.done ? " is-done" : ""}`;
      li.style.animationDelay = `${index * 50}ms`;

      let badge = "";
      if (item.priority) {
        badge = `<span class="aiep-priority aiep-priority-${item.priority}">${item.priority}</span>`;
      }

      li.innerHTML = `
        <div class="aiep-timeline-marker">${global.AIEP.icons.icon("clock", 14)}</div>
        <div class="aiep-timeline-content">
          ${badge}
          <p>${global.AIEP.markdown.parseInline(item.text)}</p>
        </div>
      `;
      ul.appendChild(li);
    });

    container.innerHTML = "";
    container.appendChild(ul);
    return true;
  }

  function injectPriorityBadges(container) {
    container.querySelectorAll("p, li").forEach((el) => {
      const text = el.textContent;
      const priority = detectPriority(text);
      if (!priority || el.querySelector(".aiep-priority")) return;
      const badge = document.createElement("span");
      badge.className = `aiep-priority aiep-priority-${priority}`;
      badge.textContent = priority;
      el.insertBefore(badge, el.firstChild);
    });
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.timeline = { renderTimeline, parseActionItems, injectPriorityBadges, detectPriority };
})(typeof window !== "undefined" ? window : self);
