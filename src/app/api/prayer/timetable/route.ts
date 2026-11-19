import { NextRequest, NextResponse } from "next/server";
import { readPrayerSlug } from "@/lib/serverSettings";
import { prayerApiUrl } from "@/lib/settings";

const API_KEY = "JejYcMS7hsOsZTPDk2ZhKOAlW9IyQ6Px";

interface RawHijri {
  day?: string;
  dayOfMonth?: number;
  month?: string;
  year?: number;
  formatted?: string;
}

interface RawIqamah {
  fajr?: string;
  dhuhr?: string;
  asr?: string;
  maghrib?: string;
  isha?: string;
  jumuah?: string[];
}

interface RawEntry {
  date?: string;
  fajr?: string;
  sunrise?: string;
  dhuhr?: string;
  asr?: string;
  maghrib?: string;
  isha?: string;
  hijri?: RawHijri;
  iqamah?: RawIqamah;
  jumuah?: string[];
  special?: Record<string, string>;
}

export interface TimetableDay {
  dateKey: string; // YYYY-MM-DD
  weekday: number; // 0=Sun … 6=Sat
  gregorian: string; // "Thu, 01 Jan 2026"
  hijriDay: string; // Arabic weekday name
  hijriDayNum: number;
  hijriMonth: string; // Arabic month
  hijriYear: number;
  hijriShort: string; // "13 رجب ١٤٤٧"
  ramadan: boolean;
  prayers: {
    key: string;
    name: string;
    athan: string; // "4:24 AM"
    iqamah: string | null; // "4:50 AM" or null
  }[];
  // "needs checking" = any prayer missing an iqamah time
  needsCheck: boolean;
  updatedAt: string | null;
}

/* ── Fetch log types (surfaced to the admin UI) ── */
export interface FetchLogStep {
  t: string; // ISO timestamp
  label: string;
  detail?: string;
  ms?: number;
  status: "ok" | "warn" | "error";
}
export interface FetchLog {
  startedAt: string;
  durationMs: number;
  cacheHit: boolean;
  slug: string;
  apiUrl: string;
  windows: number;
  windowsOk: number;
  daysReceived: number;
  expectedDays: number;
  healthy: boolean;
  healthScore: number; // 0–100
  steps: FetchLogStep[];
}

const PRAYER_ORDER = [
  { key: "fajr", name: "Fajr" },
  { key: "sunrise", name: "Sunrise" },
  { key: "dhuhr", name: "Zuhr" },
  { key: "asr", name: "Asr" },
  { key: "maghrib", name: "Maghrib" },
  { key: "isha", name: "Isha" },
] as const;

function fmtTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Sydney",
  });
}

function buildDay(raw: RawEntry): TimetableDay | null {
  if (!raw?.date) return null;
  const dateKey = raw.date.slice(0, 10);
  const d = new Date(raw.date);
  const weekday = isNaN(d.getTime()) ? -1 : d.getDay();

  const gregorian = isNaN(d.getTime())
    ? dateKey
    : d.toLocaleDateString("en-AU", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Australia/Sydney",
      });

  const hijri = raw.hijri ?? {};
  const hijriMonth = hijri.month ?? "";
  const hijriYear = hijri.year ?? 0;
  const hijriDayNum = hijri.dayOfMonth ?? 0;
  const hijriShort =
    hijriDayNum && hijriMonth && hijriYear
      ? `${hijriDayNum} ${hijriMonth} ${hijriYear}`
      : (hijri.formatted ?? "—");

  const isFriday = weekday === 5;
  const jumuahAthan =
    isFriday && Array.isArray(raw.jumuah) && raw.jumuah.length ? fmtTime(raw.jumuah[0]) : null;
  const jumuahIqamah =
    isFriday && raw.iqamah?.jumuah?.length ? fmtTime(raw.iqamah.jumuah[0]) : jumuahAthan;

  const prayers = PRAYER_ORDER.map((p) => {
    if (p.key === "dhuhr" && jumuahAthan) {
      return { key: "jumuah", name: "Jumuah", athan: jumuahAthan, iqamah: jumuahIqamah };
    }
    return {
      key: p.key,
      name: p.name,
      athan: fmtTime(raw[p.key] as string) ?? "--",
      iqamah: fmtTime(raw.iqamah?.[p.key as keyof RawIqamah] as string | undefined),
    };
  });

  const needsCheck = prayers.some((p) => p.key !== "sunrise" && !p.iqamah);
  const ramadan = /رمضان|Ramadan/i.test(hijriMonth);

  return {
    dateKey,
    weekday,
    gregorian,
    hijriDay: hijri.day ?? "",
    hijriDayNum,
    hijriMonth,
    hijriYear,
    hijriShort,
    ramadan,
    prayers,
    needsCheck,
    updatedAt: raw.iqamah?.fajr ?? raw.fajr ?? null,
  };
}

/* Simple in-memory cache so a cold fetch isn't repeated on every page view. */
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; data: TimetableResponse }>();

interface TimetableResponse {
  success: true;
  from: string;
  to: string;
  year: number;
  daysInYear: number;
  count: number;
  ramadanCount: number;
  needChecking: number;
  lastUpdated: string | null;
  days: TimetableDay[];
  fetchLog: FetchLog;
}

