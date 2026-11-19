/* ==========================================================================
   Aladhan client — builds requests, normalises the response, then layers the
   masjid's own iqamah / other-prayer / duration rules on top.
   Server-side only (called from /api/prayer/timings).
   ========================================================================== */

import https from "node:https";

import {
  AUTOMATIC_METHOD,
  CUSTOM_METHOD,
  formatHijri,
  gregorianParts,
  hijriFrom,
  IQAMAH_KEYS,
  normalizeHijriMonth,
  shiftTime,
  toMinutes,
  toTime,
  type DurationConfig,
  type HijriParts,
  type IqamahConfig,
  type IqamahKey,
  type OtherConfig,
  type PrayerConfig,
  type RelativeTime,
} from "@/lib/prayerConfig";

const ALADHAN = "https://api.aladhan.com/v1";

/* ── Transport ───────────────────────────────────────────────────────────── */

/* Aladhan publishes an AAAA record, and on networks where the IPv6 route is
   unreachable Node's default happy-eyeballs connect stalls until it times out
   (the same URL is instant over IPv4). Disabling it *for this request only*
   makes Node use the first resolved address instead, which works. */
function httpsGet(url: string, timeoutMs = 20000): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    /* `autoSelectFamily` is a real `net.connect` option that @types/node does
       not surface on https.RequestOptions, hence the intersection type. */
    const options: https.RequestOptions & { autoSelectFamily?: boolean } = {
      hostname: u.hostname,
      port: u.port ? Number(u.port) : 443,
      path: `${u.pathname}${u.search}`,
      method: "GET",
      headers: { accept: "application/json" },
      autoSelectFamily: false,
      timeout: timeoutMs,
    };
    const req = https.request(options, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          httpsGet(new URL(res.headers.location, url).toString(), timeoutMs).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Aladhan request failed (${res.statusCode})`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Aladhan request timed out")));
    req.on("error", reject);
    req.end();
  });
}

export type TimeKey =
  | "Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Sunset" | "Maghrib"
  | "Isha" | "Imsak" | "Midnight" | "Firstthird" | "Lastthird";

export type Timings = Record<TimeKey, string>;

export interface HijriDate {
  day: string;
  weekday: string;
  month: string;
  year: string;
  formatted: string;
}

export interface GregorianDate {
  day: string;
  weekday: string;
  month: string;
  year: string;
}

export interface MethodUsed {
  id: number;
  name: string;
}

export interface ResolvedDay {
  dateKey: string; // YYYY-MM-DD
  weekday: number; // 0 Sun – 6 Sat
  readable: string; // "01 Nov 2026"
  hijri: HijriDate;
  gregorian: GregorianDate;
  timings: Timings;
  methodUsed: MethodUsed;
  iqamah: Record<IqamahKey, string>;
  other: {
    jumuah: { name: string; athan: string; iqamah: string }[];
    taraweeh: string;
    imsak: string;
    iftar: string;
  };
  durations: DurationConfig;
}

/** One day of a month/year calendar — lighter than `ResolvedDay` because a
 *  30–365 row table has no "next prayer" or other-prayer panel to carry. */
export interface CalendarDay {
  dateKey: string;
  weekday: number;
  hijri: HijriDate;
  gregorian: GregorianDate;
  timings: Timings;
  iqamah: Record<IqamahKey, string>;
}

/* ── Query building ─────────────────────────────────────────────────────── */

/** Aladhan wants DD-MM-YYYY; we store YYYY-MM-DD. */
function toAladhanDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}-${m}-${y}`;
}

/**
 * The shared request query.
 *
 * `dateKey` is omitted for Aladhan's calendar endpoints (`/calendar/:year`,
 * `/calendar/:year/:month`), which take the date in the path instead.
 */
