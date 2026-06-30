# Claude.ai Connector Setup — AI Executive Platform

This guide explains how to connect **Claude.ai** to your deployed **AI Executive Platform** so users can ask questions like:

> CEO, bugungi Bitrix24 holatini tahlil qil

Claude will call your platform tools and return live Bitrix24-based executive answers.

---

## Important requirements

### 1. Public URL is required

Claude.ai runs in Anthropic's cloud. It **cannot** call `localhost` or private networks.

You must deploy the FastAPI app to a public HTTPS URL:

```
https://ai-executive-platform-1.onrender.com
```

**Production Remote MCP URL (Claude.ai Custom Connector):**

```
https://ai-executive-platform-1.onrender.com/mcp
```

### 2. Local development

- Dashboard: `http://127.0.0.1:8000/`
- Connector health: `http://127.0.0.1:8000/claude/health`
- Connector manifest: `http://127.0.0.1:8000/claude/manifest`

These work locally for testing the API, but **Claude.ai cannot use them** until deployed publicly.

### 3. After Render deploy

Set your production base URL in Render environment variables:

```
PUBLIC_BASE_URL=https://ai-executive-platform-1.onrender.com
```

Then verify:

```bash
curl https://ai-executive-platform-1.onrender.com/mcp/health
curl https://ai-executive-platform-1.onrender.com/claude/health
curl https://ai-executive-platform-1.onrender.com/claude/manifest
```

---

## Available connector tools

| Tool | Method | Endpoint |
|------|--------|----------|
| `get_bitrix_summary` | GET | `/tools/bitrix/summary` |
| `run_ceo_agent` | POST | `/tools/agent/ceo` |
| `run_finance_agent` | POST | `/tools/agent/finance` |
| `run_sales_agent` | POST | `/tools/agent/sales` |
| `run_hr_agent` | POST | `/tools/agent/hr` |
| `run_marketing_agent` | POST | `/tools/agent/marketing` |
| `run_customer_success_agent` | POST | `/tools/agent/customer_success` |

Agent tools accept JSON body:

```json
{
  "question": "CEO, bugungi Bitrix24 holatini tahlil qil"
}
```

---

## Connector endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /mcp` | **Remote MCP JSON-RPC** (Claude.ai Custom Connector) |
| `GET /mcp/health` | MCP health (no secret required) |
| `GET /claude/health` | Legacy connector health |
| `GET /claude/manifest` | Legacy HTTP tool manifest |
| `GET /claude/instructions` | Instructions Claude should follow |
| `GET /public/claude-tools.json` | Static manifest file |

---

## Optional API protection

Set in Render (recommended for production):

```
CONNECTOR_SECRET=your-long-random-secret
```

When set, Claude (or any client) must send:

```
X-Connector-Secret: your-long-random-secret
```

Protected routes:

- `POST /mcp`
- `/tools/*`
- `/claude/*` except `/claude/health`

`/mcp/health` does not require the secret.

If `CONNECTOR_SECRET` is empty, local development works without the header.

**Never commit** `CONNECTOR_SECRET` to GitHub.

---

## Deploy on Render (summary)

1. Push code to GitHub (ensure `.env` is not committed).
2. Create Render Web Service from repo (`render.yaml` supported).
3. Set environment variables:
   - `BITRIX24_WEBHOOK_URL`
   - `ANTHROPIC_API_KEY`
   - `PUBLIC_BASE_URL=https://YOUR-APP.onrender.com`
   - `CONNECTOR_SECRET` (recommended)
4. Deploy and open `https://YOUR-APP.onrender.com/health`.

---

## Connect Claude.ai (Remote MCP — recommended)

### Step 1 — Verify MCP health

```bash
curl https://ai-executive-platform-1.onrender.com/mcp/health
```

### Step 2 — Add Custom Connector in Claude.ai

In Claude.ai → **Settings → Connectors → Add custom connector**:

| Field | Value |
|-------|-------|
| **Connector URL** | `https://ai-executive-platform-1.onrender.com/mcp` |
| **Header** (if `CONNECTOR_SECRET` is set) | `X-Connector-Secret: <your-secret>` |

### Step 3 — Test MCP initialize (optional)

```bash
curl -X POST https://ai-executive-platform-1.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -H "X-Connector-Secret: YOUR_SECRET" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}}}"
```

### Step 4 — Test in Claude chat

Example prompts:

- `CEO, bugungi Bitrix24 holatini tahlil qil`
- `Finance, pipeline moliyaviy xulosasini ber`
- `Sales, lidlar va bitimlar bo'yicha qisqa tahlil`

Claude calls `run_ceo_agent` (or the matching agent) via Remote MCP with your question.

---

## Legacy HTTP connector (optional)

### Step 1 — Verify connector

```bash
curl https://ai-executive-platform-1.onrender.com/claude/health
```

### Step 2 — Get manifest URL

```
https://ai-executive-platform-1.onrender.com/claude/manifest
```

### Step 3 — Add connector in Claude.ai

Use manifest URL: `https://ai-executive-platform-1.onrender.com/claude/manifest`

---

## Connect Claude.ai (legacy)

---

## Manual API test (without Claude.ai)

```bash
# Health
curl https://YOUR-APP.onrender.com/claude/health

# Manifest
curl https://YOUR-APP.onrender.com/claude/manifest

# Bitrix summary (with secret if configured)
curl -H "X-Connector-Secret: YOUR_SECRET" \
  https://YOUR-APP.onrender.com/tools/bitrix/summary

# CEO agent (uses Claude API on server — costs credits)
curl -X POST https://YOUR-APP.onrender.com/tools/agent/ceo \
  -H "Content-Type: application/json" \
  -H "X-Connector-Secret: YOUR_SECRET" \
  -d "{\"question\":\"CEO, bugungi Bitrix24 holatini tahlil qil\"}"
```

---

## Security checklist

- [ ] `.env` is gitignored
- [ ] `ANTHROPIC_API_KEY` only in Render env vars
- [ ] `BITRIX24_WEBHOOK_URL` only in Render env vars
- [ ] `CONNECTOR_SECRET` set in production
- [ ] `PUBLIC_BASE_URL` points to Render HTTPS URL
- [ ] No secrets in `README.md`, logs, or `public/claude-tools.json`

---

## Architecture

```
Claude.ai chat
      │
      ▼
POST /mcp  (JSON-RPC: initialize → tools/list → tools/call)
      │
      ▼
AI Executive Platform
  ├── Bitrix24 CRM (live data)
  ├── Agent Brain + Knowledge
  └── Claude API (server-side analysis)
      │
      ▼
Executive answer returned to Claude → user
```
