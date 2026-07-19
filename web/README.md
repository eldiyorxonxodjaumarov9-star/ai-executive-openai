# AI Executive Platform — Vercel

Tezkor, mobilga mos AI chat: Bitrix24 + OpenAI.

## Arxitektura

```
Brauzer → Next.js (Vercel) → Bitrix24 REST → OpenAI Responses API → o'zbekcha javob
```

Render, Claude, Chrome extension va MCP **ishlatilmaydi**.

## Vercel deploy

1. GitHub repoga ulang
2. **Root Directory:** `web`
3. **Framework:** Next.js (avtomatik)
4. **Build Command:** `npm run build` (default)
5. **Output:** Next.js default

### Environment Variables

| O'zgaruvchi | Majburiy | Tavsif |
|-------------|----------|--------|
| `OPENAI_API_KEY` | Ha | OpenAI API kaliti |
| `OPENAI_MODEL` | Yo'q | Default: `gpt-4o-mini` |
| `BITRIX24_WEBHOOK_URL` | Ha | Bitrix24 incoming webhook |
| `OPENAI_QUICK_MAX_TOKENS` | Yo'q | Default: `800` |

Kalitlar faqat serverda — frontendga chiqmaydi.

## Mahalliy ishga tushirish

```bash
cd web
cp .env.example .env.local
# .env.local ni to'ldiring
npm install
npm run dev
```

http://localhost:3000

## API

| Method | Path | Vazifa |
|--------|------|--------|
| GET | `/api/health` | Holat |
| GET | `/api/test/openai` | OpenAI test |
| GET | `/api/test/bitrix` | Bitrix24 test |
| POST | `/api/chat/agent/{agent}` | Tezkor javob |

Agentlar: `ceo`, `finance`, `sales`, `hr`, `marketing`, `customer_success`

## Test

```bash
cd web
npm run build
npm run start
```

- Bosh sahifa 200
- Agent tanlash
- "Salom" — tez javob, CRM yuklanmasin
- Sotuv/vazifa savollari — faqat tegishli CRM
