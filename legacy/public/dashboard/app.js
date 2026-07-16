const AGENTS = [
  { id: "ceo", label: "Bosh direktor" },
  { id: "sales", label: "Sotuv" },
  { id: "finance", label: "Moliya" },
  { id: "hr", label: "Kadrlar" },
  { id: "marketing", label: "Marketing" },
  { id: "customer_success", label: "Mijozlar muvaffaqiyati" },
];

const STORAGE_PREFIX = "aiep_chat_";
const SECRET_KEY = "aiep_connector_secret";

const state = {
  activeAgent: "ceo",
  loading: false,
  lastAnswer: "",
};

const els = {
  agentList: document.getElementById("agent-list"),
  activeLabel: document.getElementById("active-agent-label"),
  messages: document.getElementById("chat-messages"),
  input: document.getElementById("message-input"),
  sendBtn: document.getElementById("send-btn"),
  fullReportBtn: document.getElementById("full-report-btn"),
  clearBtn: document.getElementById("clear-chat"),
  loading: document.getElementById("loading"),
  loadingText: document.getElementById("loading-text"),
  error: document.getElementById("error"),
  statusBadge: document.getElementById("status-badge"),
  secret: document.getElementById("connector-secret"),
  saveSecret: document.getElementById("save-secret"),
  exportBar: document.getElementById("export-bar"),
  copyBtn: document.getElementById("copy-btn"),
};

function chatKey(agentId) {
  return `${STORAGE_PREFIX}${agentId}`;
}

function agentLabel(id) {
  return AGENTS.find((a) => a.id === id)?.label || id;
}

function headers() {
  const h = { "Content-Type": "application/json" };
  const secret = localStorage.getItem(SECRET_KEY);
  if (secret) h["X-Connector-Secret"] = secret;
  return h;
}

function parseApiError(status, body) {
  try {
    const data = JSON.parse(body);
    const detail = data?.detail;
    if (typeof detail === "object" && detail?.message) {
      return sanitizeUserError(detail.message);
    }
    const raw = data?.error || data?.message || `Server xatosi (${status})`;
    return sanitizeUserError(raw);
  } catch {
    return `Server xatosi (${status})`;
  }
}

function sanitizeUserError(message) {
  const text = String(message || "").toLowerCase();
  if (text.includes("claude") || text.includes("anthropic") || text.includes("authentication")) {
    return "OpenAI bilan javob olishda xato yuz berdi — keyinroq qayta urinib ko'ring.";
  }
  if (text.includes("timeout") || text.includes("vaqti tugadi")) {
    return "OpenAI javobi vaqti tugadi — qayta urinib ko'ring.";
  }
  if (text.includes("openai")) {
    return String(message);
  }
  return "OpenAI bilan javob olishda xato yuz berdi — keyinroq qayta urinib ko'ring.";
}

function simpleMarkdown(text) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  html = html.replace(/\n\n/g, "</p><p>");
  html = `<p>${html}</p>`;
  return html;
}

