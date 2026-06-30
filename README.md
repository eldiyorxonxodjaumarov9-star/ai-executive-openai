# Bitrix24 + Claude + Telegram Integration Server

Production-ready FastAPI server that connects **Bitrix24 CRM**, **Anthropic Claude AI agents**, and **Telegram** notifications. Designed for CEO and department-level business analysis in Uzbek, with MCP-ready tool definitions for Claude/agent integrations.

## Features

- **Bitrix24 REST API** — fetch leads, deals, contacts, and tasks (normalized JSON)
- **6 AI Agents** — CEO, Sales, Finance, Marketing, Customer Success, HR
- **Claude API** — agent-specific prompts + CRM data → structured Uzbek analysis
- **Telegram Bot** — send reports with automatic long-message splitting
- **Scheduler** — daily automated reports (configurable timezone)
- **Webhooks** — Bitrix24 outgoing webhook endpoint for realtime triggers
- **MCP-ready** — `GET /mcp/tools` exposes tool catalog for agent integrations
- **Docker** — containerized deployment with health checks

## Project Structure

```
app/
  main.py              # FastAPI routes
  config.py            # Pydantic settings
  services/
    bitrix.py          # Bitrix24 REST client
    claude.py          # Anthropic Claude client
    telegram.py        # Telegram Bot client
  agents/
    runner.py          # Agent orchestration pipeline
  scheduler/
    jobs.py            # Daily report scheduler
  mcp/
    tools.py           # MCP tool definitions
  utils/
    logger.py          # Logging setup
prompts/
  ceo.md               # Agent system prompts
  sales.md
  finance.md
  marketing.md
  customer_success.md
  hr.md
```

## Quick Start (Local)

### 1. Prerequisites

- Python 3.11+
- Bitrix24 portal with incoming webhook
- Anthropic API key
- Telegram bot token and chat ID

### 2. Install

```bash
git clone <your-repo>
cd bitrix24-claude-telegram

python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
```

