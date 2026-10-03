-- Extended events table for Masjid As Sunnah admin
-- Run this migration to add new columns to the events table.

-- Add new columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_image TEXT DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS content_html TEXT DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS audience TEXT[] DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS dates_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS faq JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

-- Index for public queries
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_dates ON events(date_start);

-- Public read access (already exists from initial migration, but ensure)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read access' AND tablename = 'events') THEN
    CREATE POLICY "Public read access" ON events FOR SELECT USING (true);
  END IF;
END $$;

-- Service role full access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access' AND tablename = 'events') THEN
    CREATE POLICY "Service role full access" ON events FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
