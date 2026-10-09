// Human recurrence labels shared by the dashboard ("Every Saturday").
// Mirrors web/src/lib/eventTime.js so admin and site read the same data.

export interface RecurrenceSource {
  date_start?: string | null;
  date_type?: string | null;
  recurring_pattern?: string | null;
  weekdays?: string[] | null;
}

export function recurringLabel(entry: RecurrenceSource | null | undefined): string | null {
  if (!entry) return null;
  const pattern =
    entry.recurring_pattern ||
    (entry.date_type === "recurring"
      ? entry.weekdays?.length
        ? "custom"
        : "weekly"
      : null);
  if (!pattern) return null;
  if (pattern === "daily") return "Daily";
  if (pattern === "weekly") {
    const day = entry.date_start
      ? new Date(entry.date_start + "T12:00:00").toLocaleDateString("en-AU", {
          weekday: "long",
        })
      : "";
    return day ? `Every ${day}` : "Weekly";
  }
  if (pattern === "monthly") return "Monthly";
  if (pattern === "yearly") return "Yearly";
  if (pattern === "custom")
    return entry.weekdays?.length ? `Every ${entry.weekdays.join(", ")}` : "Weekly";
  return pattern;
}
