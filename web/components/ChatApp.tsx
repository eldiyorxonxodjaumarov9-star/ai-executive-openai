"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ApiError, checkHealth, newId, quickChat } from "@/lib/api";
import {
  AGENTS,
  SUGGESTIONS,
  USER_NAME_KEY,
  type AgentId,
  type ChatMessage,
} from "@/lib/constants";
import styles from "./ChatApp.module.css";

const CHAT_PREFIX = "aiep_chat_";
const TEXTAREA_MAX_HEIGHT = 180;

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

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 19V5M5 12l7-7 7 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ComposerSpinner() {
  return <span className={styles.composerSpinner} aria-label="Yuklanmoqda" role="status" />;
}

interface ComposerProps {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  loading: boolean;
  error: string;
}

function Composer({ inputRef, value, onChange, onSend, loading, error }: ComposerProps) {
  const adjustHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT);
    el.style.height = `${Math.max(next, 52)}px`;
  }, [inputRef]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const canSend = !loading && value.trim().length > 0;

  return (
    <footer className={styles.composerWrap}>
      <div className={styles.composer}>
        {error ? <div className={styles.composerError}>{error}</div> : null}
        <div className={styles.composerField}>
          <textarea
            ref={inputRef}
            className={styles.composerInput}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Savolingizni yozing..."
            rows={1}
            disabled={loading}
            aria-label="Savol yozish maydoni"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
          />
          {loading ? (
            <ComposerSpinner />
          ) : (
            <button
              type="button"
              className={styles.composerSend}
              onClick={onSend}
              disabled={!canSend}
              aria-label="Yuborish"
            >
              <SendIcon />
            </button>
          )}
        </div>
        <p className={styles.composerHint}>Enter — yuborish · Shift+Enter — yangi qator</p>
      </div>
    </footer>
  );
}

export default function ChatApp() {
  const [agent, setAgent] = useState<AgentId>("ceo");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<{ ok: boolean; openai: boolean } | null>(null);
  const [userName, setUserName] = useState("Foydalanuvchi");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
      .then((h) => setHealth({ ok: h.ok, openai: h.openai_configured }))
      .catch(() => setHealth({ ok: false, openai: false }));
  }, []);

  useEffect(() => {
    if (hasMessages) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, hasMessages]);

  const send = useCallback(
    async (questionText?: string) => {
      const question = (questionText ?? input).trim();
      if (!question || loading) return;

      setError("");
      setInput("");
      setSidebarOpen(false);

      const userMsg: ChatMessage = {
        id: newId(),
        role: "user",
        content: question,
        timestamp: Date.now(),
      };

      const next = [...messages, userMsg];
      setMessages(next);
      persistMessages(agent, next);
      setLoading(true);

      try {
        const answer = await quickChat(agent, question);
        const assistantMsg: ChatMessage = {
          id: newId(),
          role: "assistant",
          content: answer,
          timestamp: Date.now(),
        };
        const updated = [...next, assistantMsg];
        setMessages(updated);
        persistMessages(agent, updated);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "OpenAI bilan javob olishda xato yuz berdi.");
      } finally {
        setLoading(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [agent, input, loading, messages]
  );

  const clearChat = () => {
    localStorage.removeItem(`${CHAT_PREFIX}${agent}`);
    setMessages([]);
    setError("");
    setInput("");
    inputRef.current?.focus();
  };

  const copyAnswer = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setError("Nusxalash muvaffaqiyatsiz.");
    }
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
            <span className={styles.logoMark}>AI</span>
            <span>AI Executive</span>
          </div>
          <button type="button" className={styles.newChatBtn} onClick={clearChat}>
            Suhbatni tozalash
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
              <span className={`${styles.agentDot} ${styles[`agentDot_${a.id}`]}`} />
              <span className={styles.agentItemLabel}>{a.label}</span>
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <span className={styles.profileStatus}>
            {health?.ok && health.openai ? "OpenAI · online" : "Offline"}
          </span>
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
            ☰
          </button>
          <select
            className={styles.agentSelect}
            value={agent}
            onChange={(e) => selectAgent(e.target.value as AgentId)}
            disabled={loading}
            aria-label="Agent tanlash"
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </header>

        <div className={styles.chatScroll}>
          {!hasMessages ? (
            <div className={styles.welcome}>
              <div className={styles.welcomeInner}>
                <div className={`${styles.welcomeIcon} ${styles[`welcomeIcon_${agent}`]}`}>
                  {agentMeta.short}
                </div>
                <h1 className={styles.welcomeTitle}>Salom!</h1>
                <p className={styles.welcomeSub}>
                  {agentMeta.label} bilan Bitrix24 ma&apos;lumotlari asosida savolingizga javob oling.
                </p>
                <div className={styles.suggestions}>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={styles.suggestionChip}
                      onClick={() => send(s)}
                      disabled={loading}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.thread}>
              {messages.map((m) => (
                <article
                  key={m.id}
                  className={`${styles.message} ${m.role === "user" ? styles.messageUser : styles.messageAi}`}
                >
                  <div
                    className={`${styles.messageAvatar} ${
                      m.role === "assistant" ? styles[`messageAvatar_${agent}`] : styles.messageAvatarUser
                    }`}
                  >
                    {m.role === "user" ? userInitial : agentMeta.short}
                  </div>
                  <div className={styles.messageBody}>
                    {m.role === "assistant" ? (
                      <>
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                        <button
                          type="button"
                          className={styles.copyBtn}
                          onClick={() => copyAnswer(m.content, m.id)}
                        >
                          {copiedId === m.id ? "Nusxalandi" : "Nusxalash"}
                        </button>
                      </>
                    ) : (
                      <p>{m.content}</p>
                    )}
                  </div>
                </article>
              ))}
              {loading && (
                <article className={`${styles.message} ${styles.messageAi}`}>
                  <div className={`${styles.messageAvatar} ${styles[`messageAvatar_${agent}`]}`}>
                    {agentMeta.short}
                  </div>
                  <div className={`${styles.messageBody} ${styles.typing}`}>
                    Javob tayyorlanmoqda...
                  </div>
                </article>
              )}
              <div ref={bottomRef} className={styles.threadEnd} />
            </div>
          )}
        </div>

        <Composer
          inputRef={inputRef}
          value={input}
          onChange={setInput}
          onSend={() => send()}
          loading={loading}
          error={error}
        />
      </main>
    </div>
  );
}
