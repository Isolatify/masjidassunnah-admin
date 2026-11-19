"use client";

/* ==========================================================================
   Responses — every answer the masjid's forms have collected.
     · header: eyebrow / title / sub, with Manage forms + Refresh
     · form chips: the selected form drives ?form=<id>, so the links from the
       events pages (table cells, "View" rows) land straight on that form's
       answers
     · ResultsPanel does the heavy lifting — overview stats, choice
       breakdowns, spreadsheet view, search / sort / column filters,
       CSV · TSV · Excel · JSON export and bulk delete
   ========================================================================== */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowsClockwise, Plus, Table } from "@phosphor-icons/react";
import { toast } from "@/components/Toast";
import ResultsPanel, { type ResponseRow } from "@/components/forms/ResultsPanel";
import type { FormRecord } from "@/lib/forms";
import s from "./page.module.css";

/* ── Inner page (reads ?form=, so it must sit under Suspense) ────────────── */

function ResponsesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formParam = searchParams.get("form");

  const [forms, setForms] = useState<FormRecord[]>([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [respLoading, setRespLoading] = useState(false);

  const loadForms = useCallback(async () => {
    setLoadError("");
    try {
      const res = await fetch("/api/forms", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load forms");
      setForms((data.forms || []) as FormRecord[]);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Failed to load forms");
    } finally {
      setFormsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  /* The ?form= link wins; otherwise open the busiest form so the page never
     lands on an empty one first. */
  const selected = useMemo(() => {
    if (!forms.length) return null;
    if (formParam) return forms.find((f) => f.id === formParam) ?? null;
    return [...forms].sort(
      (a, b) => (b.response_count ?? 0) - (a.response_count ?? 0)
    )[0];
  }, [forms, formParam]);

  const selectedId = selected?.id ?? null;
  const notFound =
    !!formParam && forms.length > 0 && !forms.some((f) => f.id === formParam);

  const loadResponses = useCallback(async () => {
    if (!selectedId) return;
    setRespLoading(true);
    try {
      const res = await fetch(`/api/forms/responses?form_id=${selectedId}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load responses");
      setResponses(data.responses || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load responses");
    } finally {
      setRespLoading(false);
    }
  }, [selectedId]);

  /* Drop the previous form's rows the moment another form is picked, so the
     old answers never flash under the new title. */
  useEffect(() => {
    setResponses([]);
    loadResponses();
  }, [loadResponses]);

  function refresh() {
    loadForms();
    loadResponses();
  }

  const loading = formsLoading;
  const totalResponses = forms.reduce((n, f) => n + (f.response_count ?? 0), 0);

  return (
    <div>
      {/* ── Header ── */}
      <header className={s.head}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div className="page-eyebrow">Responses</div>
          <h1>Every answer, in one place.</h1>
          <p>
            {forms.length
              ? `${forms.length} form${forms.length === 1 ? "" : "s"} · ${totalResponses} response${totalResponses === 1 ? "" : "s"} collected — pick one below.`
              : "Submissions from every registration and enquiry form land here."}
          </p>
        </div>
        <div className={s.headActions}>
          <Link className="btn btn-secondary" href="/dashboard/register">
            Manage forms
          </Link>
          <button type="button" className="btn-primary" onClick={refresh}>
            <ArrowsClockwise size={16} weight="bold" /> Refresh
          </button>
        </div>
      </header>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 70 }}>
          <div className="spinner" />
        </div>
      ) : loadError ? (
        <div className="panel">
          <div className="panel-center">
            <p className="panel-empty" style={{ padding: "6px 0" }}>
              Couldn&apos;t load forms — {loadError}
            </p>
            <button type="button" className="btn btn-secondary" onClick={loadForms}>
              Try again
            </button>
          </div>
        </div>
      ) : forms.length === 0 ? (
        <div className="panel">
          <div className="panel-center">
            <p className="panel-empty" style={{ padding: "6px 0" }}>
              No forms yet — create one to start collecting responses.
            </p>
            <Link className="btn btn-gold" href="/dashboard/register">
              <Plus size={15} weight="bold" /> New form
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* ── Form chips ── */}
          <div className={s.chips}>
            {forms.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={selected?.id === f.id}
                className={`${s.chip}${selected?.id === f.id ? ` ${s.chipOn}` : ""}`}
                title={f.title}
                onClick={() => router.push(`/dashboard/responses?form=${f.id}`)}
              >
                <span className={s.chipTitle}>{f.title}</span>
                <span className={s.chipCount}>{f.response_count ?? 0}</span>
              </button>
            ))}
          </div>

          {notFound ? (
            <div className="panel">
              <div className="panel-center">
                <p className="panel-empty" style={{ padding: "6px 0" }}>
                  That form no longer exists — it may have been deleted.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => router.push("/dashboard/responses")}
                >
                  Back to all responses
                </button>
              </div>
            </div>
          ) : (
            selected && (
              <div className="panel">
                <div className="panel-title">
                  <Table size={15} /> {selected.title}
                  <span className={s.count}>{selected.response_count ?? 0}</span>
                  <span
                    className={`badge${selected.status === "published" ? " badge--gold" : ""}`}
                  >
                    {selected.status}
                  </span>
                </div>
                <ResultsPanel
                  form={selected}
                  responses={responses}
                  loading={respLoading}
                  onRefresh={loadResponses}
                />
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function ResponsesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", padding: 70 }}>
          <div className="spinner" />
        </div>
      }
    >
      <ResponsesInner />
    </Suspense>
  );
}
