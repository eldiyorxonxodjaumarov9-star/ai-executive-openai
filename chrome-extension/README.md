# AI Executive Platform — Chrome Extension

Use AI Executive agents **inside [claude.ai](https://claude.ai)** while Claude Custom Connectors are unavailable.

This extension injects a floating **AI Agent** panel on `claude.ai`. It only sends **your typed question** to the HARIDLAR.UZ backend — it does **not** read Claude conversations, cookies, or tokens.

**Backend:** `https://ai-executive-platform-1.onrender.com`

---

## Features

- Floating **AI Agent** button on claude.ai
- Side panel with 6 executive agents (CEO, Finance, Sales, HR, Marketing, Customer Success)
- Live Bitrix24 analysis via backend API
- Optional `X-Connector-Secret` (saved in `chrome.storage` only)
- Copy answer / Clear controls

---

## Install (Load unpacked)

1. Open Chrome and go to:
   ```
   chrome://extensions
   ```

2. Enable **Developer mode** (top-right toggle).

3. Click **Load unpacked**.

4. Select this folder:
   ```
   chrome-extension/
   ```
   (the folder containing `manifest.json`)

5. Confirm the extension **AI Executive Platform** appears in the list.

6. Open:
   ```
   https://claude.ai/new
   ```

7. Click the **AI Agent** button (bottom-right).

8. Select an agent, type your question, click **Send**.

---

## Set connector secret (if required)

If your Render backend has `CONNECTOR_SECRET` configured:

1. Click the extension icon in the Chrome toolbar.
2. Enter your connector secret.
3. Click **Save**.

The secret is stored locally via `chrome.storage` and sent as:

```
X-Connector-Secret: <your-secret>
```

If no secret is saved, requests are sent without the header (works only when `CONNECTOR_SECRET` is empty on the server).

---

## Test inside Claude

1. Go to `https://claude.ai/new`
2. Click **AI Agent** (floating button, bottom-right)
3. Select **CEO Agent**
4. Type:
   ```
   CEO, bugungi Bitrix24 holatini tahlil qil
   ```
5. Click **Send**
6. Wait for **AI tahlil qilmoqda...**
7. Read the answer in the panel → **Copy answer** if needed

**Keyboard shortcut:** `Ctrl+Enter` (or `Cmd+Enter` on Mac) to send.

---

## API used

```
POST https://ai-executive-platform-1.onrender.com/tools/agent/{agent_name}
Content-Type: application/json
X-Connector-Secret: <optional>

{
  "question": "..."
}
```

Agents: `ceo`, `finance`, `sales`, `hr`, `marketing`, `customer_success`

---

## Privacy

- Does **not** modify Claude's internal code
- Does **not** steal cookies, tokens, or account data
- Does **not** read private Claude conversation content
- Only sends the question you type in the extension panel

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Unauthorized` | Set connector secret in extension popup |
| Button not visible | Refresh `claude.ai` page; check extension is enabled |
| CORS / network error | Confirm backend is live: `/health` |
| Slow response | Agent calls Claude API on server — may take 30–60s |

---

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Manifest V3 config |
| `content.js` | Injects panel on claude.ai |
| `styles.css` | Panel styling |
| `popup.html` / `popup.js` | Connector secret settings |
| `README.md` | This guide |
