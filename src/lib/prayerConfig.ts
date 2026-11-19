/* ==========================================================================
   Prayer configuration — data model shared by the API routes and the
   prayer page. Everything here is plain data + pure helpers so it can be
   imported on both the server and the client.
   ========================================================================== */

/* ── Athan ──────────────────────────────────────────────────────────────── */

/** `automatic` = omit `method` and let Aladhan resolve the best method for
 *  the coordinates. `custom` = `method=99` + our own methodSettings. */
export type AthanMode = "automatic" | "explicit";
export type AngleMode = "angle" | "minutes";

export interface AthanConfig {
  mode: AthanMode;
  /** Aladhan method id (0–23). Only read when mode === "explicit". */
  methodId: number;
  /** Custom method (method=99) parameters. */
  fajrMode: AngleMode;
  fajrAngle: number; // 12–20
  fajrMinutes: number; // minutes before sunrise
  ishaMode: AngleMode;
  ishaAngle: number; // 12–20
  ishaMinutes: number; // minutes after maghrib
  /** 0 = Shafi (standard), 1 = Hanafi. */
  asrMethod: 0 | 1;
  /** 0 None · 1 Middle of the Night · 2 One Seventh · 3 Angle Based */
  highLatitude: 0 | 1 | 2 | 3;
  /** Minutes added to each prayer's athan. May be negative. */
  offsets: AthanOffsets;
}

/* ── Iqamah ─────────────────────────────────────────────────────────────── */

export type IqamahType = "delay" | "fixed" | "none";

export interface IqamahRule {
  type: IqamahType;
  /** Used when type === "delay" — minutes after the athan. */
  delay: number;
  /** Used when type === "fixed" — "HH:MM", always at/after the athan. */
  time: string;
}

/** Only the five prayers that actually have an iqamah. */
export const IQAMAH_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type IqamahKey = (typeof IQAMAH_KEYS)[number];

/** Manual shift applied to each prayer's athan, in minutes. */
export type AthanOffsets = Record<IqamahKey, number>;

export const PRAYER_LABELS: Record<IqamahKey, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

export type IqamahConfig = Record<IqamahKey, IqamahRule>;

/** Zero offsets for every prayer — used when previewing so the caller can
 *  apply its own draft offsets on top without double-counting. */
