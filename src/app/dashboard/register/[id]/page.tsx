"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash,
  Copy,
  LinkSimple,
  Check,
  SpinnerGap,
  Eye,
  CaretUp,
  CaretDown,
  X,
  DownloadSimple,
  GearSix,
  PaintBrush,
  CheckCircle,
  FlowArrow,
  ListChecks,
  Star,
  ShieldWarning,
} from "@phosphor-icons/react";
import { toast } from "@/components/Toast";
import FormRenderer from "@/components/forms/FormRenderer";
import ImageUploader from "@/components/forms/ImageUploader";
import { countryRows } from "@/components/forms/PhoneInput";
import { FIELD_META, FIELD_GROUPS, metaFor } from "@/components/forms/meta";
import { FieldWidget } from "@/components/forms/FormRenderer";
import ResultsPanel from "@/components/forms/ResultsPanel";
import {
  newField,
  defaultTheme,
  defaultResponses,
  defaultPresentation,
  defaultQuiz,
  CONDITION_OPS,
  NO_VALUE_OPS,
  FIELD_VALUE_OPS,
  DATE_VALUE_OPS,
  THEME_FONTS,
  type ConditionRule,
  type ValidationRule,
  type ValidationCondition,
  type CompareOp,
  type FormField,
  type FormRecord,
  type FieldType,
  type FormSettings,
} from "@/lib/forms";

type Tab = "build" | "preview" | "settings" | "publish" | "results";
type SettingsSection =
  | "form"
  | "appearance"
  | "responses"
  | "quiz"
  | "thankyou"
  | "conditions"
  | "validation";
type Selection = { kind: "field"; id: string } | null;

interface FormResponse {
  id: string;
  form_id: string;
  answers: Record<string, unknown>;
  created_at: string;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "build", label: "Build" },
  { id: "preview", label: "Preview" },
  { id: "settings", label: "Settings" },
  { id: "publish", label: "Publish" },
  { id: "results", label: "Results" },
];

const SETTINGS_SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: "form", label: "Form", icon: <GearSix size={16} weight="duotone" /> },
  { id: "appearance", label: "Appearance", icon: <PaintBrush size={16} weight="duotone" /> },
  { id: "responses", label: "Responses", icon: <ListChecks size={16} weight="duotone" /> },
  { id: "quiz", label: "Quiz", icon: <Star size={16} weight="duotone" /> },
  { id: "thankyou", label: "Thank You", icon: <CheckCircle size={16} weight="duotone" /> },
  { id: "conditions", label: "Conditions", icon: <FlowArrow size={16} weight="duotone" /> },
  { id: "validation", label: "Validation", icon: <ShieldWarning size={16} weight="duotone" /> },
];

const CHOICE_TYPES: FieldType[] = [
  "multiple_choice",
  "checkboxes",
  "dropdown",
  "picture_choice",
  "ranking",
];

const QUIZ_ANSWER_TYPES: FieldType[] = [
  "multiple_choice",
  "checkboxes",
  "dropdown",
  "picture_choice",
  "yes_no",
  "short_text",
  "long_text",
  "email",
  "number",
  "url",
  "rating",
  "opinion_scale",
  "nps",
];

