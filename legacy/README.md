# Legacy code (not used in production)

Vercel `web/` ilovasi production uchun yagona manba.

| Papka / fayl | Tavsif |
|--------------|--------|
| `app/` | Eski FastAPI backend (Render) |
| `chrome-extension/` | Chrome kengaytma |
| `frontend/` | Vite React (Render API client) |
| `public/` | FastAPI static dashboard |
| `render.yaml` | Render deploy |
| `requirements.txt` | Python dependencies |
| `Dockerfile` | Docker image |
| `scripts/` | Python test skriptlari |
| `brains/`, `prompts/` | Agent bilim bazasi (nusxa `web/prompts/` da) |

Bu kodlar arxiv uchun saqlangan — Vercel build ularga bog'liq emas.
