# Claude.ai uchun: Rahbar AI tugmasi ochilmayapti — tuzatish topshirig'i

Quyidagi matnni Claude.ai chatiga to'liq nusxalab yuboring.

---

## MUAMMO

Chrome kengaytmasi `Rahbarlik AI platformasi` (MV3) `https://claude.ai/*` sahifasiga content script inject qiladi. Pastki o'ng burchakda **"Rahbar AI"** tugmasi (FAB) ko'rinadi, lekin bosilganda chat paneli ochilmaydi.

**Kutilgan:** FAB bosilganda o'ngdan `aside#aiep-panel` slide-in ochiladi.

**Haqiqat:** Tugma ko'rinadi, lekin hech narsa bo'lmaydi yoki panel bir marta ochilib yopiladi.

---

## LOYIHA

- **Repo:** `d:\AI AGENT CLUD\chrome-extension\`
- **Versiya:** 2.1.4
- **Backend:** `https://ai-executive-platform.onrender.com`
- **Maqsad:** claude.ai da Bitrix24 agentlar paneli (CEO, Sales, Finance, va h.k.)

---

## ARXITEKTURA (qisqa)

```
manifest.json → 19 ta JS modul + content.js + styles.css
content.js → boot() → new AIEP.ExecutiveDashboard().mount()
dashboard.js → DOM (#aiep-root, #aiep-fab, #aiep-panel) + bindEvents() + openPanel()
background.js → server API (agent tahlil — FAB ochish bilan bog'liq emas)
```

**FAB ochish zanjiri:**
1. `#aiep-fab` click
2. `content.js` FabGuard (capture phase) YOKI `dashboard.js` bindEvents listener
3. `openPanel()` → `#aiep-backdrop` va `#aiep-panel` ga `aiep-open` class qo'shiladi
4. CSS: `.aiep-panel.aiep-open { transform: translateX(0) }`

---

## ANIQLANGAN SABABLAR

### 1. `activeDashboard` null (asosiy)
`content.js` FabGuard faqat `window.AIEP.activeDashboard` mavjud bo'lsa ishlaydi. Agar mount yarim tugasa yoki DOM qayta yaratilsa, tugma ko'rinadi lekin handler yo'qoladi.

### 2. MutationObserver race (v2.1.3)
`claude.ai` SPA — `document.body` childList tez-tez o'zgaradi. `MutationObserver` `boot()` ni qayta chaqiradi, `#aiep-root` o'chiriladi, `activeDashboard = null`. Tugma qisqa vaqt ko'rinadi, click ishlamaydi.

### 3. CSS pointer-events (v2.1.2 da tuzatilgan)
`#aiep-root { pointer-events: none }` — faqat `.aiep-fab` va ochiq panel `pointer-events: auto`. Yopiq panel FAB ustida click ushlab qolishi mumkin edi (z-index teng bo'lsa).

### 4. `bindEvents()` throw
Agar `themeToggle`, `send` yoki boshqa element null bo'lsa, butun bindEvents yiqiladi. FAB listener oldin qo'shilgan bo'lishi kerak, lekin `data-aiep-bound` va `aiepReady` holati chalkashishi mumkin.

### 5. Kengaytma yangilanmagan
Foydalanuvchi kod yangilagan, lekin `chrome://extensions` da **Qayta yuklash** qilmagan — eski buzilgan `config.js` (syntax error) ishlayapti.

---

## MUHIM FAYLLAR

| Fayl | Vazifa |
|------|--------|
| `chrome-extension/content.js` | boot(), FabGuard, SPA watcher |
| `chrome-extension/js/dashboard.js` | ExecutiveDashboard, mount(), bindEvents(), openPanel() |
| `chrome-extension/js/config.js` | AGENT_REGISTRY — syntax error bo'lsa butun UI ishlamaydi |
| `chrome-extension/styles.css` | FAB, panel, pointer-events, z-index |
| `chrome-extension/manifest.json` | content_scripts tartibi (constants → ... → dashboard → content.js) |

---

## TEKSHIRISH (Console — F12 claude.ai da)

```javascript
// 1. Modullar yuklanganmi?
!!window.AIEP?.ExecutiveDashboard  // true bo'lishi kerak

// 2. Dashboard instance bormi?
!!window.AIEP?.activeDashboard     // true bo'lishi kerak

// 3. DOM elementlar
document.getElementById("aiep-fab")
document.getElementById("aiep-panel")
document.getElementById("aiep-root")?.dataset.aiepReady
document.getElementById("aiep-fab")?.dataset.aiepBound

// 4. Qo'lda ochish
document.getElementById("aiep-backdrop")?.classList.add("aiep-open");
document.getElementById("aiep-panel")?.classList.add("aiep-open");
// Panel ko'rinsa — muammo faqat click handlerda

// 5. Qo'lda openPanel
window.AIEP?.activeDashboard?.openPanel()
```

**Console xatolarni qidiring:** `[AIEP] mount xatosi`, `ExecutiveDashboard yuklanmadi`, `config.js`

---

## v2.1.4 DA QILINGAN TUZATISHLAR

1. FabGuard: `activeDashboard` bo'lmasa ham DOM orqali panel ochadi + `scheduleBoot()`
2. `__aiepMounting` flag — mount vaqtida qayta boot bloklanadi
3. `bindEvents()` — ixtiyoriy elementlar uchun `?.` (FAB dan keyin throw bo'lmasin)
4. `openPanel()` / `closePanel()` — DOM fallback

---

## SIZDAN SO'RALADIGAN TUZATISH

Agar v2.1.4 ham ishlamasa:

1. `content.js` va `dashboard.js` ni to'liq tekshiring — race condition qolganmi?
2. Shadow DOM yoki claude.ai overlay FAB ustida qolmayaptimi? (Elements → FAB ustidagi element)
3. Content script barcha `claude.ai` subroute larda inject bo'ladimi? (`/chat/`, `/new`, va h.k.)
4. Kerak bo'lsa FAB ni Shadow DOM ichiga ko'chiring — sahifa CSS dan izolyatsiya
5. `run_at: "document_start"` yoki `all_frames: false` sinab ko'ring

---

## FOYDALANUVCHI QADAMLARI

1. `chrome://extensions` → Rahbarlik AI → **Qayta yuklash** (v2.1.4)
2. `claude.ai` → **Ctrl+Shift+R** (hard refresh)
3. FAB bosing — panel ochilishi kerak
4. Popup dan ulanish kalitini saqlang (server CONNECTOR_SECRET talab qilsa — bu FAB ochishga ta'sir qilmaydi, faqat tahlil uchun)

---

## ULanish kaliti haqida

`CONNECTOR_SECRET` **faqat agent tahlil** uchun kerak. FAB ochilmasligi kalit bilan bog'liq **emas**. Kalit bo'lmasa "Tahlil qilish" bosilganda xato chiqadi, lekin panel ochilishi kerak.
