/* ==========================================================================
   Shared server-side access to the stored prayer configuration.
   Used by every prayer route that only needs to *read* the saved row before
   asking Aladhan. (/api/prayer/config keeps its own richer error handling
   because it also writes.)
   ========================================================================== */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mergeConfig, type PrayerConfig } from "@/lib/prayerConfig";

const ROW_ID = "default";

let admin: SupabaseClient | null = null;

export function prayerDb(): SupabaseClient {
  if (!admin) {
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return admin;
}

/** The saved configuration, degrading to the defaults when the row (or the
 *  whole table) does not exist yet. */
export async function savedConfig(): Promise<PrayerConfig> {
  try {
    const { data, error } = await prayerDb()
      .from("prayer_settings")
      .select("*")
      .eq("id", ROW_ID)
      .maybeSingle();
    if (error) return mergeConfig(null);
    return mergeConfig(data);
  } catch {
    return mergeConfig(null);
  }
}
