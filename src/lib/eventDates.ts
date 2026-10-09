import type { DateEntry } from "@/components/DateEditor";

// Keep the legacy top-level date columns in sync with dates_json so list
// ordering, dashboard upcoming widgets and direct column readers stay right.
// Returns a partial event patch (empty when there are no dated entries —
// legacy events with only top-level columns are left untouched).
export function deriveDateFields(entries: DateEntry[] | null | undefined): Partial<{
  date_start: string;
  date_end: string | null;
  date_type: string;
  recurring_pattern: string | null;
}> {
  const list = (entries || []).filter((d) => d && d.date_start);
  if (!list.length) return {};

  const today = new Date().toLocaleDateString("en-CA");
  const primary = list.find((d) => (d.date_end || d.date_start) >= today) || list[0];
  const recurring = primary.date_type === "recurring" || !!primary.recurring_pattern;
  const start = recurring && primary.date_start < today ? today : primary.date_start;

  return {
    date_start: start,
    date_end: primary.date_end || null,
    date_type: primary.date_type || "single",
    recurring_pattern: primary.recurring_pattern || null,
  };
}
