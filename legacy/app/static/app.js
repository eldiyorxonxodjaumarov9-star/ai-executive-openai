const AGENTS = [
  { id: "ceo", label: "CEO Agent" },
  { id: "finance", label: "Finance Agent" },
  { id: "sales", label: "Sales Agent" },
  { id: "hr", label: "HR Agent" },
  { id: "marketing", label: "Marketing Agent" },
  { id: "customer_success", label: "Customer Success Agent" },
];

const STORAGE_PREFIX = "ai_exec_chat_";

const state = {
  activeAgent: "ceo",
  loading: false,
};

const agentListEl = document.getElementById("agent-list");
const activeAgentLabelEl = document.getElementById("active-agent-label");
const chatMessagesEl = document.getElementById("chat-messages");
const messageInputEl = document.getElementById("message-input");
const sendBtnEl = document.getElementById("send-btn");
const clearChatEl = document.getElementById("clear-chat");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const secretEl = document.getElementById("connector-secret");
const saveSecretEl = document.getElementById("save-secret");
const SECRET_KEY = "ai_exec_connector_secret";

function chatStorageKey(agentId) {
  return `${STORAGE_PREFIX}${agentId}`;
}

function getAgentLabel(agentId) {
  return AGENTS.find((a) => a.id === agentId)?.label || agentId;
}

function loadChat(agentId) {
  try {
    const raw = localStorage.getItem(chatStorageKey(agentId));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveChat(agentId, messages) {
  localStorage.setItem(chatStorageKey(agentId), JSON.stringify(messages));
}

function setLoading(value) {
  state.loading = value;
  loadingEl.classList.toggle("hidden", !value);
  sendBtnEl.disabled = value;
  messageInputEl.disabled = value;
}

function setError(message = "") {
  if (!message) {
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
    return;
  }
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function appendMessage(role, text) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.textContent = text;

  if (role === "ai") {
    const actions = document.createElement("div");
    actions.className = "message-actions";
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "Copy answer";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = "Copied";
        setTimeout(() => {
          copyBtn.textContent = "Copy answer";
        }, 1000);
      } catch (err) {
        setError("Copy failed.");
      }
    });
    actions.appendChild(copyBtn);
    message.appendChild(actions);
  }

  chatMessagesEl.appendChild(message);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function renderChat() {
  const messages = loadChat(state.activeAgent);
  chatMessagesEl.innerHTML = "";
  messages.forEach((msg) => appendMessage(msg.role, msg.text));
}

function persistMessage(role, text) {
  const messages = loadChat(state.activeAgent);
  messages.push({ role, text, ts: Date.now() });
  saveChat(state.activeAgent, messages);
}

function switchAgent(agentId) {
  state.activeAgent = agentId;
  activeAgentLabelEl.textContent = getAgentLabel(agentId);
  document.querySelectorAll(".agent-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.agent === agentId);
  });
  setError("");
  renderChat();
}

async function sendMessage() {
  if (state.loading) return;
  const question = messageInputEl.value.trim();
  if (!question) return;

  setError("");
  persistMessage("user", question);
  appendMessage("user", question);
  messageInputEl.value = "";
  setLoading(true);
  let timeout;

  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 120000);
    const res = await fetch(`/chat/agent/${state.activeAgent}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Connector-Secret": localStorage.getItem(SECRET_KEY) || "",
      },
      body: JSON.stringify({ question }),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(parseApiError(res.status, text));
    }
    const data = JSON.parse(text);
    if (!data.success) {
      throw new Error(data?.error || "Javob olinmadi.");
    }
    const answer = data?.answer || "Ma'lumot yetarli emas.";
    persistMessage("ai", answer);
    appendMessage("ai", answer);
  } catch (err) {
    const message =
      err.name === "AbortError"
        ? "OpenAI javobi vaqti tugadi — qayta urinib ko'ring."
        : sanitizeUserError(err.message);
    setError(message);
  } finally {
    clearTimeout(timeout);
    setLoading(false);
  }
}

function parseApiError(status, body) {
  try {
    const data = JSON.parse(body);
    const detail = data?.detail;
    if (typeof detail === "object" && detail?.message) {
      return sanitizeUserError(detail.message);
    }
    return sanitizeUserError(data?.error || data?.message || `Server xatosi (${status})`);
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
  return String(message || "OpenAI bilan javob olishda xato yuz berdi — keyinroq qayta urinib ko'ring.");
}

function initAgentList() {
  AGENTS.forEach((agent) => {
    const btn = document.createElement("button");
    btn.className = "agent-btn";
    btn.dataset.agent = agent.id;
    btn.textContent = agent.label;
    btn.addEventListener("click", () => switchAgent(agent.id));
    agentListEl.appendChild(btn);
  });
}

sendBtnEl.addEventListener("click", sendMessage);
messageInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

clearChatEl.addEventListener("click", () => {
  localStorage.removeItem(chatStorageKey(state.activeAgent));
  renderChat();
});

secretEl.value = localStorage.getItem(SECRET_KEY) || "";
saveSecretEl.addEventListener("click", () => {
  const value = secretEl.value.trim();
  if (value) localStorage.setItem(SECRET_KEY, value);
  else localStorage.removeItem(SECRET_KEY);
  setError("");
});

initAgentList();
switchAgent(state.activeAgent);
