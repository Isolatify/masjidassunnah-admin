import { NextRequest, NextResponse } from "next/server";
import { prayerApiUrl, DEFAULT_PRAYER_SLUG, normaliseSlug } from "@/lib/settings";

const API_KEY = "JejYcMS7hsOsZTPDk2ZhKOAlW9IyQ6Px";

/* Lightweight connectivity probe for an (unsaved) slug. Used by Prayer Settings
   to verify a Masjidbox source before the user commits to saving it. */
export async function GET(request: NextRequest) {
  const slug = normaliseSlug(request.nextUrl.searchParams.get("slug") || "") || DEFAULT_PRAYER_SLUG;
  const apiUrl = prayerApiUrl(slug);
  const t0 = Date.now();

  try {
    const res = await fetch(`${apiUrl}?get=at&days=7`, {
      headers: { apikey: API_KEY },
      cache: "no-store",
    });
    const ms = Date.now() - t0;
    if (!res.ok) {
      return NextResponse.json({ success: false, slug, apiUrl, status: res.status, ms });
    }
    const data = (await res.json()) as { timetable?: Record<string, unknown>[] };
    const count = data.timetable?.length ?? 0;
    const first = data.timetable?.[0];
    return NextResponse.json({
      success: count > 0,
      slug,
      apiUrl,
      status: res.status,
      ms,
      count,
      sampleDate: first?.date ? String(first.date).slice(0, 10) : null,
    });
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      slug,
      apiUrl,
      ms: Date.now() - t0,
      error: error instanceof Error ? error.message : "Network error",
    });
  }
}
