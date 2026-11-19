/* ─────────────────────────────────────────────────────────────────────────
   Grants for public.screens.

   20261108082520 created the table, its RLS policy and a SELECT grant for
   `authenticated` — but nothing for `service_role`. Supabase normally applies
   default privileges to newly created tables; they did not land here, so the
   role every screens API route runs as was left with no privileges at all:

       permission denied for table screens  (SQLSTATE 42501)

   which surfaces as a 500 from /api/screens/register and /status — i.e. the
   device can never mint or poll a pairing code, and /dashboard/screens can
   never list one.

   Grants are privileges, not RLS: `service_role` already bypasses row level
   security, it just needs to be allowed to touch the table. `anon` is
   deliberately left with nothing — the anon key never reads this table.
   ───────────────────────────────────────────────────────────────────────── */

grant select, insert, update, delete on public.screens to service_role;

-- Belt and braces: repeat the dashboard read so a database restored from a
-- dump (where line-level grants can be lost) still serves /dashboard/screens.
grant select on public.screens to authenticated;
