/**
 * AI Executive Platform — content script for claude.ai
 * Injects floating panel only. Does not read Claude conversation DOM.
 */

(function () {
  "use strict";

  const API_BASE = "https://ai-executive-platform-1.onrender.com";
  const STORAGE_SECRET_KEY = "connectorSecret";
  const STORAGE_AGENT_KEY = "selectedAgent";

  const AGENTS = [
    { id: "ceo", label: "CEO Agent" },
    { id: "finance", label: "Finance Agent" },
    { id: "sales", label: "Sales Agent" },
    { id: "hr", label: "HR Agent" },
    { id: "marketing", label: "Marketing Agent" },
    { id: "customer_success", label: "Customer Success Agent" },
  ];

  if (document.getElementById("aiep-root")) {
    return;
  }

  const root = document.createElement("div");
  root.id = "aiep-root";
  document.body.appendChild(root);

  const backdrop = document.createElement("div");
  backdrop.id = "aiep-backdrop";
  root.appendChild(backdrop);

  const fab = document.createElement("button");
  fab.id = "aiep-fab";
  fab.type = "button";
  fab.textContent = "AI Agent";
  fab.setAttribute("aria-label", "Open AI Executive Platform panel");
  root.appendChild(fab);

  const panel = document.createElement("aside");
  panel.id = "aiep-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "AI Executive Platform");
  panel.innerHTML = `
    <div class="aiep-header">
      <h2>AI Executive Platform</h2>
      <button type="button" class="aiep-close" aria-label="Close panel">&times;</button>
    </div>
    <div class="aiep-body">
      <label class="aiep-label" for="aiep-agent">Agent</label>
      <select id="aiep-agent" class="aiep-select"></select>

      <label class="aiep-label" for="aiep-question">Savol</label>
      <textarea id="aiep-question" class="aiep-textarea" placeholder="Masalan: CEO, bugungi Bitrix24 holatini tahlil qil" rows="4"></textarea>

      <div class="aiep-actions">
        <button type="button" id="aiep-send" class="aiep-btn aiep-btn-primary">Send</button>
        <button type="button" id="aiep-copy" class="aiep-btn aiep-btn-secondary">Copy answer</button>
        <button type="button" id="aiep-clear" class="aiep-btn aiep-btn-secondary">Clear</button>
      </div>

      <div id="aiep-loading" class="aiep-loading">AI tahlil qilmoqda...</div>
      <div id="aiep-error" class="aiep-error"></div>

      <div class="aiep-answer-wrap">
        <span class="aiep-label">Javob</span>
        <div id="aiep-answer" class="aiep-answer"></div>
      </div>
    </div>
    <div class="aiep-footer">HARIDLAR.UZ · Bitrix24 live analysis</div>
  `;
  root.appendChild(panel);

  const agentSelect = panel.querySelector("#aiep-agent");
  const questionInput = panel.querySelector("#aiep-question");
  const sendBtn = panel.querySelector("#aiep-send");
  const copyBtn = panel.querySelector("#aiep-copy");
  const clearBtn = panel.querySelector("#aiep-clear");
  const loadingEl = panel.querySelector("#aiep-loading");
  const errorEl = panel.querySelector("#aiep-error");
  const answerEl = panel.querySelector("#aiep-answer");
  const closeBtn = panel.querySelector(".aiep-close");

  AGENTS.forEach((agent) => {
    const option = document.createElement("option");
    option.value = agent.id;
    option.textContent = agent.label;
    agentSelect.appendChild(option);
  });

  function openPanel() {
    backdrop.classList.add("aiep-open");
    panel.classList.add("aiep-open");
  }

  function closePanel() {
    backdrop.classList.remove("aiep-open");
    panel.classList.remove("aiep-open");
  }

  function setLoading(on) {
    loadingEl.classList.toggle("aiep-visible", on);
    sendBtn.disabled = on;
    questionInput.disabled = on;
  }

  function setError(message) {
    if (!message) {
      errorEl.textContent = "";
      errorEl.classList.remove("aiep-visible");
      return;
    }
    errorEl.textContent = message;
    errorEl.classList.add("aiep-visible");
  }

  function getStoredSecret() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_SECRET_KEY], (result) => {
        resolve((result[STORAGE_SECRET_KEY] || "").trim());
      });
    });
  }

  function saveSelectedAgent(agentId) {
    chrome.storage.local.set({ [STORAGE_AGENT_KEY]: agentId });
  }

  function loadSelectedAgent() {
    chrome.storage.local.get([STORAGE_AGENT_KEY], (result) => {
      const saved = result[STORAGE_AGENT_KEY];
      if (saved && AGENTS.some((a) => a.id === saved)) {
        agentSelect.value = saved;
      }
    });
  }

  async function sendQuestion() {
    const question = questionInput.value.trim();
    if (!question) {
      setError("Savol yozing.");
      return;
    }

    setError("");
    setLoading(true);
    answerEl.textContent = "";

    const agent = agentSelect.value;
    saveSelectedAgent(agent);

    try {
      const secret = await getStoredSecret();
      const headers = { "Content-Type": "application/json" };
      if (secret) {
        headers["X-Connector-Secret"] = secret;
      }

      const response = await fetch(`${API_BASE}/tools/agent/${agent}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ question }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const msg =
          data?.message ||
          data?.error ||
          (response.status === 401 ? "Unauthorized — connector secret noto'g'ri yoki yo'q." : "So'rov muvaffaqiyatsiz.");
        throw new Error(msg);
      }

      answerEl.textContent = data?.data?.answer || "Insufficient information.";
    } catch (err) {
      setError(`Xatolik: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  fab.addEventListener("click", openPanel);
  closeBtn.addEventListener("click", closePanel);
  backdrop.addEventListener("click", closePanel);
  sendBtn.addEventListener("click", sendQuestion);

  questionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      sendQuestion();
    }
  });

  copyBtn.addEventListener("click", async () => {
    const text = answerEl.textContent.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy answer";
      }, 1200);
    } catch {
      setError("Nusxa olish muvaffaqiyatsiz.");
    }
  });

  clearBtn.addEventListener("click", () => {
    questionInput.value = "";
    answerEl.textContent = "";
    setError("");
  });

  agentSelect.addEventListener("change", () => {
    saveSelectedAgent(agentSelect.value);
  });

  loadSelectedAgent();
})();
