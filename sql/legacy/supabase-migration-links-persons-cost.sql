-- Add links, persons, cost, and tags columns to events table
-- Run this migration to enable the new admin editor fields.

ALTER TABLE events ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS persons JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cost TEXT DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
