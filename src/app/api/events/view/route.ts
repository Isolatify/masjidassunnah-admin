import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* Public ping — no session. The website fires this (fire-and-forget) when an
   event page is opened, so the Events overview can show real view counts.
   Writes go through the service role → bump_event_view(), the only role
   granted EXECUTE on it (see migration 20261117120000). */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.FORM_CORS_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/* One ping per event+IP per window, so a refresh loop or a shared NAT can't
   inflate the counter. In-memory is enough: a lost entry only means one
   extra counted view after a server restart. */
const COOLDOWN_MS = 30_000;
const seen = new Map<string, number>();

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { event_id?: unknown } | null;
  const eventId = typeof body?.event_id === "string" && body.event_id ? body.event_id : null;
  if (!eventId) {
    return NextResponse.json(
      { success: false, error: "event_id is required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${eventId}|${ip}`;
  const now = Date.now();
  const last = seen.get(key);
  if (last !== undefined && now - last < COOLDOWN_MS) {
    return NextResponse.json({ success: true, counted: false }, { headers: CORS_HEADERS });
  }
  if (seen.size > 10_000) {
    for (const [k, t] of seen) if (now - t >= COOLDOWN_MS) seen.delete(k);
  }
  seen.set(key, now);

  const { error } = await supabase.rpc("bump_event_view", { p_event_id: eventId });
  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
  return NextResponse.json({ success: true, counted: true }, { headers: CORS_HEADERS });
}
