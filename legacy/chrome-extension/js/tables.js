/**
 * Sortable, searchable responsive tables
 */
(function (global) {
  "use strict";

  function enhanceTables(container) {
    container.querySelectorAll("table.aiep-table").forEach((table) => {
      if (table.dataset.enhanced) return;
      table.dataset.enhanced = "true";

      const wrap = table.closest(".aiep-table-wrap");
      if (!wrap) return;

      const toolbar = document.createElement("div");
      toolbar.className = "aiep-table-toolbar";
      toolbar.innerHTML = `
        <input type="search" class="aiep-table-search" placeholder="Search table…" aria-label="Search table" />
        <button type="button" class="aiep-table-copy-btn" title="Jadvalni nusxalash">Nusxalash</button>
      `;
      wrap.insertBefore(toolbar, table);

      const searchInput = toolbar.querySelector(".aiep-table-search");
      searchInput.addEventListener("input", () => filterTable(table, searchInput.value));

      toolbar.querySelector(".aiep-table-copy-btn").addEventListener("click", () => {
        copyTable(table);
      });

      table.querySelectorAll("thead th").forEach((th, colIndex) => {
        th.classList.add("aiep-sortable");
        th.setAttribute("tabindex", "0");
        th.setAttribute("role", "columnheader");
        let asc = true;
        const sort = () => {
          sortTable(table, colIndex, asc);
          asc = !asc;
          table.querySelectorAll("th").forEach((h) => h.classList.remove("aiep-sorted-asc", "aiep-sorted-desc"));
          th.classList.add(asc ? "aiep-sorted-desc" : "aiep-sorted-asc");
        };
        th.addEventListener("click", sort);
        th.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            sort();
          }
        });
      });

      table.querySelectorAll("tbody tr").forEach((tr) => {
        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "aiep-row-copy";
        copyBtn.title = "Qatorni nusxalash";
        copyBtn.innerHTML = global.AIEP.icons.icon("copy", 14);
        copyBtn.addEventListener("click", () => {
          const cells = [...tr.querySelectorAll("td")].map((td) => td.textContent.trim());
          navigator.clipboard.writeText(cells.join("\t"));
        });
        const td = document.createElement("td");
        td.className = "aiep-row-actions";
        td.appendChild(copyBtn);
        tr.appendChild(td);
      });

      const actionTh = document.createElement("th");
      actionTh.className = "aiep-row-actions-header";
      actionTh.setAttribute("aria-label", "Row actions");
      table.querySelector("thead tr")?.appendChild(actionTh);
    });
  }

  function filterTable(table, query) {
    const q = query.toLowerCase().trim();
    table.querySelectorAll("tbody tr").forEach((tr) => {
      const text = tr.textContent.toLowerCase();
      tr.style.display = !q || text.includes(q) ? "" : "none";
    });
  }

  function sortTable(table, colIndex, asc) {
    const tbody = table.querySelector("tbody");
    const rows = [...tbody.querySelectorAll("tr")];
    rows.sort((a, b) => {
      const aText = a.children[colIndex]?.textContent.trim() || "";
      const bText = b.children[colIndex]?.textContent.trim() || "";
      const aNum = parseFloat(aText.replace(/[^0-9.-]/g, ""));
      const bNum = parseFloat(bText.replace(/[^0-9.-]/g, ""));
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return asc ? aNum - bNum : bNum - aNum;
      }
      return asc ? aText.localeCompare(bText) : bText.localeCompare(aText);
    });
    rows.forEach((r) => tbody.appendChild(r));
  }

  function copyTable(table) {
    const rows = [...table.querySelectorAll("tr")].map((tr) =>
      [...tr.querySelectorAll("th, td")]
        .filter((c) => !c.classList.contains("aiep-row-actions"))
        .map((c) => c.textContent.trim())
        .join("\t")
    );
    navigator.clipboard.writeText(rows.join("\n"));
  }

  global.AIEP = global.AIEP || {};
  global.AIEP.tables = { enhanceTables };
})(typeof window !== "undefined" ? window : self);
