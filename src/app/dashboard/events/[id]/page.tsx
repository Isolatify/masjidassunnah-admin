"use client";

import { useState, useEffect, useCallback, use, useRef, useLayoutEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  FloppyDisk,
  Trash,
  SpinnerGap,
  X,
  Plus,
  MapPin,
  UploadSimple,
  Link as LinkIcon,
  User,
  CurrencyDollar,
  Check,
  CalendarDots,
  ArrowSquareOut,
  MagnifyingGlass,
  NotePencil,
  LinkSimple,
} from "@phosphor-icons/react";
import { toast } from "@/components/Toast";
import RichTextEditor from "@/components/RichTextEditor";
import DateEditor from "@/components/DateEditor";
import type { DateEntry } from "@/components/DateEditor";
import { type FormRecord } from "@/lib/forms";
import { deriveDateFields } from "@/lib/eventDates";
import { SITE_URL } from "@/lib/siteUrl";

const AUDIENCE_OPTIONS = ["All", "Brothers", "Sisters", "Youth", "Children"] as const;

function untilPhraseFor(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr + "T12:00:00").getTime() - Date.now();
  if (ms <= 0) return "Today";
  const sec = Math.floor(ms / 1000);
  const units: [number, string][] = [
    [31536000, "year"],
    [2592000, "month"],
    [604800, "week"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
    [1, "second"],
  ];
  for (const [size, name] of units) {
    if (sec >= size) {
      const n = Math.floor(sec / size);
      return `${n} ${name}${n === 1 ? "" : "s"}`;
    }
  }
  return "Moments";
}

const AUDIENCE_COLORS: Record<string, string> = {
  All: "#c8a65d",
  Brothers: "#03894a",
  Sisters: "#9c7e3d",
  Youth: "#026839",
  Children: "#015230",
};

interface LinkEntry {
  label: string;
  url: string;
}

interface PersonEntry {
  name: string;
  role: string;
}

interface EventData {
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
  location_lat: number | null;
  location_lng: number | null;
  audience: string[];
  dates_json: DateEntry[];
  links: LinkEntry[];
  persons: PersonEntry[];
  faq?: { question: string; answer: string }[] | null;
  cost: string;
  form_id: string | null;
  register_url: string;
  full_image: string;
  status: string;
  created_at: string;
}

const EMPTY_EVENT: Partial<EventData> = {
  title: "",
  slug: "",
  description: "",
  content_html: "",
  cover_image: "",
  image_url: "",
  date_start: "",
  date_end: null,
  date_type: "one-day",
  recurring_pattern: null,
  location: "",
  location_lat: null,
  location_lng: null,
  audience: [],
  dates_json: [],
  links: [],
  persons: [],
  cost: "",
  form_id: null,
  register_url: "",
  full_image: "",
  status: "draft",
};

