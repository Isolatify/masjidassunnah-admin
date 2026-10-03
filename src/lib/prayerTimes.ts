export interface Prayer {
  key: string;
  name: string;
  arabic: string;
  athan: string;
  iqamah: string;
}

export interface DayEntry {
  dateKey: string;
  weekday: number;
  prayers: Prayer[];
}

export type Week = DayEntry[];

export function navDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
}

export function getDayPrayers(week: Week, date: Date): Prayer[] | null {
  if (!week || !week.length) return null;
  const key = navDateKey(date);
  const exact = week.find((e) => e.dateKey === key);
  if (exact) return exact.prayers;
  const wd = date.getDay();
  const byWd = week.find((e) => e.weekday === wd);
  return byWd ? byWd.prayers : week[week.length - 1].prayers;
}

export function parseTimeToMins(str: string): number {
  if (!str || str === "--") return -1;
  const m = str.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return -1;
  let h = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
  if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
  return h * 60 + mins;
}

function parseTimeComponents(timeStr: string): { h: number; m: number } | null {
  if (!timeStr || timeStr === "--") return null;
  const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
  if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
  return { h, m: mins };
}

function timeToDate(date: Date, timeStr: string): Date | null {
  const tc = parseTimeComponents(timeStr);
  if (!tc) return null;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    tc.h,
    tc.m,
    0,
    0
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function getDiffParts(ms: number): { hours: string; minutes: string; seconds: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { hours: pad(h), minutes: pad(m), seconds: pad(s) };
}

export function getCountdownParts(
  targetDate: Date,
  timeStr: string,
  now: Date
): { hours: string; minutes: string; seconds: string } | null {
  const target = timeToDate(targetDate, timeStr);
  if (!target) return null;
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return null;
  return getDiffParts(diff);
}

export function getElapsedParts(
  targetDate: Date,
  timeStr: string,
  now: Date
): { hours: string; minutes: string; seconds: string } | null {
  const target = timeToDate(targetDate, timeStr);
  if (!target) return null;
  return getDiffParts(Math.max(0, now.getTime() - target.getTime()));
}

export function getNextPrayer(
  prayers: Prayer[],
  now: Date,
  nextPrayers: Prayer[]
): {
  prayer: Prayer;
  phase: "athan" | "iqamah";
  targetTime: string;
  showIqamah: boolean;
  nextDay?: boolean;
} | null {
  if (!prayers) return null;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const byKey = Object.fromEntries(prayers.map((p) => [p.key, p]));
  const ordered = prayers.filter(
    (p) => p.key !== "sunrise" && parseTimeToMins(p.iqamah) >= 0
  );

  for (const p of ordered) {
    const iqM = parseTimeToMins(p.iqamah);
    if (nowMins < iqM) {
      const athanM = parseTimeToMins(p.athan);
      if (nowMins < athanM) {
        return {
          prayer: p,
          phase: "athan",
          targetTime: p.athan,
          showIqamah: true,
        };
      }
      return {
        prayer: p,
        phase: "iqamah",
        targetTime: p.iqamah,
        showIqamah: false,
      };
    }
  }

  const nextByKey = Object.fromEntries((nextPrayers || []).map((p) => [p.key, p]));
  const fajr = nextByKey["fajr"] || byKey["fajr"];
  return {
    prayer: fajr,
    phase: "athan",
    targetTime: fajr?.athan,
    showIqamah: true,
    nextDay: true,
  };
}

export function getNavLabel(navDate: Date): string {
  const today = new Date();
  if (
    today.getFullYear() === navDate.getFullYear() &&
    today.getMonth() === navDate.getMonth() &&
    today.getDate() === navDate.getDate()
  ) {
    return "Today";
  }
  return navDate.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function getDaysFromToday(navDate: Date): number {
  const today = new Date();
  const startNav = new Date(
    navDate.getFullYear(),
    navDate.getMonth(),
    navDate.getDate()
  );
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  return Math.round((startNav.getTime() - startToday.getTime()) / 86400000);
}

export function startOfToday(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

export function getNextFridayFormatted(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function getLastFridayOfMonth(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  const friday = new Date(lastDay);
  while (friday.getDay() !== 5) {
    friday.setDate(friday.getDate() - 1);
  }
  return friday.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}