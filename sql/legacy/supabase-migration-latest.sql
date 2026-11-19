-- ============================================
-- Masjid As Sunnah — consolidated Supabase migration (LATEST)
-- Idempotent: safe to run more than once.
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/thhsnrnecsybbrskocwf/sql/new
--
-- Covers:
--   1) base events table
--   2) editor v2 columns (slug, cover_image, content_html, audience,
--      dates_json, faq, status, map coords)
--   3) links / persons / cost / tags / updated_at
--   4) indexes
--   5) row level security policies
--   6) storage bucket + policies for event images
--   7) forms (registration / quizzes) + form_responses
--   8) events.form_id link
-- ============================================

-- 1. Base table ---------------------------------
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  date_start DATE NOT NULL,
  date_end DATE,
  date_type TEXT NOT NULL DEFAULT 'one-day',
  recurring_pattern TEXT,
  location TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Editor v2 columns ---------------------------
ALTER TABLE events ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_image TEXT DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS content_html TEXT DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS audience TEXT[] DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS dates_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS faq JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

-- 3. Links / persons / cost / tags ---------------
ALTER TABLE events ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS persons JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cost TEXT DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 4. Indexes -------------------------------------
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_date_start ON events(date_start);

-- 5. Row level security --------------------------
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read access' AND tablename = 'events') THEN
    CREATE POLICY "Public read access" ON events FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access' AND tablename = 'events') THEN
    CREATE POLICY "Service role full access" ON events
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- 6. Storage bucket for event images -------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('events', 'events', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read storage' AND tablename = 'objects') THEN
    CREATE POLICY "Public read storage" ON storage.objects FOR SELECT USING (bucket_id = 'events');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can upload events' AND tablename = 'objects') THEN
    CREATE POLICY "Anyone can upload events" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'events');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can update events storage' AND tablename = 'objects') THEN
    CREATE POLICY "Anyone can update events storage" ON storage.objects FOR UPDATE USING (bucket_id = 'events');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can delete events storage' AND tablename = 'objects') THEN
    CREATE POLICY "Anyone can delete events storage" ON storage.objects FOR DELETE USING (bucket_id = 'events');
  END IF;
END $$;

-- 7. Forms (registration forms & quizzes) ---------
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT DEFAULT '',
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forms_slug ON forms(slug);
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status);
CREATE INDEX IF NOT EXISTS idx_form_responses_form_id ON form_responses(form_id);

ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read forms' AND tablename = 'forms') THEN
    CREATE POLICY "Public read forms" ON forms FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access' AND tablename = 'forms') THEN
    CREATE POLICY "Service role full access" ON forms
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can submit forms' AND tablename = 'form_responses') THEN
    CREATE POLICY "Anyone can submit forms" ON form_responses FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role reads responses' AND tablename = 'form_responses') THEN
    CREATE POLICY "Service role reads responses" ON form_responses FOR SELECT USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 8. Event → form link ----------------------------
ALTER TABLE events ADD COLUMN IF NOT EXISTS form_id UUID REFERENCES forms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_events_form_id ON events(form_id);

-- 9. Grants (idempotent — covers tables created outside SQL Editor) ----
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forms TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_responses TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO anon, authenticated, service_role;
GRANT ALL ON public.forms TO postgres;
GRANT ALL ON public.form_responses TO postgres;