### 3. Run

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Open API docs: http://localhost:8000/docs

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BITRIX24_WEBHOOK_URL` | Yes | Bitrix24 incoming webhook URL |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `TELEGRAM_BOT_TOKEN` | No | Optional — omit to disable Telegram |
| `TELEGRAM_CHAT_ID` | No | Optional — omit to disable Telegram |
| `CLAUDE_MODEL` | No | Default: `claude-sonnet-4-6` |
| `CONNECTOR_SECRET` | No | Protect `/tools/*` and `/claude/*` in production |
| `PUBLIC_BASE_URL` | No | Public URL for connector manifest (e.g. `https://your-app.onrender.com`) |
| `DAILY_REPORT_ENABLED` | No | Enable scheduler (default: `true`) |
| `DAILY_REPORT_HOUR` | No | Hour in 24h format (default: `9`) |
| `DAILY_REPORT_TIMEZONE` | No | Default: `Asia/Tashkent` |
| `DAILY_REPORT_AGENT` | No | Default: `ceo` |

See `.env.example` for the full list.

## Bitrix24 Setup

1. Log in to your Bitrix24 portal as administrator.
2. Go to **Applications → Webhooks → Incoming webhook**.
3. Create a webhook with permissions:
   - `crm` (leads, deals, contacts)
   - `task` (optional, for tasks)
4. Copy the webhook URL (format: `https://your-domain.bitrix24.com/rest/1/xxxxx/`).
5. Set `BITRIX24_WEBHOOK_URL` in `.env`.

### Outgoing Webhook (optional, realtime)

1. Go to **Applications → Webhooks → Outgoing webhook**.
2. Set handler URL: `https://your-server.com/webhooks/bitrix`
3. Select CRM events (e.g. `ONCRMDEALADD`, `ONCRMLEADADD`).
4. On each event, the server runs the CEO agent and sends a Telegram report.

## Anthropic API Key

1. Sign up at [console.anthropic.com](https://console.anthropic.com).
2. Create an API key under **API Keys**.
3. Set `ANTHROPIC_API_KEY` in `.env`.

## Telegram Bot Setup

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot` and follow instructions.
3. Copy the bot token → `TELEGRAM_BOT_TOKEN`.
4. Add the bot to your target group/channel.
5. Get chat ID:
   - Send a message in the group.
   - Visit: `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Find `"chat":{"id":...}` → `TELEGRAM_CHAT_ID`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | AI Chat Dashboard |
| `GET` | `/health` | Health check (used by Render) |
| `GET` | `/claude/health` | Claude connector health |
| `GET` | `/claude/manifest` | Claude connector tool manifest |
| `GET` | `/claude/instructions` | Claude connector usage instructions |
| `GET` | `/public/claude-tools.json` | Static connector manifest file |
| `POST` | `/reports/daily` | Trigger daily report |
| `POST` | `/reports/agent/{agent_name}` | Run specific agent report |
| `POST` | `/webhooks/bitrix` | Bitrix24 outgoing webhook |
| `POST` | `/telegram/send-test` | Send test Telegram message |
| `GET` | `/tools/manifest` | Claude tool manifest |
| `GET` | `/tools/bitrix/summary` | Bitrix24 summary tool |
| `POST` | `/tools/agent/{agent_name}` | Agent analysis with question |
| `GET` | `/mcp/tools` | MCP tool catalog |
| `GET` | `/agents` | List available agents |
| `GET` | `/bitrix/crm` | Fetch raw CRM snapshot |

### Agent names

`ceo`, `sales`, `finance`, `marketing`, `customer_success`, `hr`

### Example: Run CEO report

```bash
curl -X POST http://localhost:8000/reports/agent/ceo \
  -H "Content-Type: application/json" \
  -d '{"send_telegram": true}'
```

### Example: Test Telegram

```bash
curl -X POST http://localhost:8000/telegram/send-test \
  -H "Content-Type: application/json" \
  -d '{"message": "Test xabar"}'
```

## Docker

```bash
cp .env.example .env
# Edit .env

docker compose up --build -d
```

Or without compose:

```bash
docker build -t bitrix24-claude-telegram .
docker run -d --env-file .env -p 8000:8000 bitrix24-claude-telegram
```

## Deploy to Render

This project includes `render.yaml` (Render Blueprint), `Procfile`, and `runtime.txt` for production deployment.

### Production safety

- **Never commit `.env`** — it is listed in `.gitignore`. Use `.env.example` as a template only.
- **Set secrets in the Render dashboard** — add `BITRIX24_WEBHOOK_URL`, `ANTHROPIC_API_KEY`, `PUBLIC_BASE_URL`, and `CONNECTOR_SECRET` as environment variables, not in code.
- **Mask API keys** — do not paste real keys into GitHub, README, logs, or screenshots. Use placeholders like `sk-ant-***` when sharing.
- **Rotate keys** if they were ever committed or exposed.
- **Use HTTPS** — Render provides TLS automatically on `*.onrender.com` URLs.

### Render deployment (step-by-step)

#### 1. Push code to GitHub

```bash
git init
git add .
git commit -m "Prepare FastAPI app for Render deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

Confirm `.env` is **not** tracked:

```bash
git status
# .env should not appear in staged/untracked files to commit
```

#### 2. Create a Render account

1. Go to [render.com](https://render.com) and sign up.
2. Connect your GitHub account.

#### 3. Deploy with Blueprint (`render.yaml`)

1. In Render, click **New +** → **Blueprint**.
2. Connect the repository.
3. Render detects `render.yaml` and shows the `bitrix24-claude-api` web service.
4. Click **Apply**.

#### 4. Or deploy manually (without Blueprint)

1. Click **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Configure:
   - **Name:** `bitrix24-claude-api`
   - **Runtime:** Python 3
   - **Build Command:** `pip install --upgrade pip && pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path:** `/health`

#### 5. Set environment variables in Render

In **Environment** → **Environment Variables**, add:

| Key | Required | Example / notes |
|-----|----------|-----------------|
| `BITRIX24_WEBHOOK_URL` | Yes | `https://your-domain.bitrix24.uz/rest/1/xxx/` |
| `ANTHROPIC_API_KEY` | Yes | `sk-ant-api03-...` (keep secret) |
| `TELEGRAM_BOT_TOKEN` | No | Optional — omit to disable Telegram |
| `TELEGRAM_CHAT_ID` | No | Optional — omit to disable Telegram |
| `APP_ENV` | No | `production` |
| `DEBUG` | No | `false` |
| `CLAUDE_MODEL` | No | `claude-sonnet-4-6` |
| `CONNECTOR_SECRET` | No | Recommended in production; sent as `X-Connector-Secret` header |
| `PUBLIC_BASE_URL` | No | `https://YOUR-SERVICE.onrender.com` for connector manifest URLs |
| `DAILY_REPORT_ENABLED` | No | `false` recommended on free tier |

Render injects `PORT` automatically — do not hardcode it.

#### 6. Deploy and verify

1. Click **Deploy** (or wait for auto-deploy after push).
2. Open your service URL: `https://bitrix24-claude-api.onrender.com`
3. Verify health:

```bash
curl https://YOUR-SERVICE.onrender.com/health
```

Expected:

```json
{
  "status": "ok",
  "app_name": "Bitrix24 Claude Integration",
  "environment": "production",
  "agents": ["ceo", "customer_success", "finance", "hr", "marketing", "sales"],
  "daily_report_enabled": false
}
```

4. Verify Claude tools manifest:

```bash
curl https://YOUR-SERVICE.onrender.com/tools/manifest
```

#### 7. Connect Claude.ai / Bitrix24 webhooks

- **Claude connector base URL:** `https://YOUR-SERVICE.onrender.com`
- **Connector manifest:** `https://YOUR-SERVICE.onrender.com/claude/manifest`
- **Connector health:** `https://YOUR-SERVICE.onrender.com/claude/health`
- **Bitrix24 outgoing webhook (optional):** `https://YOUR-SERVICE.onrender.com/webhooks/bitrix`

See [docs/CLAUDE_CONNECTOR_SETUP.md](docs/CLAUDE_CONNECTOR_SETUP.md) for full Claude.ai connector setup.

### Test connector endpoints (no Claude API cost)

```bash
curl https://YOUR-SERVICE.onrender.com/health
curl https://YOUR-SERVICE.onrender.com/claude/health
curl https://YOUR-SERVICE.onrender.com/claude/manifest
curl https://YOUR-SERVICE.onrender.com/claude/instructions
```

If `CONNECTOR_SECRET` is set, add header to protected routes:

```bash
curl -H "X-Connector-Secret: YOUR_SECRET" \
  https://YOUR-SERVICE.onrender.com/tools/bitrix/summary
```

### Use from Claude.ai

1. Deploy to Render and set `PUBLIC_BASE_URL`.
2. In Claude.ai, add connector with manifest URL: `https://YOUR-SERVICE.onrender.com/claude/manifest`
3. Configure `X-Connector-Secret` if `CONNECTOR_SECRET` is set.
4. Ask in chat: `CEO, bugungi Bitrix24 holatini tahlil qil`

Claude calls `POST /tools/agent/ceo` with your question and returns the executive answer.

### Render files in this repo

| File | Purpose |
|------|---------|
| `render.yaml` | Render Blueprint — build/start commands and env template |
| `Procfile` | Process definition (`web: uvicorn ...`) |
| `runtime.txt` | Python version pin (`3.11.11`) |
| `requirements.txt` | Python dependencies |

### Start command (production)

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Deploy to Railway

1. Push code to GitHub.
2. Create a new project on [Railway](https://railway.app).
3. Deploy from GitHub repo.
4. Add environment variables from `.env.example`.
5. Railway auto-detects Dockerfile, or set start command:
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Generate a public domain under **Settings → Networking**.

## Claude.ai Connector

The platform exposes a connector API for Claude.ai chat integrations:

| Endpoint | Description |
|----------|-------------|
| `GET /claude/health` | Connector health (no auth required) |
| `GET /claude/manifest` | Tool manifest with absolute URLs |
| `GET /claude/instructions` | Instructions for Claude behavior |
| `GET /public/claude-tools.json` | Static manifest template |

**Tools available to Claude:**

- `get_bitrix_summary` — `GET /tools/bitrix/summary`
- `run_ceo_agent` — `POST /tools/agent/ceo` with `{"question": "..."}`
- `run_finance_agent` — `POST /tools/agent/finance`
- `run_sales_agent` — `POST /tools/agent/sales`
- `run_hr_agent` — `POST /tools/agent/hr`
- `run_marketing_agent` — `POST /tools/agent/marketing`
- `run_customer_success_agent` — `POST /tools/agent/customer_success`

Full setup guide: [docs/CLAUDE_CONNECTOR_SETUP.md](docs/CLAUDE_CONNECTOR_SETUP.md)

## MCP Integration

The server exposes MCP-compatible tool schemas at `GET /mcp/tools`:

- `fetch_bitrix_crm_data` — pull CRM data
- `run_agent_report` — run agent analysis
- `send_telegram_message` — send Telegram message
- `list_agents` — list available agents

Use these schemas when wiring Claude Desktop, Cursor, or custom MCP servers to this API.

## Architecture

```
Bitrix24 CRM ──► FastAPI Server ──► Claude API
                      │                  │
                      │                  ▼
                      │            Agent Analysis
                      │            (Uzbek report)
                      ▼
                 Telegram Bot ──► CEO / Team Chat
```

## License

MIT
