import { createClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, mergeSettings, DEFAULT_PRAYER_SLUG, normaliseSlug } from "@/lib/settings";

/* Server-only settings access (service role). Settings live in the
   app_metadata.site_settings of a designated owner account — no SQL needed. */

let client: ReturnType<typeof createClient> | null = null;
function supabase() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return client;
}

async function listUsersSorted() {
  const { data, error } = await supabase().auth.admin.listUsers({ perPage: 200 });
  if (error || !data?.users?.length) return [];
  return [...data.users].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/** Read the merged settings object (defaults + stored overrides). */
export async function readSettings(): Promise<Record<string, unknown>> {
  const users = await listUsersSorted();
  if (!users.length) return DEFAULT_SETTINGS as unknown as Record<string, unknown>;
  const withSettings = users.find(
    (u) => (u.app_metadata as Record<string, unknown>)?.site_settings
  );
  const source = (withSettings ?? users[0]).app_metadata as Record<string, unknown>;
  return mergeSettings(DEFAULT_SETTINGS, source.site_settings) as unknown as Record<string, unknown>;
}

/** Write the full settings object back to the owner's app_metadata. */
export async function writeSettings(settings: Record<string, unknown>): Promise<void> {
  const users = await listUsersSorted();
  if (!users.length) throw new Error("No users found");
  const owner =
    users.find((u) => u.email === "admin@masjidassunnah.com.au") ??
    users.find((u) => (u.app_metadata as Record<string, unknown>)?.site_settings) ??
    users[0];
  const meta = { ...(owner.app_metadata as Record<string, unknown>), site_settings: settings };
  const { error } = await supabase().auth.admin.updateUserById(owner.id, { app_metadata: meta });
  if (error) throw new Error(error.message);
}

/** Read just the prayer slug (falls back to the default). */
export async function readPrayerSlug(): Promise<string> {
  const settings = await readSettings();
  const prayer = settings.prayer as { slug?: unknown } | undefined;
  const slug = normaliseSlug(String(prayer?.slug ?? ""));
  return slug || DEFAULT_PRAYER_SLUG;
}