function ChipToggle({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={`jf-chip${on ? " on" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

export default function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [form, setForm] = useState<FormRecord | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("build");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("form");
  const [sel, setSel] = useState<Selection>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const dirty = form !== null && JSON.stringify(form) !== snapshot;

  /* ---------------- load ---------------- */

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/forms?id=${id}`);
        const data = await res.json();
        if (!alive) return;
        if (!data.success || !data.form) throw new Error(data.error || "Form not found");
        const loaded: FormRecord = {
          ...data.form,
          fields: data.form.fields || [],
          settings: data.form.settings || {},
        };
        setForm(loaded);
        setSnapshot(JSON.stringify(loaded));
      } catch (err: unknown) {
        if (alive) {
          toast.error(err instanceof Error ? err.message : "Failed to load form");
          router.push("/dashboard/register");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, router]);

  /* ---------------- autosave ---------------- */

  useEffect(() => {
    if (!form || loading || !dirty) return;
    let alive = true;
    const t = setTimeout(async () => {
      setSaveState("saving");
      try {
        const res = await fetch("/api/forms", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!alive) return;
        if (!data.success) throw new Error(data.error);
        setSnapshot(JSON.stringify(data.form || form));
        setSaveState("saved");
        await new Promise((r) => setTimeout(r, 1400));
        if (alive) setSaveState("idle");
      } catch (err: unknown) {
        if (!alive) return;
        setSaveState("error");
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    }, 900);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [form, loading, dirty]);

  /* ---------------- responses ---------------- */

  const loadResponses = useCallback(async () => {
    setLoadingResponses(true);
    try {
      const res = await fetch(`/api/forms/responses?form_id=${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setResponses(data.responses || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load responses");
    } finally {
      setLoadingResponses(false);
    }
  }, [id]);

  useEffect(() => {
    if (tab !== "results") return;
    const t = setTimeout(loadResponses, 0);
    return () => clearTimeout(t);
  }, [tab, loadResponses]);

  /* ---------------- mutations ---------------- */

  const patchForm = useCallback((patch: Partial<FormRecord>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const patchSettings = useCallback((patch: Partial<FormSettings>) => {
    setForm((prev) => (prev ? { ...prev, settings: { ...(prev.settings || {}), ...patch } } : prev));
  }, []);

  const patchTheme = useCallback((patch: Partial<NonNullable<FormSettings["theme"]>>) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            settings: {
              ...(prev.settings || {}),
              theme: { ...defaultTheme(), ...(prev.settings?.theme || {}), ...patch },
            },
          }
        : prev
    );
  }, []);

  const patchThankYou = useCallback((patch: Partial<NonNullable<FormSettings["thank_you"]>>) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            settings: {
              ...(prev.settings || {}),
              thank_you: { ...(prev.settings?.thank_you || {}), ...patch },
            },
          }
        : prev
    );
  }, []);

  const patchResponses = useCallback((patch: Partial<FormSettings["responses"]>) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            settings: {
              ...(prev.settings || {}),
              responses: { ...defaultResponses(), ...(prev.settings?.responses || {}), ...patch },
            },
          }
        : prev
    );
  }, []);

  const patchPresentation = useCallback((patch: Partial<FormSettings["presentation"]>) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            settings: {
              ...(prev.settings || {}),
              presentation: {
                ...defaultPresentation(),
                ...(prev.settings?.presentation || {}),
                ...patch,
              },
            },
          }
        : prev
    );
  }, []);

  const patchQuiz = useCallback((patch: Partial<FormSettings["quiz"]>) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            settings: {
              ...(prev.settings || {}),
              quiz: { ...defaultQuiz(), ...(prev.settings?.quiz || {}), ...patch },
            },
          }
        : prev
    );
  }, []);

  const setConditions = useCallback((conditions: ConditionRule[]) => {
    patchSettings({ conditions });
  }, [patchSettings]);

  const setValidation = useCallback((validation: ValidationRule[]) => {
    patchSettings({ validation });
  }, [patchSettings]);

  const patchField = useCallback((fieldId: string, patch: Partial<FormField>) => {
    setForm((prev) =>
      prev
        ? { ...prev, fields: prev.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) }
        : prev
    );
  }, []);

  const addField = useCallback((type: FieldType) => {
    const field = newField(type);
    setForm((prev) => (prev ? { ...prev, fields: [...prev.fields, field] } : prev));
    setSel({ kind: "field", id: field.id });
    setTimeout(() => {
      document.getElementById(`jf-item-${field.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
  }, []);

  const removeField = useCallback((fieldId: string) => {
    setForm((prev) =>
      prev ? { ...prev, fields: prev.fields.filter((f) => f.id !== fieldId) } : prev
    );
    setSel((s) => (s?.id === fieldId ? null : s));
  }, []);

  const duplicateField = useCallback((fieldId: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const idx = prev.fields.findIndex((f) => f.id === fieldId);
      if (idx < 0) return prev;
      const copy: FormField = { ...prev.fields[idx], id: newField(prev.fields[idx].type).id };
      const fields = [...prev.fields];
      fields.splice(idx + 1, 0, copy);
      setSel({ kind: "field", id: copy.id });
      return { ...prev, fields };
    });
  }, []);

  const moveField = useCallback((fieldId: string, dir: -1 | 1) => {
    setForm((prev) => {
      if (!prev) return prev;
      const idx = prev.fields.findIndex((f) => f.id === fieldId);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= prev.fields.length) return prev;
      const fields = [...prev.fields];
      [fields[idx], fields[next]] = [fields[next], fields[idx]];
      return { ...prev, fields };
    });
  }, []);

  const reorderFields = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    setForm((prev) => {
      if (!prev) return prev;
      const from = prev.fields.findIndex((f) => f.id === fromId);
      const to = prev.fields.findIndex((f) => f.id === toId);
      if (from < 0 || to < 0) return prev;
      const fields = [...prev.fields];
      const [moved] = fields.splice(from, 1);
      fields.splice(to, 0, moved);
      return { ...prev, fields };
    });
  }, []);

  const changeType = useCallback((fieldId: string, type: FieldType) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        fields: prev.fields.map((f) => {
          if (f.id !== fieldId) return f;
          const next: FormField = { ...f, type };
          if (CHOICE_TYPES.includes(type)) {
            next.options = next.options?.length ? next.options : ["Option 1", "Option 2"];
          } else {
            delete next.options;
            delete next.images;
            delete next.branches;
          }
          if (type === "picture_choice") {
            next.images = next.options?.map(() => "") || [];
            if (!next.images.length) next.images = ["", ""];
          }
          if (type === "rating") next.max = next.max || 5;
          if (type === "statement") next.required = false;
          if (type === "section") next.required = false;
          if (type === "matrix" && (!next.rows?.length || !next.columns?.length)) {
            next.rows = next.rows?.length ? next.rows : ["Item 1", "Item 2"];
            next.columns = next.columns?.length
              ? next.columns
              : ["Strongly disagree", "Disagree", "Agree", "Strongly agree"];
          }
          if (type === "phone" && !next.phone_country) next.phone_country = "au";
          return next;
        }),
      };
    });
  }, []);

  const publish = useCallback(
    async (status: string) => {
      if (!form) return;
      setSaveState("saving");
      try {
        const res = await fetch("/api/forms", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: form.id, status }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setForm((prev) => (prev ? { ...prev, status } : prev));
        setSnapshot(JSON.stringify({ ...form, status }));
        setSaveState("saved");
        toast.success(status === "published" ? "Form is live" : "Saved as draft");
        setTimeout(() => setSaveState("idle"), 1400);

        const eventParam = new URLSearchParams(window.location.search).get("event");
        if (status === "published" && eventParam && eventParam !== "new") {
          const evRes = await fetch("/api/events", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: eventParam, form_id: form.id }),
          });
          const evData = await evRes.json();
          if (!evData.success) throw new Error(evData.error);
          toast.success("Form attached to the event");
          router.push(`/dashboard/events/${eventParam}`);
        }
      } catch (err: unknown) {
        setSaveState("error");
        toast.error(err instanceof Error ? err.message : "Could not update status");
      }
    },
    [form, router]
  );

  const copyLiveLink = useCallback(() => {
    if (!form) return;
    const url = `${window.location.origin}/f/${form.slug}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => toast.info(url));
  }, [form]);

  /* ---------------- render ---------------- */

  if (loading || !form) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <div className="spinner" />
      </div>
    );
  }

  const liveUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/f/${form.slug}`;
  const selectedField =
    sel?.kind === "field" ? form.fields.find((f) => f.id === sel.id) || null : null;
  const conditions = form.settings?.conditions || [];
  const validation = form.settings?.validation || [];
  const theme = { ...defaultTheme(), ...(form.settings?.theme || {}) };

  return (
    <div className="jf">
      {/* Top bar */}
      <div className="jf-bar ev-in">
        <button className="jf-back" onClick={() => router.push("/dashboard/register")} aria-label="Back to forms">
          <ArrowLeft size={16} />
        </button>
        <input
          className="jf-title-input"
          value={form.title}
          onChange={(e) => patchForm({ title: e.target.value })}
          placeholder="Untitled form"
          aria-label="Form title"
        />
        <span className={`jf-save sf-${saveState}`}>
          {saveState === "saving" && <SpinnerGap size={13} className="spin" />}
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && <Check size={13} />}
          {saveState === "saved" && "Saved"}
          {saveState === "error" && "Not saved"}
        </span>
        <div className="jf-bar-actions">
          <span className={`badge${form.status === "published" ? " badge--gold" : ""}`}>
            {form.status}
          </span>
          <button className="btn-secondary" onClick={() => setTab("preview")}>
            <Eye size={15} /> Preview
          </button>
          {form.status === "published" ? (
            <button className="btn-secondary" onClick={() => publish("draft")}>
              Unpublish
            </button>
          ) : (
            <button className="btn-primary" onClick={() => publish("published")}>
              Publish
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="jf-tabs ev-in" style={{ animationDelay: "60ms" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`jf-tab${tab === t.id ? " on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === "results" && responses.length > 0 && (
              <span className="jf-tab-count">{responses.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ---------------- BUILD ---------------- */}
      {tab === "build" && (
        <div className="jf-layout ev-in" style={{ animationDelay: "120ms" }}>
          {/* Palette */}
          <aside className="jf-palette">
            <div className="jf-palette-title">Add element</div>
            {FIELD_GROUPS.map((g) => (
              <div className="jf-palette-group" key={g.value}>
                <div className="jf-palette-label">{g.label}</div>
                {FIELD_META.filter((m) => m.group === g.value).map((m) => (
                  <button className="jf-palette-btn" key={m.value} onClick={() => addField(m.value)}>
                    <span className="jf-palette-icon">{m.icon}</span>
                    {m.rail}
                    <Plus size={13} className="jf-palette-plus" />
                  </button>
                ))}
              </div>
            ))}
          </aside>

          {/* Canvas */}
          <main className="jf-canvas" onClick={() => setSel(null)}>
            <div className="jf-sheet">
              <header
                className="jf-sheet-head"
                onClick={(e) => {
                  e.stopPropagation();
                  setSel(null);
                }}
              >
                {theme.logo_url && <img src={theme.logo_url} alt="" className="jf-sheet-logo" />}
                <div className="jf-sheet-eyebrow">Form</div>
                <h2 className="jf-sheet-title">{form.title || "Untitled form"}</h2>
                {form.description && <p className="jf-sheet-desc">{form.description}</p>}
                <p className="jf-sheet-hint">Click “Form” in the panel to edit this header</p>
              </header>

              {form.fields.length === 0 && (
                <div className="jf-canvas-empty">
                  <div className="jf-canvas-empty-art">✦</div>
                  <h3>Your form is empty</h3>
                  <p>Pick an element from the left to add your first question.</p>
                </div>
              )}

              {form.fields.map((f, i) => {
                const meta = metaFor(f.type);
                const on = sel?.id === f.id;
                return (
                  <div
                    key={f.id}
                    id={`jf-item-${f.id}`}
                    className={`jf-item${on ? " on" : ""}${overId === f.id && dragId && dragId !== f.id ? " over" : ""}`}
                    draggable
                    onClick={(e) => {
                      e.stopPropagation();
                      setSel({ kind: "field", id: f.id });
                    }}
                    onDragStart={(e) => {
                      setDragId(f.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", f.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOverId(f.id);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragId) reorderFields(dragId, f.id);
                      setDragId(null);
                      setOverId(null);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverId(null);
                    }}
                  >
                    <div className="jf-item-tools" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="jf-tool"
                        disabled={i === 0}
                        onClick={() => moveField(f.id, -1)}
                        aria-label="Move up"
                      >
                        <CaretUp size={13} />
                      </button>
                      <button
                        className="jf-tool"
                        disabled={i === form.fields.length - 1}
                        onClick={() => moveField(f.id, 1)}
                        aria-label="Move down"
                      >
                        <CaretDown size={13} />
                      </button>
                      <button
                        className="jf-tool"
                        onClick={() => duplicateField(f.id)}
                        aria-label="Duplicate"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        className="jf-tool danger"
                        onClick={() => removeField(f.id)}
                        aria-label="Delete"
                      >
                        <Trash size={13} />
                      </button>
                      <span className="jf-grip" aria-hidden="true">
                        ⠿
                      </span>
                    </div>

                    <div className="jf-item-head">
                      <span className="jf-item-num">{i + 1}</span>
                      <span className="jf-item-type">{meta.rail}</span>
                      {conditions.some((c) => c.targetId === f.id) && (
                        <span className="jf-item-cond">Conditional</span>
                      )}
                    </div>
                    {f.type !== "statement" && f.type !== "section" && (
                      <>
                        <div className="jf-item-label">
                          {f.title || meta.label}
                          {f.required && <span className="jf-req-star">*</span>}
                        </div>
                        {f.description && <div className="jf-item-desc">{f.description}</div>}
                      </>
                    )}
                    {f.type === "section" ? (
                      <div className="jf-item-section">
                        <span className="jf-item-section-tag">Section break</span>
                        <strong>{f.title || "Section"}</strong>
                        {f.description && <p>{f.description}</p>}
                      </div>
                    ) : (
                      <div className={`jf-item-preview jf-item-preview--${f.type}`}>
                        <FieldWidget
                          field={f}
                          value={f.default_value ?? ""}
                          onChange={() => {}}
                          variant="jff"
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="jf-sheet-foot">
                <div className="jf-sheet-submit">Submit</div>
                <span>Powered by Masjid As Sunnah</span>
              </div>
            </div>
          </main>

          {/* Properties */}
          <aside className="jf-props" onClick={(e) => e.stopPropagation()}>
            {selectedField ? (
              <>
                <div className="jf-props-head">
                  <span className="jf-props-eyebrow">Question settings</span>
                  <button
                    className="jf-props-x"
                    onClick={() => setSel(null)}
                    aria-label="Close panel"
                  >
                    <X size={14} />
                  </button>
                </div>

                <label className="jf-label">Type</label>
                <select
                  className="jf-select"
                  value={selectedField.type}
                  onChange={(e) => changeType(selectedField.id, e.target.value as FieldType)}
                >
                  {FIELD_META.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.rail}
                    </option>
                  ))}
                </select>

                <label className="jf-label">
                  {selectedField.type === "statement" ? "Text" : "Question label"}
                </label>
                <textarea
                  className="jf-textarea"
                  rows={2}
                  value={selectedField.title}
                  onChange={(e) => patchField(selectedField.id, { title: e.target.value })}
                  placeholder="e.g. Full name"
                />

                <label className="jf-label">Description <span>optional</span></label>
                <input
                  className="jf-input"
                  value={selectedField.description || ""}
                  onChange={(e) => patchField(selectedField.id, { description: e.target.value })}
                  placeholder="Help text shown under the label"
                />

                {["short_text", "long_text", "email", "number", "phone", "url", "dropdown"].includes(
                  selectedField.type
                ) && (
                  <>
                    <label className="jf-label">Placeholder</label>
                    <input
                      className="jf-input"
                      value={selectedField.placeholder || ""}
                      onChange={(e) => patchField(selectedField.id, { placeholder: e.target.value })}
                      placeholder="Type your answer…"
                    />
                  </>
                )}

                {["short_text", "long_text", "email", "number", "url", "date", "time"].includes(
                  selectedField.type
                ) && (
                  <>
                    <label className="jf-label">Default value</label>
                    <input
                      className="jf-input"
                      value={selectedField.default_value || ""}
                      onChange={(e) => patchField(selectedField.id, { default_value: e.target.value })}
                      placeholder="Pre-filled answer"
                    />
                  </>
                )}

                {CHOICE_TYPES.includes(selectedField.type) && (
                  <>
                    <label className="jf-label">
                      Options <span>{selectedField.options?.length || 0}</span>
                    </label>
                    <div className="jf-opts">
                      {(selectedField.options || []).map((opt, oi) => (
                        <div className="jf-opt-col" key={oi}>
                          <div className="jf-opt-row">
                            <span className="jf-opt-key">{String.fromCharCode(97 + oi)}</span>
                            <input
                              className="jf-input"
                              value={opt}
                              onChange={(e) => {
                                const options = [...(selectedField.options || [])];
                                options[oi] = e.target.value;
                                patchField(selectedField.id, { options });
                              }}
                            />
                            <button
                              className="jf-tool danger"
                              onClick={() => {
                                const options = [...(selectedField.options || [])];
                                options.splice(oi, 1);
                                const images = [...(selectedField.images || [])];
                                if (images.length) {
                                  images.splice(oi, 1);
                                  patchField(selectedField.id, { options, images });
                                } else {
                                  patchField(selectedField.id, { options });
                                }
                              }}
                              aria-label="Remove option"
                            >
                              <X size={13} />
                            </button>
                          </div>
                          {selectedField.type === "picture_choice" && (
                            <input
                              className="jf-input jf-opt-img"
                              value={selectedField.images?.[oi] || ""}
                              placeholder="Image URL for this option"
                              onChange={(e) => {
                                const images = (selectedField.options || []).map(
                                  (_, k) => selectedField.images?.[k] || ""
                                );
                                images[oi] = e.target.value;
                                patchField(selectedField.id, { images });
                              }}
                            />
                          )}
                        </div>
                      ))}
                      <button
                        className="jf-opt-add"
                        onClick={() => {
                          const options = [
                            ...(selectedField.options || []),
                            `Option ${(selectedField.options?.length || 0) + 1}`,
                          ];
                          if (selectedField.type === "picture_choice") {
                            patchField(selectedField.id, {
                              options,
                              images: options.map((_, k) => selectedField.images?.[k] || ""),
                            });
                          } else {
                            patchField(selectedField.id, { options });
                          }
                        }}
                      >
                        <Plus size={13} /> Add option
                      </button>
                    </div>

                    {["multiple_choice", "checkboxes", "dropdown"].includes(selectedField.type) && (
                      <label className="jf-switch">
                        <input
                          type="checkbox"
                          checked={!!selectedField.allow_other}
                          onChange={(e) =>
                            patchField(selectedField.id, { allow_other: e.target.checked })
                          }
                        />
                        <span className="jf-switch-track" />
                        Allow “Other” option
                      </label>
                    )}

                    {["multiple_choice", "checkboxes", "dropdown", "picture_choice"].includes(
                      selectedField.type
                    ) && (
                      <label className="jf-switch">
                        <input
                          type="checkbox"
                          checked={!!selectedField.shuffle_options}
                          onChange={(e) =>
                            patchField(selectedField.id, { shuffle_options: e.target.checked })
                          }
                        />
                        <span className="jf-switch-track" />
                        Shuffle these options
                      </label>
                    )}
                  </>
                )}

                {selectedField.type === "rating" && (
                  <>
                    <label className="jf-label">Shape</label>
                    <select
                      className="jf-select"
                      value={selectedField.rating_shape || "star"}
                      onChange={(e) =>
                        patchField(selectedField.id, {
                          rating_shape: e.target.value as "star" | "heart" | "thumb",
                        })
                      }
                    >
                      <option value="star">Stars</option>
                      <option value="heart">Hearts</option>
                      <option value="thumb">Thumbs up</option>
                    </select>
                    <label className="jf-label">Scale</label>
                    <select
                      className="jf-select"
                      value={selectedField.max || 5}
                      onChange={(e) => patchField(selectedField.id, { max: Number(e.target.value) })}
                    >
                      <option value={3}>3 points</option>
                      <option value={5}>5 points</option>
                      <option value={7}>7 points</option>
                      <option value={10}>10 points</option>
                    </select>
                  </>
                )}

                {(selectedField.type === "opinion_scale" || selectedField.type === "nps") && (
                  <>
                    <div className="jf-two">
                      <div>
                        <label className="jf-label">Min</label>
                        <input
                          className="jf-input"
                          type="number"
                          value={selectedField.scale_min ?? 0}
                          onChange={(e) =>
                            patchField(selectedField.id, { scale_min: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div>
                        <label className="jf-label">Max</label>
                        <input
                          className="jf-input"
                          type="number"
                          value={selectedField.scale_max ?? 10}
                          onChange={(e) =>
                            patchField(selectedField.id, { scale_max: Number(e.target.value) })
                          }
                        />
                      </div>
                    </div>
                    <label className="jf-label">Label at low end</label>
                    <input
                      className="jf-input"
                      value={selectedField.scale_label_low || ""}
                      onChange={(e) =>
                        patchField(selectedField.id, { scale_label_low: e.target.value })
                      }
                      placeholder="Not likely"
                    />
                    <label className="jf-label">Label at centre <span>optional</span></label>
                    <input
                      className="jf-input"
                      value={selectedField.scale_label_center || ""}
                      onChange={(e) =>
                        patchField(selectedField.id, { scale_label_center: e.target.value })
                      }
                      placeholder="Neutral"
                    />
                    <label className="jf-label">Label at high end</label>
                    <input
                      className="jf-input"
                      value={selectedField.scale_label_high || ""}
                      onChange={(e) =>
                        patchField(selectedField.id, { scale_label_high: e.target.value })
                      }
                      placeholder="Very likely"
                    />
                  </>
                )}

                {selectedField.type === "matrix" && (
                  <>
                    <label className="jf-label">
                      Rows <span>{selectedField.rows?.length || 0}</span>
                    </label>
                    <div className="jf-opts">
                      {(selectedField.rows || []).map((r, i) => (
                        <div className="jf-opt-row" key={i}>
                          <span className="jf-opt-key">{i + 1}</span>
                          <input
                            className="jf-input"
                            value={r}
                            onChange={(e) => {
                              const rows = [...(selectedField.rows || [])];
                              rows[i] = e.target.value;
                              patchField(selectedField.id, { rows });
                            }}
                          />
                          <button
                            className="jf-tool danger"
                            onClick={() => {
                              const rows = [...(selectedField.rows || [])];
                              rows.splice(i, 1);
                              patchField(selectedField.id, { rows });
                            }}
                            aria-label="Remove row"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                      <button
                        className="jf-opt-add"
                        onClick={() =>
                          patchField(selectedField.id, {
                            rows: [
                              ...(selectedField.rows || []),
                              `Row ${(selectedField.rows?.length || 0) + 1}`,
                            ],
                          })
                        }
                      >
                        <Plus size={13} /> Add row
                      </button>
                    </div>

                    <label className="jf-label">
                      Columns <span>{selectedField.columns?.length || 0}</span>
                    </label>
                    <div className="jf-opts">
                      {(selectedField.columns || []).map((r, i) => (
                        <div className="jf-opt-row" key={i}>
                          <span className="jf-opt-key">{i + 1}</span>
                          <input
                            className="jf-input"
                            value={r}
                            onChange={(e) => {
                              const columns = [...(selectedField.columns || [])];
                              columns[i] = e.target.value;
                              patchField(selectedField.id, { columns });
                            }}
                          />
                          <button
                            className="jf-tool danger"
                            onClick={() => {
                              const columns = [...(selectedField.columns || [])];
                              columns.splice(i, 1);
                              patchField(selectedField.id, { columns });
                            }}
                            aria-label="Remove column"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                      <button
                        className="jf-opt-add"
                        onClick={() =>
                          patchField(selectedField.id, {
                            columns: [
                              ...(selectedField.columns || []),
                              `Column ${(selectedField.columns?.length || 0) + 1}`,
                            ],
                          })
                        }
                      >
                        <Plus size={13} /> Add column
                      </button>
                    </div>

                    <label className="jf-switch">
                      <input
                        type="checkbox"
                        checked={!!selectedField.matrix_multi}
                        onChange={(e) =>
                          patchField(selectedField.id, { matrix_multi: e.target.checked })
                        }
                      />
                      <span className="jf-switch-track" />
                      Multiple answers per row
                    </label>
                    <label className="jf-switch">
                      <input
                        type="checkbox"
                        checked={!!selectedField.limit_one_per_column}
                        onChange={(e) =>
                          patchField(selectedField.id, { limit_one_per_column: e.target.checked })
                        }
                      />
                      <span className="jf-switch-track" />
                      Only one choice per column
                    </label>
                  </>
                )}

                {selectedField.type === "date" && (
                  <label className="jf-switch">
                    <input
                      type="checkbox"
                      checked={!!selectedField.include_time}
                      onChange={(e) =>
                        patchField(selectedField.id, { include_time: e.target.checked })
                      }
                    />
                    <span className="jf-switch-track" />
                    Include time of day
                  </label>
                )}

                {selectedField.type === "time" && (
                  <>
                    <label className="jf-label">Time type</label>
                    <select
                      className="jf-select"
                      value={selectedField.time_kind || "time"}
                      onChange={(e) =>
                        patchField(selectedField.id, {
                          time_kind: e.target.value as "time" | "duration",
                        })
                      }
                    >
                      <option value="time">Pick a time</option>
                      <option value="duration">Duration (hours + minutes)</option>
                    </select>
                  </>
                )}

                {selectedField.type === "full_name" && (
                  <>
                    <label className="jf-label">Name parts</label>
                    <div className="jf-chips">
                      {["first", "last", "middle", "prefix", "suffix"].map((part) => {
                        const cur = selectedField.name_fields?.length
                          ? selectedField.name_fields
                          : ["first", "last"];
                        const on = cur.includes(part);
                        return (
                          <ChipToggle
                            key={part}
                            on={on}
                            onClick={() => {
                              const next = on ? cur.filter((x) => x !== part) : [...cur, part];
                              patchField(selectedField.id, {
                                name_fields: next.length ? next : ["first"],
                              });
                            }}
                          >
                            {part[0].toUpperCase() + part.slice(1)}
                          </ChipToggle>
                        );
                      })}
                    </div>
                  </>
                )}

                {selectedField.type === "address" && (
                  <>
                    <label className="jf-label">Address fields</label>
                    <div className="jf-chips">
                      {["street", "city", "state", "postcode", "country"].map((part) => {
                        const cur = selectedField.address_fields?.length
                          ? selectedField.address_fields
                          : ["street", "city", "state", "postcode", "country"];
                        const on = cur.includes(part);
                        return (
                          <ChipToggle
                            key={part}
                            on={on}
                            onClick={() => {
                              const next = on ? cur.filter((x) => x !== part) : [...cur, part];
                              patchField(selectedField.id, {
                                address_fields: next.length ? next : ["street"],
                              });
                            }}
                          >
                            {part[0].toUpperCase() + part.slice(1)}
                          </ChipToggle>
                        );
                      })}
                    </div>
                  </>
                )}

                {selectedField.type === "phone" && (
                  <>
                    <label className="jf-label">Default country</label>
                    <select
                      className="jf-select"
                      value={(selectedField.phone_country || "au").toUpperCase()}
                      onChange={(e) =>
                        patchField(selectedField.id, { phone_country: e.target.value })
                      }
                    >
                      {countryRows().map((r) => (
                        <option key={r.iso} value={r.iso}>
                          {r.name} ({r.dial})
                        </option>
                      ))}
                    </select>
                    <label className="jf-switch">
                      <input
                        type="checkbox"
                        checked={selectedField.allow_country_change !== false}
                        onChange={(e) =>
                          patchField(selectedField.id, { allow_country_change: e.target.checked })
                        }
                      />
                      <span className="jf-switch-track" />
                      Let people change the country
                    </label>
                  </>
                )}

                {selectedField.type === "file_upload" && (
                  <>
                    <label className="jf-label">Accepted file types</label>
                    <input
                      className="jf-input"
                      value={selectedField.file_accept || ""}
                      onChange={(e) => patchField(selectedField.id, { file_accept: e.target.value })}
                      placeholder="image/*, .pdf (blank = any)"
                    />
                    <div className="jf-two">
                      <div>
                        <label className="jf-label">Max size (MB)</label>
                        <input
                          className="jf-input"
                          type="number"
                          min={1}
                          value={selectedField.max_file_mb ?? 10}
                          onChange={(e) =>
                            patchField(selectedField.id, {
                              max_file_mb: Math.max(1, Number(e.target.value) || 10),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="jf-label">Max files</label>
                        <input
                          className="jf-input"
                          type="number"
                          min={1}
                          value={selectedField.max_files ?? 1}
                          onChange={(e) =>
                            patchField(selectedField.id, {
                              max_files: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                      </div>
                    </div>
                  </>
                )}

                {selectedField.type === "legal" && (
                  <>
                    <label className="jf-label">Link text</label>
                    <input
                      className="jf-input"
                      value={selectedField.link_text || ""}
                      onChange={(e) =>
                        patchField(selectedField.id, { link_text: e.target.value })
                      }
                      placeholder="the terms"
                    />
                    <label className="jf-label">Link URL</label>
                    <input
                      className="jf-input"
                      value={selectedField.link || ""}
                      onChange={(e) => patchField(selectedField.id, { link: e.target.value })}
                      placeholder="https://…/terms"
                    />
                  </>
                )}

                {selectedField.type === "image" && (
                  <ImageUploader
                    label="Image"
                    hint="PNG, JPG or SVG"
                    value={selectedField.image || ""}
                    onChange={(url) => patchField(selectedField.id, { image: url })}
                  />
                )}

                {selectedField.type === "video" && (
                  <>
                    <label className="jf-label">Video URL</label>
                    <input
                      className="jf-input"
                      value={selectedField.video || ""}
                      onChange={(e) => patchField(selectedField.id, { video: e.target.value })}
                      placeholder="https://youtube.com/watch?v=… or .mp4"
                    />
                    <p className="jf-setnote">
                      YouTube links are embedded automatically. Direct video files (mp4/webm) play
                      inline.
                    </p>
                  </>
                )}

                {form.settings?.quiz?.enabled && QUIZ_ANSWER_TYPES.includes(selectedField.type) && (
                  <>
                    <div className="jf-setdivider" />
                    <label className="jf-label">
                      Correct answer <span>quiz</span>
                    </label>
                    {["multiple_choice", "dropdown", "picture_choice"].includes(
                      selectedField.type
                    ) && (
                      <select
                        className="jf-select"
                        value={
                          typeof selectedField.correct_value === "string"
                            ? selectedField.correct_value
                            : ""
                        }
                        onChange={(e) =>
                          patchField(selectedField.id, { correct_value: e.target.value || undefined })
                        }
                      >
                        <option value="">Not set</option>
                        {(selectedField.options || []).map((o, i) => (
                          <option key={o + i} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    )}
                    {selectedField.type === "yes_no" && (
                      <select
                        className="jf-select"
                        value={
                          typeof selectedField.correct_value === "string"
                            ? selectedField.correct_value
                            : ""
                        }
                        onChange={(e) =>
                          patchField(selectedField.id, { correct_value: e.target.value || undefined })
                        }
                      >
                        <option value="">Not set</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    )}
                    {selectedField.type === "checkboxes" && (
                      <div className="jf-chips">
                        {(selectedField.options || []).map((o) => {
                          const cur = Array.isArray(selectedField.correct_value)
                            ? selectedField.correct_value
                            : [];
                          const on = cur.includes(o);
                          return (
                            <ChipToggle
                              key={o}
                              on={on}
                              onClick={() => {
                                const next = on
                                  ? cur.filter((x) => x !== o)
                                  : [...cur, o];
                                patchField(selectedField.id, {
                                  correct_value: next.length ? next : undefined,
                                });
                              }}
                            >
                              {o}
                            </ChipToggle>
                          );
                        })}
                      </div>
                    )}
                    {["short_text", "long_text", "email", "url"].includes(selectedField.type) && (
                      <input
                        className="jf-input"
                        value={
                          typeof selectedField.correct_value === "string"
                            ? selectedField.correct_value
                            : ""
                        }
                        onChange={(e) =>
                          patchField(selectedField.id, {
                            correct_value: e.target.value || undefined,
                          })
                        }
                        placeholder="Expected answer"
                      />
                    )}
                    {["number", "rating", "opinion_scale", "nps"].includes(selectedField.type) && (
                      <input
                        className="jf-input"
                        type="number"
                        value={
                          selectedField.correct_value !== undefined &&
                          selectedField.correct_value !== null &&
                          selectedField.correct_value !== ""
                            ? String(selectedField.correct_value)
                            : ""
                        }
                        onChange={(e) =>
                          patchField(selectedField.id, {
                            correct_value: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                        placeholder="Expected value"
                      />
                    )}
                    <label className="jf-label">Points</label>
                    <input
                      className="jf-input"
                      type="number"
                      min={1}
                      value={selectedField.points ?? 1}
                      onChange={(e) =>
                        patchField(selectedField.id, {
                          points: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </>
                )}

                {selectedField.type !== "statement" && (
                  <label className="jf-switch">
                    <input
                      type="checkbox"
                      checked={!!selectedField.required}
                      onChange={(e) => patchField(selectedField.id, { required: e.target.checked })}
                    />
                    <span className="jf-switch-track" />
                    Required
                  </label>
                )}

                <div className="jf-props-foot">
                  <button className="btn-secondary" onClick={() => duplicateField(selectedField.id)}>
                    <Copy size={14} /> Duplicate
                  </button>
                  <button
                    className="btn-secondary jf-danger-btn"
                    onClick={() => removeField(selectedField.id)}
                  >
                    <Trash size={14} /> Delete
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="jf-props-head">
                  <span className="jf-props-eyebrow">Form</span>
                </div>

                <label className="jf-label">Title</label>
                <input
                  className="jf-input"
                  value={form.title}
                  onChange={(e) => patchForm({ title: e.target.value })}
                  placeholder="Form title"
                />

                <label className="jf-label">Description</label>
                <textarea
                  className="jf-textarea"
                  rows={3}
                  value={form.description || ""}
                  onChange={(e) => patchForm({ description: e.target.value })}
                  placeholder="Shown at the top of the form"
                />

                <div className="jf-props-block">
                  <div className="jf-props-block-row">
                    <span>Display</span>
                    <strong>
                      {form.settings?.display === "one_at_a_time"
                        ? "One question at a time"
                        : "Classic form"}
                    </strong>
                  </div>
                  <div className="jf-props-block-row">
                    <span>Conditions</span>
                    <strong>{conditions.length}</strong>
                  </div>
                  <div className="jf-props-block-row">
                    <span>Rejection rules</span>
                    <strong>{validation.length}</strong>
                  </div>
                  <div className="jf-props-block-row">
                    <span>Questions</span>
                    <strong>{form.fields.length}</strong>
                  </div>
                </div>

                <button
                  className="btn-secondary jf-full"
                  onClick={() => {
                    setTab("settings");
                    setSettingsSection("appearance");
                  }}
                >
                  <PaintBrush size={14} /> Change appearance
                </button>
                <button
                  className="btn-secondary jf-full"
                  onClick={() => {
                    setTab("settings");
                    setSettingsSection("conditions");
                  }}
                >
                  <FlowArrow size={14} /> Edit conditions
                </button>

                <p className="jf-props-hint">Select a question on the canvas to edit it here.</p>
              </>
            )}
          </aside>
        </div>
      )}

      {/* ---------------- PREVIEW ---------------- */}
      {tab === "preview" && (
        <div className="jf-preview ev-in" style={{ animationDelay: "120ms" }}>
          <div className="jf-preview-bar">
            <div className="jf-devices">
              <button
                className={`jf-device${device === "desktop" ? " on" : ""}`}
                onClick={() => setDevice("desktop")}
              >
                Desktop
              </button>
              <button
                className={`jf-device${device === "mobile" ? " on" : ""}`}
                onClick={() => setDevice("mobile")}
              >
                Mobile
              </button>
            </div>
            <a
              className="btn-secondary"
              href={`/f/${form.slug}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Eye size={15} /> Open in new tab
            </a>
          </div>
          <div className={`jf-preview-stage${device === "mobile" ? " is-mobile" : ""}`}>
            <div className="jf-preview-frame">
              <FormRenderer form={form} preview />
            </div>
          </div>
        </div>
      )}

      {/* ---------------- SETTINGS ---------------- */}
      {tab === "settings" && (
        <div className="jf-settings ev-in" style={{ animationDelay: "120ms" }}>
          <nav className="jf-setnav">
            {SETTINGS_SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`jf-setnav-btn${settingsSection === s.id ? " on" : ""}`}
                onClick={() => setSettingsSection(s.id)}
              >
                {s.icon}
                {s.label}
                {s.id === "conditions" && conditions.length > 0 && (
                  <span className="jf-tab-count">{conditions.length}</span>
                )}
                {s.id === "validation" && validation.length > 0 && (
                  <span className="jf-tab-count">{validation.length}</span>
                )}
              </button>
            ))}
          </nav>

          <section className="jf-setpanel">
            {settingsSection === "form" && (
              <div className="jf-setbody">
                <h3 className="jf-settitle">Form settings</h3>

                <label className="jf-label">Title</label>
                <input
                  className="jf-input"
                  value={form.title}
                  onChange={(e) => patchForm({ title: e.target.value })}
                />

                <label className="jf-label">Description</label>
                <textarea
                  className="jf-textarea"
                  rows={3}
                  value={form.description || ""}
                  onChange={(e) => patchForm({ description: e.target.value })}
                  placeholder="Intro paragraph shown above the questions"
                />

                <div className="jf-setdivider" />
                <h4 className="jf-setsubtitle">Welcome screen</h4>
                <p className="jf-setnote">Used in “One question at a time” mode.</p>

                <label className="jf-switch">
                  <input
                    type="checkbox"
                    checked={form.settings?.welcome_enabled !== false}
                    onChange={(e) => patchSettings({ welcome_enabled: e.target.checked })}
                  />
                  <span className="jf-switch-track" />
                  Show a welcome screen
                </label>

                <label className="jf-label">Welcome title</label>
                <input
                  className="jf-input"
                  value={form.settings?.welcome_title || ""}
                  onChange={(e) => patchSettings({ welcome_title: e.target.value })}
                />

                <label className="jf-label">Welcome message</label>
                <textarea
                  className="jf-textarea"
                  rows={2}
                  value={form.settings?.welcome_description || ""}
                  onChange={(e) => patchSettings({ welcome_description: e.target.value })}
                />

                <label className="jf-label">Start button text</label>
                <input
                  className="jf-input"
                  value={form.settings?.welcome_button || ""}
                  onChange={(e) => patchSettings({ welcome_button: e.target.value })}
                />
              </div>
            )}

            {settingsSection === "appearance" && (
              <div className="jf-setbody">
                <h3 className="jf-settitle">Appearance</h3>

                <label className="jf-label">Display mode</label>
                <div className="jf-modes">
                  <button
                    className={`jf-mode${form.settings?.display !== "one_at_a_time" ? " on" : ""}`}
                    onClick={() => patchSettings({ display: "classic" })}
                  >
                    <span className="jf-mode-art jf-mode-art--classic">
                      <i />
                      <i />
                      <i />
                    </span>
                    <strong>Classic form</strong>
                    <span>All questions on one scrolling page with a Submit button.</span>
                  </button>
                  <button
                    className={`jf-mode${form.settings?.display === "one_at_a_time" ? " on" : ""}`}
                    onClick={() => patchSettings({ display: "one_at_a_time" })}
                  >
                    <span className="jf-mode-art jf-mode-art--oaat">
                      <i />
                    </span>
                    <strong>One question at a time</strong>
                    <span>Full-screen questions, one per step — like Typeform.</span>
                  </button>
                </div>

                <div className="jf-setdivider" />
                <h4 className="jf-setsubtitle">Theme</h4>

                <div className="jf-colors">
                  <label className="jf-color">
                    <span>Background</span>
                    <span className="jf-color-input">
                      <input
                        type="color"
                        value={theme.bg || "#f4f6f4"}
                        onChange={(e) => patchTheme({ bg: e.target.value })}
                      />
                      <input
                        className="jf-input"
                        value={theme.bg || ""}
                        onChange={(e) => patchTheme({ bg: e.target.value })}
                      />
                    </span>
                  </label>
                  <label className="jf-color">
                    <span>Primary / buttons</span>
                    <span className="jf-color-input">
                      <input
                        type="color"
                        value={theme.primary || "#026839"}
                        onChange={(e) => patchTheme({ primary: e.target.value })}
                      />
                      <input
                        className="jf-input"
                        value={theme.primary || ""}
                        onChange={(e) => patchTheme({ primary: e.target.value })}
                      />
                    </span>
                  </label>
                  <label className="jf-color">
                    <span>Text</span>
                    <span className="jf-color-input">
                      <input
                        type="color"
                        value={theme.text || "#14201a"}
                        onChange={(e) => patchTheme({ text: e.target.value })}
                      />
                      <input
                        className="jf-input"
                        value={theme.text || ""}
                        onChange={(e) => patchTheme({ text: e.target.value })}
                      />
                    </span>
                  </label>
                </div>

                <label className="jf-label">Font</label>
                <select
                  className="jf-select"
                  value={theme.font || "system"}
                  onChange={(e) => patchTheme({ font: e.target.value })}
                >
                  {THEME_FONTS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>

                <ImageUploader
                  label="Logo"
                  hint="PNG or SVG — shown at the top of the form"
                  value={theme.logo_url || ""}
                  onChange={(url) => patchTheme({ logo_url: url })}
                />

                <div className="jf-setdivider" />
                <h4 className="jf-setsubtitle">Background image</h4>
                <p className="jf-setnote">
                  Optional cover image behind the form. A subtle dark overlay keeps text readable.
                </p>
                <ImageUploader
                  label="Background"
                  hint="A wide image works best"
                  value={theme.background_image || ""}
                  onChange={(url) => patchTheme({ background_image: url })}
                />
              </div>
            )}

            {settingsSection === "thankyou" && (
              <div className="jf-setbody">
                <h3 className="jf-settitle">Thank You page</h3>
                <p className="jf-setnote">
                  Shown after someone submits. Add a redirect URL to send them somewhere else
                  instead.
                </p>

                <label className="jf-label">Heading</label>
                <input
                  className="jf-input"
                  value={form.settings?.thank_you?.title || ""}
                  onChange={(e) => patchThankYou({ title: e.target.value })}
                  placeholder="Thank You!"
                />

                <label className="jf-label">Message</label>
                <textarea
                  className="jf-textarea"
                  rows={3}
                  value={form.settings?.thank_you?.message || ""}
                  onChange={(e) => patchThankYou({ message: e.target.value })}
                  placeholder="Your response has been recorded."
                />

                <label className="jf-label">Redirect URL <span>optional</span></label>
                <input
                  className="jf-input"
                  value={form.settings?.thank_you?.redirect_url || ""}
                  onChange={(e) => patchThankYou({ redirect_url: e.target.value })}
                  placeholder="https://masjidas-sunnah.org/thanks"
                />

                <div className="jf-thanks-preview">
                  <span className="jf-thanks-preview-icon">
                    <Check size={18} weight="bold" />
                  </span>
                  <div>
                    <strong>{form.settings?.thank_you?.title || "Thank You!"}</strong>
                    <p>{form.settings?.thank_you?.message || "Your response has been recorded."}</p>
                  </div>
                </div>
              </div>
            )}

            {settingsSection === "responses" && (
              <div className="jf-setbody">
                <h3 className="jf-settitle">Response collection</h3>

                <label className="jf-switch">
                  <input
                    type="checkbox"
                    checked={form.settings?.responses?.accept !== false}
                    onChange={(e) => patchResponses({ accept: e.target.checked })}
                  />
                  <span className="jf-switch-track" />
                  Accept responses
                </label>

                {form.settings?.responses?.accept === false && (
                  <>
                    <label className="jf-label">Closed message</label>
                    <textarea
                      className="jf-textarea"
                      rows={2}
                      value={form.settings?.responses?.closed_message || ""}
                      onChange={(e) => patchResponses({ closed_message: e.target.value })}
                      placeholder="This form is no longer accepting responses."
                    />
                  </>
                )}

                <div className="jf-two">
                  <div>
                    <label className="jf-label">Open from</label>
                    <input
                      className="jf-input"
                      type="datetime-local"
                      value={form.settings?.responses?.start_at || ""}
                      onChange={(e) => patchResponses({ start_at: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="jf-label">Close at</label>
                    <input
                      className="jf-input"
                      type="datetime-local"
                      value={form.settings?.responses?.end_at || ""}
                      onChange={(e) => patchResponses({ end_at: e.target.value })}
                    />
                  </div>
                </div>
                <p className="jf-setnote">
                  Leave blank for no limit. Responses are rejected outside this window.
                </p>

                <label className="jf-label">Max responses <span>0 = unlimited</span></label>
                <input
                  className="jf-input"
                  type="number"
                  min={0}
                  value={form.settings?.responses?.max_responses ?? 0}
                  onChange={(e) =>
                    patchResponses({ max_responses: Math.max(0, Number(e.target.value) || 0) })
                  }
                />

                <label className="jf-switch">
                  <input
                    type="checkbox"
                    checked={!!form.settings?.responses?.duplicate_per_browser}
                    onChange={(e) => patchResponses({ duplicate_per_browser: e.target.checked })}
                  />
                  <span className="jf-switch-track" />
                  One response per browser
                </label>

                <div className="jf-setdivider" />
                <h4 className="jf-setsubtitle">Form filling</h4>

                <label className="jf-switch">
                  <input
                    type="checkbox"
                    checked={!!form.settings?.presentation?.shuffle_questions}
                    onChange={(e) => patchPresentation({ shuffle_questions: e.target.checked })}
                  />
                  <span className="jf-switch-track" />
                  Shuffle questions
                </label>

                <label className="jf-switch">
                  <input
                    type="checkbox"
                    checked={form.settings?.presentation?.progress_bar !== false}
                    onChange={(e) => patchPresentation({ progress_bar: e.target.checked })}
                  />
                  <span className="jf-switch-track" />
                  Show progress bar
                </label>

                <label className="jf-switch">
                  <input
                    type="checkbox"
                    checked={form.settings?.presentation?.question_numbers !== false}
                    onChange={(e) => patchPresentation({ question_numbers: e.target.checked })}
                  />
                  <span className="jf-switch-track" />
                  Show question numbers
                </label>

                <label className="jf-label">
                  Time limit (minutes) <span>0 = off</span>
                </label>
                <input
                  className="jf-input"
                  type="number"
                  min={0}
                  value={form.settings?.presentation?.timer_minutes ?? 0}
                  onChange={(e) =>
                    patchPresentation({ timer_minutes: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
                <p className="jf-setnote">
                  When time runs out the form auto-submits with whatever has been answered.
                </p>

                <div className="jf-setdivider" />
                <h4 className="jf-setsubtitle">Hidden URL fields</h4>
                <label className="jf-label">Parameter names</label>
                <input
                  className="jf-input"
                  value={(form.settings?.hidden_fields || []).join(", ")}
                  onChange={(e) =>
                    patchSettings({
                      hidden_fields: e.target.value
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="campaign, member_id"
                />
                <p className="jf-setnote">
                  Collected from the link, e.g. <code>?campaign=ramadan</code>. Answers show up in
                  results as <code>hidden:campaign</code>.
                </p>
              </div>
            )}

            {settingsSection === "quiz" && (
              <div className="jf-setbody">
                <h3 className="jf-settitle">Quiz mode</h3>
                <p className="jf-setnote">
                  Turn this form into a scored quiz — like Microsoft Forms or Google Forms quizzes.
                </p>

                <label className="jf-switch">
                  <input
                    type="checkbox"
                    checked={!!form.settings?.quiz?.enabled}
                    onChange={(e) => patchQuiz({ enabled: e.target.checked })}
                  />
                  <span className="jf-switch-track" />
                  This is a quiz
                </label>

                {form.settings?.quiz?.enabled && (
                  <>
                    <label className="jf-switch">
                      <input
                        type="checkbox"
                        checked={form.settings?.quiz?.show_score !== false}
                        onChange={(e) => patchQuiz({ show_score: e.target.checked })}
                      />
                      <span className="jf-switch-track" />
                      Show score after submitting
                    </label>

                    <label className="jf-switch">
                      <input
                        type="checkbox"
                        checked={form.settings?.quiz?.show_answers !== false}
                        onChange={(e) => patchQuiz({ show_answers: e.target.checked })}
                      />
                      <span className="jf-switch-track" />
                      Show correct answers with the score
                    </label>

                    <label className="jf-label">
                      Pass mark <span>points — 0 = no pass mark</span>
                    </label>
                    <input
                      className="jf-input"
                      type="number"
                      min={0}
                      value={form.settings?.quiz?.pass_mark ?? 0}
                      onChange={(e) =>
                        patchQuiz({ pass_mark: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />

                    <div className="jf-props-block">
                      <div className="jf-props-block-row">
                        <span>Questions with a correct answer</span>
                        <strong>
                          {
                            form.fields.filter(
                              (f) =>
                                f.correct_value !== undefined &&
                                f.correct_value !== null &&
                                f.correct_value !== ""
                            ).length
                          }
                          {" / "}
                          {form.fields.filter((f) => f.type !== "section" && f.type !== "statement" && f.type !== "divider" && f.type !== "image" && f.type !== "video").length}
                        </strong>
                      </div>
                    </div>

                    <p className="jf-setnote">
                      Set the correct answer and points on each question in the Build tab — the
                      “Correct answer” section appears at the bottom of a question’s settings.
                    </p>
                  </>
                )}
              </div>
            )}

            {settingsSection === "conditions" && (
              <div className="jf-setbody">
                <h3 className="jf-settitle">Conditional logic</h3>
                <p className="jf-setnote">
                  Show or hide questions based on earlier answers. A question with a “Show”
                  condition stays hidden until the rule matches.
                </p>

                {conditions.length === 0 && (
                  <div className="jf-conditions-empty">
                    <FlowArrow size={22} />
                    <strong>No conditions yet</strong>
                    <p>Every question is always visible. Add a rule to change that.</p>
                  </div>
                )}

                <div className="jf-conditions">
                  {conditions.map((c, ci) => {
                    const needsValue = !NO_VALUE_OPS.includes(c.op);
                    return (
                      <div className="jf-cond" key={c.id}>
                        <span className="jf-cond-if">IF</span>
                        <select
                          className="jf-select"
                          value={c.fieldId}
                          onChange={(e) => {
                            const next = [...conditions];
                            next[ci] = { ...c, fieldId: e.target.value };
                            setConditions(next);
                          }}
                        >
                          <option value="">Choose a question…</option>
                          {form.fields.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.title || metaFor(f.type).label}
                            </option>
                          ))}
                        </select>

                        <select
                          className="jf-select"
                          value={c.op}
                          onChange={(e) => {
                            const next = [...conditions];
                            next[ci] = { ...c, op: e.target.value as ConditionRule["op"] };
                            setConditions(next);
                          }}
                        >
                          {CONDITION_OPS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>

                        {needsValue && (
                          <input
                            className="jf-input jf-cond-value"
                            value={c.value}
                            onChange={(e) => {
                              const next = [...conditions];
                              next[ci] = { ...c, value: e.target.value };
                              setConditions(next);
                            }}
                            placeholder="Value"
                          />
                        )}

                        <span className="jf-cond-then">THEN</span>
                        <select
                          className="jf-select"
                          value={c.action}
                          onChange={(e) => {
                            const next = [...conditions];
                            next[ci] = { ...c, action: e.target.value as ConditionRule["action"] };
                            setConditions(next);
                          }}
                        >
                          <option value="show">Show</option>
                          <option value="hide">Hide</option>
                        </select>

                        <select
                          className="jf-select"
                          value={c.targetId}
                          onChange={(e) => {
                            const next = [...conditions];
                            next[ci] = { ...c, targetId: e.target.value };
                            setConditions(next);
                          }}
                        >
                          <option value="">Choose a question…</option>
                          {form.fields.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.title || metaFor(f.type).label}
                            </option>
                          ))}
                        </select>

                        <button
                          className="jf-tool danger"
                          onClick={() => setConditions(conditions.filter((x) => x.id !== c.id))}
                          aria-label="Delete condition"
                        >
                          <Trash size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  className="btn-secondary"
                  disabled={form.fields.length < 2}
                  onClick={() => {
                    const first = form.fields[0]?.id || "";
                    const last = form.fields[form.fields.length - 1]?.id || "";
                    setConditions([
                      ...conditions,
                      {
                        id: Math.random().toString(36).slice(2, 10),
                        fieldId: first,
                        op: "equals",
                        value: "",
                        action: "show",
                        targetId: last,
                      },
                    ]);
                  }}
                >
                  <Plus size={15} /> Add condition
                </button>
                {form.fields.length < 2 && (
                  <p className="jf-setnote">You need at least two questions to add a condition.</p>
                )}
              </div>
            )}

            {settingsSection === "validation" && (
              <div className="jf-setbody">
                <h3 className="jf-settitle">Reject submissions</h3>
                <p className="jf-setnote">
                  Block a submission and show your own message when the answers match — minimum
                  age checks, dates of birth, dropdown choices, comparing two answers and more.
                  Rules are checked the moment someone presses Submit.
                </p>

                {validation.length === 0 && (
                  <div className="jf-conditions-empty">
                    <ShieldWarning size={22} />
                    <strong>No rejection rules yet</strong>
                    <p>Everyone can submit. Add a rule to block matching answers.</p>
                  </div>
                )}

                <div className="jf-conditions">
                  {validation.map((rule, ri) => (
                    <div className="jf-valid" key={rule.id}>
                      <div className="jf-valid-head">
                        <span className="jf-cond-if">WHEN</span>
                        <select
                          className="jf-select"
                          value={rule.match}
                          onChange={(e) => {
                            const next = [...validation];
                            next[ri] = {
                              ...rule,
                              match: e.target.value as ValidationRule["match"],
                            };
                            setValidation(next);
                          }}
                        >
                          <option value="all">ALL of these are true</option>
                          <option value="any">ANY of these are true</option>
                        </select>
                        <button
                          className="jf-tool danger"
                          onClick={() =>
                            setValidation(validation.filter((x) => x.id !== rule.id))
                          }
                          aria-label="Delete rule"
                        >
                          <Trash size={13} />
                        </button>
                      </div>

                      {rule.conditions.map((c, ci) => {
                        const needsValue = !NO_VALUE_OPS.includes(c.op);
                        const isFieldValue = FIELD_VALUE_OPS.includes(c.op)
                          ? c.value.trim().toLowerCase().startsWith("field:")
                          : false;
                        const valueLabel = isFieldValue
                          ? (() => {
                              const fid = c.value.trim().slice(6);
                              const f = form.fields.find((x) => x.id === fid);
                              return f ? f.title || metaFor(f.type).label : "another answer";
                            })()
                          : "";
                        const patchCond = (patch: Partial<ValidationCondition>) => {
                          const conds = [...rule.conditions];
                          conds[ci] = { ...c, ...patch };
                          const next = [...validation];
                          next[ri] = { ...rule, conditions: conds };
                          setValidation(next);
                        };
                        return (
                          <div className="jf-cond jf-valid-row" key={c.id}>
                            <span className="jf-cond-if">IF</span>
                            <select
                              className="jf-select"
                              value={c.fieldId}
                              onChange={(e) => patchCond({ fieldId: e.target.value })}
                            >
                              <option value="">Choose a question…</option>
                              {form.fields.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.title || metaFor(f.type).label}
                                </option>
                              ))}
                            </select>

                            <select
                              className="jf-select"
                              value={c.op}
                              onChange={(e) =>
                                patchCond({ op: e.target.value as CompareOp, value: "" })
                              }
                            >
                              {CONDITION_OPS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>

                            {needsValue && (
                              <>
                                <select
                                  className="jf-select jf-cond-value"
                                  value={isFieldValue ? c.value : ""}
                                  onChange={(e) => {
                                    if (e.target.value) patchCond({ value: e.target.value });
                                  }}
                                >
                                  <option value="">Type a value…</option>
                                  {form.fields
                                    .filter((f) => f.id !== c.fieldId)
                                    .map((f) => (
                                      <option key={f.id} value={`field:${f.id}`}>
                                        Answer of “{f.title || metaFor(f.type).label}”
                                      </option>
                                    ))}
                                </select>
                                {isFieldValue ? (
                                  <span className="jf-valchip">
                                    {valueLabel}
                                    <button
                                      type="button"
                                      onClick={() => patchCond({ value: "" })}
                                      aria-label="Use a custom value"
                                    >
                                      <X size={11} />
                                    </button>
                                  </span>
                                ) : (
                                  <input
                                    className="jf-input jf-cond-value"
                                    value={c.value}
                                    onChange={(e) => patchCond({ value: e.target.value })}
                                    placeholder={
                                      DATE_VALUE_OPS.includes(c.op)
                                        ? "17/10/2026, today, -13y"
                                        : c.op === "age_lt" ||
                                            c.op === "age_lte" ||
                                            c.op === "age_gt" ||
                                            c.op === "age_gte"
                                          ? "Years, e.g. 18"
                                          : c.op === "one_of" || c.op === "not_one_of"
                                            ? "Yes, Maybe, No"
                                            : "Value"
                                    }
                                  />
                                )}
                              </>
                            )}

                            <button
                              className="jf-tool danger"
                              onClick={() => {
                                const conds = rule.conditions.filter((x) => x.id !== c.id);
                                const next = [...validation];
                                next[ri] = { ...rule, conditions: conds };
                                setValidation(next);
                              }}
                              aria-label="Delete check"
                            >
                              <Trash size={13} />
                            </button>
                          </div>
                        );
                      })}

                      <div className="jf-valid-add">
                        <button
                          className="jf-tool"
                          onClick={() => {
                            const first = form.fields[0]?.id || "";
                            const conds: ValidationCondition[] = [
                              ...rule.conditions,
                              {
                                id: Math.random().toString(36).slice(2, 10),
                                fieldId: first,
                                op: "equals",
                                value: "",
                              },
                            ];
                            const next = [...validation];
                            next[ri] = { ...rule, conditions: conds };
                            setValidation(next);
                          }}
                          disabled={form.fields.length === 0}
                        >
                          <Plus size={13} /> Add check
                        </button>
                      </div>

                      <div className="jf-cond jf-valid-msg">
                        <span className="jf-cond-then">THEN</span>
                        <input
                          className="jf-input jf-cond-value"
                          value={rule.message}
                          onChange={(e) => {
                            const next = [...validation];
                            next[ri] = { ...rule, message: e.target.value };
                            setValidation(next);
                          }}
                          placeholder="Reject the submission and say why, e.g. This event is only for people above 18"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  className="btn-secondary"
                  disabled={form.fields.length === 0}
                  onClick={() => {
                    const first = form.fields[0]?.id || "";
                    setValidation([
                      ...validation,
                      {
                        id: Math.random().toString(36).slice(2, 10),
                        match: "all",
                        enabled: true,
                        message: "",
                        conditions: [
                          {
                            id: Math.random().toString(36).slice(2, 10),
                            fieldId: first,
                            op: "age_lt",
                            value: "18",
                          },
                        ],
                      },
                    ]);
                  }}
                >
                  <Plus size={15} /> Add rejection rule
                </button>
                {form.fields.length === 0 && (
                  <p className="jf-setnote">Add a question first to build a rule.</p>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ---------------- PUBLISH ---------------- */}
      {tab === "publish" && (
        <div className="fb-share ev-in" style={{ animationDelay: "120ms" }}>
          <section className="fb-share-card">
            <div className="fb-share-label">Live link</div>
            <div className="fb-share-url">
              <LinkSimple size={16} />
              <span>{liveUrl}</span>
            </div>
            <div className="fb-share-actions">
              <button className="btn-primary" onClick={copyLiveLink}>
                {copied ? <Check size={15} /> : <LinkSimple size={15} />}
                {copied ? "Copied!" : "Copy link"}
              </button>
              <a
                className="btn-secondary"
                href={`/f/${form.slug}?preview=1`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Eye size={15} /> Open form
              </a>
            </div>
            {form.status !== "published" && (
              <p className="fb-share-note">
                This form is still a draft — publish it so people can submit responses.
              </p>
            )}
          </section>

          <section className="fb-share-card">
            <div className="fb-share-label">Embed on your website</div>
            <textarea
              className="ev-input fb-embed"
              readOnly
              value={`<iframe src="${liveUrl}" width="100%" height="640" style="border:0" title="${form.title}"></iframe>`}
              onFocus={(e) => e.target.select()}
            />
            <p className="fb-share-note">
              Paste this into any page on the mosque website to embed the form.
            </p>
          </section>

          <section className="fb-share-card">
            <div className="fb-share-label">Status</div>
            <div className="fb-share-row">
              <div>
                <strong>{form.status === "published" ? "Collecting responses" : "Draft mode"}</strong>
                <p>
                  {form.status === "published"
                    ? "Anyone with the link can submit this form."
                    : "Only admins can preview this form."}
                </p>
              </div>
              <span className={`badge${form.status === "published" ? " badge--gold" : ""}`}>
                {form.status}
              </span>
            </div>
            <div className="fb-share-actions">
              {form.status === "published" ? (
                <button className="btn-secondary" onClick={() => publish("draft")}>
                  Move back to draft
                </button>
              ) : (
                <button className="btn-primary" onClick={() => publish("published")}>
                  Publish form
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ---------------- RESULTS ---------------- */}
      {tab === "results" && (
        <div className="fb-results ev-in" style={{ animationDelay: "120ms" }}>
          <ResultsPanel
            form={form}
            responses={responses}
            loading={loadingResponses}
            onRefresh={loadResponses}
          />
        </div>
      )}
    </div>
  );
}