export function buildQuery(config: PrayerConfig, dateKey?: string): URLSearchParams {
  const { location, athan } = config;
  const q = new URLSearchParams();

  q.set("latitude", String(location.latitude));
  q.set("longitude", String(location.longitude));
  q.set("timezonestring", location.timezone);
  q.set("school", String(athan.asrMethod));
  q.set("latitudeAdjustmentMethod", String(athan.highLatitude));
  q.set("iso8601", "false");

  if (athan.mode === "explicit") {
    if (athan.methodId === CUSTOM_METHOD) {
      /* methodSettings = "FajrAngle,MaghribAngleOrMins,IshaAngleOrMins".
         Angles are honoured directly; the minutes forms are applied locally
         below because the API only understands `<n> min` for Isha and has no
         "minutes before sunrise" slot for Fajr at all. */
      const fajr = athan.fajrMode === "angle" ? String(athan.fajrAngle) : "18";
      const isha = athan.ishaMode === "angle" ? String(athan.ishaAngle) : "17";
      q.set("method", String(CUSTOM_METHOD));
      q.set("methodSettings", `${fajr},null,${isha}`);
    } else {
      q.set("method", String(athan.methodId));
      // Method 15 requires a shafaq value; default to "general".
      if (athan.methodId === 15) q.set("shafaq", "general");
    }
  }
  // mode === "automatic": omit `method` entirely so Aladhan resolves the
  // issuing authority for these coordinates (verified: London→MWL,
  // New York→ISNA, Makkah→Umm Al-Qura).

  if (dateKey) q.set("date", toAladhanDate(dateKey));
  return q;
}

/** Raw shape of an Aladhan timings response (only the parts we use). */
interface AladhanResponse {
  code: number;
  status: string;
  data?: {
    timings?: Partial<Timings>;
    date?: {
      readable?: string;
      hijri?: AladhanHijri;
      gregorian?: AladhanGregorian;
    };
    meta?: {
      method?: { id?: number; name?: string };
    };
  };
}

interface AladhanHijri {
  day?: string;
  weekday?: { en?: string };
  month?: { en?: string };
  year?: string;
}

interface AladhanGregorian {
  date?: string;
  day?: string;
  weekday?: { en?: string };
  month?: { en?: string };
  year?: string;
}

/** A row of Aladhan's `/calendar` endpoints. */
interface CalendarEntry {
  timings?: Partial<Timings>;
  date?: { readable?: string; hijri?: AladhanHijri; gregorian?: AladhanGregorian };
}

interface CalendarResponse {
  code: number;
  status: string;
  /** `/calendar/:year/:month` → a flat array. `/calendar/:year` → keyed by
   *  month number ("1"…"12"). */
  data?: CalendarEntry[] | Record<string, CalendarEntry[]>;
}

/** Strip Aladhan's timezone suffix ("04:24 (AEDT)") if present. */
function cleanTime(raw: string | undefined): string {
  if (!raw) return "--:--";
  const m = /^(\d{1,2}:\d{2})/.exec(raw);
  return m ? m[1] : "--:--";
}

/** Normalise a raw Aladhan timings object to plain `HH:MM`. */
function toTimings(raw: Partial<Timings> | undefined): Timings {
  return {
    Fajr: cleanTime(raw?.Fajr),
    Sunrise: cleanTime(raw?.Sunrise),
    Dhuhr: cleanTime(raw?.Dhuhr),
    Asr: cleanTime(raw?.Asr),
    Sunset: cleanTime(raw?.Sunset),
    Maghrib: cleanTime(raw?.Maghrib),
    Isha: cleanTime(raw?.Isha),
    Imsak: cleanTime(raw?.Imsak),
    Midnight: cleanTime(raw?.Midnight),
    Firstthird: cleanTime(raw?.Firstthird),
    Lastthird: cleanTime(raw?.Lastthird),
  };
}

/**
 * Everything the masjid layers on top of Aladhan's own answer, in order:
 * custom Fajr/Isha minutes, then the manual per-prayer offsets.
 * Shared by the day, month and year fetchers so a table and a single day can
 * never disagree.
 */
export function applyLocalRules(config: PrayerConfig, input: Timings): Timings {
  const timings: Timings = { ...input };
  const { athan } = config;

  /* Minutes-based Fajr = sunrise minus N (no API equivalent). */
  if (athan.mode === "explicit" && athan.methodId === CUSTOM_METHOD && athan.fajrMode === "minutes") {
    timings.Fajr = shiftTime(timings.Sunrise, -athan.fajrMinutes);
  }
  /* Minutes-based Isha = maghrib plus N, applied locally for symmetry. */
  if (athan.mode === "explicit" && athan.methodId === CUSTOM_METHOD && athan.ishaMode === "minutes") {
    timings.Isha = shiftTime(timings.Maghrib, athan.ishaMinutes);
  }

  /* Manual per-prayer athan offsets, applied after the custom rules and
     BEFORE the iqamah is resolved so every iqamah shifts with its athan.
     Sunrise is deliberately not offsettable — it is not an athan. */
  const offsets = athan.offsets;
  if (offsets) {
    IQAMAH_KEYS.forEach((key) => {
      const n = offsets[key];
      if (!Number.isFinite(n) || n === 0) return;
      const k = cap(key) as TimeKey;
      timings[k] = shiftTime(timings[k], n);
    });
  }

  return timings;
}

