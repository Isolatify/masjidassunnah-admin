"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useAccess } from "@/lib/access";
import {
  navSections,
  screenSections,
  eventSections,
  SCREENS_HREF,
  EVENTS_HREF,
  EVENTS_OVERVIEW_HREF,
  inEventsArea,
  type NavItem,
  type NavChild,
} from "@/lib/nav";
import styles from "./Sidebar.module.css";

/* ── Icons (stroke = currentColor) ──────────────────────────────────────── */

function SearchIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="9,6 15,12 9,18" />
    </svg>
  );
}

/* Dropdown trigger chevron — points up when the menu is closed, down when
   open, so it reads as "attached" to the menu above it. Rotation is applied
   by `.chevronOpen` on the wrapper, which is also where the transition lives. */
function ChevronUp() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="6,15 12,9 18,15" />
    </svg>
  );
}

/* Leaves the screens panel and slides the normal nav back in. */
function ArrowLeft() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12,19 5,12 12,5" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16,17 21,12 16,7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/* ── Path helpers ───────────────────────────────────────────────────────── */

function activeFor(pathname: string, href?: string): boolean {
  if (!href) return false;
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}

function hasActiveChild(pathname: string, item: NavItem): boolean {
  return !!item.children?.some((c) => activeFor(pathname, c.href));
}

/* The events panel's pages live side by side: /dashboard/events is the list
   and /dashboard/events/overview is the glance board, and the editor rides
   under the list. So the "Events" button owns the whole prefix EXCEPT its
   Overview sibling — otherwise both buttons would light up together. */
function eventChildActive(pathname: string, href: string): boolean {
  if (href === EVENTS_HREF) {
    return (
      pathname === EVENTS_HREF ||
      (pathname.startsWith(`${EVENTS_HREF}/`) && !pathname.startsWith(EVENTS_OVERVIEW_HREF))
    );
  }
  return activeFor(pathname, href);
}

/* ── Platform ───────────────────────────────────────────────────────────── */

/* Never changes at runtime, so it needs no real subscription — this only exists
   to read the platform without reading `navigator` during SSR/hydration. */
const neverSubscribes = () => () => {};

function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.userAgent || "");
}

/* ── Name fitting ───────────────────────────────────────────────────────── */

const NAME_MAX = 18;

