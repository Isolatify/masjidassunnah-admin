import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, SECTIONS, mergeSettings, allFieldKeys, setPath, getPath } from "@/lib/settings";

export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.FORM_CORS_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Settings live in app_metadata of a designated owner account (no SQL needed).
// Prefer the primary admin, fall back to the oldest user.
async function readSettings(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (error || !data?.users?.length) return DEFAULT_SETTINGS as unknown as Record<string, unknown>;
  const users = [...data.users].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const withSettings = users.find((u) => (u.app_metadata as Record<string, unknown>)?.site_settings);
  const source = (withSettings ?? users[0]).app_metadata as Record<string, unknown>;
  return mergeSettings(DEFAULT_SETTINGS, source.site_settings);
}

async function writeSettings(settings: Record<string, unknown>): Promise<void> {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 200 });
  const users = data?.users ?? [];
  if (!users.length) throw new Error("No users found");
  const sorted = [...users].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const owner =
    sorted.find((u) => u.email === "admin@masjidassunnah.com.au") ??
    sorted.find((u) => (u.app_metadata as Record<string, unknown>)?.site_settings) ??
    sorted[0];
  const meta = { ...(owner.app_metadata as Record<string, unknown>), site_settings: settings };
  const { error } = await supabase.auth.admin.updateUserById(owner.id, { app_metadata: meta });
  if (error) throw new Error(error.message);
}

export async function GET() {
  try {
    const settings = await readSettings();
    return NextResponse.json({ success: true, settings, sections: SECTIONS }, { headers: CORS_HEADERS });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load settings" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const body = (await request.json()) as { settings?: Record<string, unknown> };
    if (!body.settings || typeof body.settings !== "object") {
      return NextResponse.json({ success: false, error: "settings is required" }, { status: 400 });
    }

    // Only accept known fields.
    const allowed = allFieldKeys();
    let next = await readSettings();
    for (const path of allowed) {
      const value = getPath(body.settings, path);
      if (value === undefined) continue;
      next = setPath(next, path, coerce(next, path, value));
    }
    await writeSettings(next);
    return NextResponse.json({ success: true, settings: next }, { headers: CORS_HEADERS });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to save settings" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const POST = PUT;

function coerce(current: Record<string, unknown>, path: string, value: unknown): unknown {
  const flat: Record<string, unknown> = {};
  for (const s of SECTIONS) for (const f of s.fields) flat[f.key] = f;
  const def = flat[path];
  const type = def && typeof def === "object" && "type" in def ? (def as { type: string }).type : "text";
  const cur = path.split(".").reduce<unknown>((acc, p) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[p];
    return undefined;
  }, current);
  if (type === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n : cur;
  }
  if (type === "toggle") return Boolean(value);
  if (typeof value === "string") return value.slice(0, 4000);
  return value;
}
