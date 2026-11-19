import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/supabase/server";
import { SECTIONS, allFieldKeys, setPath, getPath } from "@/lib/settings";
import { readSettings, writeSettings } from "@/lib/serverSettings";

export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.FORM_CORS_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
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
