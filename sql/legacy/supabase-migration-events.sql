-- ============================================
-- Masjid As Sunnah Admin - Events Table Setup
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/thhsnrnecsybbrskocwf/sql/new
-- ============================================

-- Create events table
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

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read access' AND tablename = 'events') THEN
    CREATE POLICY "Public read access" ON events FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access' AND tablename = 'events') THEN
    CREATE POLICY "Service role full access" ON events FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Create storage bucket for event images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('events', 'events', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

-- Storage policies
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
