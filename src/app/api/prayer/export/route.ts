import { NextResponse } from "next/server";
import { fetchYear, type CalendarDay } from "@/lib/aladhan";
import { prettyTime, type IqamahKey, type PrayerConfig } from "@/lib/prayerConfig";
import { savedConfig } from "@/lib/prayerStore";

export const dynamic = "force-dynamic";

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/** Columns: the six athans plus an iqamah column for each prayer that has one. */
const HEAD = [
  "Date",
  "Weekday",
  "Hijri",
  "Fajr Athan",
  "Fajr Iqamah",
  "Sunrise",
  "Dhuhr Athan",
  "Dhuhr Iqamah",
  "Asr Athan",
  "Asr Iqamah",
  "Maghrib Athan",
  "Maghrib Iqamah",
  "Isha Athan",
  "Isha Iqamah",
];

/** RFC 4180 quoting — needed the moment a value carries a comma or a quote. */
function cell(value: string): string {
  const v = value ?? "";
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsv(days: CalendarDay[]): string {
  const lines = [HEAD.join(",")];

  for (const d of days) {
    const iq = (k: IqamahKey) => (d.iqamah[k] ? prettyTime(d.iqamah[k]) : "");
    lines.push(
      [
        d.dateKey,
        d.gregorian.weekday,
        d.hijri.formatted || `${d.hijri.day} ${d.hijri.month} ${d.hijri.year} AH`,
        prettyTime(d.timings.Fajr),
        iq("fajr"),
        prettyTime(d.timings.Sunrise),
        prettyTime(d.timings.Dhuhr),
        iq("dhuhr"),
        prettyTime(d.timings.Asr),
        iq("asr"),
        prettyTime(d.timings.Maghrib),
        iq("maghrib"),
        prettyTime(d.timings.Isha),
        iq("isha"),
      ]
        .map(cell)
        .join(",")
    );
  }

  // CRLF so Excel on Windows opens it as CSV rather than as one long cell.
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * GET /api/prayer/export?year=YYYY → text/csv
 *
 * A whole year resolves from a single Aladhan `/calendar/:year` call, so the
 * export costs one ~3s upstream request rather than 365 of them.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));

  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return NextResponse.json(
      { success: false, error: `year must be between ${MIN_YEAR} and ${MAX_YEAR}` },
      { status: 400 }
    );
  }

  try {
    const config: PrayerConfig = await savedConfig();
    const days = await fetchYear(config, year);
    if (!days.length) {
      return NextResponse.json(
        { success: false, error: "Aladhan returned no days for that year" },
        { status: 502 }
      );
    }

    return new NextResponse(toCsv(days), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="masjid-as-sunnah-prayer-times-${year}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Aladhan request failed" },
      { status: 502 }
    );
  }
}
