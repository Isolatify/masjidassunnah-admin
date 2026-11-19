# Legacy SQL — already applied

Everything in this folder has **already been run** against the live Supabase
project (`thhsnrnecsybbrskocwf`), mostly by pasting it into the SQL Editor
before the Supabase CLI was set up. It is kept for history only.

**Do not push these.** New schema changes go in `admin/supabase/migrations/`
and are applied with:

```
supabase db push
```

| File | What it did |
| --- | --- |
| `supabase-migration-events.sql` | Base `events` table |
| `supabase-migration-events-v2.sql` | Editor v2 columns (slug, cover, faq, audience…) |
| `supabase-migration-links-persons-cost.sql` | `links` / `persons` / `cost` / `tags` |
| `supabase-migration-rls-hardening.sql` | RLS policies + `register_url` / `full_image` |
| `supabase-migration-sync-event-dates.sql` | `dates_json` backfill |
| `supabase-migration-latest.sql` | Consolidated re-run of all of the above + forms |
| `prayer-settings.sql` | `prayer_settings` table (now migration `20261117120100`) |

The two exceptions now tracked as real migrations:

- `supabase/migrations/20261108082520_create_screens_table.sql`
- `supabase/migrations/20261109000000_grant_screens_privileges.sql`
- `supabase/migrations/20261117120000_event_view_tracking.sql` (new)
- `supabase/migrations/20261117120100_prayer_settings.sql` (new)
