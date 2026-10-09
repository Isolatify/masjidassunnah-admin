-- Backfill the legacy top-level date columns (date_start, date_end,
-- date_type, recurring_pattern) from dates_json so list ordering, the
-- dashboard upcoming widget and direct column readers agree with what the
-- DateEditor shows. Mirrors admin/src/lib/eventDates.ts deriveDateFields().
--
-- Safe to run repeatedly; events with an empty dates_json are left alone
-- (their top-level columns are still the source of truth).

WITH src AS (
  SELECT
    e.id,
    d.entry,
    d.ord,
    d.entry->>'date_start' AS ds,
    COALESCE(d.entry->>'date_end', d.entry->>'date_start') AS de
  FROM events e
  CROSS JOIN LATERAL (
    SELECT t.entry, t.ord
    FROM jsonb_array_elements(e.dates_json) WITH ORDINALITY AS t(entry, ord)
  ) AS d
  WHERE e.dates_json IS NOT NULL
    AND jsonb_typeof(e.dates_json) = 'array'
    AND jsonb_array_length(e.dates_json) > 0
    AND COALESCE(d.entry->>'date_start', '') <> ''
),
pick AS (
  SELECT DISTINCT ON (id)
    id,
    entry,
    ds
  FROM src
  ORDER BY
    id,
    -- in-progress / upcoming entries win over finished ones, then soonest start
    (de >= to_char(current_date, 'YYYY-MM-DD')) DESC,
    ds ASC,
    ord ASC
)
UPDATE events e
SET
  date_start = CASE
    WHEN COALESCE(pick.entry->>'date_type', '') = 'recurring'
      OR pick.entry->>'recurring_pattern' IS NOT NULL
    THEN GREATEST(pick.ds, to_char(current_date, 'YYYY-MM-DD'))
    ELSE pick.ds
  END,
  date_end = NULLIF(pick.entry->>'date_end', ''),
  date_type = COALESCE(pick.entry->>'date_type', 'single'),
  recurring_pattern = NULLIF(pick.entry->>'recurring_pattern', ''),
  updated_at = now()
FROM pick
WHERE e.id = pick.id;
