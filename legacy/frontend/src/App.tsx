import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ApiError,
  checkHealth,
  fetchAnalytics,
  fullReport,
  getSecret,
  quickChat,
  saveSecret,
} from "./api/client";
import { AGENTS, type AgentId, type ChatMessage, type HistoryEntry } from "./lib/constants";
import { addHistory, deleteHistory, loadHistory, newId } from "./lib/history";
import { modeForQuestion } from "./lib/responseMode";
import { downloadMarkdown, exportDocxSimple, printPdf } from "./lib/export";

type Tab = "chat" | "history" | "analytics";

export default function App() {
  const [, setSecret] = useState(getSecret());
  const [secretInput, setSecretInput] = useState(() => getSecret());
  const [unlocked, setUnlocked] = useState(() => Boolean(getSecret()));
  const [tab, setTab] = useState<Tab>("chat");
  const [agent, setAgent] = useState<AgentId>("ceo");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkHealth().then(setServerOk);
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleUnlock = () => {
    saveSecret(secretInput);
    setSecret(secretInput.trim());
    setUnlocked(true);
    setError("");
  };

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;
    setError("");
    setInput("");

    const mode = modeForQuestion(question);
    const userMsg: ChatMessage = {
      id: newId(),
      role: "user",
      content: question,
      mode,
      agent,
      timestamp: Date.now(),
    };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    setLoadingStage(mode === "full_report" ? "To'liq hisobot tayyorlanmoqda..." : "Javob tayyorlanmoqda...");

    try {
      const answer =
        mode === "full_report"
          ? await fullReport(agent, question, setLoadingStage)
          : await quickChat(agent, question);

      const assistantMsg: ChatMessage = {
        id: newId(),
        role: "assistant",
        content: answer,
        mode,
        agent,
        timestamp: Date.now(),
      };
      setMessages((m) => [...m, assistantMsg]);

      const entry: HistoryEntry = {
        ...assistantMsg,
        question,
        answer,
      };
      setHistory(addHistory(entry));
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Kutilmagan xato";
      setError(msg);
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  }, [agent, input, loading]);

  const loadAnalytics = async () => {
    setError("");
    try {
      const data = await fetchAnalytics();
      setAnalytics(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Analitika xatosi");
    }
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const isFullLast = lastAssistant?.mode === "full_report";

  if (!unlocked) {
    return (
      <div className="gate">
        <div className="gate-card">
          <h1>Rahbarlik AI platformasi</h1>
          <p>Web dashboard — ulanish kalitini kiriting (Render CONNECTOR_SECRET).</p>
          <label htmlFor="secret">Ulanish kaliti</label>
          <input
            id="secret"
            type="password"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            placeholder="CONNECTOR_SECRET"
            autoComplete="off"
          />
          <button type="button" onClick={handleUnlock}>
            Kirish
          </button>
          {serverOk === false && (
            <p className="warn">Server hozir javob bermayapti — Render holatini tekshiring.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Rahbarlik AI</h1>
        <p className="muted">Web dashboard</p>
        <span className={`badge ${serverOk ? "ok" : "err"}`}>
          {serverOk === null ? "…" : serverOk ? "Server ulandi" : "Server offline"}
        </span>

        <nav className="nav">
          <button type="button" className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>
            AI Chat
          </button>
          <button type="button" className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
            Tarix
          </button>
          <button
            type="button"
            className={tab === "analytics" ? "active" : ""}
            onClick={() => {
              setTab("analytics");
              loadAnalytics();
            }}
          >
            Analitika
          </button>
        </nav>

        <label htmlFor="agent">Agent</label>
        <select id="agent" value={agent} onChange={(e) => setAgent(e.target.value as AgentId)} disabled={loading}>
          {AGENTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>

        <button type="button" className="secondary" onClick={() => setMessages([])}>
          Chatni tozalash
        </button>
      </aside>

      <main className="main">
        {tab === "chat" && (
          <>
            <header className="header">
              <h2>{AGENTS.find((a) => a.id === agent)?.label}</h2>
              <p className="muted">Oddiy savol → tez javob. To'liq hisobot uchun «to'liq hisobot» yozing.</p>
            </header>

            <div className="messages">
              {messages.length === 0 && (
                <div className="empty">Savolingizni yozing — masalan: bugun nechta bitim bor?</div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`bubble ${m.role}`}>
                  {m.role === "assistant" && (
                    <span className="mode-tag">{m.mode === "full_report" ? "To'liq hisobot" : "Tezkor javob"}</span>
                  )}
                  {m.role === "assistant" ? (
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  ) : (
                    <p>{m.content}</p>
                  )}
                </div>
              ))}
              {loading && (
                <div className="bubble assistant loading-bubble">
                  <p>{loadingStage || "Kutilmoqda..."}</p>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {error && <div className="error">{error}</div>}

            {lastAssistant && (
              <div className="export-bar">
                <button type="button" onClick={() => navigator.clipboard.writeText(lastAssistant.content)}>
                  Nusxalash
                </button>
                {isFullLast && (
                  <>
                    <button
                      type="button"
                      onClick={() => printPdf("Rahbarlik hisoboti", lastAssistant.content)}
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => exportDocxSimple("Rahbarlik hisoboti", lastAssistant.content)}
                    >
                      DOCX
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadMarkdown("hisobot.md", lastAssistant.content)}
                    >
                      Markdown
                    </button>
                  </>
                )}
              </div>
            )}

            <footer className="composer">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Savolingizni yozing..."
                rows={3}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button type="button" onClick={send} disabled={loading || !input.trim()}>
                So'rash
              </button>
            </footer>
          </>
        )}

        {tab === "history" && (
          <div className="history-page">
            <h2>Hisobotlar tarixi</h2>
            {history.length === 0 && <p className="muted">Hali yozuvlar yo'q.</p>}
            <ul className="history-list">
              {history.map((h) => (
                <li key={h.id}>
                  <div className="history-meta">
                    <strong>{AGENTS.find((a) => a.id === h.agent)?.label}</strong>
                    <span>{new Date(h.timestamp).toLocaleString("uz-UZ")}</span>
                    <span className="mode-tag">{h.mode === "full_report" ? "To'liq" : "Tezkor"}</span>
                  </div>
                  <p className="history-q">{h.question}</p>
                  <details>
                    <summary>Javobni ko'rish</summary>
                    <ReactMarkdown>{h.answer}</ReactMarkdown>
                  </details>
                  <button type="button" className="secondary small" onClick={() => setHistory(deleteHistory(h.id))}>
                    O'chirish
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "analytics" && (
          <div className="analytics-page">
            <h2>CRM analitika</h2>
            <button type="button" className="secondary" onClick={loadAnalytics}>
              Yangilash
            </button>
            {analytics && (
              <div className="stats-grid">
                {Object.entries(analytics).map(([k, v]) => (
                  <div key={k} className="stat-card">
                    <span className="stat-key">{k}</span>
                    <span className="stat-val">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
