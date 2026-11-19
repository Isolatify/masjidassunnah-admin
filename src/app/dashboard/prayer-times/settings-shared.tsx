"use client";

/* ==========================================================================
   Shared plumbing for the three prayer settings pages
     · /dashboard/prayer-times/edit              (Athan | Iqamah, 2 steps)
     · /dashboard/prayer-times/other-prayers     (pick one, then edit)
     · /dashboard/prayer-times/salah-duration

   The modals these pages replaced are gone: everything here is full-page
   chrome (back link, "Autosave settings" link, eyebrow/title, step bar,
   footer) plus the data hook that loads the config, drafts changes and —
   when autosave is on — writes them itself so the Save button can be hidden.

   The autosave On/Off switch itself deliberately does NOT live here: it is a
   single preference and belongs to Settings (/dashboard/settings →
   "Prayer times"). All this does is read `config.autosave` so each page knows
   whether to show Save at all.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, GearSix, MoonStars, Clock, SunDim, UsersThree } from "@phosphor-icons/react";
import GirihPattern from "@/components/site/GirihPattern";
import { toast } from "@/components/Toast";
import {
  prettyTime,
  shiftTime,
  zeroOffsets,
  type AthanOffsets,
  type IqamahKey,
  type PrayerConfig,
} from "@/lib/prayerConfig";
import type { ResolvedDay } from "@/lib/aladhan";
import s from "./page.module.css";

/* ── Per-prayer icon tiles (mirrors the page rows) ───────────────────────── */

export const PRAYER_ICONS: Record<IqamahKey, React.ElementType> = {
  fajr: SunDim,
  dhuhr: Clock,
  asr: UsersThree,
  maghrib: MoonStars,
  isha: MoonStars,
};

export const ROW_STYLE = (i: number) => ({ ["--i" as string]: i });

export const BACK_HREF = "/dashboard/prayer-times";

/* ── Preview helper ──────────────────────────────────────────────────────── */

/** Ask the server to resolve `config` for `dateKey`. */
export async function previewDay(config: PrayerConfig, dateKey: string): Promise<ResolvedDay> {
  const url = `/api/prayer/timings?date=${dateKey}&config=${encodeURIComponent(
    JSON.stringify(config)
  )}`;
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json();
  if (!body?.success) throw new Error(body?.error || "Preview failed");
  return body.days[0] as ResolvedDay;
}

/** YYYY-MM-DD for right now, in the masjid's timezone. */
export function todayKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
}

/* ==========================================================================
   Config hook — load, draft, save, autosave
   ========================================================================== */

export interface SaveResult {
  ok: boolean;
  error?: string;
  warning?: string;
}

export interface UsePrayerConfig {
  /** The working draft. Null until the first load finishes. */
  config: PrayerConfig | null;
  loaded: boolean;
  /** Non-fatal message from the last load/save. */
  error: string;
  saving: boolean;
  /** Replace part of the draft (does not write on its own). */
  set: (patch: Partial<PrayerConfig> | ((c: PrayerConfig) => PrayerConfig)) => void;
  /** Persist the draft (or `next`) right now, with a success toast. */
  save: (next?: PrayerConfig, message?: string) => Promise<SaveResult>;
  reload: () => Promise<void>;
}

export function usePrayerConfig(): UsePrayerConfig {
  const [config, setConfig] = useState<PrayerConfig | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  /* Last snapshot that made it to the server. Compared by identity against
     `config` so the autosave effect only fires on a real change. */
  const persisted = useRef<PrayerConfig | null>(null);
  const timer = useRef<number | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  /* Written as a `.then()` chain rather than async/await so that the initial
     `void load()` inside the effect below never reaches setState
     synchronously — every update lands in a callback. */
  const load = useCallback(
    (): Promise<void> =>
      fetch("/api/prayer/config", { cache: "no-store" })
        .then((res) => res.json())
        .then((body) => {
          if (!body?.success) throw new Error(body?.error || "Could not load settings");
          if (!alive.current) return;
          const next = body.config as PrayerConfig;
          persisted.current = next;
          setConfig(next);
          setError("");
        })
        .catch((e: unknown) => {
          if (!alive.current) return;
          setError(e instanceof Error ? e.message : "Could not load settings");
        })
        .then(() => {
          if (alive.current) setLoaded(true);
        }),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(async (next: PrayerConfig, message: string): Promise<SaveResult> => {
    /* Claim the snapshot before the request goes out so the autosave effect
       does not queue a duplicate while this one is in flight. */
    const previous = persisted.current;
    persisted.current = next;
    setSaving(true);
    try {
      const res = await fetch("/api/prayer/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: next }),
      });
      const body = await res.json().catch(() => null);
      if (!body?.success) throw new Error(body?.error || "Save failed");
      if (alive.current) setError("");
      toast.success(message);
      if (body.warning) toast.info(body.warning);
      return { ok: true, warning: body.warning };
    } catch (e) {
      persisted.current = previous;
      const msg = e instanceof Error ? e.message : "Save failed";
      if (alive.current) setError(msg);
      toast.error(msg);
      return { ok: false, error: msg };
    } finally {
      if (alive.current) setSaving(false);
    }
  }, []);

  /* Autosave — debounced so hammering a stepper costs one write and one toast. */
  useEffect(() => {
    if (!loaded || !config) return;
    if (persisted.current === config) return;
    if (!config.autosave) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void persist(config, "Changes saved");
    }, 600);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [config, loaded, persist]);

  const set = useCallback((patch: Partial<PrayerConfig> | ((c: PrayerConfig) => PrayerConfig)) => {
    setConfig((cur) => {
      if (!cur) return cur;
      return typeof patch === "function" ? patch(cur) : { ...cur, ...patch };
    });
  }, []);

  const save = useCallback(
    (next?: PrayerConfig, message = "Saved") => {
      const target = next ?? config;
      if (!target) return Promise.resolve<SaveResult>({ ok: false, error: "Not loaded yet" });
      return persist(target, message);
    },
    [config, persist]
  );

  return { config, loaded, error, saving, set, save, reload: load };
}

