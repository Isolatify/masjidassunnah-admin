"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  MagnifyingGlass,
  Trash,
  Copy,
  ArrowRight,
  LinkSimple,
  ClipboardText,
  ListChecks,
  CursorClick,
  DotsThreeVertical,
} from "@phosphor-icons/react";
import { toast } from "@/components/Toast";
import type { FormRecord } from "@/lib/forms";

export default function RegisterPage() {
  const router = useRouter();
  const [forms, setForms] = useState<FormRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FormRecord | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/forms");
        const data = await res.json();
        if (!alive) return;
        if (!data.success) throw new Error(data.error);
        setForms(data.forms || []);
      } catch (err: unknown) {
        if (alive) toast.error(err instanceof Error ? err.message : "Failed to load forms");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const createForm = useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled form" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      router.push(`/dashboard/register/${data.form.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not create form");
      setCreating(false);
    }
  }, [router]);

  const duplicateForm = useCallback(
    async (form: FormRecord) => {
      try {
        const res = await fetch("/api/forms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${form.title} (copy)`,
            description: form.description,
            fields: form.fields,
            settings: form.settings,
            status: "draft",
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        toast.success("Form duplicated");
        const list = await fetch("/api/forms");
        const listData = await list.json();
        if (listData.success) setForms(listData.forms || []);
      } catch {
        toast.error("Duplicate failed");
      }
      setOpenMenu(null);
    },
    []
  );

  const deleteForm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch("/api/forms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Form deleted");
      setForms((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      setDeleteTarget(null);
      setOpenMenu(null);
    } catch {
      toast.error("Delete failed");
    }
  }, [deleteTarget]);

  const copyLink = useCallback((form: FormRecord) => {
    const url = `${window.location.origin}/f/${form.slug}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Link copied"))
      .catch(() => toast.info(url));
    setOpenMenu(null);
  }, []);

  const filtered = forms.filter((f) => {
    const matchesSearch =
      !search ||
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      (f.description || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalResponses = forms.reduce((sum, f) => sum + (f.response_count || 0), 0);

  return (
    <div onClick={() => setOpenMenu(null)}>
      <div className="page-header">
        <div className="page-eyebrow">Forms &amp; Quizzes</div>
        <h1>Register</h1>
        <p>Create registration forms, surveys and quizzes — then attach them to events.</p>
      </div>

      <div className="fm-stats">
        <div className="fm-stat">
          <ClipboardText size={20} weight="duotone" />
          <div>
            <strong>{forms.length}</strong>
            <span>Form{forms.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div className="fm-stat">
          <ListChecks size={20} weight="duotone" />
          <div>
            <strong>{totalResponses}</strong>
            <span>Response{totalResponses === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div className="fm-stat">
          <CursorClick size={20} weight="duotone" />
          <div>
            <strong>{forms.filter((f) => f.status === "published").length}</strong>
            <span>Live</span>
          </div>
        </div>
      </div>

      <div className="fm-toolbar">
        <div className="fm-search">
          <MagnifyingGlass size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search forms…"
            aria-label="Search forms"
          />
        </div>
        <div className="fm-filters">
          {(["all", "published", "draft"] as const).map((s) => (
            <button
              key={s}
              className={`fm-filter${statusFilter === s ? " on" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setStatusFilter(s);
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <button className="btn-primary fm-new" onClick={createForm} disabled={creating}>
          <Plus size={16} /> New form
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 70 }}>
          <div className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="fm-empty">
          <div className="fm-empty-art">✦</div>
          <h3>{forms.length === 0 ? "No forms yet" : "Nothing matches"}</h3>
          <p>
            {forms.length === 0
              ? "Build your first registration form — it takes about a minute."
              : "Try a different search or filter."}
          </p>
          {forms.length === 0 && (
            <button className="btn-primary" onClick={createForm} disabled={creating}>
              <Plus size={16} /> Create your first form
            </button>
          )}
        </div>
      ) : (
        <div className="fm-grid">
          {filtered.map((form, i) => {
            const live = form.status === "published";
            return (
              <article
                key={form.id}
                className="fm-card"
                style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
              >
                <button
                  className="fm-thumb"
                  onClick={() => router.push(`/dashboard/register/${form.id}`)}
                  aria-label={`Open ${form.title}`}
                >
                  <span className="fm-thumb-bar">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="fm-thumb-body">
                    <span className="fm-thumb-title" />
                    <span className="fm-thumb-line" />
                    <span className="fm-thumb-line short" />
                    <span className="fm-thumb-field" />
                    <span className="fm-thumb-field" />
                    <span className="fm-thumb-btn" />
                  </span>
                  <span className={`fm-thumb-status${live ? " live" : ""}`}>
                    {live ? "Live" : "Draft"}
                  </span>
                </button>

                <div className="fm-card-info">
                  <div className="fm-card-head">
                    <button
                      className="fm-card-title"
                      onClick={() => router.push(`/dashboard/register/${form.id}`)}
                    >
                      {form.title}
                    </button>
                    <div className="fm-menu-wrap">
                      <button
                        className="fm-icon-btn"
                        title="More actions"
                        aria-label="More actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenu(openMenu === form.id ? null : form.id);
                        }}
                      >
                        <DotsThreeVertical size={16} />
                      </button>
                      {openMenu === form.id && (
                        <div className="fm-menu" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => copyLink(form)}>
                            <LinkSimple size={14} /> Copy live link
                          </button>
                          <button onClick={() => duplicateForm(form)}>
                            <Copy size={14} /> Duplicate
                          </button>
                          <button
                            className="danger"
                            onClick={() => {
                              setDeleteTarget(form);
                              setOpenMenu(null);
                            }}
                          >
                            <Trash size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="fm-card-desc">
                    {form.description || "No description — open the builder to add one."}
                  </p>

                  <div className="fm-card-meta">
                    <span className={`badge${live ? " badge--gold" : ""}`}>
                      {form.status}
                    </span>
                    <span>
                      <ListChecks size={13} /> {form.response_count || 0} response
                      {(form.response_count || 0) === 1 ? "" : "s"}
                    </span>
                    <span>
                      {form.fields?.length || 0} question
                      {(form.fields?.length || 0) === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="fm-card-actions">
                    <button
                      className="fm-open"
                      onClick={() => router.push(`/dashboard/register/${form.id}`)}
                    >
                      Open builder <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <div className="ev-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="ev-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ev-modal-icon">
              <Trash size={24} />
            </div>
            <div className="ev-modal-title">Delete “{deleteTarget.title}”?</div>
            <p className="ev-modal-text">
              All {deleteTarget.response_count || 0} responses will be removed too. This cannot be
              undone.
            </p>
            <div className="ev-modal-actions">
              <button className="ev-modal-cancel" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="ev-modal-danger" onClick={deleteForm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
