/* ─────────────────────────────────────────────────────────────────────────
   Event view tracking.

   The Events overview shows "views of the latest event" and a 30-day views
   trend, but nothing ever counted a view. Two objects close that gap:

     · events.view_count  — lifetime total, shown on the overview and cards
     · event_views        — one row per event per day, powers the trend
     · bump_event_view()  — one atomic call: total + daily row in one round
       trip, so a ping can never split the two counters

   The ping itself is POST /api/events/view (service role → RPC). The public
   website fires it from EventDetailPage.jsx; nothing anon-facing writes
   directly, so RLS stays closed to everyone but the service role.

   Idempotent — safe to re-run. Applied with `supabase db push`.
   ───────────────────────────────────────────────────────────────────────── */

-- 1. Lifetime counter on the event row itself ----------------------------
alter table public.events
  add column if not exists view_count integer not null default 0;

-- 2. Daily rollup for the trend chart ------------------------------------
create table if not exists public.event_views (
  event_id uuid not null references public.events (id) on delete cascade,
  day      date not null default current_date,
  views    integer not null default 0,
  primary key (event_id, day)
);

create index if not exists idx_event_views_day on public.event_views (day);

alter table public.event_views enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'Service role full access' and tablename = 'event_views'
  ) then
    create policy "Service role full access" on public.event_views
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- Broad grants match the rest of the schema; RLS is what actually scopes
-- this table down to the service role (no anon/authenticated policies).
grant select, insert, update, delete on public.event_views
  to anon, authenticated, service_role;

-- 3. Atomic bump: lifetime total + today's row, one call ------------------
create or replace function public.bump_event_view(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
     set view_count = coalesce(view_count, 0) + 1
   where id = p_event_id;

  insert into public.event_views (event_id, day, views)
  values (p_event_id, current_date, 1)
  on conflict (event_id, day)
  do update set views = public.event_views.views + 1;
end;
$$;

-- Only the admin API (service role) may call it — an anon client that found
-- the RPC still could not inflate counts.
revoke execute on function public.bump_event_view(uuid) from public, anon, authenticated;
grant execute on function public.bump_event_view(uuid) to service_role;
