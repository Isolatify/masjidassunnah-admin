import { NextRequest, NextResponse } from "next/server";
import { readPrayerSlug } from "@/lib/serverSettings";
import { prayerApiUrl } from "@/lib/settings";

const API_KEY = "JejYcMS7hsOsZTPDk2ZhKOAlW9IyQ6Px";

interface Prayer {
  key: string;
  name: string;
  arabic: string;
  athan: string;
  iqamah: string;
}

interface DayEntry {
  dateKey: string;
  weekday: number;
  prayers: Prayer[];
}

const PRAYER_META = [
  { key: "fajr", name: "Fajr", arabic: "الفجر" },
  { key: "sunrise", name: "Shuruq", arabic: "الشروق" },
  { key: "dhuhr", name: "Dhuhr", arabic: "الظهر" },
  { key: "asr", name: "Asr", arabic: "العصر" },
  { key: "maghrib", name: "Maghrib", arabic: "المغرب" },
  { key: "isha", name: "Isha", arabic: "العشاء" },
];

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "--";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Sydney",
  });
}

function buildEntry(raw: Record<string, unknown>): DayEntry | null {
  if (!raw || !raw.date) return null;
  const dateKey = String(raw.date).slice(0, 10);
  const d = new Date(String(raw.date));
  const isFriday = !isNaN(d.getTime()) && d.getDay() === 5;

  const rawJumuah = Array.isArray(raw.jumuah) ? raw.jumuah : [];
  const iqamah = raw.iqamah && typeof raw.iqamah === "object" ? (raw.iqamah as Record<string, unknown>) : {};
  const jumuahAthan = isFriday && rawJumuah.length ? String(rawJumuah[0]) : null;
  const jumuahIqamahNeedle = isFriday && Array.isArray(iqamah.jumuah) ? (iqamah.jumuah as unknown[]) : [];
  const jumuahIqamah = jumuahIqamahNeedle.length ? String(jumuahIqamahNeedle[0]) : jumuahAthan;

  const prayers: Prayer[] = PRAYER_META.map((p) => {
    if (p.key === "dhuhr" && jumuahAthan) {
      return {
        key: "jumuah",
        name: "Jumuah",
        arabic: "الجمعة",
        athan: fmtTime(jumuahAthan),
        iqamah: jumuahIqamah ? fmtTime(jumuahIqamah) : "--",
      };
    }
    return {
      key: p.key,
      name: p.name,
      arabic: p.arabic,
      athan: fmtTime(raw[p.key] as string),
      iqamah: iqamah[p.key] ? fmtTime(iqamah[p.key] as string) : "--",
    };
  });

  return {
    dateKey,
    weekday: isNaN(d.getTime()) ? -1 : d.getDay(),
    prayers,
  };
}

function sydneyDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
}

async function fetchWindow(apiUrl: string, begin: string | null): Promise<DayEntry[]> {
  const params = begin ? `?get=at&begin=${begin}&days=7` : "?get=at&days=7";
  const res = await fetch(`${apiUrl}${params}`, {
    headers: { apikey: API_KEY },
    next: { revalidate: 0 },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Masjidbox API ${res.status}`);
  const data = (await res.json()) as { timetable: Record<string, unknown>[] };
  return (data.timetable || []).map(buildEntry).filter((e): e is DayEntry => e !== null);
}

export async function GET(_request: NextRequest) {
  try {
    const apiUrl = prayerApiUrl(await readPrayerSlug());
    const today = new Date();
    const pastBegin = new Date(today);
    pastBegin.setDate(pastBegin.getDate() - 6);

    const [past, future] = await Promise.all([
      fetchWindow(apiUrl, sydneyDateKey(pastBegin)),
      fetchWindow(apiUrl, null),
    ]);

    const seen = new Set<string>();
    const week = [...past, ...future].filter((e) => {
      if (seen.has(e.dateKey)) return false;
      seen.add(e.dateKey);
      return true;
    });

    const fridays = week.filter(
      (e) => e.weekday === 5 && e.prayers.some((p) => p.key === "jumuah")
    );

    return NextResponse.json({ success: true, week, jumuah: fridays });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}