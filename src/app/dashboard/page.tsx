"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  getNextPrayer,
  getCountdownParts,
  parseTimeToMins,
  type Week,
} from "@/lib/prayerTimes";

interface EventRow {
  id: string;
  title: string;
  status: string;
  date_start: string;
  date_end?: string | null;
  location?: string;
}

interface FormRow {
  id: string;
  title: string;
  response_count?: number;
}

interface EventsRes {
  success: boolean;
  events?: EventRow[];
}
interface FormsRes {
  success: boolean;
  forms?: FormRow[];
}
interface ManagersRes {
  success: boolean;
  managers?: unknown[];
}
interface PrayerRes {
  success: boolean;
  week?: Week;
}

type LoadStatus = "loading" | "ready" | "error";

function StatCard({
  label,
  value,
  icon,
  gold,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  gold?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-left">
        <p>{label}</p>
        <span>{value}</span>
      </div>
      <div className={`stat-icon${gold ? " stat-icon--gold" : ""}`}>{icon}</div>
    </div>
  );
}

function sydneyKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const parts = iso.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return iso;
  return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(
    "en-AU",
    { day: "numeric", month: "short", year: "numeric" }
  );
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

export default function DashboardHome() {
  const [userEmail, setUserEmail] = useState("");
  const [now, setNow] = useState(new Date());
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [forms, setForms] = useState<FormRow[] | null>(null);
  const [managerCount, setManagerCount] = useState<number | null>(null);
  const [week, setWeek] = useState<Week | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    setStatus("loading");
    const [ev, fm, mg, pr] = await Promise.allSettled([
      getJson<EventsRes>("/api/events"),
      getJson<FormsRes>("/api/forms"),
      getJson<ManagersRes>("/api/managers"),
      getJson<PrayerRes>("/api/prayer"),
    ]);

    setEvents(
      ev.status === "fulfilled" && ev.value.success && Array.isArray(ev.value.events)
        ? ev.value.events
        : null
    );
    setForms(
      fm.status === "fulfilled" && fm.value.success && Array.isArray(fm.value.forms)
        ? fm.value.forms
        : null
    );
    setManagerCount(
      mg.status === "fulfilled" && mg.value.success && Array.isArray(mg.value.managers)
        ? mg.value.managers.length
        : null
    );
    setWeek(
      pr.status === "fulfilled" && pr.value.success && Array.isArray(pr.value.week)
        ? pr.value.week
        : null
    );

    const allFailed = [ev, fm, mg, pr].every((r) => r.status === "rejected");
    setStatus(allFailed ? "error" : "ready");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      if (cancelled) return;
      setUserEmail(data.user.email ?? "");
      void load();
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [router, load]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 17
        ? "Good afternoon"
        : "Good evening";
  const firstName = userEmail.split("@")[0].split(".")[0];
  const dateStr = now.toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const todayKey = sydneyKey(now);
  const tomorrowKey = sydneyKey(addDays(now, 1));
  const byKey = (k: string) => week?.find((d) => d.dateKey === k) || null;
  const todayDay =
    byKey(todayKey) ||
    (week
      ? [...week]
          .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
          .find((d) => d.dateKey >= todayKey) || null
      : null);
  const prayers = todayDay?.prayers || [];
  const tomorrowPrayers = byKey(tomorrowKey)?.prayers || [];

  const next =
    prayers.length > 0 ? getNextPrayer(prayers, now, tomorrowPrayers) : null;
  const nextTarget =
    next && next.prayer && next.targetTime
      ? getCountdownParts(
          next.nextDay ? addDays(now, 1) : now,
          next.targetTime,
          now
        )
      : null;
  const nextMeta =
    next && next.prayer && next.prayer.name
      ? `Next: ${next.prayer.name} · ${
          next.phase === "iqamah" ? "Iqamah" : "Athan"
        }${nextTarget ? ` in ${nextTarget.hours}h ${nextTarget.minutes}m` : " soon"}`
      : null;

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const pctFor = (i: number): number => {
    const p = prayers[i];
    const athanM = parseTimeToMins(p.athan);
    if (athanM < 0) return 0;
    const prev = i > 0 ? prayers[i - 1] : null;
    let startM = 0;
    if (prev) {
      const iq = parseTimeToMins(prev.iqamah);
      startM = iq >= 0 ? iq : parseTimeToMins(prev.athan);
      if (startM < 0) startM = 0;
    }
    if (nowMins <= startM) return 0;
    if (athanM <= startM || nowMins >= athanM) return 100;
    return Math.round(((nowMins - startM) / (athanM - startM)) * 100);
  };
  const activeKey = next?.prayer?.key;

  const upcoming = (events || [])
    .filter((e) => e.date_start >= todayKey)
    .sort((a, b) => a.date_start.localeCompare(b.date_start));
  const upcomingCount = upcoming.length;
  const formCount = forms ? forms.length : null;
  const responseCount = forms
    ? forms.reduce((sum, f) => sum + (f.response_count || 0), 0)
    : null;

  const num = (n: number | null): string | number =>
    status === "loading" ? "–" : n === null ? "–" : n;

  if (!userEmail) return null;

  const loading = status === "loading";

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Overview</div>
        <h1>
          {greeting}, {firstName || "Admin"}
        </h1>
        <p>
          {dateStr} &mdash; Here&apos;s what&apos;s happening at Masjid As Sunnah.
        </p>
      </div>

      {status === "error" && (
        <div className="dash-error" role="alert">
          <span>Couldn&apos;t load dashboard data. Check your connection and try again.</span>
          <button type="button" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="stats-row">
        <StatCard
          label="Prayer Times"
          value={num(prayers.length || null)}
          icon={
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
          }
        />
        <StatCard
          label="Upcoming Events"
          value={num(events ? upcomingCount : null)}
          gold
          icon={
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          }
        />
        <StatCard
          label="Forms"
          value={num(formCount)}
          icon={
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>
          }
        />
        <StatCard
          label="Responses"
          value={num(responseCount)}
          gold
          icon={
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>
          }
        />
        <StatCard
          label="Managers"
          value={num(managerCount)}
          icon={
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          }
        />
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-title">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
            Prayer Schedule
            {nextMeta && <span className="panel-title-meta">{nextMeta}</span>}
          </div>
          {loading ? (
            <div className="panel-center">
              <div className="spinner" />
            </div>
          ) : prayers.length === 0 ? (
            <p className="panel-empty">
              Prayer times unavailable right now.{" "}
              <button
                type="button"
                className="panel-empty-link"
                onClick={load}
              >
                Retry
              </button>
            </p>
          ) : (
            prayers.map((p, i) => (
              <div
                className={`schedule-row${p.key === activeKey ? " schedule-row--active" : ""}`}
                key={p.key}
              >
                <span className="schedule-name">{p.name}</span>
                <div className="schedule-bar">
                  <div
                    className="schedule-bar-fill"
                    style={{
                      width: `${pctFor(i)}%`,
                      background:
                        p.key === activeKey
                          ? "var(--color-gold)"
                          : "var(--color-primary)",
                    }}
                  />
                </div>
                <span className="schedule-time">{p.iqamah}</span>
              </div>
            ))
          )}
        </div>

        <div className="panel">
          <div className="panel-title">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            Upcoming Events
          </div>
          {loading ? (
            <div className="panel-center">
              <div className="spinner" />
            </div>
          ) : upcoming.length === 0 ? (
            <p className="panel-empty">
              No upcoming events.{" "}
              <Link href="/dashboard/events">Create one &rarr;</Link>
            </p>
          ) : (
            upcoming.slice(0, 4).map((e, i) => (
              <Link
                key={e.id}
                href={`/dashboard/events/${e.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="list-item">
                  <div
                    className="list-rank"
                    style={
                      e.status === "published"
                        ? undefined
                        : { background: "var(--color-gold-soft)", color: "var(--color-gold-deep)" }
                    }
                  >
                    {i + 1}
                  </div>
                  <div className="list-info">
                    <p className="list-name">{e.title}</p>
                    <p className="list-detail">
                      {fmtDate(e.date_start)}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                  <span
                    className={`badge${
                      e.status === "published"
                        ? ""
                        : e.status === "draft"
                          ? " badge--gold"
                          : " badge--muted"
                    }`}
                  >
                    {e.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="quick-actions-title">
          <span style={{ fontSize: 18 }}>&#9889;</span> Quick Actions
        </div>
        <div className="quick-actions-grid">
          <Link href="/dashboard/events" style={{ textDecoration: "none" }}>
            <button className="quick-action-btn" style={{ width: "100%" }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              Events
            </button>
          </Link>
          <Link href="/dashboard/register" style={{ textDecoration: "none" }}>
            <button className="quick-action-btn" style={{ width: "100%" }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>
              Register
            </button>
          </Link>
          <a href="https://masjidassunnah.vercel.app" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <button className="quick-action-btn" style={{ width: "100%" }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18 15 15 0 010-18"/></svg>
              Website
            </button>
          </a>
          <Link href="/dashboard/settings" style={{ textDecoration: "none" }}>
            <button className="quick-action-btn" style={{ width: "100%" }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              Settings
            </button>
          </Link>
        </div>
      </div>

      <div className="active-header">
        <h2>All Events</h2>
        <Link href="/dashboard/events" style={{ textDecoration: "none" }}>
          <button className="btn-primary">New Event</button>
        </Link>
      </div>
      <div className="active-table">
        <div className="active-table-header">
          <span>Event</span>
          <span>Date</span>
          <span>Location</span>
          <span>Status</span>
        </div>
        {loading ? (
          <div className="panel-center">
            <div className="spinner" />
          </div>
        ) : !events || events.length === 0 ? (
          <p className="panel-empty" style={{ padding: "18px 24px" }}>
            No events yet.{" "}
            <Link href="/dashboard/events">Create the first one &rarr;</Link>
          </p>
        ) : (
          events.slice(0, 6).map((e) => (
            <Link
              key={e.id}
              href={`/dashboard/events/${e.id}`}
              className="active-table-row"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <span style={{ fontWeight: 500 }}>{e.title}</span>
              <span style={{ color: "var(--text-secondary)" }}>
                {fmtDate(e.date_start)}
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                {e.location || "—"}
              </span>
              <span
                className={`badge${
                  e.status === "published"
                    ? ""
                    : e.status === "draft"
                      ? " badge--gold"
                      : " badge--muted"
                }`}
              >
                {e.status}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
