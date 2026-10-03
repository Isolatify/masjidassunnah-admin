"use client";

import { useMemo, useState, useCallback } from "react";
import {
  MagnifyingGlass,
  DownloadSimple,
  SpinnerGap,
  CaretUp,
  CaretDown,
  Trash,
  X,
  Copy,
  Printer,
  Table,
  Clock,
  ChartBar,
  TrendUp,
} from "@phosphor-icons/react";
import { toast } from "@/components/Toast";
import { metaFor } from "@/components/forms/meta";
import { isLayout, type FormField, type FormRecord } from "@/lib/forms";

export interface ResponseRow {
  id: string;
  form_id: string;
  answers: Record<string, unknown>;
  created_at: string;
}

interface TimingMeta {
  started_at?: number;
  duration_ms?: number;
  words?: number;
  chars?: number;
  page_views?: number;
  device?: string;
}

interface Col {
  key: string;
  label: string;
  kind: "submitted" | "duration" | "field";
  field?: FormField;
}

interface Props {
  form: FormRecord;
  responses: ResponseRow[];
  loading: boolean;
  onRefresh: () => void;
}

const OTHER = "__other__:".length;
const PAGE_SIZE = 50;

const NUMERIC_TYPES = new Set(["number", "rating", "opinion_scale", "nps"]);
const CHOICE_TYPES = new Set([
  "multiple_choice",
  "checkboxes",
  "dropdown",
  "picture_choice",
  "yes_no",
  "legal",
]);

function metaOf(r: ResponseRow): TimingMeta {
  const m = r.answers?.__meta;
  return m && typeof m === "object" ? (m as TimingMeta) : {};
}

function display(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.map((x) => String(x)).join(", ") : "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") {
    return Object.values(v as Record<string, unknown>)
      .map((x) => String(x ?? ""))
      .filter(Boolean)
      .join(" ");
  }
  const s = String(v);
  return s.startsWith("__other__") ? s.slice(OTHER) : s;
}

function raw(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") {
    return Object.values(v as Record<string, unknown>)
      .map((x) => String(x ?? ""))
      .filter(Boolean)
      .join(" ");
  }
  const s = String(v);
  return s.startsWith("__other__") ? s.slice(OTHER) : s;
}

