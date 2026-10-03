"use client";

// Shared site-settings store for the admin app.
// Loads once from /api/settings, applies the appearance block to <html>,
// and notifies subscribers so any page can react to changes.

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, mergeSettings } from "@/lib/settings";

export type SettingsState = Record<string, Record<string, unknown>>;

type Listener = () => void;

let cache: SettingsState = DEFAULT_SETTINGS as unknown as SettingsState;
let loaded = false;
let inflight: Promise<SettingsState> | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

/** Apply the appearance.* block to the document root. */
export function applyAppearanceAll(s: SettingsState) {
  if (typeof document === "undefined") return;
  const a = (s.appearance ?? {}) as Record<string, unknown>;
  const root = document.documentElement;

  const themeRaw = String(a.theme ?? "light");
  const mode = themeRaw === "auto" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : themeRaw;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;

  const accent = String(a.accent ?? "");
  if (accent) {
    root.style.setProperty("--color-primary", accent);
    root.style.setProperty("--accent", accent);
  }

  root.dataset.density = String(a.density ?? "comfortable");
  root.dataset.motion = String(a.motion ?? "full");
  root.dataset.pattern = String(a.pattern ?? "subtle");

  const scale = Number(a.fontScale ?? 100);
  if (Number.isFinite(scale)) root.style.fontSize = `${scale}%`;
}

async function load(): Promise<SettingsState> {
  if (loaded) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const json = await res.json();
      if (json && json.success) {
        cache = mergeSettings(DEFAULT_SETTINGS, json.settings) as unknown as SettingsState;
        loaded = true;
        applyAppearanceAll(cache);
      }
    } catch {
      /* keep defaults */
    } finally {
      inflight = null;
      emit();
    }
    return cache;
  })();
  return inflight;
}

/** Warm the cache as soon as this module is imported. */
if (typeof window !== "undefined") void load();

export function useSiteSettings(): [SettingsState, () => void] {
  const subscribe = useCallback((cb: Listener) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, []);
  const snap = useSyncExternalStore(
    subscribe,
    () => cache,
    () => cache
  );
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setRefreshing(true);
    loaded = false;
    void load().finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    if (!loaded) void load();
  }, []);

  return [snap, refreshing ? () => {} : refresh];
}

/** Read a dotted path (e.g. "donations.bsb") from the live settings. */
export function setting(path: string, fallback?: unknown): unknown {
  const [head, ...rest] = path.split(".");
  const section = cache[head];
  if (!section) return fallback;
  let cur: unknown = section;
  for (const k of rest) {
    if (cur === null || typeof cur !== "object") return fallback;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur === undefined ? fallback : cur;
}

export function getSettings(): SettingsState {
  return cache;
}
