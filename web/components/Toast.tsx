"use client";

import { useEffect } from "react";
import styles from "./Toast.module.css";

interface ToastProps {
  message: string;
  visible: boolean;
  onHide: () => void;
  durationMs?: number;
}

export default function Toast({ message, visible, onHide, durationMs = 2000 }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onHide, durationMs);
    return () => clearTimeout(t);
  }, [visible, onHide, durationMs]);

  if (!visible) return null;

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  );
}
