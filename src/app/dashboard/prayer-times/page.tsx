"use client";

/* ==========================================================================
   Prayer Times — website-parity page.
     · eyebrow / display title / pill actions (global .wsite layer)
     · hero panel: dark "next prayer" card (live countdown) + day navigation
       + a single-day board — seven days are resolved in one request, so
       stepping to the next day never waits on the network
     · the full month underneath as a proper timetable, with an .csv export
       for the year before, the current year, or the year after
   Motion language mirrors web/src/index.css: .reveal stagger, pointer 3D
   tilt on the panel, per-row rise, direction-aware date transitions.
   ========================================================================== */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CaretLeft,
  CaretRight,
  CloudSun,
  Clock,
  FileCsv,
  MapPin,
  Moon,
  MoonStars,
  PencilSimple,
  Sun,
  SunDim,
  SunHorizon,
  UsersThree,
} from "@phosphor-icons/react";
import Reveal from "@/components/site/Reveal";
import GirihPattern from "@/components/site/GirihPattern";
import { toast } from "@/components/Toast";
import { isReadOnly, useAccess } from "@/lib/access";
import {
  formatHijri,
  gregorianParts,
  hijriFrom,
  iqamahRuleLabel,
  prettyTime,
  toMinutes,
  type IqamahKey,
  type PrayerConfig,
} from "@/lib/prayerConfig";
import type { CalendarDay, ResolvedDay, TimeKey } from "@/lib/aladhan";
import s from "./page.module.css";

/* ── Layout rows ─────────────────────────────────────────────────────────── */

interface Row {
  key: string;
  name: string;
  arabic: string;
  timeKey: TimeKey;
  iqamahKey?: IqamahKey;
}

const ROWS: Row[] = [
  { key: "fajr", name: "Fajr", arabic: "الفجر", timeKey: "Fajr", iqamahKey: "fajr" },
  { key: "sunrise", name: "Shuruq", arabic: "الشروق", timeKey: "Sunrise" },
  { key: "dhuhr", name: "Dhuhr", arabic: "الظهر", timeKey: "Dhuhr", iqamahKey: "dhuhr" },
  { key: "asr", name: "Asr", arabic: "العصر", timeKey: "Asr", iqamahKey: "asr" },
  { key: "maghrib", name: "Maghrib", arabic: "المغرب", timeKey: "Maghrib", iqamahKey: "maghrib" },
  { key: "isha", name: "Isha", arabic: "العشاء", timeKey: "Isha", iqamahKey: "isha" },
];

/** The month table's columns — an athan plus, where it exists, an iqamah. */
const MONTH_COLS: { label: string; timeKey: TimeKey; iqamahKey?: IqamahKey }[] = [
  { label: "Fajr", timeKey: "Fajr", iqamahKey: "fajr" },
  { label: "Sunrise", timeKey: "Sunrise" },
  { label: "Dhuhr", timeKey: "Dhuhr", iqamahKey: "dhuhr" },
  { label: "Asr", timeKey: "Asr", iqamahKey: "asr" },
  { label: "Maghrib", timeKey: "Maghrib", iqamahKey: "maghrib" },
  { label: "Isha", timeKey: "Isha", iqamahKey: "isha" },
];

const ICONS: Record<string, React.ElementType> = {
  fajr: SunDim,
  sunrise: SunHorizon,
  dhuhr: Sun,
  asr: CloudSun,
  maghrib: MoonStars,
  isha: MoonStars,
};

const ORDER: TimeKey[] = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

const TZ = "Australia/Sydney";

const MO = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

/** The export picker offers {current year − 1, current, current year + 1}. */
const CURRENT_YEAR = Number(
  new Date().toLocaleDateString("en-CA", { timeZone: TZ }).slice(0, 4)
);
const EXPORT_YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

const WEEK_DAYS = 7;

/* ── Date helpers ────────────────────────────────────────────────────────── */

function todayKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function parseKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
}

