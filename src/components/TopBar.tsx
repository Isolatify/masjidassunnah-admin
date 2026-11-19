"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { routeMeta } from "@/lib/nav";

/* Number of unread notifications. 0 hides the badge. Wire to a real feed later. */
const NOTIF_COUNT = 3;

function titleCase(seg: string) {
  return seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* Build a tappable, icon-bearing breadcrumb trail from the current path. */
function useCrumbs() {
  const pathname = usePathname() ?? "/dashboard";
  const segs = pathname.split("/").filter(Boolean); // e.g. ["dashboard","prayer-times"]
  const crumbs: { label: string; href: string; icon?: React.ReactNode; current: boolean }[] = [];
  let acc = "";
  segs.forEach((seg, idx) => {
    acc += "/" + seg;
    const meta = routeMeta[seg];
    const last = idx === segs.length - 1;
    crumbs.push({
      label: meta?.label ?? (seg === "dashboard" ? "Dashboard" : titleCase(seg)),
      href: acc,
      icon: meta?.icon,
      current: last,
    });
  });
  // A bare /dashboard should show a single "Dashboard" crumb.
  if (!crumbs.length) crumbs.push({ label: "Dashboard", href: "/dashboard", icon: routeMeta.dashboard?.icon, current: true });
  return crumbs;
}

export default function TopBar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const crumbs = useCrumbs();
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setEmail(data.user.email ?? "");
    });
  }, []);

  const name = email
    ? email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Admin";
  const initials = email ? email.charAt(0).toUpperCase() : "?";

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-collapse"
          onClick={onToggle}
          aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
          title={collapsed ? "Open sidebar" : "Close sidebar"}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
            <path d={collapsed ? "m15 9 3 3-3 3" : "m15 9-3 3 3 3"} />
          </svg>
        </button>

        <nav className="topbar-crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, idx) => {
            const sep = idx < crumbs.length - 1;
            return (
              <span className="topbar-crumb" key={c.href + idx}>
                {c.icon && <span className="topbar-crumb-icon">{c.icon}</span>}
                {c.current ? (
                  <span className="topbar-crumb-current">{c.label}</span>
                ) : (
                  <Link href={c.href} className="topbar-crumb-link">{c.label}</Link>
                )}
                {sep && <span className="topbar-crumb-sep">/</span>}
              </span>
            );
          })}
        </nav>
      </div>

      <div className="topbar-right">
        <button type="button" className="topbar-bell" aria-label={`Notifications (${NOTIF_COUNT})`} title="Notifications">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          {NOTIF_COUNT > 0 && <span className="topbar-bell-badge">{NOTIF_COUNT}</span>}
        </button>

        <div className="topbar-user">
          <div className="topbar-avatar">{initials}</div>
          <div className="topbar-user-meta">
            <p className="topbar-user-name">{name}</p>
            <p className="topbar-user-role">Admin</p>
          </div>
        </div>
      </div>
    </header>
  );
}