/**
 * Hijri date for `dateKey`, in the masjid's spelling — "21 Jumadal Awwal 1448 AH".
 *
 * Primary source is Umm al-Qura via `Intl` (local, deterministic, month given
 * as a number). Aladhan's own month name is only used as a fallback, and it
 * passes through `normalizeHijriMonth`, which folds its diacritics first.
 */
function buildHijri(dateKey: string, from?: AladhanHijri): HijriDate {
  const local: HijriParts | null = hijriFrom(dateKey);
  const day = local?.day ?? from?.day ?? "";
  const month = local?.month ?? normalizeHijriMonth(from?.month?.en ?? "");
  const year = local?.year ?? from?.year ?? "";
  const weekday = local?.weekday ?? from?.weekday?.en ?? "";
  return { day, weekday, month, year, formatted: formatHijri({ day, month, year }) };
}

function buildGregorian(dateKey: string, from?: AladhanGregorian): GregorianDate {
  const local = gregorianParts(dateKey);
  return {
    day: from?.day || local.day,
    weekday: from?.weekday?.en || local.weekday,
    month: from?.month?.en || local.month,
    year: from?.year || local.year,
  };
}

/** A calendar row → the day shape the admin renders. */
function toCalendarDay(config: PrayerConfig, entry: CalendarEntry): CalendarDay {
  const dateKey = fromAladhanDate(entry.date?.gregorian?.date) ?? "";
  const timings = applyLocalRules(config, toTimings(entry.timings));
  return {
    dateKey,
    weekday: weekdayOf(dateKey),
    hijri: buildHijri(dateKey, entry.date?.hijri),
    gregorian: buildGregorian(dateKey, entry.date?.gregorian),
    timings,
    iqamah: resolveIqamah(config.iqamah, timings),
  };
}

/** "01-11-2026" → "2026-11-01". Returns null when Aladhan omits the field. */
function fromAladhanDate(raw: string | undefined): string | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw ?? "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** The first N days are the ones Aladhan actually answered with. */
function readCalendar(data: CalendarResponse["data"]): CalendarEntry[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const out: CalendarEntry[] = [];
  for (let month = 1; month <= 12; month++) out.push(...(data[String(month)] ?? []));
  return out;
}

/* ── Fetch ──────────────────────────────────────────────────────────────── */

export async function fetchDay(
  config: PrayerConfig,
  dateKey: string
): Promise<ResolvedDay> {
  const query = buildQuery(config, dateKey);
  const url = `${ALADHAN}/timings/${toAladhanDate(dateKey)}?${query.toString()}`;

  const res = await httpsGet(url);
  const body = JSON.parse(res) as AladhanResponse;
  if (body.code !== 200 || !body.data?.timings) {
    throw new Error(body.status || "Aladhan returned no timings");
  }

  const timings = applyLocalRules(config, toTimings(body.data.timings));
  const { athan } = config;

  const d = body.data.date ?? {};

  const hijri = buildHijri(dateKey, d.hijri);
  const gregorian = buildGregorian(dateKey, d.gregorian);

  const methodUsed: MethodUsed = {
    id: body.data.meta?.method?.id ?? (athan.mode === "automatic" ? AUTOMATIC_METHOD : athan.methodId),
    name: body.data.meta?.method?.name ?? "Automatic",
  };

  const iqamah = resolveIqamah(config.iqamah, timings);
  const other = resolveOther(config.other, timings, iqamah);

  return {
    dateKey,
    weekday: weekdayOf(dateKey),
    readable: d.readable ?? dateKey,
    hijri,
    gregorian,
    timings,
    methodUsed,
    iqamah,
    other,
    durations: config.durations,
  };
}

