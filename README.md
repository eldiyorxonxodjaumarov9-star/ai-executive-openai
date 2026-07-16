# AI Executive Platform

**Production:** faqat [Vercel](https://vercel.com) — `web/` papkasidagi Next.js ilova.

```
Foydalanuvchi → Vercel → Bitrix24 → OpenAI → qisqa o'zbekcha javob
```

## Tez boshlash

| Qadam | Qiymat |
|-------|--------|
| **Root Directory** | `web` |
| **Build Command** | `npm run build` |
| **Framework** | Next.js |

### Vercel Environment Variables

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
BITRIX24_WEBHOOK_URL=https://your.bitrix24.uz/rest/1/token/
```

Batafsil: [`web/README.md`](web/README.md)

## Legacy

Eski FastAPI (Render), Chrome extension va MCP kodlari `legacy/` papkasida saqlangan — production build ularga bog'liq emas.

## Mahalliy test

```bash
cd web
npm install
npm run dev
```
