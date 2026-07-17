"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AgentId } from "@/lib/constants";
import { analyzeExportContent, exportMessage, getExportOptions, type ExportFormat } from "@/lib/export";
import { isSavedInLibrary, saveToLibrary } from "@/lib/saved-library";
import styles from "./MessageActionToolbar.module.css";

interface MessageActionToolbarProps {
  content: string;
  agentId: AgentId;
  agentLabel: string;
  userQuestion?: string;
  disabled?: boolean;
  onCopy: () => void;
  onRefresh: () => void;
  onSaved?: () => void;
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

function BookmarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 4a2 2 0 012-2h8a2 2 0 012 2v17l-6-3-6 3V4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface ExportDropdownProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  options: ReturnType<typeof getExportOptions>;
  onSelect: (format: ExportFormat) => void;
  onClose: () => void;
}

function ExportDropdown({ open, anchorRef, options, onSelect, onClose }: ExportDropdownProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 220 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const width = Math.min(260, Math.max(220, rect.width + 160));
    let left = rect.right - width;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    const top = rect.bottom + 6;
    setPos({ top, left, width });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, onClose, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      className={styles.dropdown}
      role="menu"
      aria-label="Export formats"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxWidth: "calc(100vw - 24px)",
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.format}
          type="button"
          role="menuitem"
          className={styles.dropdownItem}
          disabled={opt.disabled}
          onClick={() => onSelect(opt.format)}
        >
          <span className={styles.dropdownIcon} aria-hidden="true">
            {opt.icon}
          </span>
          <span className={styles.dropdownLabel}>{opt.label}</span>
        </button>
      ))}
    </div>,
    document.body
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
  onSaved,
}: MessageActionToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saved, setSaved] = useState(false);
  const exportBtnRef = useRef<HTMLButtonElement>(null);

  const analysis = analyzeExportContent(content);
  const options = getExportOptions(analysis);
  const title = userQuestion?.slice(0, 80) || `${agentLabel} javobi`;

  useEffect(() => {
    setSaved(isSavedInLibrary(content, agentId));
  }, [content, agentId]);

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

  const handleSave = useCallback(() => {
    const ok = saveToLibrary({
      agentId,
      agentLabel,
      title,
      content,
      userQuestion,
    });
    if (ok) {
      setSaved(true);
      onSaved?.();
    }
  }, [agentId, agentLabel, content, onSaved, title, userQuestion]);

  if (disabled || !content.trim()) return null;

  return (
    <>
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

        <div className={styles.exportWrap}>
          <button
            ref={exportBtnRef}
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
          className={`${styles.btn} ${saved ? styles.btnSaved : ""}`}
          onClick={handleSave}
          title={saved ? "Saved to Library" : "Save to Library"}
          aria-label={saved ? "Saved to Library" : "Save to Library"}
          aria-pressed={saved}
        >
          <BookmarkIcon />
          <span className={styles.btnLabel}>Save</span>
        </button>
      </div>

      <ExportDropdown
        open={exportOpen}
        anchorRef={exportBtnRef}
        options={options}
        onSelect={(format) => void handleExport(format)}
        onClose={() => setExportOpen(false)}
      />
    </>
  );
}
