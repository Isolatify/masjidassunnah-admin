"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";
import { recurringLabel } from "@/lib/dateLabels";
import {
  Plus,
  CalendarBlank,
  MapPin,
  Eye,
  EyeSlash,
  UsersThree,
  MagnifyingGlass,
  CaretLeft,
  CaretRight,
  Trash,
} from "@phosphor-icons/react";

interface EventItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  content_html: string;
  cover_image: string;
  image_url: string;
  date_start: string;
  date_end: string | null;
  date_type: string;
  recurring_pattern: string | null;
  location: string;
  audience: string[];
  dates_json: {
    display: string;
    date_start?: string | null;
    date_type?: string | null;
    recurring_pattern?: string | null;
    weekdays?: string[] | null;
  }[];
  status: string;
  created_at: string;
}

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-ink)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatDisplayDate(ev: EventItem): string {
  const first = ev.dates_json?.[0];
  if (first?.display) {
    const label = recurringLabel(first);
    return label ? `${first.display} · ${label}` : first.display;
  }
  if (ev.recurring_pattern || ev.date_type === "recurring") {
    const label = recurringLabel({
      date_start: ev.date_start,
      date_type: ev.date_type,
      recurring_pattern: ev.recurring_pattern,
    });
    if (label) return label;
  }
  if (ev.date_end && ev.date_end !== ev.date_start) {
    return `${formatDate(ev.date_start)} – ${formatDate(ev.date_end)}`;
  }
  return formatDate(ev.date_start);
}

function getEventDateForSort(ev: EventItem): Date {
  return new Date(ev.date_start + "T00:00:00");
}