export function zeroOffsets(): AthanOffsets {
  return { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
}

/* ── Other prayers ──────────────────────────────────────────────────────── */

export interface JumuahEntry {
  name: string;
  athan: string; // "HH:MM" — required
  iqamah: string; // "HH:MM" — optional ("" = none)
}

/** A time that is either fixed, or offset from an anchor prayer. */
export interface RelativeTime {
  mode: "relative" | "fixed";
  /** Which athan/iqamah to measure from. */
  anchor: string; // e.g. "isha_athan"
  /** Minutes after the anchor (negative = before). */
  minutes: number;
  /** Used when mode === "fixed". */
  time: string;
}

export interface OtherConfig {
  jumuah: JumuahEntry[];
  taraweeh: RelativeTime;
  imsak: RelativeTime;
  iftar: RelativeTime;
}

/** The four selectable entries on the Other Prayers page. */
export const OTHER_KEYS = ["jumuah", "taraweeh", "imsak", "iftar"] as const;
export type OtherKey = (typeof OTHER_KEYS)[number];

/* ── Salah duration ─────────────────────────────────────────────────────── */

export type DurationConfig = Record<IqamahKey, number>;

/* ── Location ───────────────────────────────────────────────────────────── */

export interface LocationConfig {
  latitude: number;
  longitude: number;
  timezone: string;
  address: string;
}

/** The masjid's fixed address. Hard-coded on purpose: the timetable must
 *  never drift from the building, so `mergeConfig` re-imposes it over
 *  whatever happens to be stored in the database. */
export const MASJID_ADDRESS = "132-136 Haldon Street, Lakemba NSW 2195";

/* Geocoded from Haldon Street's known house numbers (Photon/OSM):
   69 ≈ -33.92023, 151.07771 · 153 ≈ -33.92226, 151.07899 → interpolate 132–136. */
export const MASJID_LOCATION: LocationConfig = {
  latitude: -33.9218,
  longitude: 151.0787,
  timezone: "Australia/Sydney",
  address: MASJID_ADDRESS,
};

/* ── Root ───────────────────────────────────────────────────────────────── */

export interface PrayerConfig {
  location: LocationConfig;
  athan: AthanConfig;
  iqamah: IqamahConfig;
  other: OtherConfig;
  durations: DurationConfig;
  /** When true every editor writes immediately and hides its Save button. */
  autosave: boolean;
}

/* ── Calculation methods ────────────────────────────────────────────────── */

export interface CalcMethod {
  id: number;
  name: string;
  /** Shown as a hint under the name. */
  note?: string;
}

/** `Automatic` and `Custom` sit above the numbered Aladhan methods.
 *  The list deliberately strips the leading "N - " from every entry. */
export const CALC_METHODS: CalcMethod[] = [
  { id: -1, name: "Automatic", note: "Resolves the best method for this location" },
  { id: 99, name: "Custom", note: "Set your own Fajr & Isha angles or minutes" },
  { id: 0, name: "Jafari / Shia Ithna-Ashari" },
  { id: 1, name: "University of Islamic Sciences, Karachi" },
  { id: 2, name: "Islamic Society of North America" },
  { id: 3, name: "Muslim World League" },
  { id: 4, name: "Umm Al-Qura University, Makkah" },
  { id: 5, name: "Egyptian General Authority of Survey" },
  { id: 7, name: "Institute of Geophysics, University of Tehran" },
  { id: 8, name: "Gulf Region" },
  { id: 9, name: "Kuwait" },
  { id: 10, name: "Qatar" },
  { id: 11, name: "Majlis Ugama Islam Singapura, Singapore" },
  { id: 12, name: "Union Organization islamic de France" },
  { id: 13, name: "Diyanet İşleri Başkanlığı, Turkey" },
  { id: 14, name: "Spiritual Administration of Muslims of Russia" },
  { id: 15, name: "Moonsighting Committee Worldwide", note: "Also requires shafaq" },
  { id: 16, name: "Dubai (experimental)" },
  { id: 17, name: "Jabatan Kemajuan Islam Malaysia (JAKIM)" },
  { id: 18, name: "Tunisia" },
  { id: 19, name: "Algeria" },
  { id: 20, name: "KEMENAG - Kementerian Agama Republik Indonesia" },
  { id: 21, name: "Morocco" },
  { id: 22, name: "Comunidade Islamica de Lisboa" },
  { id: 23, name: "Ministry of Awqaf, Islamic Affairs and Holy Places, Jordan" },
];

export const AUTOMATIC_METHOD = -1;
export const CUSTOM_METHOD = 99;

export function methodName(id: number): string {
  return CALC_METHODS.find((m) => m.id === id)?.name ?? "Automatic";
}

/* ── Option lists for the pickers ───────────────────────────────────────── */

export const ASR_OPTIONS = [
  { value: 0, name: "Shafi" },
  { value: 1, name: "Hanafi" },
] as const;

export const HIGH_LATITUDE_OPTIONS = [
  { value: 0, name: "None" },
  { value: 1, name: "Middle of the Night" },
  { value: 2, name: "One Seventh" },
  { value: 3, name: "Angle Based" },
] as const;

/* ── Hijri dates ────────────────────────────────────────────────────────── */

/** Display names, in order. "Jumadal Awwal" is the masjid's preferred
 *  spelling. Month index 1–12 maps straight onto these entries. */
export const HIJRI_MONTHS = [
  "Muharram",
  "Safar",
  "Rabiul Awwal",
  "Rabiul Akhir",
  "Jumadal Awwal",
  "Jumadal Akhir",
  "Rajab",
  "Shaban",
  "Ramadan",
  "Shawwal",
  "Dhul Qidah",
  "Dhul Hijjah",
] as const;

/**
 * Fold any Arabic month spelling onto the masjid's own one.
 *
 * Everything is diacritic-folded first. That is the whole point: Aladhan
 * returns fully vocalised names — `Jumādá al-ākhirah`, `Muḥarram`,
 * `Rabīʿ al-thānī`, `Dhū al-Qaʿdah` — and the raw strings contain macrons and
 * dot-below accents, so plain `includes("akhir")` / `startsWith("muh")` tests
 * silently miss 8 of the 12 months and every miss fell back to the wrong name
 * (Jumada II was rendering as "Jumadal Awwal"). NFD-decomposing first turns
 * `ā` → `a` + macron and `ḥ` → `h` + dot, which the mark-stripping regex then
 * removes, leaving plain ASCII to match against.
 */
function fold(raw: string): string {
  return (raw ?? "")
    .normalize("NFD")
    // Combining marks: Latin diacritics (macron/acute/circumflex/dot below …)
    // and the Arabic harakat/tatweel-combining range.
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, "")
    // Modifier letters NFD will not decompose: ʻ ʼ ʾ ʿ ` ´ ’ ‘ ' and friends.
    .replace(/[ʻʼʼʾʿ`´’‘'\u2018\u2019]/g, "")
    .toLowerCase()
    .replace(/[-–—_/.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map an Aladhan / ICU / already-normalised month name onto the masjid's
 *  spelling. Unknown names pass through untouched rather than being mangled. */
export function normalizeHijriMonth(raw: string): string {
  const m = fold(raw);
  if (!m) return "";

  const isSecond =
    m.includes("ii") ||
    m.includes("akhir") ||
    m.includes("thani") ||
    m.includes("second") ||
    m.includes("2");

  if (m.startsWith("muh")) return HIJRI_MONTHS[0];
  if (m.startsWith("saf")) return HIJRI_MONTHS[1];
  if (m.startsWith("rabi")) return isSecond ? HIJRI_MONTHS[3] : HIJRI_MONTHS[2];
  if (m.startsWith("jum")) return isSecond ? HIJRI_MONTHS[5] : HIJRI_MONTHS[4];
  if (m.startsWith("raj")) return HIJRI_MONTHS[6];
  if (m.startsWith("shaw")) return HIJRI_MONTHS[9];
  if (m.startsWith("sha")) return HIJRI_MONTHS[7];
  if (m.startsWith("ram")) return HIJRI_MONTHS[8];
  if (m.includes("hij")) return HIJRI_MONTHS[11];
  if (m.includes("qi") || m.includes("qad") || m.includes("qaad") || m.includes("kad")) {
    return HIJRI_MONTHS[10];
  }
  return raw;
}

/* ── The hijri calendar ─────────────────────────────────────────────────── */

/** Gregorian date pieces → its Umm al-Qura (ICU) hijri parts. */
export interface HijriParts {
  day: string;
  /** Masjid spelling, already normalised. */
  month: string;
  year: string;
  weekday: string;
}

/** Umm al-Qura — the official Saudi civil calendar, shipped inside ICU. */
const ISLAMIC_CALENDAR = "en-u-ca-islamic-umalqura";

const HIJRI_FMT = new Intl.DateTimeFormat(ISLAMIC_CALENDAR, {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  weekday: "long",
  timeZone: "UTC",
});

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const GREG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Resolve the hijri date for a `YYYY-MM-DD` Gregorian day.
 *
 * This is deliberately computed locally through `Intl` instead of reading the
 * month name back from Aladhan: ICU's Umm al-Qura tables are deterministic,
 * need no network, and expose the month as a **number**, so there is no
 * transliterated string left to mis-match. (Aladhan's names were the source of
 * the "month loops back to Jumadal Awwal" bug — see `normalizeHijriMonth`.)
 *
 * Returns `null` only when `dateKey` is malformed or the host lacks ICU.
 */
export function hijriFrom(dateKey: string): HijriParts | null {
  const m = DATE_KEY_RE.exec(dateKey ?? "");
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  if (Number.isNaN(date.getTime())) return null;

  try {
    const parts = HIJRI_FMT.formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const monthNo = Number(get("month"));
    return {
      day: get("day"),
      month: HIJRI_MONTHS[monthNo - 1] ?? get("month"),
      year: get("year"),
      weekday: get("weekday"),
    };
  } catch {
    return null;
  }
}

/** Gregorian parts for a `YYYY-MM-DD` day, used when Aladhan omits them. */
export function gregorianParts(dateKey: string): { day: string; weekday: string; month: string; year: string } {
  const m = DATE_KEY_RE.exec(dateKey ?? "");
  const [, y = "", mo = "", d = ""] = m ?? [];
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 12));
  const weekday = Number.isNaN(date.getTime())
    ? ""
    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getUTCDay()];
  return {
    day: d.replace(/^0/, "") || d,
    weekday,
    month: GREG_MONTHS[Number(mo) - 1] ?? "",
    year: y,
  };
}

/** "21 Jumadal Awwal 1448 AH" — day without a leading zero, no weekday. */
export function formatHijri(h: { day: string; month: string; year: string }): string {
  const day = Number(h.day);
  const year = Number(h.year);
  const d = Number.isFinite(day) && h.day !== "" ? String(day) : (h.day ?? "").trim();
  const y = Number.isFinite(year) && h.year !== "" ? String(year) : (h.year ?? "").trim();
  const month = normalizeHijriMonth(h.month);
  if (!d && !month) return "";
  return [d, month, y].filter(Boolean).join(" ") + (y ? " AH" : "");
}

/* ── Iqamah descriptors ─────────────────────────────────────────────────── */

/**
 * The rule shown underneath an iqamah time.
 *   delay → `+5 min` · fixed → `Fixed Time` · none → `No Iqama`
 */
export function iqamahRuleLabel(rule: IqamahRule | undefined): string {
  if (!rule || rule.type === "none") return "No Iqama";
  if (rule.type === "fixed") return "Fixed Time";
  const n = Math.round(Number(rule.delay) || 0);
  return `${n >= 0 ? "+" : ""}${n} min`;
}

/* ── Defaults ───────────────────────────────────────────────────────────── */

export const DEFAULT_CONFIG: PrayerConfig = {
  location: { ...MASJID_LOCATION },
  athan: {
    mode: "automatic",
    methodId: 3,
    fajrMode: "angle",
    fajrAngle: 18,
    fajrMinutes: 60,
    ishaMode: "angle",
    ishaAngle: 17,
    ishaMinutes: 90,
    asrMethod: 0,
    highLatitude: 3,
    offsets: zeroOffsets(),
  },
  iqamah: {
    fajr: { type: "delay", delay: 20, time: "" },
    dhuhr: { type: "delay", delay: 10, time: "" },
    asr: { type: "delay", delay: 10, time: "" },
    maghrib: { type: "delay", delay: 5, time: "" },
    isha: { type: "delay", delay: 10, time: "" },
  },
  other: {
    jumuah: [
      { name: "1st Jumuah", athan: "13:15", iqamah: "13:30" },
      { name: "2nd Jumuah", athan: "14:15", iqamah: "14:30" },
    ],
    taraweeh: { mode: "relative", anchor: "isha_athan", minutes: 20, time: "21:30" },
    imsak: { mode: "relative", anchor: "fajr_athan", minutes: -10, time: "04:30" },
    iftar: { mode: "relative", anchor: "maghrib_athan", minutes: 0, time: "19:23" },
  },
  durations: { fajr: 15, dhuhr: 15, asr: 15, maghrib: 15, isha: 15 },
  autosave: true,
};

/** Coerce a stored offsets blob into a complete, numeric record. */
function mergeOffsets(saved: unknown): AthanOffsets {
  const out = zeroOffsets();
  const s = (saved ?? {}) as Record<string, unknown>;
  for (const k of IQAMAH_KEYS) {
    const v = Number(s[k]);
    if (Number.isFinite(v)) out[k] = Math.round(v);
  }
  return out;
}

/** Deep-merge saved values over the defaults, tolerating partial/old rows.
 *  The location is deliberately NOT merged — it is always the masjid's. */
export function mergeConfig(saved: unknown): PrayerConfig {
  const s = (saved ?? {}) as Partial<PrayerConfig>;
  return {
    location: { ...MASJID_LOCATION },
    athan: {
      ...DEFAULT_CONFIG.athan,
      ...(s.athan ?? {}),
      offsets: mergeOffsets(s.athan?.offsets),
    },
    iqamah: { ...DEFAULT_CONFIG.iqamah, ...(s.iqamah ?? {}) },
    other: {
      ...DEFAULT_CONFIG.other,
      ...(s.other ?? {}),
      jumuah: Array.isArray(s.other?.jumuah)
        ? s.other.jumuah
        : DEFAULT_CONFIG.other.jumuah,
      taraweeh: { ...DEFAULT_CONFIG.other.taraweeh, ...(s.other?.taraweeh ?? {}) },
      imsak: { ...DEFAULT_CONFIG.other.imsak, ...(s.other?.imsak ?? {}) },
      iftar: { ...DEFAULT_CONFIG.other.iftar, ...(s.other?.iftar ?? {}) },
    },
    durations: { ...DEFAULT_CONFIG.durations, ...(s.durations ?? {}) },
    autosave: typeof s.autosave === "boolean" ? s.autosave : DEFAULT_CONFIG.autosave,
  };
}

/* ── Time helpers ───────────────────────────────────────────────────────── */

/** "HH:MM" → minutes since midnight (negative when unparseable). */
export function toMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!m) return -1;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** Minutes since midnight → "HH:MM", wrapping across midnight. */
export function toTime(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "HH:MM" shifted by n minutes → "HH:MM". */
export function shiftTime(time: string, n: number): string {
  const m = toMinutes(time);
  return m < 0 ? time : toTime(m + n);
}

/** Compare two "HH:MM" times; true when `a` is not before `b`. */
export function notBefore(a: string, b: string): boolean {
  const [am, bm] = [toMinutes(a), toMinutes(b)];
  if (am < 0 || bm < 0) return true;
  return am >= bm;
}

/** 12-hour label for display: "04:24" → "4:24 AM". */
export function prettyTime(time: string): string {
  const m = toMinutes(time);
  if (m < 0) return "--";
  const h24 = Math.floor(m / 60) % 24;
  const mins = m % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(mins).padStart(2, "0")} ${suffix}`;
}