/**
 * Every day of one month, in **a single** Aladhan call
 * (`/calendar/:year/:month`, ~0.4s) instead of ~30 sequential `/timings` calls.
 */
export async function fetchMonth(
  config: PrayerConfig,
  year: number,
  month: number
): Promise<CalendarDay[]> {
  const url = `${ALADHAN}/calendar/${year}/${month}?${buildQuery(config).toString()}`;
  const body = JSON.parse(await httpsGet(url, 30000)) as CalendarResponse;
  if (body.code !== 200) throw new Error(body.status || "Aladhan returned no calendar");

  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return readCalendar(body.data)
    .map((entry) => toCalendarDay(config, entry))
    .filter((d) => d.dateKey.startsWith(prefix));
}

/**
 * Every day of a whole year, also in one call (~3.3s) — this is what makes a
 * 365-row CSV export practical rather than 365 round trips.
 */
export async function fetchYear(config: PrayerConfig, year: number): Promise<CalendarDay[]> {
  const url = `${ALADHAN}/calendar/${year}?${buildQuery(config).toString()}`;
  const body = JSON.parse(await httpsGet(url, 60000)) as CalendarResponse;
  if (body.code !== 200) throw new Error(body.status || "Aladhan returned no calendar");

  return readCalendar(body.data)
    .map((entry) => toCalendarDay(config, entry))
    .filter((d) => d.dateKey.startsWith(`${year}-`));
}

/* ── Rules ──────────────────────────────────────────────────────────────── */

function weekdayOf(dateKey: string): number {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d.getUTCDay();
}

/** Compute each prayer's iqamah time from its athan time. */
export function resolveIqamah(
  rules: IqamahConfig,
  timings: Timings
): Record<IqamahKey, string> {
  const out = {} as Record<IqamahKey, string>;
  (Object.keys(rules) as IqamahKey[]).forEach((key) => {
    const rule = rules[key];
    const athan = timings[cap(key) as TimeKey];
    if (!rule || rule.type === "none") {
      out[key] = "";
      return;
    }
    if (rule.type === "delay") {
      out[key] = shiftTime(athan, rule.delay);
      return;
    }
    // Fixed — but only ever at/after the athan.
    const fixed = rule.time || athan;
    out[key] = toMinutes(fixed) >= toMinutes(athan) ? fixed : athan;
  });
  return out;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Map of every anchor a relative time can measure from. */
function anchorMap(
  timings: Timings,
  iqamah: Record<IqamahKey, string>
): Record<string, string> {
  return {
    fajr_athan: timings.Fajr,
    fajr_iqamah: iqamah.fajr || timings.Fajr,
    sunrise_athan: timings.Sunrise,
    dhuhr_athan: timings.Dhuhr,
    dhuhr_iqamah: iqamah.dhuhr || timings.Dhuhr,
    asr_athan: timings.Asr,
    asr_iqamah: iqamah.asr || timings.Asr,
    maghrib_athan: timings.Maghrib,
    maghrib_iqamah: iqamah.maghrib || timings.Maghrib,
    isha_athan: timings.Isha,
    isha_iqamah: iqamah.isha || timings.Isha,
  };
}

function resolveRelative(
  rel: RelativeTime,
  anchors: Record<string, string>
): string {
  if (rel.mode === "fixed") return rel.time || "--:--";
  const base = anchors[rel.anchor] ?? anchors.isha_athan;
  return shiftTime(base, rel.minutes);
}

function resolveOther(
  other: OtherConfig,
  timings: Timings,
  iqamah: Record<IqamahKey, string>
) {
  const anchors = anchorMap(timings, iqamah);
  return {
    jumuah: other.jumuah.slice(0, 4).map((j) => ({
      name: j.name,
      athan: j.athan || "--:--",
      iqamah: j.iqamah || "",
    })),
    taraweeh: resolveRelative(other.taraweeh, anchors),
    imsak: resolveRelative(other.imsak, anchors),
    iftar: resolveRelative(other.iftar, anchors),
  };
}

/* ── Date helpers ───────────────────────────────────────────────────────── */

/** YYYY-MM-DD for `date`, in the masjid's timezone. */
export function dateKeyOf(date: Date, timezone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone: timezone });
}

export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export { toTime };
