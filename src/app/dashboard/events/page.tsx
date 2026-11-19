"use client";

/* ==========================================================================
   Events — the programme list.
     · header: eyebrow / title / sub, with Overview + New Event
     · search + status chips + sortable table (responses link into
       /dashboard/responses)
     · row click opens the editor; publish / delete live in the row
   The glance half of this section — stats, spotlight, 30-day trend — is
   /dashboard/events/overview.
   ========================================================================== */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";
import {
  Plus,
  CalendarBlank,
  MagnifyingGlass,
  Trash,
  PencilSimple,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";
import s from "./page.module.css";
import {
  audienceLabel,
  decorate,
  emptyState,
  getDisplayDate,
  useOverview,
  type Decorated,
  type EventItem,
} from "./shared";

type StatusFilter = "all" | "published" | "draft";
type SortKey = "title" | "date" | "created" | "status" | "responses" | "views";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Drafts" },
];

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function EventsListPage() {
  const router = useRouter();
  const { overview, loadError, load, loading } = useOverview();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: 1 });
  const [deleteConfirm, setDeleteConfirm] = useState<Decorated | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const events = useMemo(() => (overview?.events ?? []).map(decorate), [overview]);

  /* ── Table: filter + sort ── */
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = events.filter((ev) => {
      if (statusFilter !== "all" && ev.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (ev.title || "").toLowerCase().includes(q) ||
        (ev.description || "").toLowerCase().includes(q) ||
        (ev.location || "").toLowerCase().includes(q)
      );
    });

    const respCount = (ev: EventItem) =>
      ev.form_id ? (overview?.formCounts?.[ev.form_id] ?? 0) : null;

    const dir = sort.dir;
    return filtered.sort((a, b) => {
      switch (sort.key) {
        case "title":
          return (a.title || "").localeCompare(b.title || "") * dir;
        case "created":
          return String(a.created_at).localeCompare(String(b.created_at)) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        case "responses":
          return ((respCount(a) ?? -1) - (respCount(b) ?? -1)) * dir;
        case "views":
          return ((a.view_count || 0) - (b.view_count || 0)) * dir;
        case "date":
        default: {
          /* Undated rows always sink to the bottom, whichever way it sorts. */
          if (a.__next === null && b.__next === null)
            return String(a.date_start).localeCompare(String(b.date_start)) * dir;
          if (a.__next === null) return 1;
          if (b.__next === null) return -1;
          return (a.__next - b.__next) * dir;
        }
      }
    });
  }, [events, search, statusFilter, sort, overview]);

  function headSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: (prev.dir === 1 ? -1 : 1) as 1 | -1 }
        : { key, dir: key === "date" || key === "title" ? 1 : -1 }
    );
  }

  const respCount = (ev: EventItem) =>
    ev.form_id ? (overview?.formCounts?.[ev.form_id] ?? 0) : null;

  /* ── Actions ── */
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
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function toggleStatus(ev: EventItem) {
    const next = ev.status === "published" ? "draft" : "published";
    setTogglingId(ev.id);
    try {
      const res = await fetch("/api/events", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ev.id, status: next }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(next === "published" ? "Event published" : "Event moved to drafts");
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not change status");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      {/* ── Header ── */}
      <header className={s.head}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div className="page-eyebrow">Events</div>
          <h1>Every programme, in one place.</h1>
          <p>Search, publish and manage them all — click any row to open its editor.</p>
        </div>
        <div className={s.headActions}>
          <Link className="btn btn-secondary" href="/dashboard/events/overview">
            Overview
          </Link>
          <button
            type="button"
            className="btn-primary"
            onClick={() => router.push("/dashboard/events/new")}
          >
            <Plus size={16} weight="bold" /> New Event
          </button>
        </div>
      </header>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 70 }}>
          <div className="spinner" />
        </div>
      ) : loadError ? (
        <div className="panel">
          {emptyState(
            `Couldn't load events — ${loadError}`,
            <button type="button" className="btn btn-secondary" onClick={load}>
              Try again
            </button>
          )}
        </div>
      ) : (
        <div className="panel">
          <div className="panel-title">
            <CalendarBlank size={15} /> All events
            <span className={s.count}>{rows.length}</span>
          </div>

          <div className="fm-toolbar">
            <label className="fm-search">
              <MagnifyingGlass size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events…"
                aria-label="Search events"
              />
            </label>
            <div className="fm-filters">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`fm-filter${statusFilter === f.id ? " on" : ""}`}
                  onClick={() => setStatusFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {events.length === 0 ? (
            emptyState(
              "No events yet — every programme you create shows up here.",
              <button
                type="button"
                className="btn btn-gold"
                onClick={() => router.push("/dashboard/events/new")}
              >
                <Plus size={15} weight="bold" /> New Event
              </button>
            )
          ) : rows.length === 0 ? (
            emptyState(
              "No events match your search.",
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </button>
            )
          ) : (
            <table className="rsp-table">
              <thead>
                <tr>
                  <th
                    className={sort.key === "title" ? "sorted" : undefined}
                    onClick={() => headSort("title")}
                  >
                    <span>
                      Event
                      {sort.key === "title" && (
                        <i className={s.arrow}>{sort.dir === 1 ? "▲" : "▼"}</i>
                      )}
                    </span>
                  </th>
                  <th
                    className={sort.key === "date" ? "sorted" : undefined}
                    onClick={() => headSort("date")}
                  >
                    <span>
                      Date
                      {sort.key === "date" && (
                        <i className={s.arrow}>{sort.dir === 1 ? "▲" : "▼"}</i>
                      )}
                    </span>
                  </th>
                  <th
                    className={sort.key === "status" ? "sorted" : undefined}
                    onClick={() => headSort("status")}
                  >
                    <span>
                      Status
                      {sort.key === "status" && (
                        <i className={s.arrow}>{sort.dir === 1 ? "▲" : "▼"}</i>
                      )}
                    </span>
                  </th>
                  <th
                    className={sort.key === "responses" ? "sorted" : undefined}
                    onClick={() => headSort("responses")}
                  >
                    <span>
                      Responses
                      {sort.key === "responses" && (
                        <i className={s.arrow}>{sort.dir === 1 ? "▲" : "▼"}</i>
                      )}
                    </span>
                  </th>
                  <th
                    className={sort.key === "views" ? "sorted" : undefined}
                    onClick={() => headSort("views")}
                  >
                    <span>
                      Views
                      {sort.key === "views" && (
                        <i className={s.arrow}>{sort.dir === 1 ? "▲" : "▼"}</i>
                      )}
                    </span>
                  </th>
                  <th className={s.thPlain}>
                    <span aria-label="Actions" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((ev) => {
                  const rc = respCount(ev);
                  return (
                    <tr key={ev.id} onClick={() => router.push(`/dashboard/events/${ev.id}`)}>
                      <td>
                        <span className={s.evCell}>
                          <b>{ev.title}</b>
                          <span>
                            {[ev.location, audienceLabel(ev.audience)]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </td>
                      <td>{getDisplayDate(ev)}</td>
                      <td>
                        <span
                          className={`badge${ev.status === "published" ? "" : " badge--muted"}`}
                        >
                          {ev.status === "published" ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td>
                        {ev.form_id ? (
                          <Link
                            className={s.cellLink}
                            href={`/dashboard/responses?form=${ev.form_id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {rc}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={s.numCell}>{ev.view_count || 0}</td>
                      <td>
                        <span className={s.rowActions}>
                          <button
                            type="button"
                            className={s.iconBtn}
                            title="Edit"
                            aria-label={`Edit ${ev.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/events/${ev.id}`);
                            }}
                          >
                            <PencilSimple size={14} weight="bold" />
                          </button>
                          <button
                            type="button"
                            className={s.iconBtn}
                            title={ev.status === "published" ? "Move to drafts" : "Publish"}
                            aria-label={ev.status === "published" ? "Move to drafts" : "Publish"}
                            disabled={togglingId === ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStatus(ev);
                            }}
                          >
                            {ev.status === "published" ? (
                              <Eye size={14} weight="bold" />
                            ) : (
                              <EyeSlash size={14} weight="bold" />
                            )}
                          </button>
                          <button
                            type="button"
                            className={`${s.iconBtn} ${s.iconBtnDanger}`}
                            title="Delete"
                            aria-label={`Delete ${ev.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(ev);
                            }}
                          >
                            <Trash size={14} weight="bold" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl keep-radius border border-line bg-surface p-8 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-danger-soft text-danger">
              <Trash size={24} weight="duotone" />
            </span>
            <div className="mt-4 font-heading text-lg font-semibold">Delete Event?</div>
            <p className="mt-2 text-[14px] text-muted">
              “{deleteConfirm.title || "Untitled event"}” will be permanently
              removed. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-full border border-line px-6 py-3 text-[13px] font-medium text-ink-soft transition-colors hover:border-primary-mist hover:text-primary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="rounded-full bg-danger px-6 py-3 text-[13px] font-medium text-white transition-shadow hover:shadow-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
