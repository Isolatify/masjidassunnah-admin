import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEVICE_RE = /^[A-Za-z0-9._-]{4,64}$/;

/* First launch happens on a device that may serve /screen from another
   origin — errors included, every answer carries CORS. */
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

/* Registration happens once per install, so the budget only has to stop
   junk-row spam: 10 requests per minute per IP. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, { n: number; at: number }>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const slot = hits.get(ip);
  if (!slot || now - slot.at > WINDOW_MS) {
    hits.set(ip, { n: 1, at: now });
    if (hits.size > 1000) {
      for (const [key, value] of hits) {
        if (now - value.at > WINDOW_MS) hits.delete(key);
      }
    }
    return false;
  }
  slot.n += 1;
  return slot.n > MAX_PER_WINDOW;
}

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

/**
 * POST /api/screens/register  { id, deviceId, secret }
 *
 * Called once by the /screen app on first launch. The device generates its
 * own ids; the pairing code is minted here so collisions can be checked.
 */
export async function POST(request: Request) {
  if (throttled(clientIp(request))) {
    return json({ success: false, error: "Too many attempts" }, 429);
  }

  let body: { id?: unknown; deviceId?: unknown; secret?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Invalid JSON" }, 400);
  }

  const id = typeof body.id === "string" ? body.id : "";
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  const secret = typeof body.secret === "string" ? body.secret : "";

  if (!UUID_RE.test(id)) {
    return json({ success: false, error: "id must be a uuid" }, 400);
  }
  if (!UUID_RE.test(secret)) {
    return json({ success: false, error: "secret must be a uuid" }, 400);
  }
  if (!DEVICE_RE.test(deviceId)) {
    return json({ success: false, error: "deviceId is not valid" }, 400);
  }

  try {
    /* Mint a 6-digit code that no other pending screen is showing. */
    let code = "";
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const { data } = await supabase
        .from("screens")
        .select("id")
        .eq("code", candidate)
        .eq("status", "pending")
        .limit(1);
      if (!data || data.length === 0) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("could not mint a code");

    const { error } = await supabase.from("screens").insert({
      id,
      device_id: deviceId,
      device_secret: secret,
      code,
      status: "pending",
    });
    if (error) throw new Error(error.message);

    return json({ success: true, code });
  } catch (e) {
    return json(
      { success: false, error: e instanceof Error ? e.message : "Failed to register" },
      500
    );
  }
}
