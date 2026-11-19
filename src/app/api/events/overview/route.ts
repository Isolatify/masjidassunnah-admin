import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/supabase/server";

/* Everything /dashboard/events needs for its overview in one round trip:
   the event list, response aggregates, per-form counts, the latest few
   submissions, and a 30-day views × responses trend. Event-side numbers the
   page can derive itself (upcoming, latest, top views) stay on the client —
   it already has the occurrence helpers. */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* Newest-first rows for aggregates; the cap only bites past a masjid-scale
   amount of history, and the exact total below never trusts it. */
const RESPONSE_CAP = 5000;
const TREND_DAYS = 30;
const DAY_MS = 86_400_000;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface ResponseRow {
  id: string;
  form_id: string | null;
  created_at: string;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const now = Date.now();
  const trendFrom = ymd(new Date(now - (TREND_DAYS - 1) * DAY_MS));

  const [eventsRes, formsRes, totalRes, rowsRes, viewsRes] = await Promise.all([
    supabase.from("events").select("*").order("created_at", { ascending: false }),
    supabase.from("forms").select("id, title, status"),
    supabase.from("form_responses").select("id", { count: "exact", head: true }),
    supabase
      .from("form_responses")
      .select("id, form_id, created_at")
      .order("created_at", { ascending: false })
      .limit(RESPONSE_CAP),
    supabase.from("event_views").select("day, views").gte("day", trendFrom).limit(10_000),
  ]);

  const firstError =
    eventsRes.error || formsRes.error || totalRes.error || rowsRes.error || viewsRes.error;
  if (firstError) {
    return NextResponse.json({ success: false, error: firstError.message }, { status: 500 });
  }

  const rows = (rowsRes.data ?? []) as ResponseRow[];
  const forms = (formsRes.data ?? []) as { id: string; title: string; status: string }[];
  const titleByForm = new Map(forms.map((f) => [f.id, f.title]));

  /* ── Response aggregates ── */
  const iso = (days: number) => new Date(now - days * DAY_MS).toISOString();
  const cut7 = iso(7);
  const cut30 = iso(30);
  const cut60 = iso(60);
  let last7 = 0;
  let last30 = 0;
  let prev30 = 0;
  const formCounts: Record<string, number> = {};
  for (const r of rows) {
    if (r.created_at >= cut7) last7 += 1;
    if (r.created_at >= cut30) last30 += 1;
    else if (r.created_at >= cut60) prev30 += 1;
    if (r.form_id) formCounts[r.form_id] = (formCounts[r.form_id] ?? 0) + 1;
  }

  /* ── Latest submissions, titled for display ── */
  const recent = rows.slice(0, 8).map((r) => ({
    id: r.id,
    form_id: r.form_id,
    form_title: r.form_id ? (titleByForm.get(r.form_id) ?? "Untitled form") : "Direct response",
    created_at: r.created_at,
  }));

  /* ── 30-day trend: one bucket per UTC day (matches event_views.day) ── */
  const buckets = new Map<string, { views: number; responses: number }>();
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    buckets.set(ymd(new Date(now - i * DAY_MS)), { views: 0, responses: 0 });
  }
  for (const row of (viewsRes.data ?? []) as { day: string; views: number }[]) {
    const b = buckets.get(row.day);
    if (b) b.views += row.views;
  }
  for (const r of rows) {
    const b = buckets.get(r.created_at.slice(0, 10));
    if (b) b.responses += 1;
  }
  const trend = Array.from(buckets, ([day, v]) => ({ day, views: v.views, responses: v.responses }));

  return NextResponse.json({
    success: true,
    events: eventsRes.data ?? [],
    forms: {
      total: forms.length,
      active: forms.filter((f) => f.status === "published").length,
    },
    responses: {
      total: totalRes.count ?? rows.length,
      last7,
      last30,
      prev30,
    },
    formCounts,
    recent,
    trend,
  });
}
