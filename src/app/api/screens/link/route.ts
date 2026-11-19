import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CODE_RE = /^\d{6}$/;

function bad(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function findPending(code: string) {
  const { data, error } = await supabase
    .from("screens")
    .select("id")
    .eq("code", code)
    .eq("status", "pending")
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

/**
 * GET /api/screens/link?code=123456
 *
 * Step 1 of Link New Device: is the code the screen is showing real, unused
 * and still waiting? Staff session required — this is the only endpoint
 * that lets you discover someone else's pending code.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const code = new URL(request.url).searchParams.get("code") ?? "";
  if (!CODE_RE.test(code)) return bad("code must be 6 digits");

  try {
    const pending = await findPending(code);
    return NextResponse.json({ success: true, valid: !!pending });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Lookup failed", 500);
  }
}

/**
 * POST /api/screens/link  { code, name }
 *
 * Step 2: the admin names the screen. Claiming is a single conditional
 * update — if two dashboards race for the same code, exactly one wins and
 * the other gets a 409.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  let body: { code?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return bad("Invalid JSON");
  }

  const code = typeof body.code === "string" ? body.code : "";
  const name = (typeof body.name === "string" ? body.name : "").replace(/\s+/g, " ").trim();

  if (!CODE_RE.test(code)) return bad("code must be 6 digits");
  if (!name) return bad("name is required");
  if (name.length > 40) return bad("name must be 40 characters or fewer");

  try {
    /* Resolve to a single row first — a coincidental duplicate code must
       never pair two devices at once. */
    const pending = await findPending(code);
    if (!pending) {
      return bad("That code is no longer valid — check the screen and try again.", 409);
    }

    const { data, error } = await supabase
      .from("screens")
      .update({
        status: "paired",
        name,
        paired_at: new Date().toISOString(),
      })
      .eq("id", pending.id)
      .eq("status", "pending")
      .select("id, name")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return bad("That code is no longer valid — check the screen and try again.", 409);
    }

    return NextResponse.json({ success: true, screen: data });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Failed to link screen", 500);
  }
}
