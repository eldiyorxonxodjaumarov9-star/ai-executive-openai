"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ApiError,
  checkHealth,
  fullReport,
  newId,
  quickChat,
} from "@/lib/api";
import {
  AGENTS,
  SUGGESTIONS,
  USER_NAME_KEY,
  type AgentId,
  type ChatMessage,
} from "@/lib/constants";
import { modeForQuestion } from "@/lib/responseMode";
import styles from "./ChatApp.module.css";

const CHAT_PREFIX = "aiep_chat_";

function loadMessages(agent: AgentId): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${CHAT_PREFIX}${agent}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistMessages(agent: AgentId, messages: ChatMessage[]) {
  localStorage.setItem(`${CHAT_PREFIX}${agent}`, JSON.stringify(messages));
}

function getUserName(): string {
  if (typeof window === "undefined") return "Foydalanuvchi";
  return localStorage.getItem(USER_NAME_KEY) || "Foydalanuvchi";
}

function saveUserName(name: string) {
  localStorage.setItem(USER_NAME_KEY, name.trim() || "Foydalanuvchi");
}

export default function ChatApp() {
  const [agent, setAgent] = useState<AgentId>("ceo");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState("");
  const [health, setHealth] = useState<{ ok: boolean; provider: string } | null>(null);
  const [userName, setUserName] = useState("Foydalanuvchi");
  const [showProfile, setShowProfile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const agentMeta = AGENTS.find((a) => a.id === agent)!;
  const hasMessages = messages.length > 0;

  useEffect(() => {
    setMessages(loadMessages(agent));
    setUserName(getUserName());
  }, [agent]);

  useEffect(() => {
    checkHealth()
      .then((h) => setHealth({ ok: h.ok, provider: h.ai_provider }))
      .catch(() => setHealth({ ok: false, provider: "?" }));
  }, []);

  useEffect(() => {
    if (hasMessages) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, hasMessages]);

  const send = useCallback(
    async (opts?: { mode?: "quick_answer" | "full_report"; question?: string }) => {
      const question = (opts?.question ?? input).trim();
      if (!question || loading) return;

      const mode = opts?.mode || modeForQuestion(question);
      setError("");
      setInput("");
      setSidebarOpen(false);

      const userMsg: ChatMessage = {
        id: newId(),
        role: "user",
        content: question,
        mode,
        timestamp: Date.now(),
      };

      const next = [...messages, userMsg];
      setMessages(next);
      persistMessages(agent, next);
      setLoading(true);
      setLoadingText(mode === "full_report" ? "To'liq hisobot tayyorlanmoqda..." : "O'ylayapman...");

      try {
        const answer =
          mode === "full_report"
            ? await fullReport(agent, question, setLoadingText)
            : await quickChat(agent, question);

        const assistantMsg: ChatMessage = {
          id: newId(),
          role: "assistant",
          content: answer,
          mode,
          timestamp: Date.now(),
        };
        const updated = [...next, assistantMsg];
        setMessages(updated);
        persistMessages(agent, updated);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Kutilmagan xato");
      } finally {
        setLoading(false);
        setLoadingText("");
      }
    },
    [agent, input, loading, messages]
  );

  const newChat = () => {
    localStorage.removeItem(`${CHAT_PREFIX}${agent}`);
    setMessages([]);
    setError("");
    setInput("");
    inputRef.current?.focus();
  };

  const selectAgent = (id: AgentId) => {
    setAgent(id);
    setSidebarOpen(false);
  };

  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className={styles.shell}>
      {sidebarOpen && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Yopish"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarTop}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>R</span>
            <span>Rahbarlik AI</span>
          </div>

          <button type="button" className={styles.newChatBtn} onClick={newChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Yangi chat
          </button>
        </div>

        <nav className={styles.agentSection}>
          <p className={styles.sectionLabel}>Agentlar</p>
          {AGENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`${styles.agentItem} ${agent === a.id ? styles.agentItemActive : ""}`}
              onClick={() => selectAgent(a.id)}
              disabled={loading}
            >
              <span className={styles.agentDot} style={{ background: a.color }} />
              <span className={styles.agentItemLabel}>{a.label}</span>
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button
            type="button"
            className={styles.profileBtn}
            onClick={() => setShowProfile((s) => !s)}
          >
            <span className={styles.profileAvatar}>{userInitial}</span>
            <span className={styles.profileInfo}>
              <span className={styles.profileName}>{userName}</span>
              <span className={styles.profileStatus}>
                {health?.ok ? `${health.provider} · online` : "Offline"}
              </span>
            </span>
          </button>

          {showProfile && (
            <div className={styles.profilePanel}>
              <label htmlFor="user-name">Ism</label>
              <input
                id="user-name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onBlur={() => saveUserName(userName)}
              />
              <button
                type="button"
                className={styles.profileSave}
                onClick={() => saveUserName(userName)}
              >
                Saqlash
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topBar}>
          <button
            type="button"
            className={styles.menuBtn}
            onClick={() => setSidebarOpen(true)}
            aria-label="Menyu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className={styles.agentSelectWrap}>
            <select
              className={styles.agentSelect}
              value={agent}
              onChange={(e) => selectAgent(e.target.value as AgentId)}
              disabled={loading}
            >
              {AGENTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {!hasMessages ? (
          <div className={styles.welcome}>
            <div className={styles.welcomeInner}>
              <div className={styles.welcomeIcon} style={{ background: agentMeta.color }}>
                {agentMeta.short.charAt(0)}
              </div>
              <h1 className={styles.welcomeTitle}>
                Salom{userName !== "Foydalanuvchi" ? `, ${userName}` : ""}!
              </h1>
              <p className={styles.welcomeSub}>
                {agentMeta.label} agenti bilan CRM savollaringizga javob oling.
              </p>

              <div className={styles.welcomeInputWrap}>
                <ChatInputBox
                  inputRef={inputRef}
                  value={input}
                  onChange={setInput}
                  onSend={() => send()}
                  loading={loading}
                  agent={agent}
                  onAgentChange={selectAgent}
                  centered
                />
              </div>

              <div className={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={styles.suggestionChip}
                    onClick={() => send({ question: s, mode: modeForQuestion(s) })}
                    disabled={loading}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.thread}>
              {messages.map((m) => (
                <article
                  key={m.id}
                  className={`${styles.message} ${m.role === "user" ? styles.messageUser : styles.messageAi}`}
                >
                  <div
                    className={styles.messageAvatar}
                    style={m.role === "assistant" ? { background: agentMeta.color } : undefined}
                  >
                    {m.role === "user" ? userInitial : agentMeta.short.charAt(0)}
                  </div>
                  <div className={styles.messageBody}>
                    {m.role === "assistant" && m.mode === "full_report" && (
                      <span className={styles.modeBadge}>To&apos;liq hisobot</span>
                    )}
                    {m.role === "assistant" ? (
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    ) : (
                      <p>{m.content}</p>
                    )}
                  </div>
                </article>
              ))}
              {loading && (
                <article className={`${styles.message} ${styles.messageAi}`}>
                  <div className={styles.messageAvatar} style={{ background: agentMeta.color }}>
                    {agentMeta.short.charAt(0)}
                  </div>
                  <div className={`${styles.messageBody} ${styles.typing}`}>
                    <span className={styles.typingDots}>
                      <span />
                      <span />
                      <span />
                    </span>
                    {loadingText}
                  </div>
                </article>
              )}
              <div ref={bottomRef} />
            </div>

            <div className={styles.bottomComposer}>
              {error && <div className={styles.error}>{error}</div>}
              <ChatInputBox
                inputRef={inputRef}
                value={input}
                onChange={setInput}
                onSend={() => send()}
                onFullReport={() =>
                  send({ mode: "full_report", question: input.trim() || "To'liq hisobot" })
                }
                loading={loading}
                agent={agent}
                onAgentChange={selectAgent}
              />
            </div>
          </>
        )}

        {!hasMessages && error && <div className={styles.errorWelcome}>{error}</div>}
      </main>
    </div>
  );
}

interface ChatInputBoxProps {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onFullReport?: () => void;
  loading: boolean;
  agent: AgentId;
  onAgentChange: (id: AgentId) => void;
  centered?: boolean;
}

function ChatInputBox({
  inputRef,
  value,
  onChange,
  onSend,
  onFullReport,
  loading,
  agent,
  onAgentChange,
  centered,
}: ChatInputBoxProps) {
  const agentMeta = AGENTS.find((a) => a.id === agent)!;

  return (
    <div className={`${styles.inputBox} ${centered ? styles.inputBoxCentered : ""}`}>
      <div className={styles.inputBoxInner}>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Savolingizni yozing..."
          rows={1}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <div className={styles.inputToolbar}>
          <select
            className={styles.modelSelect}
            value={agent}
            onChange={(e) => onAgentChange(e.target.value as AgentId)}
            disabled={loading}
            aria-label="Agent tanlash"
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <div className={styles.inputActions}>
            {onFullReport && (
              <button
                type="button"
                className={styles.reportBtn}
                onClick={onFullReport}
                disabled={loading}
                title="To'liq hisobot"
              >
                Hisobot
              </button>
            )}
            <button
              type="button"
              className={styles.sendCircle}
              onClick={onSend}
              disabled={loading || !value.trim()}
              aria-label="Yuborish"
              style={{ background: agentMeta.color }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
