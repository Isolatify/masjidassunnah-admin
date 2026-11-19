import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* The /screen app may be served from another origin (a static host or a
   different deploy), so every answer — including errors — carries CORS. */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.FORM_CORS_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const json = (body: Record<string, unknown>, status?: number) =>
  NextResponse.json(body, { status, headers: CORS_HEADERS });

/* Only write last_seen when it has actually drifted, so a device polling
   every few seconds costs one row read and very few row writes. */
const HEARTBEAT_MS = 30_000;

const NOT_FOUND = () =>
  json({ success: false, error: "Screen not found" }, 404);

/**
 * POST /api/screens/status  { id, secret }
 *
 * The /screen app polls this while it waits to be paired (and afterwards as
 * a heartbeat). Answering also refreshes last_seen, which the dashboard
 * reads as Online / Offline. The secret keeps the row private — anon never
 * reads this table.
 */
export async function POST(request: Request) {
  let body: { id?: unknown; secret?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const id = typeof body.id === "string" ? body.id : "";
  const secret = typeof body.secret === "string" ? body.secret : "";
  if (!UUID_RE.test(id) || !UUID_RE.test(secret)) return NOT_FOUND();

  try {
    const { data, error } = await supabase
      .from("screens")
      .select("id, device_secret, status, name, color, code, last_seen")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    /* Unknown row and wrong secret answer the same way — the device treats
       both as "start over" and there is nothing to probe. */
    if (!data || data.device_secret !== secret) return NOT_FOUND();

    const stale =
      !data.last_seen || Date.now() - Date.parse(data.last_seen) > HEARTBEAT_MS;
    if (stale) {
      const { error: updateError } = await supabase
        .from("screens")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", id);
      if (updateError) throw new Error(updateError.message);
    }

    return json({
      success: true,
      status: data.status,
      name: data.name,
      color: data.color,
      code: data.code,
    });
  } catch (e) {
    return json(
      { success: false, error: e instanceof Error ? e.message : "Status check failed" },
      500
    );
  }
}