function titleCase(s: string) {
  return s.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

/* Full name, but drop to the first name alone once it would no longer fit. */
function fitName(raw: string) {
  const full = titleCase(raw);
  if (!full) return "Admin";
  if (full.length <= NAME_MAX) return full;
  return full.split(" ")[0] || full;
}

/* ── Sidebar ────────────────────────────────────────────────────────────── */

export default function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const access = useAccess();
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const userRowRef = useRef<HTMLDivElement>(null);

  /* macOS shows ⌘, everything else shows Ctrl. */
  const isMac = useSyncExternalStore(neverSubscribes, detectMac, () => false);

  /* The panel on screen: the normal nav, the screens panel, or the events
     panel. Driven straight off the URL so the browser's own back button
     swaps it too. The two sub-areas never overlap, so one open flag each. */
  const inScreens = pathname.startsWith(SCREENS_HREF);
  const inEvents = inEventsArea(pathname);

  /* Where "Back" returns to. Captured the moment a panel is opened, so
     deep-linking straight into the area still has somewhere sensible to go. */
  const entryRef = useRef<string>("/dashboard");
  const eventsRef = useRef<string>("/dashboard");

  function openScreens() {
    entryRef.current = pathname || "/dashboard";
  }

  function closeScreens() {
    const back = entryRef.current;
    router.push(back.startsWith(SCREENS_HREF) ? "/dashboard" : back);
  }

  function openEvents() {
    eventsRef.current = pathname || "/dashboard";
  }

  function closeEvents() {
    const back = eventsRef.current;
    router.push(inEventsArea(back) ? "/dashboard" : back);
  }

  const visible = useMemo(
    () =>
      navSections.filter((item) => {
        // Panel door: visible when any of its pages is.
        if (item.anyOf) {
          return item.anyOf.some((k) => access.access(k) !== "hide");
        }
        // Expandable group: visible when at least one child is visible.
        if (item.children) {
          return item.children.some((c) => !c.key || access.access(c.key) !== "hide");
        }
        // Plain leaf link: respect its own key.
        return !item.key || access.access(item.key) !== "hide";
      }),
    [access]
  );

  /* Signed-in identity for the bottom row. */
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive || !data.user) return;
      const email = data.user.email ?? "";
      const meta = (data.user.user_metadata ?? {}) as Record<string, string | undefined>;
      const raw = meta.full_name || meta.name || meta.display_name || email.split("@")[0] || "";
      setUser({ email, name: fitName(raw) });
    });
    return () => {
      alive = false;
    };
  }, []);

  /* Close the dropdown on outside click or Escape. */
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (userRowRef.current && !userRowRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isOpen(item: NavItem): boolean {
    if (toggled[item.label] !== undefined) return toggled[item.label];
    return hasActiveChild(pathname, item); // default open when a child is active
  }

  function toggleGroup(item: NavItem) {
    const next = !isOpen(item);
    setToggled((prev) => ({ ...prev, [item.label]: next }));
  }

  function renderChild(c: NavChild) {
    if (c.key && access.access(c.key) === "hide") return null;
    return (
      <Link
        key={c.href}
        href={c.href}
        className={`${styles.child}${activeFor(pathname, c.href) ? ` ${styles.childActive}` : ""}`}
        title={c.label}
      >
        {c.icon}
        <span className={styles.label}>{c.label}</span>
      </Link>
    );
  }

  return (
    <aside
      className={`${styles.sidebar}${collapsed ? ` ${styles.collapsed}` : ""}${inScreens ? ` ${styles.screensOpen}` : ""}${inEvents ? ` ${styles.eventsOpen}` : ""}`}
    >
      {/* Three panels share this space: the normal nav slides out to the left,
          the screens/events panel slides in from the right. */}
      <div className={styles.panels}>
        {/* ── Panel A: brand → search → nav ── */}
        <div className={`${styles.panel} ${styles.panelMain}`}>
          {/* ── Brand: logo + "Admin Panel" ── */}
          <div className={styles.brand}>
            <Link className={styles.brandLogo} href="/dashboard" aria-label="Masjid As Sunnah">
              <Image
                src={collapsed ? "/logo-color.png" : "/logo-lockup.png"}
                alt="Masjid As Sunnah"
                width={collapsed ? 120 : 426}
                height={collapsed ? 120 : 100}
                priority
                style={{ width: collapsed ? 32 : 150, height: "auto" }}
              />
            </Link>
            <span className={styles.eyebrow}>Admin Panel</span>
          </div>

          {/* ── Search — opens the command palette (wired up later) ── */}
          <button type="button" className={styles.search} title={collapsed ? "Search" : `Search  ${isMac ? "⌘" : "Ctrl"}+K`} aria-label="Search">
            <SearchIcon />
            <span className={styles.searchLabel}>Search</span>
            <kbd className={styles.kbd}>{isMac ? "⌘" : "Ctrl"}</kbd>
          </button>

          {/* ── Nav ── */}
          <nav className={styles.nav} aria-label="Main">
            {visible.map((item) => {
              /* Collapsed: render children flat as icon links, skip the group header. */
              if (item.children && collapsed) {
                return <div key={item.label}>{item.children.map(renderChild)}</div>;
              }

              /* Expandable group (no own href). */
              if (item.children) {
                const open = isOpen(item);
                const groupActive = hasActiveChild(pathname, item);
                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      className={`${styles.groupHead}${groupActive ? ` ${styles.groupHeadActive}` : ""}`}
                      onClick={() => toggleGroup(item)}
                      aria-expanded={open}
                      title={item.label}
                    >
                      {item.icon}
                      <span className={styles.label}>{item.label}</span>
                      <span className={`${styles.chev}${open ? ` ${styles.chevOpen}` : ""}`}>
                        <ChevronRight />
                      </span>
                    </button>
                    {open && <div className={styles.children}>{item.children.map(renderChild)}</div>}
                  </div>
                );
              }

              /* Plain leaf link. The Screens/Events entry points also record
                 where they were opened from, so their back buttons can
                 return there. */
              const door = item.accent; // "blue" | "gold" | undefined
              return (
                <Link
                  key={item.href}
                  href={item.href ?? "#"}
                  className={`${styles.link}${activeFor(pathname, item.href) ? ` ${styles.linkActive}` : ""}${door === "blue" ? ` ${styles.linkScreens}` : ""}${door === "gold" ? ` ${styles.linkEvents}` : ""}`}
                  title={item.label}
                  onClick={door === "blue" ? openScreens : door === "gold" ? openEvents : undefined}
                >
                  {item.icon}
                  <span className={styles.label}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* ── Panel B: back → the screen pages ── */}
        <div className={`${styles.panel} ${styles.panelScreens}`}>
          <button type="button" className={styles.backBtn} onClick={closeScreens}>
            <ArrowLeft />
            <span className={styles.backLabel}>Back</span>
          </button>

          <nav className={styles.nav} aria-label="Screens">
            {screenSections.map((c) => {
              if (c.key && access.access(c.key) === "hide") return null;
              return (
                <Link
                  key={c.href}
                  href={c.href}
                  className={`${styles.link}${activeFor(pathname, c.href) ? ` ${styles.linkActive}` : ""}`}
                  title={c.label}
                >
                  {c.icon}
                  <span className={styles.label}>{c.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* ── Panel C: back → events / registrations / responses ── */}
        <div className={`${styles.panel} ${styles.panelEvents}`}>
          <button type="button" className={styles.backBtn} onClick={closeEvents}>
            <ArrowLeft />
            <span className={styles.backLabel}>Back</span>
          </button>

          <nav className={styles.nav} aria-label="Events">
            {eventSections.map((c) => {
              if (c.key && access.access(c.key) === "hide") return null;
              return (
                <Link
                  key={c.href}
                  href={c.href}
                  className={`${styles.link}${eventChildActive(pathname, c.href) ? ` ${styles.linkActive}` : ""}`}
                  title={c.label}
                >
                  {c.icon}
                  <span className={styles.label}>{c.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className={styles.divider} aria-hidden="true" />

      {/* ── User row + dropdown ── */}
      <div className={styles.userRow} ref={userRowRef}>
        {menuOpen && (
          <div className={styles.menu} role="menu" aria-label="Account">
            <Link href="/dashboard/settings" className={styles.menuItem} role="menuitem" onClick={() => setMenuOpen(false)}>
              <UserIcon />
              My Profile
            </Link>
            <Link href="/dashboard/settings" className={styles.menuItem} role="menuitem" onClick={() => setMenuOpen(false)}>
              <GearIcon />
              Settings
            </Link>
            <div className={styles.menuSep} aria-hidden="true" />
            <button type="button" className={`${styles.menuItem} ${styles.menuDanger}`} role="menuitem" onClick={handleLogout}>
              <SignOutIcon />
              Sign Out
            </button>
          </div>
        )}

        <button
          type="button"
          className={`${styles.userBtn}${menuOpen ? ` ${styles.userBtnOpen}` : ""}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title={user ? `${user.name} — ${user.email}` : "Account"}
        >
          <span className={styles.avatar} aria-hidden="true">
            {user ? user.name.charAt(0).toUpperCase() : "?"}
          </span>
          <span className={styles.userMeta}>
            <span className={styles.name}>{user?.name ?? "…"}</span>
            <span className={styles.email}>{user?.email ?? ""}</span>
          </span>
          <span className={`${styles.chevron}${menuOpen ? ` ${styles.chevronOpen}` : ""}`} aria-hidden="true">
            <ChevronUp />
          </span>
        </button>
      </div>
    </aside>
  );
}
