"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentId } from "@/lib/constants";
import { analyzeExportContent, exportMessage, getExportOptions, type ExportFormat } from "@/lib/export";
import styles from "./MessageActionToolbar.module.css";

interface MessageActionToolbarProps {
  content: string;
  agentId: AgentId;
  agentLabel: string;
  userQuestion?: string;
  disabled?: boolean;
  onCopy: () => void;
  onRefresh: () => void;
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 15V5a2 2 0 012-2h10" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3M20 5v4h-4M4 19v-4h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 12l8-4v8l-8-4zm-2 8V4a2 2 0 012-2h8a2 2 0 012 2v16l-6-3-6 3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function MessageActionToolbar({
  content,
  agentId,
  agentLabel,
  userQuestion,
  disabled = false,
  onCopy,
  onRefresh,
}: MessageActionToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const analysis = analyzeExportContent(content);
  const options = getExportOptions(analysis);
  const title = userQuestion?.slice(0, 80) || `${agentLabel} javobi`;

  useEffect(() => {
    if (!exportOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [exportOpen]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (exporting) return;
      setExporting(true);
      setExportOpen(false);
      try {
        await exportMessage(format, {
          agentId,
          agentLabel,
          title,
          content,
          userQuestion,
          fetchedAt: analysis.freshnessLine || undefined,
        });
      } finally {
        setExporting(false);
      }
    },
    [agentId, agentLabel, analysis.freshnessLine, content, exporting, title, userQuestion]
  );

  const handleShare = useCallback(async () => {
    const shareText = content.slice(0, 2000);
    const shareData = {
      title: `AI Executive — ${agentLabel}`,
      text: shareText,
      url: typeof window !== "undefined" ? window.location.href : "",
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* fallback */
      }
    }
    try {
      await navigator.clipboard.writeText(`# ${shareData.title}\n\n${shareText}`);
      onCopy();
    } catch {
      /* ignore */
    }
  }, [agentLabel, content, onCopy]);

  if (disabled || !content.trim()) return null;

  return (
    <div className={`${styles.toolbar} messageActionToolbar`} role="toolbar" aria-label="Javob amallari">
      <button
        type="button"
        className={styles.btn}
        onClick={onCopy}
        title="Copy"
        aria-label="Copy"
      >
        <CopyIcon />
        <span className={styles.btnLabel}>Copy</span>
      </button>

      <div className={styles.exportWrap} ref={menuRef}>
        <button
          type="button"
          className={styles.btn}
          onClick={() => setExportOpen((o) => !o)}
          title="Export"
          aria-label="Export"
          aria-expanded={exportOpen}
          aria-haspopup="menu"
          disabled={exporting}
        >
          <ExportIcon />
          <span className={styles.btnLabel}>Export</span>
        </button>
        {exportOpen ? (
          <div className={styles.dropdown} role="menu">
            {options.map((opt) => (
              <button
                key={opt.format}
                type="button"
                role="menuitem"
                className={styles.dropdownItem}
                disabled={opt.disabled}
                onClick={() => void handleExport(opt.format)}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className={styles.btn}
        onClick={onRefresh}
        title="Refresh Analysis"
        aria-label="Refresh Analysis"
      >
        <RefreshIcon />
        <span className={styles.btnLabel}>Refresh</span>
      </button>

      <button
        type="button"
        className={styles.btn}
        onClick={() => void handleShare()}
        title="Share"
        aria-label="Share"
      >
        <ShareIcon />
        <span className={styles.btnLabel}>Share</span>
      </button>
    </div>
  );
}
