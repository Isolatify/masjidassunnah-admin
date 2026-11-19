import { NextResponse } from "next/server";
import { fetchMonth, type CalendarDay } from "@/lib/aladhan";
import { mergeConfig, type PrayerConfig } from "@/lib/prayerConfig";
import { savedConfig } from "@/lib/prayerStore";

export const dynamic = "force-dynamic";

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/**
 * GET /api/prayer/month?month=YYYY-MM
 *
 * The whole month's timetable in **one** upstream request (Aladhan's
 * `/calendar/:year/:month`) instead of ~30 sequential `/timings` calls.
 * `config` may be passed to preview unsaved edits; otherwise the saved row is
 * used, exactly like /api/prayer/timings.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("month") ?? "";

  const m = MONTH_RE.exec(raw);
  if (!m) {
    return NextResponse.json(
      { success: false, error: "month must be YYYY-MM" },
      { status: 400 }
    );
  }

  const year = Number(m[1]);
  const month = Number(m[2]);
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return NextResponse.json(
      { success: false, error: `year must be between ${MIN_YEAR} and ${MAX_YEAR}` },
      { status: 400 }
    );
  }

  const rawConfig = url.searchParams.get("config");
  let config: PrayerConfig;
  if (rawConfig) {
    try {
      config = mergeConfig(JSON.parse(rawConfig));
    } catch {
      return NextResponse.json(
        { success: false, error: "config is not valid JSON" },
        { status: 400 }
      );
    }
  } else {
    config = await savedConfig();
  }

  try {
    const days: CalendarDay[] = await fetchMonth(config, year, month);
    if (!days.length) {
      return NextResponse.json(
        { success: false, error: "Aladhan returned no days for that month" },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, month: raw, days });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Aladhan request failed" },
      { status: 502 }
    );
  }
}
