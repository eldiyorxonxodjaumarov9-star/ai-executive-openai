/**
 * GitHub-flavored Markdown renderer with XSS sanitization
 */
(function (global) {
  "use strict";

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sanitizeUrl(url) {
    const trimmed = (url || "").trim();
    if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
    return "#";
  }

  function parseInline(text) {
    let s = escapeHtml(text);
    s = s.replace(/`([^`]+)`/g, "<code class='aiep-inline-code'>$1</code>");
    s = s.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      return `<a href="${sanitizeUrl(url)}" target="_blank" rel="noopener noreferrer" class="aiep-link">${label}</a>`;
    });
    return s;
  }

  function parseTable(lines) {
    if (lines.length < 2) return "";
    const headerCells = lines[0]
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length);
    const bodyLines = lines.slice(2);
    let html =
      '<div class="aiep-table-wrap"><table class="aiep-table" data-sortable="true"><thead><tr>';
    headerCells.forEach((cell) => {
      html += `<th>${parseInline(cell)}</th>`;
    });
    html += "</tr></thead><tbody>";
    bodyLines.forEach((line) => {
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length);
      if (!cells.length) return;
      html += "<tr>";
      cells.forEach((cell) => {
        html += `<td>${parseInline(cell)}</td>`;
      });
      html += "</tr>";
    });
    html += "</tbody></table></div>";
    return html;
  }

  function render(markdown) {
    if (!markdown) return "";

    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let i = 0;
    let inCode = false;
    let codeLang = "";
    let codeBuf = [];
    let listType = null;
    let listItems = [];

    function flushList() {
      if (!listItems.length) return;
      const tag = listType === "ol" ? "ol" : "ul";
      const cls = listType === "check" ? "aiep-checklist" : "";
      html.push(`<${tag} class="aiep-md-list ${cls}">`);
      listItems.forEach((item) => {
        if (listType === "check") {
          const checked = /^\[[xX]\]/.test(item);
          const text = item.replace(/^\[[ xX]\]\s*/, "");
          html.push(
            `<li class="aiep-check-item${checked ? " is-checked" : ""}"><span class="aiep-check-box" aria-hidden="true"></span>${parseInline(text)}</li>`
          );
        } else {
          html.push(`<li>${parseInline(item)}</li>`);
        }
      });
      html.push(`</${tag}>`);
      listItems = [];
      listType = null;
    }

    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith("```")) {
        if (!inCode) {
          flushList();
          inCode = true;
          codeLang = line.slice(3).trim();
          codeBuf = [];
        } else {
          html.push(
            `<pre class="aiep-code-block"><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeBuf.join("\n"))}</code></pre>`
          );
          inCode = false;
        }
        i += 1;
        continue;
      }

      if (inCode) {
        codeBuf.push(line);
        i += 1;
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
        flushList();
        html.push("<hr class='aiep-hr' />");
        i += 1;
        continue;
      }

      if (line.startsWith("|") && line.includes("|")) {
        flushList();
        const tableLines = [line];
        i += 1;
        while (i < lines.length && lines[i].startsWith("|")) {
          tableLines.push(lines[i]);
          i += 1;
        }
        html.push(parseTable(tableLines));
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushList();
        const level = heading[1].length;
        html.push(`<h${level} class="aiep-heading aiep-h${level}">${parseInline(heading[2])}</h${level}>`);
        i += 1;
        continue;
      }

      if (line.startsWith(">")) {
        flushList();
        const quoteLines = [];
        while (i < lines.length && lines[i].startsWith(">")) {
          quoteLines.push(lines[i].replace(/^>\s?/, ""));
          i += 1;
        }
        html.push(`<blockquote class="aiep-blockquote">${quoteLines.map((q) => parseInline(q)).join("<br>")}</blockquote>`);
        continue;
      }

      const checkMatch = line.match(/^- \[[ xX]\] /);
      if (checkMatch) {
        if (listType !== "check") {
          flushList();
          listType = "check";
        }
        listItems.push(line.replace(/^- /, ""));
        i += 1;
        continue;
      }

      const ulMatch = line.match(/^[-*+]\s+(.+)/);
      if (ulMatch) {
        if (listType !== "ul") {
          flushList();
          listType = "ul";
        }
        listItems.push(ulMatch[1]);
        i += 1;
        continue;
      }

      const olMatch = line.match(/^\d+\.\s+(.+)/);
      if (olMatch) {
        if (listType !== "ol") {
          flushList();
          listType = "ol";
        }
        listItems.push(olMatch[1]);
        i += 1;
        continue;
      }

      if (!line.trim()) {
        flushList();
        i += 1;
        continue;
      }

      flushList();
      html.push(`<p class="aiep-p">${parseInline(line)}</p>`);
      i += 1;
    }

    flushList();
    if (inCode && codeBuf.length) {
      html.push(`<pre class="aiep-code-block"><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
    }

    return html.join("\n");
  }

  function splitSections(markdown) {
    const { SECTION_CONFIG } = global.AIEP.config;
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const sections = [];
    let current = { title: "Report", body: [], matched: null };

    function pushCurrent() {
      const body = current.body.join("\n").trim();
      if (body || current.matched) {
        sections.push({
          title: current.title,
          body,
          config: current.matched,
        });
      }
    }

    lines.forEach((line) => {
      const h2 = line.match(/^#{1,3}\s+(.+)$/);
      if (h2) {
        pushCurrent();
        const title = h2[1].trim();
        let matched = null;
        for (const cfg of SECTION_CONFIG) {
          if (cfg.patterns.some((p) => p.test(title))) {
            matched = cfg;
            break;
          }
        }
        current = { title: matched?.title || title, body: [], matched };
      } else {
        current.body.push(line);
      }
    });
    pushCurrent();

    if (sections.length === 1 && !sections[0].matched) {
      return [{ title: "Qisqacha xulosa", body: markdown, config: SECTION_CONFIG[0] }];
    }

    return sections;
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.markdown = { render, splitSections, parseInline, escapeHtml };
})(typeof window !== "undefined" ? window : self);
