import type { ComponentKey } from "@/lib/access";

/* Thin line icons (stroke=currentColor) for the sidebar + breadcrumb. */
const i = {
  dashboard: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
  ),
  prayer: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
  ),
  events: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
  ),
  register: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>
  ),
  responses: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
  ),
  settings: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
  ),
  sliders: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
  ),
  screens: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2.5" y="4" width="19" height="13" rx="2" /><path d="M8.5 21h7M12 17v4" /></svg>
  ),
  overview: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /></svg>
  ),
};

export type NavChild = {
  label: string;
  href: string;
  key?: ComponentKey;
  icon?: React.ReactNode;
};

export type NavItem = {
  label: string;
  href?: string;
  key?: ComponentKey;
  icon: React.ReactNode;
  children?: NavChild[];
  /** Show this entry when ANY of these keys is visible (panel doors whose
      pages each carry their own permission). */
  anyOf?: ComponentKey[];
  /** Hover/active tint other than the theme green — a door into another
      slide-in panel (Screens, Events). */
  accent?: "blue" | "gold";
};

/** The screens area owns this whole route prefix. */
export const SCREENS_HREF = "/dashboard/screens";

/** The events panel spans three route prefixes — one per sub-button.
    The Overview page rides the /dashboard/events prefix itself. */
export const EVENTS_HREF = "/dashboard/events";
export const EVENTS_OVERVIEW_HREF = "/dashboard/events/overview";
export const EVENTS_HREFS = [EVENTS_HREF, "/dashboard/register", "/dashboard/responses"];

/** True while the sidebar should be showing the events panel. */
export function inEventsArea(pathname: string): boolean {
  return EVENTS_HREFS.some((h) => pathname.startsWith(h));
}

/* Only the pages that exist as real routes. Everything else is out. */
export const navSections: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", key: "overview", icon: i.dashboard },
  /* One button only — no dropdown, no children. */
  { label: "Prayer", href: "/dashboard/prayer-times", key: "prayer", icon: i.prayer },
  /* One button that opens the events panel (four sub-pages inside: Overview,
      Events, Registrations, Responses). Visible whenever any of them is. */
  {
    label: "Events",
    href: EVENTS_HREF,
    icon: i.events,
    accent: "gold",
    anyOf: ["events", "register", "responses"],
  },
  /* Opens the screens panel rather than a section of its own. */
  { label: "Screens", href: SCREENS_HREF, key: "overview", icon: i.screens, accent: "blue" },
  { label: "Settings", href: "/dashboard/settings", key: "settings", icon: i.settings },
];

/* The pages listed inside the screens panel, once the sidebar has swapped
   over to it. Grows one entry at a time — only Overview exists today. */
export const screenSections: NavChild[] = [
  { label: "Overview", href: SCREENS_HREF, key: "overview", icon: i.screens },
];

/* The pages listed inside the events panel (mirrors the screens panel).
   Overview and Events are two separate pages — the glance board and the
   programme list. */
export const eventSections: NavChild[] = [
  { label: "Overview", href: EVENTS_OVERVIEW_HREF, key: "events", icon: i.overview },
  { label: "Events", href: EVENTS_HREF, key: "events", icon: i.events },
  { label: "Registrations", href: "/dashboard/register", key: "register", icon: i.register },
  { label: "Responses", href: "/dashboard/responses", key: "responses", icon: i.responses },
];

/* Map a route segment to its label + icon so the breadcrumb can show icons. */
export const routeMeta: Record<string, { label: string; icon: React.ReactNode }> = {
  dashboard: { label: "Dashboard", icon: i.dashboard },
  "prayer-times": { label: "Prayer Times", icon: i.prayer },
  "prayer-settings": { label: "Prayer Settings", icon: i.sliders },
  events: { label: "Events", icon: i.events },
  overview: { label: "Overview", icon: i.overview },
  register: { label: "Registrations", icon: i.register },
  responses: { label: "Responses", icon: i.responses },
  screens: { label: "Screens", icon: i.screens },
  settings: { label: "Settings", icon: i.settings },
};

/* Top-level links that must not render an expand chevron. */
export const alwaysLeaf = new Set(["/dashboard/settings"]);
