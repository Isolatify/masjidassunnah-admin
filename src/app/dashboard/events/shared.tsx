"use client";

/* ==========================================================================
   Events — shared plumbing for the section's two pages:
     /dashboard/events          → the programme list     (../page.tsx)
     /dashboard/events/overview → stats, spotlight, trend (../overview/page.tsx)
   Data shapes, date helpers, the overview fetch and the empty state both
   pages render. Nothing here is a route — Next only treats page / layout /
   route files as such, so this colocated module stays out of the router.
   ========================================================================== */

import { useCallback, useEffect, useState } from "react";
import { eventOccurrences } from "@/lib/eventTime";
import { recurringLabel } from "@/lib/dateLabels";

/* ── Data shapes ─────────────────────────────────────────────────────────── */

export interface EventItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  content_html: string;
  cover_image: string;
  image_url: string;
  full_image: string;
  date_start: string;
  date_end: string | null;
  date_type: string;
  recurring_pattern: string | null;
  location: string;
  cost: string;
  audience: string[];
  form_id: string | null;
  register_url: string;
  dates_json: {
    display: string;
    date_start?: string | null;
    date_end?: string | null;
    date_type?: string | null;
    recurring_pattern?: string | null;
    weekdays?: string[] | null;
  }[];
  status: string;
  created_at: string;
  view_count?: number;
}

export type Decorated = EventItem & {
  __occ: Date[];
  __next: number | null;
  __last: number | null;
  __past: boolean;
};

export interface TrendPoint {
  day: string;
  views: number;
  responses: number;
}

export interface RecentResponse {
  id: string;
  form_id: string | null;
  form_title: string;
  created_at: string;
}

export interface OverviewData {
  events: EventItem[];
  forms: { total: number; active: number };
  responses: { total: number; last7: number; last30: number; prev30: number };
  formCounts: Record<string, number>;
  recent: RecentResponse[];
  trend: TrendPoint[];
}

/* ── Date helpers ────────────────────────────────────────────────────────── */

export function startOfToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export function fmtIso(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const mins = Math.floor((Date.now() - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmtIso(iso);
}

export function getDisplayDate(ev: EventItem): string {
  const first = ev.dates_json?.[0];
  if (first?.display) {
    const label = recurringLabel(first);
    return label ? `${first.display} · ${label}` : first.display;
  }
  if (ev.recurring_pattern || ev.date_type === "recurring") {
    const label = recurringLabel({
      recurring_pattern: ev.recurring_pattern,
      date_type: ev.date_type,
      date_start: ev.date_start,
      weekdays: first?.weekdays,
    });
    if (label) return label;
  }
  if (ev.date_end && ev.date_end !== ev.date_start)
    return `${formatDate(ev.date_start)} – ${formatDate(ev.date_end)}`;
  return formatDate(ev.date_start);
}

export function audienceLabel(aud?: string[] | null): string {
  const a = aud || [];
  if (a.length === 0 || a.includes("All")) return "Open to all";
  return a.join(" & ");
}

export function isFreeCost(cost: string): boolean {
  return !cost || !cost.trim() || cost.trim().toLowerCase() === "free";
}

export function decorate(ev: EventItem): Decorated {
  const dates = eventOccurrences(ev);
  const today = startOfToday();
  const upcoming = dates.filter((d) => d >= today);
  const pastDates = dates.filter((d) => d < today);
  return {
    ...ev,
    __occ: dates,
    /* getTime() first — Math.min spreads numbers, not Dates (the two old
       tsc errors on this page lived exactly here). */
    __next: upcoming.length ? Math.min(...upcoming.map((d) => d.getTime())) : null,
    __last: pastDates.length ? Math.max(...pastDates.map((d) => d.getTime())) : null,
    __past: dates.length > 0 && upcoming.length === 0,
  };
}

/* ── Data ────────────────────────────────────────────────────────────────── */

/** One fetch of /api/events/overview, shared by both pages.
    `overview === null` (with no error) means "still loading". */
export function useOverview() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const res = await fetch("/api/events/overview", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load events");
      setOverview(data as OverviewData);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to load events");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { overview, loadError, load, loading: overview === null && !loadError };
}

/* ── Shared UI ───────────────────────────────────────────────────────────── */

export function emptyState(msg: string, action?: React.ReactNode) {
  return (
    <div className="panel-center">
      <p className="panel-empty" style={{ padding: "6px 0" }}>
        {msg}
      </p>
      {action}
    </div>
  );
}