/* ==========================================================================
   Page chrome
   ========================================================================== */

export function SettingsShell({
  eyebrow,
  title,
  sub,
  step,
  stepLabels = ["Settings", "Review"],
  actions,
  foot,
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  step?: 1 | 2;
  stepLabels?: [string, string];
  actions?: React.ReactNode;
  foot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={s.set}>
      <div className={s.setTop}>
        <Link href={BACK_HREF} className={s.back}>
          <ArrowLeft size={14} weight="bold" />
          Prayer Times
        </Link>

        {/* The On/Off switch itself lives in Settings — this is the signpost. */}
        <div className={s.setTopRight}>
          {actions}
          <Link href="/dashboard/settings" className={s.settingsLink} title="Turn autosave on or off">
            <GearSix size={14} weight="bold" />
            Autosave settings
          </Link>
        </div>
      </div>

      <header className={s.setHead}>
        <span className={s.setEyebrow}>{eyebrow}</span>
        <h1 className={s.setTitle}>{title}</h1>
        {sub && <p className={s.setSub}>{sub}</p>}
      </header>

      {step && (
        <div className={s.steps}>
          {[1, 2].map((n) => (
            <div key={n} className={`${s.step} ${step >= n ? s.stepOn : ""}`}>
              <span className={s.stepDot}>{step > n ? <Check size={11} weight="bold" /> : n}</span>
              <span className={s.stepLabel}>{stepLabels[n - 1]}</span>
              {n === 1 && <span className={s.stepLine} />}
            </div>
          ))}
        </div>
      )}

      <div className={s.setBody}>{children}</div>

      {foot && <div className={s.setFoot}>{foot}</div>}
    </div>
  );
}

/* ── Loading / failure states ────────────────────────────────────────────── */

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={s.setState}>
      <strong>Could not load your settings.</strong>
      <span>{message}</span>
      <button type="button" className={s.btnGhost} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function Loading() {
  return (
    <div className={`${s.setState} ${s.setStateBusy}`}>
      <span className={s.spinner} aria-hidden="true" />
      <span>Loading settings…</span>
    </div>
  );
}

/* ==========================================================================
   Controls
   ========================================================================== */

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 180,
  step = 1,
  unit,
  dark,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  dark?: boolean;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className={dark ? s.stepperDark : s.stepper}>
      <button
        type="button"
        className={dark ? s.stepBtnDark : s.stepBtn}
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label="Decrease"
      >
        −
      </button>
      <span className={dark ? s.stepValDark : s.stepVal}>
        {value}
        {unit && <span className={dark ? s.stepUnitDark : s.stepUnit}> {unit}</span>}
      </span>
      <button
        type="button"
        className={dark ? s.stepBtnDark : s.stepBtn}
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

export function Segment<T extends string | number>({
  options,
  value,
  onChange,
  small,
}: {
  options: readonly { value: T; name: string }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <div className={small ? s.segSmall : s.segment}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={`${small ? s.segSmallBtn : s.segmentBtn} ${
            value === o.value ? (small ? s.segSmallBtnOn : s.segmentBtnActive) : ""
          }`}
          onClick={() => onChange(o.value)}
        >
          {value === o.value && <Check className={s.segCheck} size={12} weight="bold" />}
          {o.name}
        </button>
      ))}
    </div>
  );
}

/* ==========================================================================
   Review step — the dark timetable panel
   ========================================================================== */

/**
 * The whole timetable, on the dark girih panel that echoes the page's
 * next-prayer card.
 *
 * `base` must be fetched with the offsets zeroed out when `offsets` is
 * supplied, so the caller can apply its own draft offsets here without
 * double-counting the ones already stored.
 */
