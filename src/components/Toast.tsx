"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

/** How long a toast stays up before it starts leaving. */
const LIFETIME = 4000;
/** How the exit animation lasts — matches `.toast--closing`. */
const EXIT_MS = 260;

let toastId = 0;
let listeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function notify(message: string, type: Toast["type"] = "info") {
  const id = ++toastId;
  toasts = [...toasts, { id, message, type }];
  listeners.forEach((l) => l(toasts));
}

/** Actually drop the toast from the list. Called by the item once its exit
 *  animation has finished, or by `dismissAll` on teardown. */
function removeToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  listeners.forEach((l) => l(toasts));
}

export const toast = {
  success: (msg: string) => notify(msg, "success"),
  error: (msg: string) => notify(msg, "error"),
  info: (msg: string) => notify(msg, "info"),
};

const ICONS: Record<Toast["type"], React.ReactNode> = {
  success: (
    <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  info: (
    <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

/* ── One toast ───────────────────────────────────────────────────────────── */

function ToastItem({ t, onRemove }: { t: Toast; onRemove: (id: number) => void }) {
  const [closing, setClosing] = useState(false);
  const [paused, setPaused] = useState(false);

  /* Milliseconds still owed on the lifetime, so hovering can pause it. */
  const remaining = useRef(LIFETIME);
  const startedAt = useRef(0);
  const timer = useRef<number | null>(null);
  const exitTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    timer.current = null;
    exitTimer.current = null;
  }, []);

  /* Arm the auto-dismiss for `ms`, then run the exit animation. */
  const arm = useCallback(
    (ms: number) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      startedAt.current = Date.now();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setClosing(true);
        exitTimer.current = window.setTimeout(() => {
          exitTimer.current = null;
          onRemove(t.id);
        }, EXIT_MS);
      }, ms);
    },
    [onRemove, t.id]
  );

  const dismissNow = useCallback(() => {
    if (closing) return;
    clearTimers();
    setClosing(true);
    exitTimer.current = window.setTimeout(() => {
      exitTimer.current = null;
      onRemove(t.id);
    }, EXIT_MS);
  }, [closing, clearTimers, onRemove, t.id]);

  useEffect(() => {
    arm(remaining.current);
    return clearTimers;
  }, [arm, clearTimers]);

  const pause = useCallback(() => {
    if (closing || paused) return;
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setPaused(true);
  }, [closing, paused]);

  const resume = useCallback(() => {
    if (closing || !paused) return;
    setPaused(false);
    arm(remaining.current);
  }, [closing, paused, arm]);

  return (
    <div
      className={`toast toast-${t.type}${closing ? " toast--closing" : ""}${
        paused ? " toast--paused" : ""
      }`}
      role="status"
      aria-live="polite"
      onPointerEnter={pause}
      onPointerLeave={resume}
      onFocus={pause}
      onBlur={resume}
      style={{ ["--toast-life" as string]: `${LIFETIME}ms` }}
    >
      <span className="toast-icon">{ICONS[t.type]}</span>
      <span className="toast-msg">{t.message}</span>

      <button
        type="button"
        className="toast-close"
        onClick={dismissNow}
        aria-label="Dismiss notification"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <span className="toast-progress" aria-hidden="true" />
    </div>
  );
}

/* ── Container ───────────────────────────────────────────────────────────── */

export function ToastContainer() {
  const [list, setList] = useState<Toast[]>([]);

  useEffect(() => {
    listeners.push(setList);
    return () => {
      listeners = listeners.filter((l) => l !== setList);
    };
  }, []);

  if (list.length === 0) return null;

  return (
    <div className="toast-container">
      {list.map((t) => (
        <ToastItem key={t.id} t={t} onRemove={removeToast} />
      ))}
    </div>
  );
}
