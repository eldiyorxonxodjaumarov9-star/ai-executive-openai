# AI Executive Platform

Full-stack **Next.js** app — Claude.ai uslubidagi web chat + Bitrix24 + OpenAI.

**Contabo, Docker, FastAPI va Chrome Extension asosiy workflow emas.**

## Arxitektura

```
web/ (Next.js on Vercel)
├── app/              UI + API routes
├── lib/server/       Bitrix24, OpenAI, agents
├── prompts/          Agent system prompts
└── components/       Chat UI
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Platform holati |
| GET | `/api/test/bitrix` | Bitrix24 test |
| GET | `/api/test/openai` | OpenAI test |
| POST | `/api/chat/agent/{agent}` | Tezkor savol-javob |
| POST | `/api/tools/agent/{agent}` | To'liq hisobot |

## Vercel deploy

1. Import repo → **Root Directory: `web`**
2. Environment variables:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
BITRIX24_WEBHOOK_URL=https://your.bitrix24.uz/rest/1/token/
```

3. Deploy

## Local dev

```bash
cd web
cp .env.example .env.local
# Edit .env.local with your keys
npm install
npm run dev
```

Open http://localhost:3000

## Agentlar

CEO · Sales · Finance · HR · Marketing · Customer Success

- Oddiy savol → qisqa o'zbekcha javob (OpenAI + minimal CRM)
- To'liq hisobot → faqat maxsus kalit so'zlar yoki tugma

## Legacy backend

Python FastAPI (`app/`) va Docker optional — production uchun faqat `web/` ishlatiladi.