export function Timetable({
  title,
  meta,
  day,
  offsets,
  onOffset,
  iqamah,
  busy,
  failed,
}: {
  title: string;
  meta?: string;
  day: ResolvedDay | null;
  /** Draft athan offsets. Omit to render plain times (Iqamah review). */
  offsets?: AthanOffsets;
  onOffset?: (key: IqamahKey, value: number) => void;
  /** Show the iqamah column (Iqamah review). */
  iqamah?: boolean;
  busy: boolean;
  failed: boolean;
}) {
  const rows: React.ReactNode[] = [];

  if (day) {
    /* Sunrise is part of the timetable but is not an athan, so it never gets
       a stepper — it is rendered as a plain, quieter row. */
    const plain: { key: keyof ResolvedDay["timings"]; label: string }[] = [
      { key: "Fajr", label: "Fajr" },
      { key: "Sunrise", label: "Sunrise" },
      { key: "Dhuhr", label: "Dhuhr" },
      { key: "Asr", label: "Asr" },
      { key: "Maghrib", label: "Maghrib" },
      { key: "Isha", label: "Isha" },
    ];

    plain.forEach((r, i) => {
      const isSunrise = r.key === "Sunrise";
      const offKey = (r.key === "Fajr" ? "fajr" : r.key === "Dhuhr" ? "dhuhr" : r.key === "Asr" ? "asr" : r.key === "Maghrib" ? "maghrib" : r.key === "Isha" ? "isha" : null) as IqamahKey | null;
      const offset = offsets && offKey ? offsets[offKey] ?? 0 : 0;
      const time = offsets && offset ? shiftTime(day.timings[r.key], offset) : day.timings[r.key];
      const iq = offKey ? day.iqamah[offKey] : "";

      rows.push(
        <div
          key={r.key}
          className={`${s.ttRow} ${isSunrise ? s.ttRowMuted : ""}`}
          style={ROW_STYLE(i)}
        >
          <span className={s.ttName}>{r.label}</span>

          <span className={s.ttTimes}>
            <strong className={s.ttTime}>{prettyTime(time)}</strong>
            {iqamah && offKey && (
              <em className={s.ttIqamah}>{iq ? prettyTime(iq) : "No Iqamah"}</em>
            )}
            {iqamah && isSunrise && <em className={s.ttIqamah}>—</em>}
          </span>

          {offsets && offKey && onOffset && (
            <span className={s.ttOff}>
              <button
                type="button"
                className={s.ttOffBtn}
                onClick={() => onOffset(offKey, offset - 1)}
                disabled={offset <= -60}
                aria-label={`Move ${r.label} athan earlier`}
              >
                −
              </button>
              <span className={s.ttOffVal}>{offset > 0 ? `+${offset}` : offset}</span>
              <button
                type="button"
                className={s.ttOffBtn}
                onClick={() => onOffset(offKey, offset + 1)}
                disabled={offset >= 60}
                aria-label={`Move ${r.label} athan later`}
              >
                +
              </button>
            </span>
          )}
        </div>
      );
    });
  }

  return (
    <div className={s.timetable}>
      <GirihPattern className={s.previewGirih} />
      <span className={s.previewGlow} aria-hidden="true" />

      <div className={s.previewHead}>
        <span>{title}</span>
        {meta && <em>{meta}</em>}
      </div>

      {busy ? (
        <span className={s.previewBusy}>Calculating…</span>
      ) : failed ? (
        <span className={s.previewBusy}>Could not reach Aladhan.</span>
      ) : (
        <div className={s.previewRows}>{rows}</div>
      )}
    </div>
  );
}

/* ── "Do you want to proceed the change?" ────────────────────────────────── */

export function ConfirmBar({
  onYes,
  onNo,
  disabled,
  saving,
}: {
  onYes: () => void;
  onNo: () => void;
  disabled?: boolean;
  saving?: boolean;
}) {
  return (
    <div className={s.confirm}>
      <span className={s.confirmText}>Do you want to proceed the change?</span>
      <div className={s.confirmRow}>
        <button className={s.btnYes} onClick={onYes} disabled={disabled || saving}>
          {saving ? "Saving…" : "Yes"}
        </button>
        <button className={s.btnNo} onClick={onNo} disabled={saving}>
          No
        </button>
      </div>
    </div>
  );
}

/* ── Footer action row ───────────────────────────────────────────────────── */

export function FooterActions({
  autosave,
  saving,
  saveLabel,
  onSave,
  nextLabel,
  onNext,
  nextDisabled,
  backLabel,
  onBack,
}: {
  autosave: boolean;
  saving?: boolean;
  saveLabel?: string;
  onSave?: () => void;
  nextLabel?: string;
  onNext?: () => void;
  nextDisabled?: boolean;
  backLabel?: string;
  onBack?: () => void;
}) {
  return (
    <>
      <div className={s.footLeft}>
        {backLabel && onBack && (
          <button type="button" className={s.btnGhost} onClick={onBack} disabled={saving}>
            <ArrowLeft size={14} weight="bold" />
            {backLabel}
          </button>
        )}
      </div>

      <div className={s.footRight}>
        {/* Autosave on → the Save button simply does not exist. */}
        {!autosave && onSave && (
          <button type="button" className={s.btnPrimary} onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : saveLabel ?? "Save changes"}
          </button>
        )}
        {nextLabel && onNext && (
          <button
            type="button"
            className={s.btnPrimary}
            onClick={onNext}
            disabled={nextDisabled || saving}
          >
            {nextLabel}
            <ArrowRight size={14} weight="bold" />
          </button>
        )}
      </div>
    </>
  );
}

export { zeroOffsets };