/* Run an async task over items with a bounded concurrency. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

interface RangeResult {
  days: TimetableDay[];
  windows: number;
  windowsOk: number;
  steps: FetchLogStep[];
}

/* Walk the 7-day-window API concurrently to assemble [from, to], logging each step. */
async function fetchRange(from: string, to: string, apiUrl: string): Promise<RangeResult> {
  const steps: FetchLogStep[] = [];
  const now = () => new Date().toISOString();
  const push = (label: string, status: FetchLogStep["status"], ms?: number, detail?: string) =>
    steps.push({ t: now(), label, status, ms, detail });

  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    push("Validate range", "error", 0, "Invalid from/to dates");
    return { days: [], windows: 0, windowsOk: 0, steps };
  }

  const begins: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    begins.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 7);
  }
  push("Build windows", "ok", 0, `${begins.length} × 7-day window(s)`);

  let windowsOk = 0;
  const t0 = Date.now();
  const batches = await mapLimit(begins, 16, async (begin) => {
    const wStart = Date.now();
    try {
      const res = await fetch(`${apiUrl}?get=at&begin=${begin}&days=7`, {
        headers: { apikey: API_KEY },
        cache: "no-store",
      });
      const ms = Date.now() - wStart;
      if (!res.ok) {
        push(`Window ${begin}`, "error", ms, `HTTP ${res.status}`);
        return [] as RawEntry[];
      }
      const data = (await res.json()) as { timetable?: RawEntry[] };
      windowsOk++;
      push(`Window ${begin}`, "ok", ms, `${data.timetable?.length ?? 0} entries`);
      return data.timetable ?? [];
    } catch (e) {
      push(`Window ${begin}`, "error", Date.now() - wStart, e instanceof Error ? e.message : "fetch failed");
      return [] as RawEntry[];
    }
  });
  const fetchMs = Date.now() - t0;

  const out: TimetableDay[] = [];
  const seen = new Set<string>();
  for (const entries of batches) {
    for (const raw of entries) {
      const day = buildDay(raw);
      if (!day || seen.has(day.dateKey)) continue;
      if (day.dateKey < from || day.dateKey > to) continue;
      seen.add(day.dateKey);
      out.push(day);
    }
  }
  out.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  push("Parse & dedupe", "ok", fetchMs, `${out.length} unique days in range`);

  return { days: out, windows: begins.length, windowsOk, steps };
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T00:00:00Z").getTime();
  const b = new Date(to + "T00:00:00Z").getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

function scoreHealth(p: {
  windows: number;
  windowsOk: number;
  daysReceived: number;
  expectedDays: number;
  durationMs: number;
}): { healthy: boolean; healthScore: number } {
  if (p.windows === 0 || p.expectedDays === 0) return { healthy: false, healthScore: 0 };
  const completeness = Math.min(1, p.daysReceived / p.expectedDays);
  const successRate = p.windowsOk / p.windows;
  // Latency: full marks under 1.5s total, zero at 15s+.
  const latency = Math.max(0, Math.min(1, (15000 - p.durationMs) / 13500));
  const score = Math.round((completeness * 0.6 + successRate * 0.25 + latency * 0.15) * 100);
  const healthy = score >= 70 && successRate > 0 && p.daysReceived > 0;
  return { healthy, healthScore: score };
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const year = Number(sp.get("year"));
  const fromParam = sp.get("from");
  const toParam = sp.get("to");
  const refetch = sp.get("refetch") === "1";

  let from: string;
  let to: string;

  if (fromParam && toParam) {
    from = fromParam;
    to = toParam;
  } else if (year && year > 2000 && year < 2100) {
    from = `${year}-01-01`;
    to = `${year}-12-31`;
  } else {
    const y = new Date().getFullYear();
    from = `${y}-01-01`;
    to = `${y}-12-31`;
  }

  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  try {
    const slug = await readPrayerSlug();
    const apiUrl = prayerApiUrl(slug);
    const cacheKey = `${slug}|${from}|${to}`;

    if (!refetch) {
      const hit = cache.get(cacheKey);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
        const cached: TimetableResponse = {
          ...hit.data,
          fetchLog: {
            ...hit.data.fetchLog,
            cacheHit: true,
            durationMs: Date.now() - t0,
            steps: [
              { t: startedAt, label: "Serve from cache", status: "ok", ms: Date.now() - t0, detail: `Slug ${slug}` },
            ],
          },
        };
        return NextResponse.json(cached);
      }
    }

    const { days, windows, windowsOk, steps } = await fetchRange(from, to, apiUrl);
    const durationMs = Date.now() - t0;

    const yearNum = year || Number(from.slice(0, 4));
    const daysInYear =
      (yearNum % 4 === 0 && yearNum % 100 !== 0) || yearNum % 400 === 0 ? 366 : 365;
    const expectedDays = daysBetween(from, to);

    const { healthy, healthScore } = scoreHealth({ windows, windowsOk, daysReceived: days.length, expectedDays, durationMs });
    steps.push({ t: new Date().toISOString(), label: "Health check", status: healthy ? "ok" : "warn", ms: durationMs, detail: `Score ${healthScore}/100` });

    const fetchLog: FetchLog = {
      startedAt,
      durationMs,
      cacheHit: false,
      slug,
      apiUrl,
      windows,
      windowsOk,
      daysReceived: days.length,
      expectedDays,
      healthy,
      healthScore,
      steps,
    };

    const payload: TimetableResponse = {
      success: true,
      from,
      to,
      year: yearNum,
      daysInYear,
      count: days.length,
      ramadanCount: days.filter((d) => d.ramadan).length,
      needChecking: days.filter((d) => d.needsCheck).length,
      lastUpdated: days.length
        ? days.map((d) => d.updatedAt).filter(Boolean).sort().pop() ?? null
        : null,
      days,
      fetchLog,
    };

    if (!refetch) cache.set(cacheKey, { at: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