function loadChat(agentId) {
  try {
    const raw = localStorage.getItem(chatKey(agentId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveChat(agentId, messages) {
  localStorage.setItem(chatKey(agentId), JSON.stringify(messages));
}

function setLoading(on, text) {
  state.loading = on;
  els.loading.classList.toggle("hidden", !on);
  els.loadingText.textContent = text || "Javob tayyorlanmoqda...";
  els.sendBtn.disabled = on;
  els.fullReportBtn.disabled = on;
  els.input.disabled = on;
}

function setError(msg) {
  if (!msg) {
    els.error.textContent = "";
    els.error.classList.add("hidden");
    return;
  }
  els.error.textContent = msg;
  els.error.classList.remove("hidden");
}

function appendBubble(role, text, mode) {
  const wrap = document.createElement("div");
  wrap.className = `bubble ${role}`;

  if (role === "assistant" && mode) {
    const tag = document.createElement("span");
    tag.className = "mode-tag";
    tag.textContent = mode === "full_report" ? "To'liq hisobot" : "Tezkor javob";
    wrap.appendChild(tag);
  }

  const body = document.createElement("div");
  if (role === "assistant") {
    body.innerHTML = simpleMarkdown(text);
  } else {
    body.textContent = text;
  }
  wrap.appendChild(body);
  els.messages.appendChild(wrap);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function renderChat() {
  const messages = loadChat(state.activeAgent);
  els.messages.innerHTML = "";
  if (!messages.length) {
    const hint = document.createElement("div");
    hint.className = "empty-hint";
    hint.textContent =
      "Savolingizni yozing — masalan: Leadlar nechta? Bugun qancha sotuv bo'ldi?";
    els.messages.appendChild(hint);
    els.exportBar.classList.add("hidden");
    return;
  }
  messages.forEach((m) => appendBubble(m.role, m.text, m.mode));
  const last = [...messages].reverse().find((m) => m.role === "assistant");
  if (last) {
    state.lastAnswer = last.text;
    els.exportBar.classList.remove("hidden");
  }
}

function persist(role, text, mode) {
  const messages = loadChat(state.activeAgent);
  messages.push({ role, text, mode, ts: Date.now() });
  saveChat(state.activeAgent, messages);
}

function switchAgent(agentId) {
  state.activeAgent = agentId;
  els.activeLabel.textContent = `${agentLabel(agentId)} agenti`;
  document.querySelectorAll(".agent-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.agent === agentId);
  });
  setError("");
  renderChat();
}

async function quickChat(agent, question) {
  const res = await fetch(`/chat/agent/${agent}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ question }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(parseApiError(res.status, text));
  const data = JSON.parse(text);
  if (!data.success) throw new Error(data.error || "Javob olinmadi");
  return data.answer || "Ma'lumot yetarli emas.";
}

async function fullReport(agent, question, onProgress) {
  onProgress("Vazifa yaratilmoqda...");
  const startRes = await fetch(`/tools/agent/${agent}?async=1`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ question, attachments: [] }),
  });
  const startText = await startRes.text();
  if (!startRes.ok) throw new Error(parseApiError(startRes.status, startText));
  const start = JSON.parse(startText);
  if (!start.success) throw new Error(start.error || "Hisobot boshlanmadi");

  const jobId = start.data?.job_id;
  if (!jobId) throw new Error("Server vazifa identifikatorini qaytarmadi.");

  const deadline = Date.now() + 480000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    onProgress("Hisobot tayyorlanmoqda...");
    const pollRes = await fetch(`/tools/agent/jobs/${jobId}`, {
      method: "GET",
      headers: headers(),
    });
    const pollText = await pollRes.text();
    if (!pollRes.ok) continue;
    const poll = JSON.parse(pollText);
    if (!poll.success) continue;
    const job = poll.data;
    if (job?.status === "completed" && job.result) {
      return (
        job.result?.data?.answer ||
        job.result?.answer ||
        "Ma'lumot yetarli emas."
      );
    }
    if (job?.status === "failed") {
      throw new Error(job.error || "Hisobot muvaffaqiyatsiz");
    }
  }
  throw new Error("Hisobot vaqti tugadi — qayta urinib ko'ring.");
}

async function sendMessage(mode) {
  if (state.loading) return;
  const question = els.input.value.trim();
  if (!question) return;

  setError("");
  const hint = els.messages.querySelector(".empty-hint");
  if (hint) hint.remove();

  persist("user", question, mode);
  appendBubble("user", question);
  els.input.value = "";
  setLoading(true, mode === "full_report" ? "To'liq hisobot tayyorlanmoqda..." : "Javob tayyorlanmoqda...");

  try {
    const answer =
      mode === "full_report"
        ? await fullReport(state.activeAgent, question, (t) => setLoading(true, t))
        : await quickChat(state.activeAgent, question);

    persist("assistant", answer, mode);
    appendBubble("assistant", answer, mode);
    state.lastAnswer = answer;
    els.exportBar.classList.remove("hidden");
  } catch (err) {
    setError(err.message || "Kutilmagan xato");
  } finally {
    setLoading(false);
  }
}

async function checkHealth() {
  try {
    const res = await fetch("/health");
    const data = await res.json();
    if (!res.ok) throw new Error("offline");
    const provider = data.ai_provider || "?";
    const configured = data.ai_configured;
    if (provider === "none") {
      els.statusBadge.textContent = "CRM shablon rejimi";
      els.statusBadge.className = "badge ok";
    } else if (configured) {
      els.statusBadge.textContent = `Server ulandi · ${provider}`;
      els.statusBadge.className = "badge ok";
    } else {
      els.statusBadge.textContent = `AI sozlanmagan · ${provider}`;
      els.statusBadge.className = "badge warn";
    }
  } catch {
    els.statusBadge.textContent = "Server offline";
    els.statusBadge.className = "badge err";
  }
}

function initAgents() {
  AGENTS.forEach((agent) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "agent-btn";
    btn.dataset.agent = agent.id;
    btn.textContent = agent.label;
    btn.addEventListener("click", () => switchAgent(agent.id));
    els.agentList.appendChild(btn);
  });
}

els.sendBtn.addEventListener("click", () => sendMessage("quick_answer"));
els.fullReportBtn.addEventListener("click", () => sendMessage("full_report"));
els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage("quick_answer");
  }
});
els.clearBtn.addEventListener("click", () => {
  localStorage.removeItem(chatKey(state.activeAgent));
  renderChat();
});
els.secret.value = localStorage.getItem(SECRET_KEY) || "";
els.saveSecret.addEventListener("click", () => {
  const v = els.secret.value.trim();
  if (v) localStorage.setItem(SECRET_KEY, v);
  else localStorage.removeItem(SECRET_KEY);
  setError("");
});
els.copyBtn.addEventListener("click", async () => {
  if (!state.lastAnswer) return;
  try {
    await navigator.clipboard.writeText(state.lastAnswer);
    els.copyBtn.textContent = "Nusxalandi";
    setTimeout(() => { els.copyBtn.textContent = "Nusxalash"; }, 1500);
  } catch {
    setError("Nusxalash muvaffaqiyatsiz");
  }
});

initAgents();
switchAgent(state.activeAgent);
checkHealth();
