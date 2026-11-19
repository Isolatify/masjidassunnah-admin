-- ===========================================================================
--  Prayer settings — Masjid As Sunnah admin panel
--  Moved here from the old root-level prayer-settings.sql so the table is
--  applied through the Supabase CLI (`supabase db push`) instead of being
--  pasted by hand into the SQL Editor.
--
--  Creates the single-row table /api/prayer/config reads and writes. The
--  runtime route reports "no GRANTs" / "missing autosave column" when this
--  has not landed — after this migration those warnings clear.
--
--  Safe to re-run: every statement is idempotent. Re-running also re-asserts
--  the masjid's fixed location, which the app hard-codes anyway.
-- ===========================================================================

create table if not exists public.prayer_settings (
  id          text primary key,
  location    jsonb  not null,
  athan       jsonb  not null,
  iqamah      jsonb  not null,
  other       jsonb  not null,
  durations   jsonb  not null,
  autosave    boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

comment on table public.prayer_settings is
  'Single-row prayer configuration (athan calculation, iqamah rules, other prayers, salah durations).';

-- ---------------------------------------------------------------------------
--  Migrate rows created before the autosave preference existed.
--  `create table if not exists` above does not add columns to a live table.
-- ---------------------------------------------------------------------------
alter table public.prayer_settings
  add column if not exists autosave boolean not null default true;

-- ---------------------------------------------------------------------------
--  GRANTS — Supabase's default privileges did not apply to this table, so
--  without these even the service-role key gets "permission denied for table".
--  This is safe to re-run on a table that already exists.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.prayer_settings
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
--  Seed the one row with the same defaults as src/lib/prayerConfig.ts
-- ---------------------------------------------------------------------------
insert into public.prayer_settings (id, location, athan, iqamah, other, durations, autosave)
values (
  'default',
  '{
     "latitude": -33.9218,
     "longitude": 151.0787,
     "timezone": "Australia/Sydney",
     "address": "132-136 Haldon Street, Lakemba NSW 2195"
   }'::jsonb,
  '{
     "mode": "automatic", "methodId": 3,
     "fajrMode": "angle", "fajrAngle": 18, "fajrMinutes": 60,
     "ishaMode": "angle", "ishaAngle": 17, "ishaMinutes": 90,
     "asrMethod": 0, "highLatitude": 3,
     "offsets": {"fajr": 0, "dhuhr": 0, "asr": 0, "maghrib": 0, "isha": 0}
   }'::jsonb,
  '{
     "fajr":    {"type": "delay", "delay": 20, "time": ""},
     "dhuhr":   {"type": "delay", "delay": 10, "time": ""},
     "asr":     {"type": "delay", "delay": 10, "time": ""},
     "maghrib": {"type": "delay", "delay": 5,  "time": ""},
     "isha":    {"type": "delay", "delay": 10, "time": ""}
   }'::jsonb,
  '{
     "jumuah": [
       {"name": "1st Jumuah", "athan": "13:15", "iqamah": "13:30"},
       {"name": "2nd Jumuah", "athan": "14:15", "iqamah": "14:30"}
     ],
     "taraweeh": {"mode": "relative", "anchor": "isha_athan",   "minutes": 20,  "time": "21:30"},
     "imsak":    {"mode": "relative", "anchor": "fajr_athan",   "minutes": -10, "time": "04:30"},
     "iftar":    {"mode": "relative", "anchor": "maghrib_athan","minutes": 0,   "time": "19:23"}
   }'::jsonb,
  '{"fajr": 15, "dhuhr": 15, "asr": 15, "maghrib": 15, "isha": 15}'::jsonb,
  true
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
--  The location is FIXED to the masjid. The app re-imposes it on every read,
--  so any row left over from the old Sydney-CBD default is corrected here too.
-- ---------------------------------------------------------------------------
update public.prayer_settings
set location = '{
  "latitude": -33.9218,
  "longitude": 151.0787,
  "timezone": "Australia/Sydney",
  "address": "132-136 Haldon Street, Lakemba NSW 2195"
}'::jsonb
where id = 'default';

-- ---------------------------------------------------------------------------
--  Row Level Security
--  The app writes through the service-role key (bypasses RLS); these policies
--  only govern the anon/authenticated browser clients.
-- ---------------------------------------------------------------------------
alter table public.prayer_settings enable row level security;

drop policy if exists "prayer_settings are readable" on public.prayer_settings;
create policy "prayer_settings are readable"
  on public.prayer_settings for select
  to authenticated
  using (true);

drop policy if exists "prayer_settings are updatable by authenticated" on public.prayer_settings;
create policy "prayer_settings are updatable by authenticated"
  on public.prayer_settings for update
  to authenticated
  using (true)
  with check (true);

-- Convenience: keep updated_at honest even if the app forgets to set it.
create or replace function public.touch_prayer_settings()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_prayer_settings on public.prayer_settings;
create trigger trg_touch_prayer_settings
  before update on public.prayer_settings
  for each row execute function public.touch_prayer_settings();
