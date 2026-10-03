"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

function StatCard({ label, value, icon, gold }: { label: string; value: string | number; icon: React.ReactNode; gold?: boolean }) {
  return (
    <div className="stat-card">
      <div className="stat-card-left">
        <p>{label}</p>
        <span>{value}</span>
      </div>
      <div className={`stat-icon${gold ? " stat-icon--gold" : ""}`}>
        {icon}
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const [userEmail, setUserEmail] = useState("");
  const [now, setNow] = useState(new Date());
  const router = useRouter();

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/login"); return; }
      setUserEmail(data.user.email ?? "");
    }
    check();
  }, [router]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const firstName = userEmail.split("@")[0].split(".")[0];
  const dateStr = now.toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const prayers = [
    { name: "Fajr", time: "5:15 AM", iqamah: "5:35 AM", pct: 30, color: "#03894a" },
    { name: "Dhuhr", time: "12:15 PM", iqamah: "12:30 PM", pct: 60, color: "#c8a65d" },
    { name: "Asr", time: "3:30 PM", iqamah: "3:35 PM", pct: 75, color: "#026839" },
    { name: "Maghrib", time: "6:05 PM", iqamah: "6:10 PM", pct: 85, color: "#9c7e3d" },
    { name: "Isha", time: "7:30 PM", iqamah: "7:50 PM", pct: 95, color: "#012a1a" },
  ];

  const upcoming = [
    { title: "Quran Circle", date: "Every Saturday", time: "7:00 PM", status: "active" },
    { title: "Youth Night", date: "Every Friday", time: "7:30 PM", status: "active" },
    { title: "Community BBQ", date: "15 Sep 2026", time: "12:00 PM", status: "upcoming" },
  ];

  if (!userEmail) return null;

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Overview</div>
        <h1>{greeting}, {firstName || "Admin"}</h1>
        <p>{dateStr} &mdash; Here&apos;s what&apos;s happening at Masjid As Sunnah.</p>
      </div>

      <div className="stats-row">
        <StatCard label="Prayer Times" value="5"
          icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>} />
        <StatCard label="Upcoming Events" value="3" gold
          icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>} />
        <StatCard label="Forms" value="4"
          icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>} />
        <StatCard label="Managers" value="1" gold
          icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>} />
        <StatCard label="Active Users" value="1"
          icon={<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>} />
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-title">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
            Prayer Schedule
          </div>
          {prayers.map((p) => (
            <div className="schedule-row" key={p.name}>
              <span className="schedule-name">{p.name}</span>
              <div className="schedule-bar">
                <div className="schedule-bar-fill" style={{ width: `${p.pct}%`, background: p.color }} />
              </div>
              <span className="schedule-time">{p.iqamah}</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-title">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            Upcoming Events
          </div>
          {upcoming.map((e, i) => (
            <div className="list-item" key={i}>
              <div className="list-rank" style={e.status === "active" ? undefined : { background: "var(--color-gold-soft)", color: "var(--color-gold-deep)" }}>
                {i + 1}
              </div>
              <div className="list-info">
                <p className="list-name">{e.title}</p>
                <p className="list-detail">{e.date} &middot; {e.time}</p>
              </div>
              <span className={`badge${e.status === "active" ? "" : " badge--gold"}`}>{e.status}</span>
            </div>
          ))}
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
        <h2>Active Events</h2>
        <Link href="/dashboard/events" style={{ textDecoration: "none" }}>
          <button className="btn-primary">New Event</button>
        </Link>
      </div>
      <div className="active-table">
        <div className="active-table-header">
          <span>Event</span>
          <span>Date</span>
          <span>Time</span>
          <span>Status</span>
        </div>
        {upcoming.map((e, i) => (
          <div className="active-table-row" key={i}>
            <span style={{ fontWeight: 500 }}>{e.title}</span>
            <span style={{ color: "var(--text-secondary)" }}>{e.date}</span>
            <span style={{ color: "var(--text-secondary)" }}>{e.time}</span>
            <span className="badge">{e.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