function formatDur(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}h ${p(m)}m`;
  if (m > 0) return `${m}m ${p(s)}s`;
  return `${s}s`;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return v === null || v === undefined || v === "" || Number.isNaN(n) ? null : n;
}

function median(list: number[]): number | null {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function csvCell(v: string): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}

export default function ResultsPanel({ form, responses, loading, onRefresh }: Props) {
  const [view, setView] = useState<"overview" | "grid">("overview");
  const [now] = useState(() => Date.now());
  const [colsOpen, setColsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({
    key: "__submitted",
    dir: -1,
  });
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const columns = useMemo<Col[]>(() => {
    const cols: Col[] = [
      { key: "__submitted", label: "Submitted", kind: "submitted" },
      { key: "__duration", label: "Time spent", kind: "duration" },
    ];
    for (const f of form.fields) {
      if (isLayout(f.type)) continue;
      cols.push({
        key: f.id,
        label: f.title || metaFor(f.type).label,
        kind: "field",
        field: f,
      });
    }
    return cols;
  }, [form.fields]);

  const visibleCols = useMemo(
    () => columns.filter((c) => !hidden.has(c.key)),
    [columns, hidden]
  );

  const prepared = useMemo(() => {
    return responses.map((r) => {
      const cells: Record<string, string> = {};
      let haystack = "";
      for (const c of columns) {
        let v = "";
        if (c.kind === "submitted") {
          v = new Date(r.created_at).toLocaleString("en-AU", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        } else if (c.kind === "duration") {
          const d = metaOf(r).duration_ms;
          v = typeof d === "number" ? formatDur(d) : "—";
        } else if (c.field) {
          v = display(r.answers?.[c.field.id]);
        }
        cells[c.key] = v;
        haystack += v.toLowerCase() + "\n";
      }
      return {
        r,
        cells,
        haystack,
        duration: metaOf(r).duration_ms ?? null,
        submitted: new Date(r.created_at).getTime(),
        words: metaOf(r).words ?? null,
      };
    });
  }, [responses, columns]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = Object.entries(colFilters).filter(([, v]) => v.trim());
    let out = prepared.filter((row) => {
      if (q && !row.haystack.includes(q)) return false;
      for (const [key, v] of active) {
        if (!row.cells[key]?.toLowerCase().includes(v.trim().toLowerCase())) return false;
      }
      return true;
    });
    const col = columns.find((c) => c.key === sort.key);
    out = [...out].sort((a, b) => {
      if (sort.key === "__submitted") return (a.submitted - b.submitted) * sort.dir;
      if (sort.key === "__duration") {
        const av = a.duration ?? -1;
        const bv = b.duration ?? -1;
        return (av - bv) * sort.dir;
      }
      const av = a.cells[sort.key] ?? "";
      const bv = b.cells[sort.key] ?? "";
      const an = col?.field && NUMERIC_TYPES.has(col.field.type) ? num(av) : null;
      const bn = col?.field && NUMERIC_TYPES.has(col.field.type) ? num(bv) : null;
      if (an !== null && bn !== null) return (an - bn) * sort.dir;
      if (an !== null) return -1 * sort.dir;
      if (bn !== null) return 1 * sort.dir;
      return av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" }) * sort.dir;
    });
    return out;
  }, [prepared, query, colFilters, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const stats = useMemo(() => {
    const durations = prepared.map((p) => p.duration).filter((d): d is number => typeof d === "number");
    const words = prepared.map((p) => p.words).filter((w): w is number => typeof w === "number");
    const day = 86400000;
    return {
      total: prepared.length,
      avgDur: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
      medDur: median(durations),
      fastest: durations.length ? Math.min(...durations) : null,
      slowest: durations.length ? Math.max(...durations) : null,
      last24: prepared.filter((p) => now - p.submitted < day).length,
      last7: prepared.filter((p) => now - p.submitted < day * 7).length,
      today: prepared.filter(
        (p) => new Date(p.submitted).toDateString() === new Date(now).toDateString()
      ).length,
      words: words.length ? words.reduce((a, b) => a + b, 0) : null,
      withTiming: durations.length,
    };
  }, [prepared, now]);

  const charts = useMemo(() => {
    return columns
      .filter((c) => c.kind === "field" && c.field && CHOICE_TYPES.has(c.field.type))
      .map((c) => {
        const counts = new Map<string, number>();
        let answered = 0;
        for (const row of prepared) {
          const v = row.r.answers?.[c.field!.id];
          if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) continue;
          answered++;
          const values = Array.isArray(v) ? v : [v];
          for (const one of values) {
            const label = raw(one) || "(empty)";
            counts.set(label, (counts.get(label) || 0) + 1);
          }
        }
        const items = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
        return { col: c, answered, items, total: prepared.length };
      })
      .filter((c) => c.items.length > 0);
  }, [columns, prepared]);

  const numericSummaries = useMemo(() => {
    return columns
      .filter((c) => c.kind === "field" && c.field && NUMERIC_TYPES.has(c.field.type))
      .map((c) => {
        const nums = prepared
          .map((row) => num(row.r.answers?.[c.field!.id]))
          .filter((n): n is number => n !== null);
        if (!nums.length) return null;
        return {
          col: c,
          count: nums.length,
          min: Math.min(...nums),
          max: Math.max(...nums),
          avg: nums.reduce((a, b) => a + b, 0) / nums.length,
          sum: nums.reduce((a, b) => a + b, 0),
        };
      })
      .filter(Boolean);
  }, [columns, prepared]);

  const textSummaries = useMemo(() => {
    return columns
      .filter(
        (c) =>
          c.kind === "field" &&
          c.field &&
          ["short_text", "long_text", "email", "phone", "url"].includes(c.field.type)
      )
      .map((c) => {
        const texts = prepared
          .map((row) => display(row.r.answers?.[c.field!.id]))
          .filter((t) => t && t !== "—");
        if (!texts.length) return null;
        const avgLen = texts.reduce((a, b) => a + b.length, 0) / texts.length;
        const distinct = new Set(texts.map((t) => t.toLowerCase())).size;
        return { col: c, count: texts.length, distinct, avgLen, longest: Math.max(...texts.map((t) => t.length)) };
      })
      .filter(Boolean);
  }, [columns, prepared]);

  const functionRow = useMemo(() => {
    const out: Record<string, string> = {};
    for (const c of visibleCols) {
      if (c.kind === "submitted") {
        out[c.key] = `${filtered.length} rows`;
        continue;
      }
      if (c.kind === "duration") {
        const ds = filtered.map((r) => r.duration).filter((d): d is number => typeof d === "number");
        out[c.key] = ds.length ? `avg ${formatDur(ds.reduce((a, b) => a + b, 0) / ds.length)}` : "—";
        continue;
      }
      const values = filtered.map((r) => r.cells[c.key]).filter((v) => v && v !== "—");
      const distinct = new Set(values.map((v) => v.toLowerCase())).size;
      if (c.field && NUMERIC_TYPES.has(c.field.type)) {
        const nums = values.map((v) => num(v)).filter((n): n is number => n !== null);
        if (!nums.length) {
          out[c.key] = `n=0`;
          continue;
        }
        const sum = nums.reduce((a, b) => a + b, 0);
        out[
          c.key
        ] = `Σ ${round(sum)} · avg ${round(sum / nums.length)} · min ${round(
          Math.min(...nums)
        )} · max ${round(Math.max(...nums))} · n=${nums.length}`;
        continue;
      }
      out[c.key] = `${values.length} filled · ${distinct} unique`;
    }
    return out;
  }, [visibleCols, filtered]);

  const selectedRow = openId ? prepared.find((p) => p.r.id === openId) : null;

  const toggleSort = useCallback((key: string) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 1 ? -1 : 1 } : { key, dir: key === "__submitted" ? -1 : 1 }
    );
    setPage(0);
  }, []);

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const deleteRows = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      if (!window.confirm(`Delete ${ids.length} response${ids.length === 1 ? "" : "s"}? This cannot be undone.`))
        return;
      setDeleting(true);
      try {
        const res = await fetch("/api/forms/responses", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        toast.success(`${ids.length} response${ids.length === 1 ? "" : "s"} deleted`);
        setSelected(new Set());
        setOpenId(null);
        onRefresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      } finally {
        setDeleting(false);
      }
    },
    [onRefresh]
  );

  const exportRows = useMemo(() => {
    const cols = visibleCols;
    const header = cols.map((c) => c.label);
    const body = filtered.map((row) => cols.map((c) => row.cells[c.key] ?? ""));
    return { header, body };
  }, [visibleCols, filtered]);

  const doExport = useCallback(
    (kind: "csv" | "tsv" | "json" | "excel" | "copy" | "print") => {
      if (!filtered.length) {
        toast.info("Nothing to export");
        return;
      }
      const { header, body } = exportRows;
      const base = form.slug || "form";
      if (kind === "csv") {
        const text = [header, ...body].map((r) => r.map(csvCell).join(",")).join("\r\n");
        download(`${base}-responses.csv`, "﻿" + text, "text/csv;charset=utf-8");
        toast.success("CSV downloaded");
      } else if (kind === "tsv") {
        const text = [header, ...body]
          .map((r) => r.map((c) => String(c).replace(/\t/g, " ")).join("\t"))
          .join("\n");
        download(`${base}-responses.tsv`, text, "text/tab-separated-values;charset=utf-8");
        toast.success("TSV downloaded");
      } else if (kind === "json") {
        const data = filtered.map((row) => {
          const obj: Record<string, unknown> = {
            submitted_at: new Date(row.r.created_at).toISOString(),
            time_spent_ms: row.duration,
          };
          for (const c of columns) {
            if (c.kind === "field" && c.field) obj[c.label] = row.r.answers?.[c.field.id] ?? null;
          }
          return obj;
        });
        download(`${base}-responses.json`, JSON.stringify(data, null, 2), "application/json");
        toast.success("JSON downloaded");
      } else if (kind === "excel") {
        const esc = (v: string) =>
          String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const html = `<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${header
          .map((h) => `<th>${esc(h)}</th>`)
          .join("")}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></body></html>`;
        download(`${base}-responses.xls`, html, "application/vnd.ms-excel");
        toast.success("Spreadsheet downloaded — open it in Excel or Google Sheets");
      } else if (kind === "copy") {
        const text = [header, ...body].map((r) => r.join("\t")).join("\n");
        navigator.clipboard
          .writeText(text)
          .then(() => toast.success("Copied as spreadsheet data"))
          .catch(() => toast.error("Could not copy"));
      } else if (kind === "print") {
        setView("grid");
        setTimeout(() => window.print(), 120);
      }
      setExportOpen(false);
    },
    [filtered, exportRows, form.slug, columns]
  );

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!responses.length) {
    return (
      <div className="fm-empty">
        <div className="fm-empty-art">◔</div>
        <h3>No responses yet</h3>
        <p>Share the link — submissions will appear here in real time.</p>
        <button className="btn-secondary" onClick={onRefresh}>
          <SpinnerGap size={14} /> Check again
        </button>
      </div>
    );
  }

  return (
    <div className="rsp">
      <div className="rsp-toolbar">
        <div className="rsp-tabs">
          <button
            className={`rsp-tab${view === "overview" ? " on" : ""}`}
            onClick={() => setView("overview")}
          >
            <ChartBar size={14} /> Overview
          </button>
          <button
            className={`rsp-tab${view === "grid" ? " on" : ""}`}
            onClick={() => setView("grid")}
          >
            <Table size={14} /> Spreadsheet
          </button>
        </div>

        <label className="rsp-search">
          <MagnifyingGlass size={14} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search every answer…"
          />
        </label>

        <button className="btn-secondary" onClick={onRefresh}>
          <SpinnerGap size={14} /> Refresh
        </button>

        <div className="rsp-menu">
          <button
            className="btn-primary"
            onClick={() => setExportOpen((v) => !v)}
            disabled={!filtered.length}
          >
            <DownloadSimple size={15} /> Export{" "}
            {selected.size > 0 ? `(${selected.size} selected)` : `(${filtered.length})`}
          </button>
          {exportOpen && (
            <div className="rsp-menu-pop">
              <button onClick={() => doExport("csv")}>CSV — Excel / Numbers</button>
              <button onClick={() => doExport("tsv")}>TSV — paste into sheets</button>
              <button onClick={() => doExport("excel")}>Excel spreadsheet (.xls)</button>
              <button onClick={() => doExport("json")}>JSON — developers</button>
              <button onClick={() => doExport("copy")}>
                <Copy size={13} /> Copy table to clipboard
              </button>
              <button onClick={() => doExport("print")}>
                <Printer size={13} /> Print / save as PDF
              </button>
            </div>
          )}
        </div>

        <button
          className="btn-secondary rsp-danger"
          onClick={() => void deleteRows([...selected])}
          disabled={!selected.size || deleting}
        >
          {deleting ? <SpinnerGap size={14} className="spin" /> : <Trash size={14} />} Delete
          {selected.size ? ` ${selected.size}` : ""}
        </button>
      </div>

      {view === "overview" ? (
        <div className="rsp-overview">
          <div className="rsp-cards">
            <div className="rsp-card">
              <span className="rsp-card-label">Responses</span>
              <strong className="rsp-card-value">{stats.total}</strong>
              <span className="rsp-card-sub">
                {stats.today} today · {stats.last24} last 24h · {stats.last7} last 7 days
              </span>
            </div>
            <div className="rsp-card">
              <span className="rsp-card-label">Average time on form</span>
              <strong className="rsp-card-value">
                {stats.avgDur !== null ? formatDur(stats.avgDur) : "—"}
              </strong>
              <span className="rsp-card-sub">
                {stats.withTiming} of {stats.total} responses timed
              </span>
            </div>
            <div className="rsp-card">
              <span className="rsp-card-label">Median time</span>
              <strong className="rsp-card-value">
                {stats.medDur !== null ? formatDur(stats.medDur) : "—"}
              </strong>
              <span className="rsp-card-sub">
                {stats.fastest !== null && stats.slowest !== null
                  ? `fastest ${formatDur(stats.fastest)} · slowest ${formatDur(stats.slowest)}`
                  : "no timing data yet"}
              </span>
            </div>
            <div className="rsp-card">
              <span className="rsp-card-label">
                <TrendUp size={13} /> Words typed
              </span>
              <strong className="rsp-card-value">{stats.words ?? "—"}</strong>
              <span className="rsp-card-sub">across every written answer</span>
            </div>
          </div>

          {charts.length > 0 && (
            <section className="rsp-block">
              <h3 className="rsp-h">
                <ChartBar size={15} /> Choice breakdowns
              </h3>
              <div className="rsp-charts">
                {charts.map(({ col, items, answered, total }) => (
                  <div className="rsp-chart" key={col.key}>
                    <div className="rsp-chart-title">
                      {col.label}
                      <span>
                        {answered}/{total} answered
                      </span>
                    </div>
                    {items.map(([label, count]) => (
                      <div className="rsp-bar" key={label}>
                        <span className="rsp-bar-label">{label}</span>
                        <span className="rsp-bar-track">
                          <span
                            className="rsp-bar-fill"
                            style={{ width: `${Math.round((count / Math.max(1, total)) * 100)}%` }}
                          />
                        </span>
                        <span className="rsp-bar-num">
                          {count}
                          <i>{Math.round((count / Math.max(1, total)) * 100)}%</i>
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          {(numericSummaries.length > 0 || textSummaries.length > 0) && (
            <section className="rsp-block">
              <h3 className="rsp-h">
                <Clock size={15} /> Answer statistics
              </h3>
              <div className="rsp-stats">
                {numericSummaries.map((s) =>
                  s ? (
                    <div className="rsp-stat" key={s.col.key}>
                      <strong>{s.col.label}</strong>
                      <div className="rsp-stat-nums">
                        <span>
                          <i>avg</i> {round(s.avg)}
                        </span>
                        <span>
                          <i>min</i> {round(s.min)}
                        </span>
                        <span>
                          <i>max</i> {round(s.max)}
                        </span>
                        <span>
                          <i>sum</i> {round(s.sum)}
                        </span>
                        <span>
                          <i>n</i> {s.count}
                        </span>
                      </div>
                    </div>
                  ) : null
                )}
                {textSummaries.map((s) =>
                  s ? (
                    <div className="rsp-stat" key={s.col.key}>
                      <strong>{s.col.label}</strong>
                      <div className="rsp-stat-nums">
                        <span>
                          <i>filled</i> {s.count}
                        </span>
                        <span>
                          <i>unique</i> {s.distinct}
                        </span>
                        <span>
                          <i>avg chars</i> {Math.round(s.avgLen)}
                        </span>
                        <span>
                          <i>longest</i> {s.longest}
                        </span>
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="rsp-grid-wrap">
          <div className="rsp-gridbar">
            <span>
              {filtered.length} of {responses.length} responses
              {selected.size ? ` · ${selected.size} selected` : ""}
            </span>
            <span className="rsp-hint">Click a row to open it · click a header to sort</span>
            <div className="rsp-menu">
              <button className="btn-secondary" onClick={() => setColsOpen((v) => !v)}>
                Columns{" "}
                <span className="rsp-colcount">
                  {visibleCols.length}/{columns.length}
                </span>
              </button>
              {colsOpen && (
                <div className="rsp-menu-pop">
                  {columns.map((c) => (
                    <label className="rsp-colitem" key={c.key}>
                      <input
                        type="checkbox"
                        checked={!hidden.has(c.key)}
                        onChange={() =>
                          setHidden((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.key)) next.delete(c.key);
                            else next.add(c.key);
                            return next;
                          })
                        }
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rsp-scroll">
            <table className="rsp-table">
              <thead>
                <tr>
                  <th className="rsp-check">
                    <input
                      type="checkbox"
                      checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.r.id))}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? new Set(pageRows.map((r) => r.r.id))
                            : new Set()
                        )
                      }
                      aria-label="Select page"
                    />
                  </th>
                  <th className="rsp-num">#</th>
                  {visibleCols.map((c) => (
                    <th
                      key={c.key}
                      onClick={() => toggleSort(c.key)}
                      className={sort.key === c.key ? "sorted" : ""}
                    >
                      <span>
                        {c.label}
                        {sort.key === c.key &&
                          (sort.dir === 1 ? <CaretUp size={11} /> : <CaretDown size={11} />)}
                      </span>
                      <input
                        className="rsp-colfilter"
                        value={colFilters[c.key] || ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          setColFilters((prev) => ({ ...prev, [c.key]: e.target.value }));
                          setPage(0);
                        }}
                        placeholder="filter"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <tr
                    key={row.r.id}
                    className={selected.has(row.r.id) ? "picked" : ""}
                    onClick={() => setOpenId(row.r.id)}
                  >
                    <td className="rsp-check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(row.r.id)}
                        onChange={() => toggleRow(row.r.id)}
                        aria-label="Select row"
                      />
                    </td>
                    <td className="rsp-num">{safePage * PAGE_SIZE + i + 1}</td>
                    {visibleCols.map((c) => (
                      <td key={c.key} className={c.kind === "duration" ? "rsp-dim" : ""}>
                        {row.cells[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={visibleCols.length + 2} className="rsp-empty">
                      Nothing matches those filters.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="rsp-fn">
                  <td />
                  <td className="rsp-num">ƒ</td>
                  {visibleCols.map((c) => (
                    <td key={c.key}>{functionRow[c.key]}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="rsp-pager">
            <button
              className="btn-secondary"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              ← Previous
            </button>
            <span>
              Page {safePage + 1} / {pageCount}
            </span>
            <button
              className="btn-secondary"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {selectedRow && (
        <div className="rsp-modal" onClick={() => setOpenId(null)}>
          <div className="rsp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rsp-modal-head">
              <div>
                <strong>Response</strong>
                <span>
                  {new Date(selectedRow.r.created_at).toLocaleString("en-AU", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {typeof selectedRow.duration === "number"
                    ? ` · took ${formatDur(selectedRow.duration)}`
                    : ""}
                </span>
              </div>
              <div className="rsp-modal-actions">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(JSON.stringify(selectedRow.r.answers, null, 2))
                      .then(() => toast.success("Answers copied"))
                      .catch(() => toast.error("Could not copy"));
                  }}
                >
                  <Copy size={13} /> Copy JSON
                </button>
                <button
                  className="btn-secondary rsp-danger"
                  onClick={() => void deleteRows([selectedRow.r.id])}
                >
                  <Trash size={13} /> Delete
                </button>
                <button className="btn-secondary" onClick={() => setOpenId(null)} aria-label="Close">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="rsp-modal-body">
              {columns
                .filter((c) => c.kind === "field")
                .map((c) => {
                  const v = selectedRow.r.answers?.[c.field!.id];
                  const empty = v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);
                  if (empty) return null;
                  return (
                    <div className="rsp-qa" key={c.key}>
                      <span className="rsp-q">{c.label}</span>
                      <span className="rsp-a">{display(v)}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function round(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
