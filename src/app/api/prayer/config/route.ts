import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/supabase/server";
import { DEFAULT_CONFIG, mergeConfig, type PrayerConfig } from "@/lib/prayerConfig";

export const dynamic = "force-dynamic";

const ROW_ID = "default";

let admin: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!admin) {
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return admin;
}

interface Row {
  location: unknown;
  athan: unknown;
  iqamah: unknown;
  other: unknown;
  durations: unknown;
  autosave?: unknown;
}

/* Supabase reports a missing table two different ways depending on whether the
   schema cache or Postgres itself answers first. */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    /could not find the table/i.test(error.message ?? "") ||
    /does not exist/i.test(error.message ?? "")
  );
}

/* The table exists but no role has been granted access to it — the seed SQL
   needs to be run again (it now includes the GRANTs). */
function isPermissionDenied(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42501" || /permission denied/i.test(error.message ?? "")
  );
}

const PERMISSION_HINT =
  "The prayer_settings table has no GRANTs yet — run `supabase db push` (migration 20261117120100_prayer_settings.sql).";

/* The `autosave` column is added by the latest seed SQL. If the row predates
   it, Postgres rejects the whole upsert — retry once without it so saving the
   prayer times still works and the admin only loses the autosave preference. */
function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || /column .* does not exist/i.test(error.message ?? "");
}

function fail(error: { code?: string; message?: string } | null) {
  if (isMissingTable(error) || isPermissionDenied(error)) {
    return NextResponse.json({ success: false, error: PERMISSION_HINT }, { status: 500 });
  }
  return NextResponse.json({ success: false, error: error?.message || "Unexpected error" }, { status: 500 });
}

function toConfig(row: Partial<Row> | null): PrayerConfig {
  if (!row) return DEFAULT_CONFIG;
  // `mergeConfig` picks the known keys off the row and re-imposes the fixed
  // masjid location, so a stale/missing column can never drift the times.
  return mergeConfig(row);
}

/** Read the saved prayer configuration (falls back to defaults). */
export async function GET() {
  try {
    const { data, error } = await db()
      .from("prayer_settings")
      .select("*")
      .eq("id", ROW_ID)
      .maybeSingle();

    if (error) {
      // Table not created yet — degrade to defaults instead of failing.
      if (isMissingTable(error)) {
        return NextResponse.json({ success: true, config: DEFAULT_CONFIG, stored: false });
      }
      return fail(error);
    }

    return NextResponse.json({
      success: true,
      config: toConfig(data as Partial<Row> | null),
      stored: !!data,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to read config" },
      { status: 500 }
    );
  }
}

/** Save the prayer configuration (one row). */
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const body = (await request.json()) as { config?: PrayerConfig };
    if (!body.config || typeof body.config !== "object") {
      return NextResponse.json({ success: false, error: "config is required" }, { status: 400 });
    }

    const config = mergeConfig(body.config);

    const base = {
      id: ROW_ID,
      location: config.location,
      athan: config.athan,
      iqamah: config.iqamah,
      other: config.other,
      durations: config.durations,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    let { error } = await db().from("prayer_settings").upsert({ ...base, autosave: config.autosave }, { onConflict: "id" });

    if (error && isMissingColumn(error)) {
      ({ error } = await db().from("prayer_settings").upsert(base, { onConflict: "id" }));
      if (!error) {
        return NextResponse.json({
          success: true,
          config,
          warning: "The `autosave` column is missing — run `supabase db push` (migration 20261117120100_prayer_settings.sql) to persist it.",
        });
      }
    }

    if (error) {
      return fail(error);
    }

    return NextResponse.json({ success: true, config });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to save config" },
      { status: 500 }
    );
  }
}

export const POST = PUT;