function getAudienceLabel(audience: string[]): string {
  if (!audience?.length) return "";
  if (audience.includes("All")) return "Open to all";
  return audience.join(", ");
}

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"date-new" | "date-old" | "title-az" | "title-za" | "status">("date-new");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/events");
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setEvents(data.events || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/events");
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        if (alive) setEvents(data.events || []);
      } catch (err: unknown) {
        if (alive) toast.error(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleDelete(id: string) {
    try {
      const res = await fetch("/api/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Event deleted");
      setDeleteConfirm(null);
      fetchEvents();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  function sortEvents(list: EventItem[]): EventItem[] {
    const sorted = [...list];
    switch (sortBy) {
      case "date-new":
        return sorted.sort((a, b) => getEventDateForSort(b).getTime() - getEventDateForSort(a).getTime());
      case "date-old":
        return sorted.sort((a, b) => getEventDateForSort(a).getTime() - getEventDateForSort(b).getTime());
      case "title-az":
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case "title-za":
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      case "status":
        return sorted.sort((a, b) => (a.status === "published" ? -1 : 1) - (b.status === "published" ? -1 : 1));
      default:
        return sorted;
    }
  }

  function filterEvents(list: EventItem[]): EventItem[] {
    let filtered = list;
    if (statusFilter !== "all") {
      filtered = filtered.filter((e) => e.status === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.description || "").toLowerCase().includes(q) ||
          (e.location || "").toLowerCase().includes(q) ||
          getAudienceLabel(e.audience).toLowerCase().includes(q)
      );
    }
    return filtered;
  }

  const displayed = sortEvents(filterEvents(events));
  const publishedCount = events.filter((e) => e.status === "published").length;
  const draftCount = events.filter((e) => e.status === "draft").length;

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="page-eyebrow">Content</div>
          <h1>Events</h1>
          <p>Manage masjid events and programmes.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => router.push("/dashboard/events/new")}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={16} weight="bold" /> New Event
        </button>
      </div>

      {/* Status tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {(["all", "published", "draft"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`tab ${statusFilter === s ? "active" : ""}`}
          >
            {s === "all" ? `All (${events.length})` : s === "published" ? `Published (${publishedCount})` : `Draft (${draftCount})`}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--color-surface)", borderRadius: 12, border: "1px solid var(--color-border)", padding: "0 12px" }}>
          <MagnifyingGlass size={16} color="var(--color-muted)" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events..."
            style={{ ...INPUT, width: 240, border: "none", background: "transparent", margin: 0, padding: "10px 0" }}
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          style={{ ...INPUT, width: 180, margin: 0, cursor: "pointer" }}
        >
          <option value="date-new">Newest first</option>
          <option value="date-old">Oldest first</option>
          <option value="title-az">Title A–Z</option>
          <option value="title-za">Title Z–A</option>
          <option value="status">By status</option>
        </select>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {(["grid", "list"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: "8px 12px", borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: viewMode === mode ? "var(--color-primary)" : "transparent",
                color: viewMode === mode ? "#fff" : "var(--color-secondary)",
                cursor: "pointer", fontSize: 16, fontFamily: "inherit", transition: "all 0.15s",
              }}
            >
              {mode === "grid" ? "▦" : "☰"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : displayed.length === 0 ? (
        <div style={{
          textAlign: "center", padding: 60, borderRadius: 16,
          border: "2px dashed var(--color-border)", color: "var(--color-muted)", fontSize: 15,
        }}>
          {searchQuery || statusFilter !== "all" ? "No events match your filters." : "No events yet. Create your first one!"}
        </div>
      ) : viewMode === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
          {displayed.map((ev) => (
            <div
              key={ev.id}
              onClick={() => router.push(`/dashboard/events/${ev.id}`)}
              style={{
                background: "var(--color-surface)", border: "1px solid var(--color-border-soft)",
                borderRadius: 18, overflow: "hidden", boxShadow: "var(--shadow-sm)",
                transition: "all 0.2s", cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--color-surface)";
                e.currentTarget.style.borderColor = "var(--color-border)";
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = "var(--shadow-md)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--color-surface)";
                e.currentTarget.style.borderColor = "var(--color-border-soft)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "var(--shadow-sm)";
              }}
            >
              {/* Image */}
              {ev.cover_image || ev.image_url ? (
                <div style={{ width: "100%", height: 180, overflow: "hidden", position: "relative" }}>
                  <img src={ev.cover_image || ev.image_url} alt={ev.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{
                    position: "absolute", top: 10, right: 10,
                    padding: "4px 10px", borderRadius: 6,
                    background: ev.status === "published" ? "#026839" : "rgba(10,10,10,0.55)",
                    backdropFilter: "blur(4px)", fontSize: 11, fontWeight: 600,
                    color: "white", display: "flex", alignItems: "center", gap: 4,
                  }}>
                    {ev.status === "published" ? <Eye size={11} /> : <EyeSlash size={11} />}
                    {ev.status}
                  </div>
                </div>
              ) : (
                <div style={{
                  width: "100%", height: 120,
                  background: "linear-gradient(135deg, #04a24d, #014d2b)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative",
                }}>
                  <CalendarBlank size={32} weight="duotone" color="rgba(255,255,255,0.5)" />
                  <div style={{
                    position: "absolute", top: 10, right: 10,
                    padding: "4px 10px", borderRadius: 6,
                    background: ev.status === "published" ? "#026839" : "rgba(10,10,10,0.55)",
                    fontSize: 11, fontWeight: 600, color: "white",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    {ev.status === "published" ? <Eye size={11} /> : <EyeSlash size={11} />}
                    {ev.status}
                  </div>
                </div>
              )}

              {/* Body */}
              <div style={{ padding: "16px 20px" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-ink)", marginBottom: 6 }}>
                  {ev.title}
                </div>
                <div style={{ fontSize: 13, color: "var(--color-secondary-light)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <CalendarBlank size={13} weight="duotone" /> {formatDisplayDate(ev)}
                </div>
                {ev.location && (
                  <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <MapPin size={12} weight="duotone" /> {ev.location.length > 40 ? ev.location.slice(0, 40) + "..." : ev.location}
                  </div>
                )}
                {ev.audience?.length > 0 && (
                  <div style={{ fontSize: 11, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
                    <UsersThree size={12} weight="duotone" /> {getAudienceLabel(ev.audience)}
                  </div>
                )}
                {ev.description && (
                  <div style={{
                    fontSize: 12, color: "var(--color-muted)", lineHeight: 1.4,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>
                    {ev.description}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          background: "var(--color-surface)", borderRadius: 18,
          border: "1px solid var(--color-border-soft)", overflow: "hidden", boxShadow: "var(--shadow-sm)",
        }}>
          {/* Table header */}
          <div style={{
            display: "grid", gridTemplateColumns: "50px 2fr 1.5fr 1fr 100px 80px",
            padding: "12px 20px", borderBottom: "1px solid var(--color-border-soft)",
            fontSize: 11, fontWeight: 600, color: "var(--color-muted)",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            <span></span><span>Event</span><span>Date</span><span>Location</span><span>Audience</span><span></span>
          </div>
          {displayed.map((ev) => (
            <div
              key={ev.id}
              onClick={() => router.push(`/dashboard/events/${ev.id}`)}
              style={{
                display: "grid", gridTemplateColumns: "50px 2fr 1.5fr 1fr 100px 80px",
                padding: "14px 20px", alignItems: "center",
                borderBottom: "1px solid var(--color-border-soft)",
                cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-bg)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div>
                {ev.cover_image || ev.image_url ? (
                  <img src={ev.cover_image || ev.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "linear-gradient(135deg, #04a24d, #014d2b)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <CalendarBlank size={16} weight="duotone" color="rgba(255,255,255,0.6)" />
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: "var(--color-ink)", fontSize: 14 }}>{ev.title}</div>
                <div style={{ fontSize: 11, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  {ev.status === "published" ? <Eye size={10} /> : <EyeSlash size={10} />}
                  {ev.status}
                </div>
              </div>
              <span style={{ color: "var(--color-secondary-light)", fontSize: 13 }}>{formatDisplayDate(ev)}</span>
              <span style={{ color: "var(--color-muted)", fontSize: 13 }}>{ev.location ? (ev.location.length > 25 ? ev.location.slice(0, 25) + "..." : ev.location) : "—"}</span>
              <span style={{ color: "var(--color-muted)", fontSize: 12 }}>{getAudienceLabel(ev.audience) || "—"}</span>
              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(ev.id); }}
                  style={{
                    background: "none", border: "none", color: "#dc2626",
                    cursor: "pointer", padding: 6,
                  }}
                >
                  <Trash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000,
          }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            style={{
              background: "var(--color-surface)", border: "1px solid var(--color-border)",
              borderRadius: 20, padding: 32, width: 400, textAlign: "center", boxShadow: "var(--shadow-lg)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-ink)", marginBottom: 12 }}>Delete Event?</div>
            <p style={{ color: "var(--color-muted)", fontSize: 14, marginBottom: 24 }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: "10px 20px", borderRadius: 12, border: "1px solid var(--color-border)",
                  background: "var(--color-bg)", color: "var(--color-ink)", fontSize: 14, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >Cancel</button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{
                  padding: "10px 20px", borderRadius: 12, border: "none",
                  background: "#dc2626", color: "white", fontSize: 14, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
