"use client";

/* ==========================================================================
   Events → Overview — how the masjid's programmes are doing:
     · five-card stats row (events, upcoming, responses, registrations, views)
     · the latest-event spotlight beside the 30-day views × responses trend
     · upcoming / latest responses / most viewed panels
   The manager — search, publish, delete — is /dashboard/events.
   ========================================================================== */

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";
import { SITE_URL } from "@/lib/siteUrl";
import {
  Plus,
  CalendarBlank,
  CalendarCheck,
  ListChecks,
  UsersThree,
  Eye,
  Clock,
  MapPin,
  CurrencyDollar,
  PencilSimple,
  ArrowUpRight,
  Copy,
  TrendUp,
} from "@phosphor-icons/react";
import s from "../page.module.css";
import {
  audienceLabel,
  decorate,
  emptyState,
  fmtDay,
  getDisplayDate,
  isFreeCost,
  timeAgo,
  useOverview,
  type EventItem,
} from "../shared";

/* ── Stat card ───────────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  icon,
  gold,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  gold?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-left">
        <p>{label}</p>
        <span>{value}</span>
        {sub && <em className={s.sub}>{sub}</em>}
      </div>
      <div className={`stat-icon${gold ? " stat-icon--gold" : ""}`}>{icon}</div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function EventsOverviewPage() {
  const router = useRouter();
  const { overview, loadError, load, loading } = useOverview();

  const events = useMemo(() => (overview?.events ?? []).map(decorate), [overview]);

  /* Latest = most recently created (independent of table sorting). */
  const latest = useMemo(() => {
    if (!events.length) return null;
    return [...events].sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at))
    )[0];
  }, [events]);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const total = events.length;
    const published = events.filter((e) => e.status === "published").length;
    const upcoming = events
      .filter((e) => e.__next !== null)
      .sort((a, b) => (a.__next ?? 0) - (b.__next ?? 0));
    const nextDate = upcoming[0]?.__next ?? null;
    const views = events.reduce((n, e) => n + (e.view_count || 0), 0);
    const r = overview?.responses;
    const delta = r ? r.last30 - r.prev30 : 0;
    return {
      total,
      published,
      drafts: total - published,
      nextDate,
      views,
      responsesTotal: r?.total ?? 0,
      last7: r?.last7 ?? 0,
      last30: r?.last30 ?? 0,
      delta,
      upcomingCount: upcoming.length,
      upcoming,
    };
  }, [events, overview]);

  /* ── Panel data ── */
  const recent = overview?.recent ?? [];
  const trend = overview?.trend ?? [];
  const trendMax = Math.max(1, ...trend.map((t) => Math.max(t.views, t.responses)));
  const trendViews = trend.reduce((n, t) => n + t.views, 0);
  const trendResponses = trend.reduce((n, t) => n + t.responses, 0);
  const topViews = useMemo(
    () =>
      [...events]
        .filter((e) => (e.view_count || 0) > 0)
        .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
        .slice(0, 5),
    [events]
  );

  const respCount = (ev: EventItem) =>
    ev.form_id ? (overview?.formCounts?.[ev.form_id] ?? 0) : null;

  async function copyLink(ev: EventItem) {
    if (!ev.slug) return;
    try {
      await navigator.clipboard.writeText(`${SITE_URL}/events/${ev.slug}`);
      toast.success("Public link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  /* Spotlight metrics for the latest event. */
  const spotNext = latest
    ? latest.__past
      ? { label: "Last held", value: latest.__last ? fmtDay(new Date(latest.__last)) : "Ended" }
      : { label: "Next date", value: latest.__next ? fmtDay(new Date(latest.__next)) : "—" }
    : null;

  return (
    <div>
      {/* ── Header ── */}
      <header className={s.head}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div className="page-eyebrow">Events</div>
          <h1>Programmes at a glance.</h1>
          <p>
            Responses, views and what is coming next — everything the masjid
            runs, counted as it happens.
          </p>
        </div>
        <div className={s.headActions}>
          <Link className="btn btn-secondary" href="/dashboard/events">
            All events
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
        <>
          {/* ── Stats ── */}
          <div className="stats-row">
            <StatCard
              label="Events"
              value={stats.total}
              sub={`${stats.published} published · ${stats.drafts} draft${stats.drafts === 1 ? "" : "s"}`}
              icon={<CalendarBlank size={20} weight="duotone" />}
            />
            <StatCard
              label="Upcoming"
              value={stats.upcomingCount}
              sub={stats.nextDate ? `Next: ${fmtDay(new Date(stats.nextDate))}` : "Nothing scheduled"}
              icon={<CalendarCheck size={20} weight="duotone" />}
              gold
            />
            <StatCard
              label="Responses"
              value={stats.responsesTotal}
              sub={`+${stats.last7} this week`}
              icon={<ListChecks size={20} weight="duotone" />}
            />
            <StatCard
              label="Registrations"
              value={stats.last30}
              sub={
                stats.delta > 0
                  ? `↑ ${stats.delta} vs prev 30 days`
                  : stats.delta < 0
                    ? `↓ ${-stats.delta} vs prev 30 days`
                    : "Same as prev 30 days"
              }
              icon={<UsersThree size={20} weight="duotone" />}
            />
            <StatCard
              label="Event views"
              value={stats.views}
              sub={latest ? `Latest event: ${latest.view_count || 0}` : "No events yet"}
              icon={<Eye size={20} weight="duotone" />}
              gold
            />
          </div>

          {/* ── Spotlight + trend ── */}
          <div className={s.row2}>
            <div className="panel">
              <div className="panel-title">
                <Clock size={15} /> Latest event
              </div>
              {latest ? (
                <div className={s.spot}>
                  <div className={s.spotCover}>
                    {latest.full_image || latest.cover_image || latest.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={latest.full_image || latest.cover_image || latest.image_url}
                        alt={latest.title}
                      />
                    ) : (
                      <CalendarBlank size={34} weight="duotone" />
                    )}
                  </div>
                  <div className={s.spotBody}>
                    <div className={s.spotBadges}>
                      <span
                        className={`badge${latest.status === "published" ? "" : " badge--muted"}`}
                      >
                        {latest.status === "published" ? "Published" : "Draft"}
                      </span>
                      <span className="badge badge--gold">{audienceLabel(latest.audience)}</span>
                    </div>
                    <h3 className={s.spotTitle}>{latest.title}</h3>
                    <div className={s.spotMeta}>
                      <span>
                        <CalendarBlank size={13} weight="duotone" /> {getDisplayDate(latest)}
                      </span>
                      {latest.location && (
                        <span>
                          <MapPin size={13} weight="duotone" /> {latest.location}
                        </span>
                      )}
                      {!isFreeCost(latest.cost) && (
                        <span>
                          <CurrencyDollar size={13} weight="duotone" /> {latest.cost}
                        </span>
                      )}
                    </div>
                    <div className={s.spotMetrics}>
                      <div>
                        <strong>{latest.view_count || 0}</strong>
                        <span>Views</span>
                      </div>
                      <div>
                        <strong>{respCount(latest) ?? "—"}</strong>
                        <span>Responses</span>
                      </div>
                      {spotNext && (
                        <div>
                          <strong>{spotNext.value}</strong>
                          <span>{spotNext.label}</span>
                        </div>
                      )}
                    </div>
                    <div className={s.spotActions}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => router.push(`/dashboard/events/${latest.id}`)}
                      >
                        <PencilSimple size={14} weight="bold" /> Edit event
                      </button>
                      {latest.slug && (
                        <a
                          className="btn btn-secondary"
                          href={`${SITE_URL}/events/${latest.slug}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ArrowUpRight size={14} weight="bold" /> View live
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => copyLink(latest)}
                      >
                        <Copy size={14} weight="bold" /> Copy link
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                emptyState(
                  "No events yet — create the first programme to see it here.",
                  <button
                    type="button"
                    className="btn btn-gold"
                    onClick={() => router.push("/dashboard/events/new")}
                  >
                    <Plus size={15} weight="bold" /> New Event
                  </button>
                )
              )}
            </div>

            <div className="panel">
              <div className="panel-title">
                <TrendUp size={15} /> Last 30 days
              </div>
              {trendViews === 0 && trendResponses === 0 ? (
                emptyState("No views or responses in the last 30 days yet.")
              ) : (
                <div className={s.chart}>
                  <div className={s.chartLegend}>
                    <span>
                      <i className={`${s.dot} ${s.dotViews}`} /> {trendViews} views
                    </span>
                    <span>
                      <i className={`${s.dot} ${s.dotResps}`} /> {trendResponses} responses
                    </span>
                  </div>
                  <div className={s.chartBars} role="img" aria-label="Daily views and responses over the last 30 days">
                    {trend.map((pt) => (
                      <div
                        className={s.chartCol}
                        key={pt.day}
                        title={`${fmtDay(new Date(pt.day + "T12:00:00"))} — ${pt.views} view${pt.views === 1 ? "" : "s"}, ${pt.responses} response${pt.responses === 1 ? "" : "s"}`}
                      >
                        <i
                          className={`${s.bar} ${s.barViews}`}
                          style={{ height: pt.views > 0 ? `${Math.max(4, (pt.views / trendMax) * 100)}%` : "0%" }}
                        />
                        <i
                          className={`${s.bar} ${s.barResps}`}
                          style={{ height: pt.responses > 0 ? `${Math.max(4, (pt.responses / trendMax) * 100)}%` : "0%" }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className={s.chartAxis}>
                    <span>30 days ago</span>
                    <span>Today</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Upcoming · latest responses · most viewed ── */}
          <div className={s.row3}>
            <div className="panel">
              <div className="panel-title">
                <CalendarCheck size={15} /> Upcoming
              </div>
              {stats.upcoming.length === 0 ? (
                emptyState("Nothing scheduled yet.")
              ) : (
                stats.upcoming.slice(0, 5).map((ev) => {
                  const d = new Date(ev.__next!);
                  return (
                    <button
                      type="button"
                      key={ev.id}
                      className={s.rowBtn}
                      onClick={() => router.push(`/dashboard/events/${ev.id}`)}
                    >
                      <span className={s.dateChip}>
                        <b>{d.getDate()}</b>
                        <i>{d.toLocaleDateString("en-AU", { month: "short" })}</i>
                      </span>
                      <span className="list-info">
                        <span className="list-name">{ev.title}</span>
                        <span className="list-detail">{ev.location || "No location set"}</span>
                      </span>
                      <span className={`${s.rowHint} ${s.rowHintWeekday}`}>
                        {ev.status === "draft"
                          ? "Draft"
                          : d.toLocaleDateString("en-AU", { weekday: "long" })}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="panel">
              <div className="panel-title">
                <ListChecks size={15} /> Latest responses
              </div>
              {recent.length === 0 ? (
                emptyState("No responses yet.")
              ) : (
                recent.slice(0, 5).map((r) => (
                  <div className={`list-item ${s.listItem}`} key={r.id}>
                    <span className={s.miniIcon}>
                      <ListChecks size={15} weight="bold" />
                    </span>
                    <span className="list-info">
                      <span className="list-name">{r.form_title}</span>
                      <span className="list-detail">{timeAgo(r.created_at)}</span>
                    </span>
                    {r.form_id && (
                      <Link
                        className={s.rowHintLink}
                        href={`/dashboard/responses?form=${r.form_id}`}
                      >
                        View
                      </Link>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="panel">
              <div className="panel-title">
                <Eye size={15} /> Most viewed
              </div>
              {topViews.length === 0 ? (
                emptyState("Views start counting when an event page is opened.")
              ) : (
                topViews.map((ev, i) => {
                  const max = topViews[0].view_count || 1;
                  return (
                    <button
                      type="button"
                      key={ev.id}
                      className={s.rowBtn}
                      onClick={() => router.push(`/dashboard/events/${ev.id}`)}
                    >
                      <span className="list-rank">{i + 1}</span>
                      <span className="list-info">
                        <span className="list-name">{ev.title}</span>
                        <span className={s.viewBar}>
                          <span
                            className={s.viewBarFill}
                            style={{ width: `${Math.max(6, ((ev.view_count || 0) / max) * 100)}%` }}
                          />
                        </span>
                      </span>
                      <span className={s.rowHint}>{ev.view_count || 0}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
