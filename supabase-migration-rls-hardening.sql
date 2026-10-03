-- =============================================================================
-- supabase-migration-rls-hardening.sql
-- Lock down anon access after enabling cookie-based auth in the admin app.
--
-- Verified current state (live probes with anon key, 2026-10-02):
--   events          anon CAN insert/update/delete (permissive v1 policy
--                   "Service role full access" created with USING (true))
--                   + anon can read drafts ("Public read access" USING (true))
--   forms           anon CAN read drafts ("Public read forms" USING (true))
--   form_responses  anon CAN insert (any form_id); SELECT already blocked
--   storage/events  anon CAN upload ("Anyone can upload events")
--
-- Who needs what after this migration:
--   web/ public site ....... anon SELECT on events WHERE status = 'published'
--                            anon SELECT on forms WHERE status = 'published'
--                            (register page reads slug + expiry/limit settings)
--   admin app .............. all data via API routes using SERVICE ROLE key
--                            (bypasses RLS — no policies needed for it)
--   public form submit ..... POST /api/forms/responses uses SERVICE ROLE key
--   file upload ............ POST /api/forms/upload + /api/upload use SERVICE ROLE
--
-- Safe to re-run (idempotent).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EVENTS — public reads published only; nobody writes anon
-- -----------------------------------------------------------------------------
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON public.events;
DROP POLICY IF EXISTS "Service role full access" ON public.events;
DROP POLICY IF EXISTS "anon read published events" ON public.events;

CREATE POLICY "anon read published events"
  ON public.events
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- -----------------------------------------------------------------------------
-- 2. FORMS — drafts stay hidden; published forms are readable (register page
--    needs slug + settings.responses expiry/limit; /f/<slug> page already
--    exposes published form JSON via the API route anyway)
-- -----------------------------------------------------------------------------
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read forms" ON public.forms;
DROP POLICY IF EXISTS "Service role full access" ON public.forms;
DROP POLICY IF EXISTS "anon read published forms" ON public.forms;

CREATE POLICY "anon read published forms"
  ON public.forms
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- (no INSERT/UPDATE/DELETE policies: writes only via service role)

-- -----------------------------------------------------------------------------
-- 3. FORM RESPONSES — no anon writes/reads (submissions go through API route)
-- -----------------------------------------------------------------------------
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit forms" ON public.form_responses;
DROP POLICY IF EXISTS "Service role reads responses" ON public.form_responses;

-- (intentionally no policies)

-- -----------------------------------------------------------------------------
-- 4. STORAGE — events bucket: public read stays, anon upload/update/delete go
--    (uploads happen only via POST /api/upload with service role)
--    form-uploads bucket already has no anon insert policy (verified).
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can upload events' AND tablename = 'objects') THEN
    DROP POLICY "Anyone can upload events" ON storage.objects;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can update events storage' AND tablename = 'objects') THEN
    DROP POLICY "Anyone can update events storage" ON storage.objects;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can delete events storage' AND tablename = 'objects') THEN
    DROP POLICY "Anyone can delete events storage" ON storage.objects;
  END IF;
END $$;

-- keep/ensure public read of event covers (bucket is public anyway, this
-- covers listing via the storage API):
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read storage' AND tablename = 'objects') THEN
    CREATE POLICY "Public read storage" ON storage.objects
      FOR SELECT USING (bucket_id = 'events');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5. EVENTS — new columns
--    register_url : admin "link to another site" registration option
--    full_image   : entire/uncropped picture (container on web + cover fallback)
-- -----------------------------------------------------------------------------
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS register_url TEXT DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS full_image TEXT DEFAULT '';

-- -----------------------------------------------------------------------------
-- 6. Verification (run in SQL Editor — expect 0 rows / blocked errors)
-- -----------------------------------------------------------------------------
-- SELECT count(*) FROM events WHERE status = 'draft';          -- anon sees 0
-- With anon key from a REST client:
--   GET  /rest/v1/events?select=id&status=eq.draft   -> [] (was full draft list)
--   POST /rest/v1/events ...                         -> 403
--   PATCH /rest/v1/events?id=eq.<any>                -> 0 rows updated
--   GET  /rest/v1/forms?select=id&status=eq.draft    -> [] (published still OK)
--   POST /rest/v1/form_responses ...                 -> 403
--   POST /storage/v1/object/events/x.png             -> 403