function EditorModal({ onCancel, children }: { onCancel: () => void; children: React.ReactNode }) {
  return (
    <div className="ev-overlay" onClick={onCancel}>
      <div className="ev-modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export default function EventEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const isNew = id === "new";

  const rootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const [event, setEvent] = useState<Partial<EventData>>({ ...EMPTY_EVENT });
  const [snapshot, setSnapshot] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [slugCheck, setSlugCheck] = useState<{ slug: string; available: boolean } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [newLink, setNewLink] = useState<LinkEntry>({ label: "", url: "" });
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [newPerson, setNewPerson] = useState<PersonEntry>({ name: "", role: "" });
  const [formsList, setFormsList] = useState<FormRecord[]>([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formModalTab, setFormModalTab] = useState<"pick" | "choose" | "create" | "link">("pick");
  const [formSearch, setFormSearch] = useState("");
  const [pickedFormId, setPickedFormId] = useState<string | null>(null);
  const [creatingForm, setCreatingForm] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState("");
  const [externalUrl, setExternalUrl] = useState("https://");

  const dirty = useMemo(() => {
    const current = JSON.stringify(event);
    return snapshot === ""
      ? current !== JSON.stringify(EMPTY_EVENT)
      : current !== snapshot;
  }, [event, snapshot]);

  const checkingSlug = !isNew && !!event.slug && slugCheck?.slug !== event.slug;
  const slugAvailable =
    !checkingSlug && (isNew || !event.slug || slugCheck?.available !== false);

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/events?id=${id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.event) {
            const loaded = {
              ...data.event,
              links: data.event.links || [],
              persons: data.event.persons || [],
              dates_json: data.event.dates_json || [],
              audience: data.event.audience || [],
            };
            setEvent(loaded);
            setSnapshot(JSON.stringify(loaded));
          } else {
            toast.error("Event not found");
            router.push("/dashboard/events");
          }
        })
        .catch(() => {
          toast.error("Failed to load event");
          router.push("/dashboard/events");
        })
        .finally(() => setLoading(false));
    }
  }, [id, isNew, router]);

  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 1600);
    return () => clearTimeout(t);
  }, [savedFlash]);

  // Staggered entrance + scroll reveal + sticky bar state
  useLayoutEffect(() => {
    if (loading) return;
    const root = rootRef.current;
    if (!root) return;

    const sentinel = sentinelRef.current;
    const bar = barRef.current;
    let stuckIo: IntersectionObserver | null = null;
    if (sentinel && bar && "IntersectionObserver" in window) {
      stuckIo = new IntersectionObserver(
        ([e]) => bar.classList.toggle("is-stuck", !e.isIntersecting),
        { threshold: 0 }
      );
      stuckIo.observe(sentinel);
    }

    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return () => stuckIo?.disconnect();
    }
    root.classList.add("ev--reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
    );
    els.forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      stuckIo?.disconnect();
    };
  }, [loading]);

  const update = useCallback((patch: Partial<EventData>) => {
    setEvent((prev) => ({ ...prev, ...patch }));
  }, []);

  const autoSlug = useCallback((title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }, []);

  const handleTitleChange = useCallback(
    (title: string) => {
      const derived = autoSlug(event.title || "");
      const slugFollowsTitle = !event.slug || event.slug === derived;
      update(slugFollowsTitle ? { title, slug: autoSlug(title) } : { title });
    },
    [event.slug, event.title, update, autoSlug]
  );

  useEffect(() => {
    const slug = event.slug;
    if (isNew || !slug) return;
    let alive = true;
    const t = setTimeout(async () => {
      let available = true;
      try {
        const res = await fetch(
          `/api/events/check-slug?slug=${encodeURIComponent(slug)}&exclude=${id}`
        );
        const data = await res.json();
        available = data.available !== false;
      } catch {
        available = true;
      }
      if (alive) setSlugCheck({ slug, available });
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [event.slug, isNew, id]);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please choose an image file");
        return;
      }
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        update({ cover_image: data.url, full_image: data.url });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
      setUploading(false);
    },
    [update]
  );

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      e.target.value = "";
    },
    [uploadFile]
  );

  const toggleAudience = useCallback(
    (a: string) => {
      const current = event.audience || [];
      if (a === "All") {
        update({ audience: current.includes("All") ? [] : ["All"] });
      } else {
        const next = current.filter((x) => x !== "All");
        if (next.includes(a)) {
          update({ audience: next.filter((x) => x !== a) });
        } else {
          update({ audience: [...next, a] });
        }
      }
    },
    [event.audience, update]
  );

  const addLink = useCallback(() => {
    if (!newLink.url.trim()) return;
    update({ links: [...(event.links || []), { ...newLink }] });
    setNewLink({ label: "", url: "" });
    setShowLinkForm(false);
  }, [newLink, event.links, update]);

  const removeLink = useCallback(
    (index: number) => {
      update({ links: (event.links || []).filter((_, i) => i !== index) });
    },
    [event.links, update]
  );

  const addPerson = useCallback(() => {
    if (!newPerson.name.trim()) return;
    update({ persons: [...(event.persons || []), { ...newPerson }] });
    setNewPerson({ name: "", role: "" });
    setShowPersonForm(false);
  }, [newPerson, event.persons, update]);

  const removePerson = useCallback(
    (index: number) => {
      update({ persons: (event.persons || []).filter((_, i) => i !== index) });
    },
    [event.persons, update]
  );

  const loadForms = useCallback(async () => {
    try {
      const res = await fetch("/api/forms");
      const data = await res.json();
      if (data.success) setFormsList(data.forms || []);
    } catch {
      /* list is optional — ignore */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(loadForms, 0);
    return () => clearTimeout(t);
  }, [loadForms]);

  const persistFormId = useCallback(
    async (formId: string | null) => {
      const clearLink = !!formId && !!event.register_url;
      update(
        clearLink ? { form_id: formId, register_url: "" } : { form_id: formId }
      );
      if (isNew) return true;
      try {
        const res = await fetch("/api/events", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            clearLink
              ? { id, form_id: formId, register_url: "" }
              : { id, form_id: formId }
          ),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return true;
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Could not save form link");
        return false;
      }
    },
    [isNew, id, update, event.register_url]
  );

  const openFormModal = useCallback(() => {
    setPickedFormId(null);
    setFormSearch("");
    setExternalUrl("https://");
    setNewFormTitle(event.title ? `Register — ${event.title}` : "");
    setFormModalTab("pick");
    setShowFormModal(true);
    loadForms();
  }, [event.title, loadForms]);

  const attachPickedForm = useCallback(async () => {
    if (!pickedFormId) return;
    const ok = await persistFormId(pickedFormId);
    if (ok) {
      setShowFormModal(false);
      toast.success("Form attached");
    }
  }, [pickedFormId, persistFormId]);

  const persistRegisterUrl = useCallback(
    async (url: string) => {
      const patch = url
        ? { register_url: url, form_id: null }
        : { register_url: "" };
      update(patch);
      if (isNew) return true;
      try {
        const res = await fetch("/api/events", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...patch }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return true;
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Could not save link");
        return false;
      }
    },
    [isNew, id, update]
  );

  const saveExternalUrl = useCallback(async () => {
    const url = externalUrl.trim();
    if (!url || url === "https://") {
      toast.error("Enter the registration link");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Link must start with http:// or https://");
      return;
    }
    const ok = await persistRegisterUrl(url);
    if (ok) {
      setShowFormModal(false);
      toast.success("Registration link saved");
    }
  }, [externalUrl, persistRegisterUrl]);

  const handleSave = useCallback(
    async (status?: string): Promise<string | null> => {
      if (!event.title?.trim()) {
        toast.error("Title is required");
        return null;
      }
      if (checkingSlug) {
        toast.error("Checking URL availability…");
        return null;
      }
      if (!slugAvailable) {
        toast.error("Please choose a different URL slug");
        return null;
      }
      setSaving(true);
      try {
        const nextStatus = status || event.status || "draft";
        const dates = event.dates_json || [];
        const payload = {
          ...(isNew ? {} : { id }),
          ...event,
          // Keep legacy top-level columns in step with dates_json on every save.
          ...(dates.length ? deriveDateFields(dates) : {}),
          status: nextStatus,
          dates_json: dates,
          faq: event.faq || [],
          audience: event.audience || [],
          links: event.links || [],
          persons: event.persons || [],
        };
        const method = isNew ? "POST" : "PUT";
        const res = await fetch("/api/events", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        const saved: Partial<EventData> = data.event || { ...event, status: nextStatus };
        setEvent(saved);
        setSnapshot(JSON.stringify(saved));
        setSavedFlash(true);
        toast.success(isNew ? "Event created" : "Event saved");
        if (isNew && data.event?.id) router.replace(`/dashboard/events/${data.event.id}`);
        return data.event?.id || (isNew ? null : id);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Save failed");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [event, isNew, slugAvailable, checkingSlug, id, router]
  );

  const openBuilderForNewForm = useCallback(async () => {
    const title = newFormTitle.trim();
    if (!title) {
      toast.error("Form title is required");
      return;
    }
    setCreatingForm(true);
    try {
      let eventId = id;
      if (isNew) {
        const savedId = await handleSave();
        if (!savedId) return;
        eventId = savedId;
      }
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Form created — finish and publish it in the builder");
      router.push(`/dashboard/register/${data.form.id}?event=${eventId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not create form");
      setCreatingForm(false);
    }
  }, [newFormTitle, isNew, id, handleSave, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, saving]);

  const handleDelete = useCallback(async () => {
    try {
      const res = await fetch("/api/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Event deleted");
      router.push("/dashboard/events");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }, [id, router]);

  const goBack = useCallback(() => {
    if (dirty) setDiscardConfirm(true);
    else router.push("/dashboard/events");
  }, [dirty, router]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <div className="spinner" />
      </div>
    );
  }

  const derived = deriveDateFields(event.dates_json || []);
  const nextDate =
    derived.date_start ||
    event.dates_json?.[0]?.date_start ||
    event.date_start ||
    null;
  const untilPhrase = untilPhraseFor(nextDate);
  const heroImage = event.cover_image || event.full_image;

  const textOnly = (event.content_html || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  const checks = [
    { label: "Title", done: !!event.title?.trim() },
    { label: "Cover image", done: !!heroImage },
    { label: "Summary", done: !!event.description?.trim() },
    { label: "About section", done: !!textOnly },
    { label: "Dates", done: (event.dates_json?.length || 0) > 0 },
    { label: "Audience", done: (event.audience?.length || 0) > 0 },
    { label: "Location", done: !!event.location?.trim() },
    { label: "URL slug", done: !!event.slug && slugAvailable },
  ];
  const pct = Math.round((checks.filter((c) => c.done).length / checks.length) * 100);
  const RING_R = 27;
  const RING_C = 2 * Math.PI * RING_R;
  const ringOffset = RING_C - (pct / 100) * RING_C;

  const displayDate = nextDate
    ? new Date(nextDate + "T12:00:00").toLocaleDateString("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const publishLabel = saving
    ? isNew || event.status !== "published"
      ? "Publishing…"
      : "Updating…"
    : isNew
      ? "Publish"
      : event.status === "published"
        ? "Update"
        : "Publish";

  const attachedForm = event.form_id
    ? formsList.find((f) => f.id === event.form_id) || null
    : null;
  const filteredForms = formsList.filter(
    (f) =>
      !formSearch.trim() || f.title.toLowerCase().includes(formSearch.trim().toLowerCase())
  );

  return (
    <div ref={rootRef}>
      <div ref={sentinelRef} className="ev-sentinel" />

      {/* Sticky action bar */}
      <div ref={barRef} className="ev-bar">
        <button className="ev-back" onClick={goBack} aria-label="Back to events">
          <ArrowLeft size={18} />
        </button>
        <div className="ev-bar-mid">
          <span className="ev-crumb">
            Events / <strong>{isNew ? "New event" : event.title || "Edit event"}</strong>
          </span>
          <span className={`ev-dirty${dirty ? " on" : ""}`}>
            <i /> Unsaved changes
          </span>
        </div>
        <div className="ev-actions">
          {!isNew && (
            <button className="ev-btn-ghost" onClick={() => setDeleteConfirm(true)}>
              <Trash size={14} /> Delete
            </button>
          )}
          <button
            className={`btn-secondary${savedFlash ? " ev-saved" : ""}`}
            onClick={() => handleSave()}
            disabled={saving || !event.title?.trim()}
          >
            {saving ? (
              <SpinnerGap size={14} className="spin" />
            ) : savedFlash ? (
              <Check size={14} />
            ) : (
              <FloppyDisk size={14} />
            )}
            {saving ? "Saving…" : savedFlash ? "Saved" : "Save Draft"}
          </button>
          <button
            className="btn-primary"
            onClick={() => handleSave("published")}
            disabled={saving || !event.title?.trim()}
          >
            {saving ? <SpinnerGap size={14} className="spin" /> : <Eye size={14} />}
            {publishLabel}
          </button>
        </div>
      </div>

      {/* Cover hero */}
      <section
        className={`ev-hero ev-in${heroImage ? "" : " no-cover"}${dragOver ? " is-drag" : ""}`}
        style={{ animationDelay: "60ms" }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) uploadFile(file);
        }}
      >
        {uploading && <div className="ev-upload-bar" />}
        {heroImage && (
          <div className="ev-hero-img">
            <img src={heroImage} alt="" />
          </div>
        )}
        <div className="ev-hero-shade" />

        <div className="ev-hero-bar">
          <label className="ev-glass">
            <UploadSimple size={17} />
            {uploading
              ? "Uploading…"
              : heroImage
                ? "Change image"
                : "Upload or drag & drop image"}
            <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
          </label>
          {heroImage && !uploading && (
            <button
              className="ev-glass ev-glass--danger"
              onClick={() => update({ cover_image: "", full_image: "" })}
            >
              <X size={14} /> Remove
            </button>
          )}
          <p className="ev-hero-hint">
            Sets the cover and the full-size picture shown on the event page.
            <br />
            <strong>Highly recommended:</strong> 1920 &times; 1080 px (16:9) or larger, landscape,
            under 2 MB &mdash; portrait images get cropped.
          </p>
        </div>

        <div className="ev-aud">
          <span className="ev-aud-label">Who is this for?</span>
          {AUDIENCE_OPTIONS.map((a) => {
            const active = (event.audience || []).includes(a);
            return (
              <button
                key={a}
                className={`ev-pill${active ? " on" : ""}`}
                onClick={() => toggleAudience(a)}
              >
                <i style={{ background: AUDIENCE_COLORS[a] || "#4ade80" }} />
                {a}
              </button>
            );
          })}
        </div>

        <div className="ev-hero-fields">
          <input
            className="ev-title-input"
            value={event.title || ""}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Enter the title"
            aria-label="Event title"
          />
          <input
            className="ev-sub-input"
            value={event.description || ""}
            onChange={(e) => update({ description: e.target.value.slice(0, 200) })}
            placeholder="One-line summary shown on event cards and listings…"
            aria-label="Event summary"
          />
          <div className="ev-title-meta">
            <span>{isNew ? "Draft — not yet published" : `Status: ${event.status}`}</span>
            <span>{(event.description || "").length} / 200</span>
          </div>
        </div>
      </section>

      {/* Two-column content */}
      <div className="ev-grid">
        {/* Left column */}
        <div>
          {/* 01 About */}
          <section className="ev-sec" data-reveal>
            <div className="ev-sec-head">
              <span className="ev-sec-num">01</span>
              <span className="ev-sec-title">About the event</span>
              <span className="ev-sec-rule" />
            </div>
            <RichTextEditor
              value={event.content_html || ""}
              onChange={(html) => update({ content_html: html })}
              placeholder="Write about this event..."
            />
          </section>

          {/* 02 Dates */}
          <section className="ev-sec" data-reveal>
            <div className="ev-sec-head">
              <span className="ev-sec-num">02</span>
              <span className="ev-sec-title">Dates &amp; Times</span>
              <span className="ev-sec-rule" />
            </div>
            <DateEditor
              dates={event.dates_json || []}
              onChange={(dates) =>
                update({ ...deriveDateFields(dates), dates_json: dates })
              }
            />
          </section>

          {/* 03 Location */}
          <section className="ev-sec" data-reveal>
            <div className="ev-sec-head">
              <span className="ev-sec-num">03</span>
              <span className="ev-sec-title">Location</span>
              <span className="ev-sec-rule" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <MapPin size={20} weight="duotone" color="var(--color-muted)" />
              <input
                className="ev-input"
                value={event.location || ""}
                onChange={(e) => update({ location: e.target.value })}
                placeholder="Masjid As Sunnah, Lakemba"
              />
            </div>
            {event.location && (
              <div className="ev-map" style={{ marginTop: 14 }}>
                <iframe
                  src={`https://www.google.com/maps?q=${encodeURIComponent(event.location)}&output=embed`}
                  width="100%"
                  height={190}
                  style={{ border: 0, display: "block" }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
          </section>
        </div>

        {/* Right column */}
        <aside className="ev-side ev-in" style={{ animationDelay: "220ms" }}>
          {/* Live preview */}
          <div className="ev-card ev-card--dark" data-reveal>
            <div className="ev-card-title">
              Live preview
              <div className="ev-ring" title={`${pct}% complete`}>
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <circle className="ev-ring-bg" cx="32" cy="32" r={RING_R} fill="none" strokeWidth="5" />
                  <circle
                    className="ev-ring-fg"
                    cx="32"
                    cy="32"
                    r={RING_R}
                    fill="none"
                    strokeWidth="5"
                    strokeDasharray={RING_C}
                    strokeDashoffset={ringOffset}
                  />
                </svg>
                <span className="ev-ring-num">{pct}%</span>
              </div>
            </div>

            <div className="ev-preview">
              <div
                className="ev-preview-top"
                style={event.cover_image ? { backgroundImage: `url(${event.cover_image})` } : undefined}
              />
              <div className="ev-preview-body">
                <div className={`ev-preview-title${event.title ? "" : " is-empty"}`}>
                  {event.title || "Untitled event"}
                </div>
                <div className="ev-preview-meta">
                  <CalendarDots size={13} weight="duotone" />
                  {displayDate || "No date set"}
                </div>
                {(event.audience || []).length > 0 && (
                  <div className="ev-preview-chips">
                    {(event.audience || []).map((a) => (
                      <span key={a} className="ev-chip">
                        {a}
                      </span>
                    ))}
                    {event.cost && <span className="ev-chip">{event.cost}</span>}
                  </div>
                )}
              </div>
            </div>

            <div className="ev-checks">
              {checks.map((c) => (
                <span key={c.label} className={`ev-check${c.done ? " on" : ""}`}>
                  <i>{c.done ? "✓" : ""}</i>
                  {c.label}
                </span>
              ))}
            </div>

            <div className="ev-nextdate">
              <div className="ev-nextdate-label">Next date</div>
              <div className="ev-nextdate-value">{displayDate || "Show upcoming date"}</div>
              <div className="ev-nextdate-sub">
                {untilPhrase !== null
                  ? untilPhrase === "Today"
                    ? "Today"
                    : `In ${untilPhrase}`
                  : "Add a date to count down"}
              </div>
            </div>
          </div>

          {/* Registration form */}
          <div className="ev-card ev-card--dark" data-reveal>
            <div className="ev-card-title">
              Registration
              {attachedForm && (
                <span className="ev-form-badge">{attachedForm.fields?.length || 0} questions</span>
              )}
            </div>

            {event.form_id ? (
              <div className="ev-form-chip">
                <div className="ev-form-chip-main">
                  <strong>{attachedForm ? attachedForm.title : "Attached form"}</strong>
                  <span>
                    {attachedForm
                      ? `${attachedForm.status === "published" ? "Live" : "Draft"} · /f/${attachedForm.slug}`
                      : "Link saved — form may have been deleted"}
                  </span>
                </div>
                <div className="ev-form-chip-actions">
                  {attachedForm && (
                    <>
                      <a
                        className="ev-chip-btn"
                        href={`/dashboard/register/${attachedForm.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in builder"
                      >
                        <ArrowSquareOut size={14} />
                      </a>
                      <a
                        className="ev-chip-btn"
                        href={`/f/${attachedForm.slug}?preview=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Preview form"
                      >
                        <Eye size={14} />
                      </a>
                    </>
                  )}
                  <button
                    className="ev-chip-btn danger"
                    title="Detach form"
                    onClick={() =>
                      persistFormId(null).then((ok) => ok && toast.success("Form detached"))
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : event.register_url ? (
              <div className="ev-form-chip">
                <div className="ev-form-chip-main">
                  <strong>External registration</strong>
                  <span>{event.register_url}</span>
                </div>
                <div className="ev-form-chip-actions">
                  <a
                    className="ev-chip-btn"
                    href={event.register_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open link"
                  >
                    <ArrowSquareOut size={14} />
                  </a>
                  <button
                    className="ev-chip-btn danger"
                    title="Remove link"
                    onClick={() =>
                      persistRegisterUrl("").then((ok) => ok && toast.success("Link removed"))
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <p className="ev-form-none">
                Attach a built-in registration form or link to an external one so people
                can sign up for this event.
              </p>
            )}

            <button className="ev-toggle" style={{ marginTop: 12 }} onClick={openFormModal}>
              <Plus size={15} />{" "}
              {event.form_id || event.register_url ? "Change registration" : "Add registration"}
            </button>
          </div>

          {/* Details: cost, URL, status */}
          <div className="ev-card ev-card--dark" data-reveal>
            <div className="ev-card-title">Details</div>

            <div className="ev-field-label" style={{ color: "rgba(255,255,255,0.45)" }}>
              Cost
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <CurrencyDollar size={16} color="rgba(255,255,255,0.55)" />
              <input
                className="ev-input-dark"
                value={event.cost || ""}
                onChange={(e) => update({ cost: e.target.value })}
                placeholder="Free"
              />
            </div>

            <div className="ev-field-label" style={{ color: "rgba(255,255,255,0.45)" }}>
              URL slug
            </div>
            <div className="ev-input-row">
              <span>/events/</span>
              <input
                value={event.slug || ""}
                onChange={(e) => update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                placeholder="event-url"
                aria-label="Event URL slug"
              />
            </div>
            <div
              className={`ev-slug-state${checkingSlug ? " checking" : slugAvailable ? " ok" : ""}`}
            >
              {checkingSlug ? (
                <>
                  <SpinnerGap size={12} className="spin" /> Checking availability…
                </>
              ) : slugAvailable ? (
                <>
                  <Check size={12} /> URL is available
                </>
              ) : (
                <>
                  <X size={12} /> This URL is already taken
                </>
              )}
            </div>

            <div className="ev-field-label" style={{ color: "rgba(255,255,255,0.45)", marginTop: 18 }}>
              Status
            </div>
            <div className="ev-seg">
              {(["draft", "published"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => update({ status: s })}
                  className={
                    event.status === s ? (s === "published" ? "on-published" : "on-draft") : ""
                  }
                >
                  {s}
                </button>
              ))}
            </div>

            {!isNew && event.slug && (
              <a
                className="ev-view"
                href={`${SITE_URL}/events/${event.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Eye size={14} /> View on website
              </a>
            )}

            <div className="ev-hint">Shortcut: Ctrl / ⌘ + S to save</div>
          </div>

          {/* Links & people */}
          <div className="ev-card" data-reveal>
            <div className="ev-card-title">Links &amp; people</div>

            <button
              className={`ev-toggle${showLinkForm ? " on" : ""}`}
              onClick={() => setShowLinkForm(!showLinkForm)}
            >
              <LinkIcon size={15} /> {showLinkForm ? "Close" : "Add link"}
            </button>

            {showLinkForm && (
              <div className="ev-mini-form">
                <input
                  className="ev-input"
                  value={newLink.label}
                  onChange={(e) => setNewLink((l) => ({ ...l, label: e.target.value }))}
                  placeholder="Label (e.g. Register)"
                />
                <input
                  className="ev-input"
                  value={newLink.url}
                  onChange={(e) => setNewLink((l) => ({ ...l, url: e.target.value }))}
                  placeholder="https://..."
                  onKeyDown={(e) => e.key === "Enter" && addLink()}
                />
                <div className="ev-mini-actions">
                  <button className="ev-add" onClick={addLink} disabled={!newLink.url.trim()}>
                    Add link
                  </button>
                  <button
                    className="ev-cancel"
                    onClick={() => {
                      setShowLinkForm(false);
                      setNewLink({ label: "", url: "" });
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {(event.links || []).map((link, i) => (
              <div className="ev-row" key={`${link.url}-${i}`}>
                <LinkIcon size={15} color="var(--color-gold-deep)" />
                <div className="ev-row-main">
                  <div className="ev-row-title">{link.label || link.url}</div>
                  {link.label && <div className="ev-row-sub">{link.url}</div>}
                </div>
                <button className="ev-row-x" onClick={() => removeLink(i)} aria-label="Remove link">
                  <X size={13} />
                </button>
              </div>
            ))}

            <button
              className={`ev-toggle${showPersonForm ? " on" : ""}`}
              style={{ marginTop: 14 }}
              onClick={() => setShowPersonForm(!showPersonForm)}
            >
              <User size={15} /> {showPersonForm ? "Close" : "Add person"}
            </button>

            {showPersonForm && (
              <div className="ev-mini-form">
                <input
                  className="ev-input"
                  value={newPerson.name}
                  onChange={(e) => setNewPerson((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Name"
                />
                <input
                  className="ev-input"
                  value={newPerson.role}
                  onChange={(e) => setNewPerson((p) => ({ ...p, role: e.target.value }))}
                  placeholder="Role (e.g. Speaker)"
                  onKeyDown={(e) => e.key === "Enter" && addPerson()}
                />
                <div className="ev-mini-actions">
                  <button className="ev-add" onClick={addPerson} disabled={!newPerson.name.trim()}>
                    Add person
                  </button>
                  <button
                    className="ev-cancel"
                    onClick={() => {
                      setShowPersonForm(false);
                      setNewPerson({ name: "", role: "" });
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {(event.persons || []).map((person, i) => (
              <div className="ev-row" key={`${person.name}-${i}`}>
                <User size={15} color="var(--color-gold-deep)" />
                <div className="ev-row-main">
                  <div className="ev-row-title">{person.name}</div>
                  {person.role && <div className="ev-row-sub">{person.role}</div>}
                </div>
                <button className="ev-row-x" onClick={() => removePerson(i)} aria-label="Remove person">
                  <X size={13} />
                </button>
              </div>
            ))}

            {(event.links || []).length === 0 && (event.persons || []).length === 0 && !showLinkForm && !showPersonForm && (
              <p className="ev-empty">No links or people added yet.</p>
            )}
          </div>
        </aside>
      </div>

      {/* Add / change registration form */}
      {showFormModal && (
        <div className="ev-overlay" onClick={() => setShowFormModal(false)}>
          <div className="ev-modal ev-modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="fm-modal-head">
              <div>
                <div className="fm-modal-eyebrow">Registration</div>
                <div className="ev-modal-title fm-modal-title">
                  {event.form_id || event.register_url
                    ? "Change registration"
                    : "Add registration"}
                </div>
              </div>
              <button
                className="ev-row-x"
                onClick={() => setShowFormModal(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {formModalTab !== "pick" && (
              <div className="fm-modal-tabs">
                <button
                  className={`fm-modal-tab${formModalTab === "choose" ? " on" : ""}`}
                  onClick={() => setFormModalTab("choose")}
                >
                  Built-in form
                </button>
                <button
                  className={`fm-modal-tab${formModalTab === "create" ? " on" : ""}`}
                  onClick={() => setFormModalTab("create")}
                >
                  Create new
                </button>
                <button
                  className={`fm-modal-tab${formModalTab === "link" ? " on" : ""}`}
                  onClick={() => setFormModalTab("link")}
                >
                  External link
                </button>
              </div>
            )}

            {formModalTab === "pick" && (
              <div className="fm-modal-body">
                <div className="fm-type-list">
                  <button className="fm-type" onClick={() => setFormModalTab("choose")}>
                    <span className="fm-type-icon">
                      <NotePencil size={22} weight="duotone" />
                    </span>
                    <strong>Built-in form</strong>
                    <span className="fm-type-desc">
                      Build a registration form on this site, or pick one you already made.
                    </span>
                  </button>
                  <button className="fm-type" onClick={() => setFormModalTab("link")}>
                    <span className="fm-type-icon">
                      <LinkSimple size={22} weight="duotone" />
                    </span>
                    <strong>Link to another site</strong>
                    <span className="fm-type-desc">
                      Send people to an external page such as Google Forms or Eventbrite.
                    </span>
                  </button>
                </div>
                {event.form_id ? (
                  <p className="fm-modal-hint">A built-in form is currently attached.</p>
                ) : event.register_url ? (
                  <p className="fm-modal-hint">Current link: {event.register_url}</p>
                ) : null}
              </div>
            )}

            {formModalTab === "link" && (
              <div className="fm-modal-body">
                <label className="fb-field-label">Registration link</label>
                <input
                  className="ev-input"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://"
                  autoFocus
                />
                <div className="fm-modal-actions-row">
                  <button className="btn-primary" onClick={saveExternalUrl}>
                    <Check size={15} /> Save link
                  </button>
                  <button className="ev-cancel" onClick={() => setFormModalTab("pick")}>
                    Back
                  </button>
                </div>
                <p className="fm-modal-hint">
                  The Register now button on the website opens this link in a new tab.
                </p>
              </div>
            )}

            {formModalTab === "choose" && (
              <div className="fm-modal-body">
                <div className="fm-search">
                  <MagnifyingGlass size={15} />
                  <input
                    value={formSearch}
                    onChange={(e) => setFormSearch(e.target.value)}
                    placeholder="Search your forms…"
                    aria-label="Search forms"
                  />
                </div>

                <div className="fm-pick-list">
                  {filteredForms.length === 0 ? (
                    <p className="fm-pick-empty">
                      {formsList.length === 0
                        ? "You have no forms yet — create one in the next tab."
                        : "No forms match that search."}
                    </p>
                  ) : (
                    filteredForms.map((f) => (
                      <button
                        key={f.id}
                        className={`fm-pick${pickedFormId === f.id ? " on" : ""}`}
                        onClick={() => setPickedFormId(f.id)}
                      >
                        <span className="fm-pick-radio" />
                        <span className="fm-pick-main">
                          <strong>{f.title}</strong>
                          <span>
                            {f.fields?.length || 0} question{f.fields?.length === 1 ? "" : "s"} ·{" "}
                            {f.status}
                          </span>
                        </span>
                        <span className="fm-pick-count">{f.response_count || 0} resp.</span>
                      </button>
                    ))
                  )}
                </div>

                <div className="fm-modal-actions-row">
                  <button
                    className="btn-primary"
                    onClick={attachPickedForm}
                    disabled={!pickedFormId}
                  >
                    <Check size={15} /> Attach form
                  </button>
                  <button className="ev-cancel" onClick={() => setFormModalTab("create")}>
                    <Plus size={14} /> New form instead
                  </button>
                  <button className="ev-cancel" onClick={() => setFormModalTab("link")}>
                    <LinkSimple size={14} /> Use external link
                  </button>
                </div>
              </div>
            )}

            {formModalTab === "create" && (
              <div className="fm-modal-body">
                <label className="fb-field-label">Form title</label>
                <input
                  className="ev-input"
                  value={newFormTitle}
                  onChange={(e) => setNewFormTitle(e.target.value)}
                  placeholder="Register — Event name"
                />

                <div className="fm-modal-actions-row">
                  <button
                    className="btn-primary"
                    onClick={openBuilderForNewForm}
                    disabled={creatingForm}
                  >
                    {creatingForm ? (
                      <SpinnerGap size={15} className="spin" />
                    ) : (
                      <ArrowSquareOut size={15} />
                    )}
                    {creatingForm ? "Creating…" : "Open form builder"}
                  </button>
                  <button className="ev-cancel" onClick={() => setFormModalTab("choose")}>
                    Back
                  </button>
                </div>
                <p className="fm-modal-hint">
                  The form builder opens — add your questions, press Publish, and you come
                  straight back here with the form attached.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <EditorModal onCancel={() => setDeleteConfirm(false)}>
          <div className="ev-modal-icon">
            <Trash size={24} />
          </div>
          <div className="ev-modal-title">Delete event?</div>
          <p className="ev-modal-text">
            “{event.title || "Untitled event"}” will be permanently removed. This action cannot be
            undone.
          </p>
          <div className="ev-modal-actions">
            <button className="ev-modal-cancel" onClick={() => setDeleteConfirm(false)}>
              Cancel
            </button>
            <button className="ev-modal-danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </EditorModal>
      )}

      {/* Discard confirmation */}
      {discardConfirm && (
        <EditorModal onCancel={() => setDiscardConfirm(false)}>
          <div className="ev-modal-icon" style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-deep)" }}>
            <ArrowLeft size={24} />
          </div>
          <div className="ev-modal-title">Discard changes?</div>
          <p className="ev-modal-text">You have unsaved changes. Leaving now will lose them.</p>
          <div className="ev-modal-actions">
            <button className="ev-modal-cancel" onClick={() => setDiscardConfirm(false)}>
              Keep editing
            </button>
            <button
              className="ev-modal-danger"
              onClick={() => router.push("/dashboard/events")}
            >
              Discard
            </button>
          </div>
        </EditorModal>
      )}
    </div>
  );
}
