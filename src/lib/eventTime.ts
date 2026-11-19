// Occurrence expansion + next-date helpers for the dashboard Events pages.
// Ported from web/src/lib/eventTime.js (minus the prayer-timetable countdown,
// which the admin editor computes locally).

export interface DateEntryLike {
  display?: string | null;
  date_start?: string | null;
  date_end?: string | null;
  date_type?: string | null;
  recurring_pattern?: string | null;
  weekdays?: string[] | null;
}

const WEEKDAY_TO_IDX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
const RECUR_BACK_DAYS = 366;
const RECUR_FWD_DAYS = 366;
const MAX_RANGE_DAYS = 62;
const MAX_RECURRING_DAYS = 400;

function parseDay(str?: string | null): Date | null {
  if (!str) return null;
  const d = new Date(`${str}T12:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function isRecurringEntry(entry?: DateEntryLike | null): boolean {
  return !!entry && (entry.date_type === "recurring" || !!entry.recurring_pattern);
}

export function effectiveEntries(ev: {
  dates_json?: DateEntryLike[] | null;
  date_start?: string | null;
  date_end?: string | null;
  date_type?: string | null;
  recurring_pattern?: string | null;
}): DateEntryLike[] {
  if (!ev) return [];
  const list = (ev.dates_json || []).filter((d) => d?.date_start);
  if (list.length) return list;
  if (ev.date_start)
    return [
      {
        date_start: ev.date_start,
        date_end: ev.date_end || null,
        date_type: ev.date_type || null,
        recurring_pattern: ev.recurring_pattern || null,
        weekdays: null,
      },
    ];
  return [];
}

function expandSpan(entry: DateEntryLike): Date[] {
  const start = parseDay(entry?.date_start);
  if (!start) return [];
  let end = start;
  if (entry.date_end && entry.date_end !== entry.date_start) {
    const e = parseDay(entry.date_end);
    if (e) end = e;
  }
  const out: Date[] = [];
  let d = new Date(start);
  let guard = 0;
  while (d <= end && guard < MAX_RANGE_DAYS) {
    out.push(new Date(d));
    d = addDays(d, 1);
    guard += 1;
  }
  return out;
}

function expandRecurring(entry: DateEntryLike, today: Date): Date[] {
  const start = parseDay(entry?.date_start);
  if (!start) return [];
  let pattern =
    entry.recurring_pattern ||
    (entry.date_type === "recurring"
      ? entry.weekdays?.length
        ? "custom"
        : "weekly"
      : null);
  if (!pattern) return [];
  if (pattern === "custom" && !entry.weekdays?.length) pattern = "weekly";

  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const winStart = addDays(t0, -RECUR_BACK_DAYS);
  const winEnd = addDays(t0, RECUR_FWD_DAYS);
  const from = start.getTime() > winStart.getTime() ? new Date(start) : winStart;
  let to = winEnd;
  const entryEnd = entry.date_end ? parseDay(entry.date_end) : null;
  if (entryEnd && entryEnd.getTime() < to.getTime()) to = entryEnd;
  if (from.getTime() > to.getTime()) return [];

  const out: Date[] = [];
  const push = (d: Date) => {
    if (
      out.length < MAX_RECURRING_DAYS &&
      d.getTime() >= from.getTime() &&
      d.getTime() <= to.getTime()
    )
      out.push(d);
  };

  if (pattern === "custom" && entry.weekdays?.length) {
    const wanted = new Set(
      entry.weekdays.map((w) => WEEKDAY_TO_IDX[w]).filter((n) => n !== undefined)
    );
    let d = new Date(from);
    let guard = 0;
    const limit = RECUR_BACK_DAYS + RECUR_FWD_DAYS + 2;
    while (d.getTime() <= to.getTime() && guard < limit && out.length < MAX_RECURRING_DAYS) {
      if (wanted.has(d.getDay())) push(new Date(d));
      d = addDays(d, 1);
      guard += 1;
    }
    return out;
  }

  if (pattern === "daily") {
    let d = new Date(from);
    let guard = 0;
    while (d.getTime() <= to.getTime() && out.length < MAX_RECURRING_DAYS && guard < MAX_RECURRING_DAYS) {
      push(new Date(d));
      d = addDays(d, 1);
      guard += 1;
    }
    return out;
  }

  if (pattern === "weekly") {
    const diffDays = Math.round((from.getTime() - start.getTime()) / 86400000);
    const k = Math.max(0, Math.ceil(diffDays / 7));
    let d = addDays(start, 7 * k);
    let guard = 0;
    while (d.getTime() <= to.getTime() && out.length < MAX_RECURRING_DAYS && guard < MAX_RECURRING_DAYS) {
      push(new Date(d));
      d = addDays(d, 7);
      guard += 1;
    }
    return out;
  }

  if (pattern === "monthly") {
    const dom = start.getDate();
    let cursor = new Date(start);
    let guard = 0;
    while (cursor.getTime() <= to.getTime() && guard < 800) {
      if (out.length < MAX_RECURRING_DAYS) push(new Date(cursor));
      const y = cursor.getFullYear();
      const m = cursor.getMonth() + 1;
      const dim = new Date(y, m + 1, 0).getDate();
      cursor = new Date(y, m, Math.min(dom, dim), 12);
      guard += 1;
    }
    return out;
  }

  if (pattern === "yearly") {
    let cursor = new Date(start);
    let guard = 0;
    while (cursor.getTime() <= to.getTime() && guard < 200) {
      if (out.length < MAX_RECURRING_DAYS) push(new Date(cursor));
      const y = cursor.getFullYear() + 1;
      const m = start.getMonth();
      const dim = new Date(y, m + 1, 0).getDate();
      cursor = new Date(y, m, Math.min(start.getDate(), dim), 12);
      guard += 1;
    }
    return out;
  }

  return [];
}

export function entryOccurrences(entry: DateEntryLike, today = new Date()): Date[] {
  return isRecurringEntry(entry)
    ? expandRecurring(entry, today)
    : expandSpan(entry);
}

export function eventOccurrences(
  ev: {
    dates_json?: DateEntryLike[] | null;
    date_start?: string | null;
    date_end?: string | null;
    date_type?: string | null;
    recurring_pattern?: string | null;
  },
  today = new Date()
): Date[] {
  const out: Date[] = [];
  for (const entry of effectiveEntries(ev)) {
    const days = entryOccurrences(entry, today);
    for (const d of days) out.push(d);
  }
  return out;
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function nextEventDate(
  entries: DateEntryLike[],
  todayStr = new Date().toLocaleDateString("en-CA")
): { idx: number; dateStr: string } | null {
  const raw = new Date(`${todayStr}T00:00:00`);
  const now = new Date();
  const t0 = isNaN(raw.getTime())
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
  const today = new Date(t0);
  let best: { idx: number; dateStr: string } | null = null;
  (entries || []).forEach((entry, idx) => {
    if (!entry?.date_start) return;
    let dateStr: string | null = null;
    if (isRecurringEntry(entry)) {
      const upcoming = expandRecurring(entry, today).filter(
        (d) => d.getTime() >= t0.getTime()
      );
      if (upcoming.length) dateStr = ymd(upcoming[0]);
    } else {
      const s = entry.date_start!;
      const end =
        entry.date_end && entry.date_end !== entry.date_start ? entry.date_end : s;
      if (end >= todayStr) dateStr = s <= todayStr ? todayStr : s;
    }
    if (dateStr && (!best || dateStr < best.dateStr)) best = { idx, dateStr };
  });
  return best;
}
