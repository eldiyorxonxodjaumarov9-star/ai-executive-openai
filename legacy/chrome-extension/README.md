# AI Executive Platform — Chrome Extension (optional)

> **Asosiy interfeys:** Vercel web dashboard (`frontend/`). Extension majburiy emas — platforma extensionsiz to'liq ishlaydi.

Premium AI Executive overlay for [claude.ai](https://claude.ai) — same backend API as the web dashboard.

**Backend:** `https://ai-executive-platform.onrender.com`

---

## Features

### Executive Dashboard
- Premium side panel (Linear / Notion AI / Claude-inspired design)
- Rich Markdown report rendering (headings, tables, checklists, code, links)
- Auto-split executive report cards with themed colors
- Collapsible sections (Executive Summary open by default)
- Sticky header with agent, date, export actions
- In-report search with highlight
- Dark mode (Claude-compatible)
- Premium staged loading with skeleton UI

### Export
- PDF (print-ready with logo, footer, page numbers)
- DOCX download
- Copy Markdown
- Share

### Data Visualization
- Auto-generated charts (bar, line, pie, area) from report data
- Sortable, searchable responsive tables
- Next Actions timeline with priority badges

### Files & History
- Drag & drop upload (PDF, DOCX, XLSX, CSV, TXT)
- Attachment preview and remove
- IndexedDB report history with search and delete

### Status & Errors
- Backend Online / Sleeping / Offline indicator
- CRM Connected / Error indicator
- Executive-grade error messages with Retry

### Agents (extensible registry)
CEO · Finance · Sales · HR · Marketing · Customer Success  
+ future-ready: Legal, Procurement, Warehouse, Operations, Analytics, AI Research

---

## Folder tree

```
chrome-extension/
├── manifest.json          # MV3 v2.0.0
├── background.js          # API calls (health, agent, status, upload)
├── content.js             # Entry point
├── popup.html / popup.js  # Connector secret + Test backend
├── styles.css             # Premium design system
├── assets/
│   └── logo.svg
└── js/
    ├── secret-storage.js    # Permanent secret + migration
    ├── icons.js           # Lucide SVG icons
    ├── errors.js          # Executive error messages
    ├── history-db.js      # IndexedDB reports
    ├── state.js           # chrome.storage persistence
    ├── markdown.js        # GFM markdown renderer
    ├── report-cards.js    # Executive report cards
    ├── charts.js          # Canvas chart engine
    ├── tables.js          # Sortable/searchable tables
    ├── timeline.js        # Next actions timeline
    ├── export.js          # PDF, DOCX, copy, share
    ├── loading.js         # Staged loading UI
    ├── upload.js          # File upload handling
    ├── status-bar.js      # Backend & CRM status
    └── dashboard.js       # Main UI controller
```

---

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `chrome-extension/`
4. Open `https://claude.ai` → click **AI Executive** button

### Connector secret (save once)

1. Click extension icon → enter `X-Connector-Secret` → **Save**
2. Stored permanently in `chrome.storage.local` as `connectorSecret`
3. Survives extension reload, panel refresh, page refresh, and version updates
4. **Clear secret** in popup is the only way to remove it — history delete does not clear secret
5. Legacy keys (`secret`, `connector_secret`, `xConnectorSecret`) auto-migrate to `connectorSecret`

### Reload / update after Cursor changes

1. Extension popup → **Update / Reload Extension**
2. **Open Extensions Page** → click **Reload** on AI Executive Platform
3. Refresh `claude.ai` tab
4. In panel → **Refresh panel** (↻) if status is stale

No need to remove and Load unpacked again unless the folder path changed.

### Panel refresh (↻ in header)

Re-checks status, restores agent + last report + history. Does not touch connector secret.

### Long agent reports (Port connection)

Agent analysis uses a **long-lived Port** (`chrome.runtime.connect({ name: "aiep-agent" })`) instead of `sendMessage`, so MV3 service worker stays alive during up to 360 second Claude/report requests.

Short actions still use `sendMessage`:
- `TEST_HEALTH`
- `CHECK_STATUS`

After code changes: popup → **Update / Reload Extension** → Reload at `chrome://extensions` → refresh `claude.ai`.

---

## APIs used (unchanged)

```
GET  /health
GET  /tools/bitrix/summary   (CRM status)
POST /tools/agent/{agent}    (with optional attachments[])
POST /mcp                    (unchanged, not called by extension)
```

---

## New dependencies

All self-contained — **no npm build required**:
- Custom Markdown renderer (GFM subset)
- Lucide-style inline SVG icons
- Canvas chart engine (Chart.js-compatible subset)
- IndexedDB for history
- Native browser APIs for PDF (print) and DOCX (HTML blob)

Optional future upgrade: add `lib/marked.min.js`, `lib/chart.umd.min.js`, `lib/jspdf.umd.min.js` for enhanced rendering.

---

## Performance

- Lazy chart rendering via `requestAnimationFrame`
- Section cards render on demand (collapsed sections skip layout)
- IndexedDB async writes don't block UI
- Status polling every 60s (not on every action)
- CSS animations respect `prefers-reduced-motion`

---

## Changed files (v2.0.0)

| File | Status |
|------|--------|
| `manifest.json` | Modified — v2.0.0, modular JS |
| `content.js` | Rewritten — thin bootstrap |
| `background.js` | Modified — attachments, CHECK_STATUS |
| `styles.css` | Rewritten — premium design system |
| `js/*.js` (14 files) | **New** |
| `assets/logo.svg` | **New** |
| `app/routers/claude_tools.py` | Modified — optional attachments |

---

## Backend attachment support

```json
POST /tools/agent/ceo
{
  "question": "Analyze this document",
  "attachments": [
    { "name": "report.csv", "content": "...", "mime_type": "text/csv" }
  ]
}
```

Backward compatible — `attachments` defaults to `[]`.
