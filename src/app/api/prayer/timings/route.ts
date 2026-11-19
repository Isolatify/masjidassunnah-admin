import { NextResponse } from "next/server";
import { fetchDay, shiftDateKey } from "@/lib/aladhan";
import { mergeConfig, type PrayerConfig } from "@/lib/prayerConfig";
import { savedConfig } from "@/lib/prayerStore";

export const dynamic = "force-dynamic";

/* The /screen board fetches this cross-origin from its own deploy. */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.FORM_CORS_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const json = (body: Record<string, unknown>, status?: number) =>
  NextResponse.json(body, { status, headers: CORS_HEADERS });

const MAX_DAYS = 62;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/prayer/timings?date=YYYY-MM-DD[&days=7][&config=<json>]
 *
 * `config` is only accepted to preview unsaved edits inside the modal; when it
 * is omitted the saved row is used.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const dateKey = url.searchParams.get("date") || today;

  if (!DATE_RE.test(dateKey)) {
    return json({ success: false, error: "date must be YYYY-MM-DD" }, 400);
  }

  const rawDays = Number(url.searchParams.get("days") ?? "1");
  const days = Math.max(1, Math.min(MAX_DAYS, Number.isFinite(rawDays) ? Math.floor(rawDays) : 1));

  const rawConfig = url.searchParams.get("config");
  let config: PrayerConfig;
  if (rawConfig) {
    try {
      config = mergeConfig(JSON.parse(rawConfig));
    } catch {
      return json({ success: false, error: "config is not valid JSON" }, 400);
    }
  } else {
    config = await savedConfig();
  }

  try {
    /* A week is the unit the board renders, so the days are fetched together
       rather than one after another — 7 round trips in parallel instead of 7
       in series. */
    const out = await Promise.all(
      Array.from({ length: days }, (_, i) => fetchDay(config, shiftDateKey(dateKey, i)))
    );
    return json({ success: true, days: out, config });
  } catch (e) {
    return json(
      { success: false, error: e instanceof Error ? e.message : "Aladhan request failed" },
      502
    );
  }
}