/** The Sunday that opens the week containing `key`. */
function dowOf(key: string): number {
  const { y, m, d } = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function weekStartOf(key: string): string {
  return shiftKey(key, -dowOf(key));
}

/** "2 November 2026" — the Gregorian day on screen. */
function gregLabel(key: string): string {
  const g = gregorianParts(key);
  return `${g.day} ${g.month} ${g.year}`;
}

/** "21 Jumadal Awwal 1448 AH" — the hijri day on screen, same fixed format. */
function hijriLabel(key: string): string {
  const h = hijriFrom(key);
  return h ? formatHijri(h) : "";
}

/* ── Time helpers ────────────────────────────────────────────────────────── */

/** Seconds elapsed since local midnight in the masjid's timezone. */
const CLOCK_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function nowSeconds(): number {
  const parts = CLOCK_FMT.formatToParts(new Date());
  const num = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return num("hour") * 3600 + num("minute") * 60 + num("second");
}

/** Distance from `from` to `to`, wrapping past midnight. */
const wrap = (from: number, to: number) => (to >= from ? to - from : to + 86400 - from);

function fmtHMS(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function PrayerTimesPage() {
  const access = useAccess();
  const readOnly = access.ready && isReadOnly(access, "prayer");

  const [config, setConfig] = useState<PrayerConfig | null>(null);
  const [configError, setConfigError] = useState("");

  /* `dayKey` is the one day on screen. Its week — the Sunday that opens it —
     is derived, and that is the unit everything is fetched in: exactly
     `WEEK_DAYS` days come back together, so stepping inside the week is a pure
     read of state and only crossing a week boundary costs a request. */
  const [dayKey, setDayKey] = useState<string>(() => todayKey());
  const weekKey = weekStartOf(dayKey);
  const [week, setWeek] = useState<ResolvedDay[] | null>(null);
  const [weekError, setWeekError] = useState("");

  /* The month below is independent — it can be browsed on its own. */
  const [monthKey, setMonthKey] = useState<string>(() => todayKey().slice(0, 7));
  const [monthDays, setMonthDays] = useState<CalendarDay[] | null>(null);
  /* Tagged with the month it belongs to, so a failure for the month being
     left behind never lingers over the one replacing it. */
  const [monthError, setMonthError] = useState<{ key: string; msg: string } | null>(null);

  const [exportYear, setExportYear] = useState(CURRENT_YEAR);
  const [exporting, setExporting] = useState(false);

  /* Bumped by "Try again" so a retry re-runs every loader, including the one
     whose key did not change. */
  const [nonce, setNonce] = useState(0);

  /* Direction of the last week jump — drives the transition. */
  const [dir, setDir] = useState<1 | -1>(1);
  /* Seconds since local midnight — the 1s heartbeat behind the countdown. */
  const [nowSec, setNowSec] = useState(() => nowSeconds());

  /* Clear the previous error as soon as the inputs change. The week itself is
     kept on screen until its replacement lands — stepping through weeks dims
     and sweeps rather than flashing a skeleton. */
  const [stamp, setStamp] = useState({ c: config, d: weekKey });
  if (stamp.c !== config || stamp.d !== weekKey) {
    setStamp({ c: config, d: weekKey });
    setWeekError("");
  }

  const error = weekError || configError;
  /* First load has nothing to show; a week change shows the old one, dimmed. */
  const firstLoad = !error && week === null;
  const stale = week !== null && week[0]?.dateKey !== weekKey;

  /* Same for the month: a skeleton only until the first answer, then the
     previous month held (dimmed) until its replacement lands. */
  const monthErrMsg = monthError && monthError.key === monthKey ? monthError.msg : "";
  const monthStale = monthDays !== null && !monthDays[0]?.dateKey.startsWith(monthKey);

  const today = todayKey();
  const isToday = dayKey === today;
  /* The board renders exactly one day. Its week is always resolved behind it,
     so this is a plain index — stepping inside the week reads state and shows
     at once. While a new week is still in flight the index lands on the same
     weekday of the previous one: adjacent weeks differ by a minute at most,
     and the board is dimmed under the sweep anyway, so a stale frame never
     shows anything untrue. */
  const cardDay = week ? (week[dowOf(dayKey)] ?? null) : null;

  /* Load the saved configuration once. */
  useEffect(() => {
    let alive = true;
    fetch("/api/prayer/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => {
        if (!alive) return;
        if (b?.success) setConfig(b.config as PrayerConfig);
        else setConfigError(b?.error || "Could not load the prayer configuration.");
      })
      .catch(() => alive && setConfigError("Could not reach the server."));
    return () => {
      alive = false;
    };
  }, [nonce]);

  /* Resolve the week. Seven days in one request, fetched together. */
  useEffect(() => {
    if (!config) return;
    let alive = true;
    fetch(`/api/prayer/timings?date=${weekKey}&days=${WEEK_DAYS}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => {
        if (!alive) return;
        if (b?.success && Array.isArray(b.days) && b.days.length === WEEK_DAYS) {
          setWeek(b.days as ResolvedDay[]);
          setWeekError("");
        } else {
          setWeekError(b?.error || "Could not load prayer times.");
        }
      })
      .catch(() => alive && setWeekError("Could not reach the server."));
    return () => {
      alive = false;
    };
  }, [config, weekKey, nonce]);

  /* The month table — one upstream request for all of its days. */
  useEffect(() => {
    let alive = true;
    fetch(`/api/prayer/month?month=${monthKey}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => {
        if (!alive) return;
        if (b?.success && Array.isArray(b.days)) {
          setMonthDays(b.days as CalendarDay[]);
          setMonthError(null);
        } else {
          setMonthError({ key: monthKey, msg: b?.error || "Could not load the month." });
        }
      })
      .catch(() => {
        if (alive) setMonthError({ key: monthKey, msg: "Could not reach the server." });
      });
    return () => {
      alive = false;
    };
  }, [monthKey, nonce]);

  /* Advance the clock once a second, but only while a live countdown is
     meaningful (the current week, with times already resolved). */
  useEffect(() => {
    if (!isToday || !cardDay) return undefined;
    const id = window.setInterval(() => setNowSec(nowSeconds()), 1000);
    return () => window.clearInterval(id);
  }, [isToday, cardDay]);

  /* Move by one day — the week behind it is already resolved, so this reads
     straight from state until a week boundary is crossed. */
  const go = useCallback((delta: number) => {
    setDir(delta > 0 ? 1 : -1);
    setDayKey((k) => shiftKey(k, delta));
  }, []);

  /* Only offered while the day on screen is not today. */
  const goToday = useCallback(() => {
    const t = todayKey();
    setDir(t > dayKey ? 1 : -1);
    setDayKey(t);
  }, [dayKey]);

  const changeMonth = useCallback((delta: number) => {
    const { y, m } = parseKey(monthKey);
    const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonthKey(dt.toISOString().slice(0, 7));
  }, [monthKey]);

  /* ← / → move a day while no field owns the keyboard. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  /** Download the selected year as a .csv (one upstream call, one blob). */
  const exportCsv = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/prayer/export?year=${exportYear}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Could not export that year.");
      }
      const text = await res.text();
      /* BOM so Excel opens the UTF-8 column headers correctly. */
      const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `masjid-as-sunnah-prayer-times-${exportYear}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success(`Prayer times for ${exportYear} exported`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export the CSV");
    } finally {
      setExporting(false);
    }
  }, [exportYear]);

  /* One pass over the week: which prayer is active right now, and what the
     dark panel should feature. Recomputed every second via `nowSec`. */
  const live = useMemo(() => {
    if (!cardDay) return { activeKey: null, next: null };

    const moments = ORDER.map((k) => ({ k, sec: toMinutes(cardDay.timings[k]) * 60 }));

    if (!isToday) {
      return {
        activeKey: null,
        next: {
          label: "First adhan",
          row: ROWS[0],
          athan: cardDay.timings.Fajr,
          iqamah: cardDay.iqamah.fajr,
          countdown: "",
          pct: 0,
          live: false,
        },
      };
    }

    /* The active row is the last moment whose Athan has passed. */
    const past = moments.filter((m) => m.sec <= nowSec);
    const activeKey = past.length ? past[past.length - 1].k.toLowerCase() : null;

    /* The dark panel features the next moment to arrive. */
    const i = moments.findIndex((m) => m.sec > nowSec);
    const nxt = i === -1 ? moments[0] : moments[i];
    const prv = i === -1 ? moments[moments.length - 1] : i > 0 ? moments[i - 1] : null;

    const span = prv ? wrap(prv.sec, nxt.sec) : nxt.sec;
    const elapsed = prv ? wrap(prv.sec, nowSec) : nowSec;
    const pct = span > 0 ? Math.min(100, Math.max(0, (elapsed / span) * 100)) : 0;

    const row = ROWS.find((r) => r.timeKey === nxt.k) ?? ROWS[0];
    return {
      activeKey,
      next: {
        label: "Next prayer",
        row,
        athan: cardDay.timings[nxt.k],
        iqamah: row.iqamahKey ? cardDay.iqamah[row.iqamahKey] : "",
        countdown: fmtHMS(wrap(nowSec, nxt.sec)),
        pct,
        live: true,
      },
    };
  }, [cardDay, isToday, nowSec]);

  const { activeKey, next } = live;

  const NextIcon = next ? ICONS[next.row.key] : SunDim;

  const monthYear = Number(monthKey.slice(0, 4));
  const monthNum = Number(monthKey.slice(5, 7));
  const rules = config?.iqamah;

  return (
    <div className={`wsite ${s.root}`}>
      <section className={s.band}>
        <div className={s.inner}>
          {/* ── Header ── */}
          <header className={s.head}>
            <Reveal>
              <span className="eyebrow">Prayer Times</span>
              <h1 className="section-title">
                The day&apos;s Salah,
                <br />
                minute by minute.
              </h1>
            </Reveal>

            <Reveal delay={90}>
              <div className={s.headSide}>
                <div className={s.actions}>
                  <Link
                    className="btn-primary"
                    href="/dashboard/prayer-times/edit"
                    aria-disabled={readOnly}
                    onClick={(e) => readOnly && e.preventDefault()}
                  >
                    <PencilSimple size={15} weight="bold" /> Edit Prayer Times
                  </Link>
                  <Link
                    className="btn btn-secondary"
                    href="/dashboard/prayer-times/other-prayers"
                    aria-disabled={readOnly}
                    onClick={(e) => readOnly && e.preventDefault()}
                  >
                    <UsersThree size={15} weight="bold" /> Other Prayers
                  </Link>
                  <Link
                    className="btn btn-secondary"
                    href="/dashboard/prayer-times/salah-duration"
                    aria-disabled={readOnly}
                    onClick={(e) => readOnly && e.preventDefault()}
                  >
                    <Clock size={15} weight="bold" /> Salah Duration
                  </Link>
                </div>
              </div>
            </Reveal>
          </header>

          {readOnly && (
            <Reveal delay={120}>
              <p className={s.status}>
                <span className="chip chip--gold">Read-only access to Prayer</span>
              </p>
            </Reveal>
          )}

          {/* ── Hero panel ── */}
          <Reveal tilt tiltMax={2.5} delay={150} className={s.panel}>
            {/* Dark next-prayer card */}
            <aside className={s.next}>
              <GirihPattern className={s.girih} />
              <span className={s.nextGlow} aria-hidden="true" />

              <span className={s.nextEyebrow}>{next ? next.label : "Loading"}</span>

              {next ? (
                <>
                  <div className={s.nextTop}>
                    <span className={s.nextIcon}>
                      <NextIcon size={24} weight="fill" />
                    </span>
                    <div>
                      <div className={s.nextName}>
                        {next.row.name}
                        <em className="arabic">{next.row.arabic}</em>
                      </div>
                      <div className={s.nextWhen}>
                        {next.live ? "Athan in" : "Athan at"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className={s.nextCount}>
                      {next.live ? next.countdown : prettyTime(next.athan)}
                    </div>
                    <div className={s.nextUntil}>
                      {next.live ? "hours : minutes : seconds" : "first adhan of the day"}
                    </div>
                  </div>

                  {next.live && (
                    <div className={s.nextTrack}>
                      <span
                        className={s.nextFill}
                        style={{ width: `${next.pct.toFixed(2)}%` }}
                      />
                    </div>
                  )}

                  <div className={s.nextTimes}>
                    <span className={s.nextTimeCell}>
                      <span>Athan</span>
                      <b>{prettyTime(next.athan)}</b>
                    </span>
                    <span className={s.nextTimeCell}>
                      <span>Iqamah</span>
                      <b>{next.iqamah ? prettyTime(next.iqamah) : "—"}</b>
                      {rules && next.row.iqamahKey && (
                        <em className={s.nextRule}>
                          {iqamahRuleLabel(rules[next.row.iqamahKey])}
                        </em>
                      )}
                    </span>
                  </div>
                </>
              ) : (
                <div className={s.nextSkeleton}>
                  <i />
                  <i />
                  <i />
                </div>
              )}
            </aside>

            {/* Board: day navigation + the single day on screen */}
            <div className={`${s.board} ${stale ? s.boardBusy : ""}`}>
              <div className={s.dateNav}>
                <button
                  className={s.navBtn}
                  onClick={() => go(-1)}
                  aria-label="Previous day"
                >
                  <CaretLeft size={18} weight="bold" />
                </button>

                <div className={s.dateBlock} key={dayKey} data-dir={dir}>
                  <div className={s.dateGreg}>
                    {gregLabel(dayKey)}
                    {isToday ? (
                      <span className={s.dateToday}>Today</span>
                    ) : (
                      <button className={s.todayBtn} onClick={goToday}>
                        Today
                      </button>
                    )}
                  </div>
                  <div className={s.dateHijri}>{hijriLabel(dayKey)}</div>
                </div>

                <button
                  className={s.navBtn}
                  onClick={() => go(1)}
                  aria-label="Next day"
                >
                  <CaretRight size={18} weight="bold" />
                </button>
              </div>

              {firstLoad ? (
                <div className={s.rows}>
                  {Array.from({ length: ROWS.length + 1 }).map((_, i) => (
                    <div className={s.skelRow} key={i}>
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                  ))}
                </div>
              ) : error && !week ? (
                <div className={s.boardError}>
                  <span>{error}</span>
                  <button className={s.retry} onClick={() => setNonce((n) => n + 1)}>
                    Try again
                  </button>
                </div>
              ) : (
                <div
                  className={`${s.rows} ${stale ? s.rowsDim : ""}`}
                  key={weekKey}
                  data-dir={dir}
                >
                  {/* Icon, prayer, athan, iqamah — the same four columns the
                      rows below are gridded on. */}
                  <div className={s.rowsHead}>
                    <span />
                    <span>Prayer</span>
                    <span>Athan</span>
                    <span>Iqamah</span>
                  </div>

                  {ROWS.map((row, r) => {
                    const d = cardDay;
                    if (!d) return null;
                    const active = activeKey === row.key && isToday;
                    const Icon = ICONS[row.key];
                    const rule = row.iqamahKey
                      ? iqamahRuleLabel(rules?.[row.iqamahKey])
                      : "";
                    const iqamah = row.iqamahKey ? d.iqamah[row.iqamahKey] : "";
                    return (
                      <div
                        key={row.key}
                        className={`${s.row} ${active ? s.rowActive : ""}`}
                        style={{ ["--i" as string]: r }}
                      >
                        <span className={s.rowIcon}>
                          <Icon size={17} weight="fill" />
                        </span>
                        <span className={s.rowName}>
                          <strong>{row.name}</strong>
                          <em className="arabic">{row.arabic}</em>
                        </span>
                        <span className={s.rowTime}>
                          <b>{prettyTime(d.timings[row.timeKey])}</b>
                        </span>
                        <span className={s.rowTime}>
                          {row.iqamahKey ? (
                            iqamah ? (
                              <>
                                <b>{prettyTime(iqamah)}</b>
                                {rule && <em className={s.rowRule}>{rule}</em>}
                              </>
                            ) : (
                              <em className={s.rowRule}>{rule}</em>
                            )
                          ) : (
                            <i className={s.rowNone}>no iqamah</i>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Reveal>

          {/* ── Full month timetable + .csv export ── */}
          <Reveal delay={200}>
            <section className={s.month}>
              <header className={s.monthBar}>
                <div className={s.monthNav}>
                  <button
                    className={s.navBtn}
                    onClick={() => changeMonth(-1)}
                    aria-label="Previous month"
                  >
                    <CaretLeft size={16} weight="bold" />
                  </button>
                  <span className={s.monthTitle}>
                    {MO[monthNum - 1]} {monthYear}
                  </span>
                  <button
                    className={s.navBtn}
                    onClick={() => changeMonth(1)}
                    aria-label="Next month"
                  >
                    <CaretRight size={16} weight="bold" />
                  </button>
                </div>

                <div className={s.monthExport}>
                  <label className={s.monthYearLabel} htmlFor="csv-year">
                    Year
                  </label>
                  <span className={s.selectWrap}>
                    <select
                      id="csv-year"
                      className={s.yearSelect}
                      value={exportYear}
                      onChange={(e) => setExportYear(Number(e.target.value))}
                    >
                      {EXPORT_YEARS.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                          {yr === CURRENT_YEAR ? " — current" : yr < CURRENT_YEAR ? " — before" : " — after"}
                        </option>
                      ))}
                    </select>
                  </span>
                  <button
                    className={s.btnExport}
                    onClick={() => void exportCsv()}
                    disabled={exporting}
                  >
                    <FileCsv size={15} weight="bold" />
                    {exporting ? "Exporting…" : "Export .csv"}
                  </button>
                </div>
              </header>

              {monthDays === null && !monthErrMsg ? (
                <div className={s.monthSkel}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <i key={i} />
                  ))}
                </div>
              ) : monthErrMsg ? (
                <div className={s.boardError}>
                  <span>{monthErrMsg}</span>
                  <button className={s.retry} onClick={() => setNonce((n) => n + 1)}>
                    Try again
                  </button>
                </div>
              ) : monthDays ? (
                <div className={s.monthScroll}>
                  <table className={`${s.monthTable} ${monthStale ? s.rowsDim : ""}`}>
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Hijri</th>
                        {MONTH_COLS.map((c) => (
                          <th key={c.label} scope="col">
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthDays.map((day) => (
                        <tr
                          key={day.dateKey}
                          className={day.weekday === 5 ? s.isFriday : ""}
                        >
                          <th scope="row" className={s.mDate}>
                            <b>{day.gregorian.day.replace(/^0/, "")}</b>
                            <em>{day.gregorian.weekday.slice(0, 3)}</em>
                          </th>
                          <td className={s.mHijri}>
                            {day.hijri.formatted ||
                              `${day.hijri.day} ${day.hijri.month} ${day.hijri.year}`}
                          </td>
                          {MONTH_COLS.map((c) => {
                            const iq = c.iqamahKey ? day.iqamah[c.iqamahKey] : "";
                            return (
                              <td key={c.label} className={s.mTime}>
                                <b>{prettyTime(day.timings[c.timeKey])}</b>
                                {c.iqamahKey ? (
                                  <>
                                    {iq && <i>{prettyTime(iq)}</i>}
                                    {rules && (
                                      <em className={s.mRule}>
                                        {iqamahRuleLabel(rules[c.iqamahKey])}
                                      </em>
                                    )}
                                  </>
                                ) : (
                                  <i className={s.mNoIq}>—</i>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          </Reveal>

          {/* ── Status ── */}
          {cardDay && (
            <Reveal delay={240}>
              <div className={s.status}>
                <span className="chip">
                  <Moon size={12} weight="fill" />
                  {cardDay.hijri.formatted ||
                    `${cardDay.hijri.day} ${cardDay.hijri.month} ${cardDay.hijri.year}`}
                </span>
                <span className="chip">
                  <MapPin size={12} weight="bold" />
                  {config?.location.address}
                </span>
                <span className="chip">Method: {cardDay.methodUsed.name}</span>
                <span className="chip chip--gold">{config?.location.timezone}</span>
                <span className={s.hint}>Use ← → to change day</span>
              </div>
            </Reveal>
          )}
        </div>
      </section>
    </div>
  );
}
