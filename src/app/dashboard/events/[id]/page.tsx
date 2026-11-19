"use client";

import { useState, useEffect, useCallback, use, useMemo } from "react";
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
  Image as ImageIcon,
  Clock,
  Question,
  UsersThree,
  Star,
} from "@phosphor-icons/react";
import { toast } from "@/components/Toast";
import RichTextEditor from "@/components/RichTextEditor";
import DateEditor from "@/components/DateEditor";
import type { DateEntry } from "@/components/DateEditor";
import ImageFlowModal from "@/components/events/ImageFlowModal";
import { type FormRecord } from "@/lib/forms";
import { deriveDateFields } from "@/lib/eventDates";
import { SITE_URL } from "@/lib/siteUrl";
import s from "./page.module.css";

const AUDIENCE_OPTIONS = ["All", "Brothers", "Sisters", "Youth", "Children"] as const;

const AUDIENCE_COLORS: Record<string, string> = {
  All: "#c8a65d",
  Brothers: "#03894a",
  Sisters: "#9c7e3d",
  Youth: "#026839",
  Children: "#015230",
};

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

interface LinkEntry {
  label: string;
  url: string;
}

interface PersonEntry {
  name: string;
  role: string;
}

interface FaqEntry {
  question: string;
  answer: string;
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
  faq?: FaqEntry[] | null;
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
  faq: [],
  cost: "",
  form_id: null,
  register_url: "",
  full_image: "",
  status: "draft",
};

/* Small labelled card used for every editor section. */
function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={s.card}>
      <div className={s.cardHead}>
        <span className={s.cardIcon}>{icon}</span>
        <span className={s.cardTitle}>{title}</span>
        {hint && <span className={s.cardHint}>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export default function EventEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const isNew = id === "new";

  const [event, setEvent] = useState<Partial<EventData>>({ ...EMPTY_EVENT });
  const [snapshot, setSnapshot] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [initialFile, setInitialFile] = useState<File | null>(null);
  const [slugCheck, setSlugCheck] = useState<{ slug: string; available: boolean } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [newLink, setNewLink] = useState<LinkEntry>({ label: "", url: "" });
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [newPerson, setNewPerson] = useState<PersonEntry>({ name: "", role: "" });
  const [formsList, setFormsList] = useState<FormRecord[]>([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formModalTab, setFormModalTab] = useState<"choose" | "create" | "link">("choose");
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
              faq: data.event.faq || [],
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

  const openImageModal = useCallback((file?: File | null) => {
    setInitialFile(file ?? null);
    setShowImageModal(true);
  }, []);

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

  const addFaq = useCallback(() => {
    update({ faq: [...(event.faq || []), { question: "", answer: "" }] });
  }, [event.faq, update]);

  const updateFaq = useCallback(
    (index: number, patch: Partial<FaqEntry>) => {
      update({
        faq: (event.faq || []).map((f, i) => (i === index ? { ...f, ...patch } : f)),
      });
    },
    [event.faq, update]
  );

  const removeFaq = useCallback(
    (index: number) => {
      update({ faq: (event.faq || []).filter((_, i) => i !== index) });
    },
    [event.faq, update]
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
    setFormModalTab("choose");
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
          faq: (event.faq || []).filter((f) => f.question.trim() || f.answer.trim()),
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
    /* Skeleton shaped like the real editor — bar, cover card, sections and
       rail — so nothing jumps when the event arrives. */
    return (
      <div className={s.skeleton} aria-busy="true" aria-label="Loading event">
        <div className={s.skBar}>
          <span className={s.sk} style={{ width: 38, height: 38, borderRadius: 11 }} />
          <span className={s.sk} style={{ width: 170, height: 15, borderRadius: 7 }} />
        </div>
        <div className={s.layout}>
          <div className={s.main}>
            <div className={`${s.card} ${s.basics}`}>
              <span className={`${s.sk} ${s.skCover}`} />
              <span className={s.sk} style={{ width: "42%", height: 27, borderRadius: 8, marginTop: 20 }} />
              <span className={s.sk} style={{ width: "68%", height: 14, borderRadius: 7, marginTop: 12 }} />
            </div>
            {[0, 1, 2].map((n) => (
              <div className={s.card} key={n}>
                <span className={s.sk} style={{ width: 150, height: 15, borderRadius: 7 }} />
                <span className={s.sk} style={{ width: "100%", height: 58, borderRadius: 10, marginTop: 16 }} />
              </div>
            ))}
          </div>
          <aside className={s.side}>
            {[0, 1, 2].map((n) => (
              <div className={s.card} key={n}>
                <span className={s.sk} style={{ width: "45%", height: 12, borderRadius: 6 }} />
                <span className={s.sk} style={{ width: "100%", height: 36, borderRadius: 10, marginTop: 14 }} />
                <span className={s.sk} style={{ width: "75%", height: 12, borderRadius: 6, marginTop: 12 }} />
              </div>
            ))}
          </aside>
        </div>
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
  const doneCount = checks.filter((c) => c.done).length;

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

  // Completeness ring geometry.
  const RING_R = 18;
  const RING_C = 2 * Math.PI * RING_R;

  return (
    <div>
      {/* Sticky action bar */}
      <div className={s.bar}>
        <button className={s.back} onClick={goBack} aria-label="Back to events">
          <ArrowLeft size={18} />
        </button>
        <div className={s.crumb}>
          <span className={s.crumbTop}>Events</span>
          <h1 className={s.crumbTitle}>
            {isNew ? "New event" : event.title || "Untitled event"}
          </h1>
        </div>
        <span className={`${s.dirty}${dirty ? ` ${s.dirtyOn}` : ""}`}>
          <i /> Unsaved changes
        </span>
        <div className={s.spacer} />
        <div className={s.actions}>
          {!isNew && (
            <button
              className={`${s.btn} ${s.btnGhost} ${s.btnDangerGhost} ${s.btnDelete}`}
              onClick={() => setDeleteConfirm(true)}
            >
              <Trash size={14} /> Delete
            </button>
          )}
          <button
            className={`${s.btn} ${s.btnSecondary}${savedFlash ? ` ${s.savedFlash}` : ""}`}
            onClick={() => handleSave()}
            disabled={saving || !event.title?.trim()}
          >
            {saving ? (
              <SpinnerGap size={14} className={s.spin} />
            ) : savedFlash ? (
              <Check size={14} />
            ) : (
              <FloppyDisk size={14} />
            )}
            {saving ? "Saving…" : savedFlash ? "Saved" : "Save Draft"}
          </button>
          <button
            className={`${s.btn} ${s.btnPrimary}`}
            onClick={() => handleSave("published")}
            disabled={saving || !event.title?.trim()}
          >
            {saving ? <SpinnerGap size={14} className={s.spin} /> : <Eye size={14} />}
            {publishLabel}
          </button>
        </div>
      </div>

      <div className={s.layout}>
        {/* ---------------- Main column ---------------- */}
        <div className={s.main}>
          {/* Cover + title */}
          <section
            className={`${s.card} ${s.basics}`}
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
              if (file) openImageModal(file);
            }}
          >
            <div
              role="button"
              tabIndex={0}
              className={`${s.cover}${dragOver ? ` ${s.coverDrag}` : ""}`}
              onClick={() => openImageModal(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openImageModal(null);
                }
              }}
              aria-label={heroImage ? "Change event picture" : "Add event picture"}
            >
              {heroImage ? (
                <>
                  <img src={heroImage} alt="" className={s.coverImg} />
                  <div className={s.coverShade}>
                    <span className={s.glassBtn}>
                      <UploadSimple size={14} /> Change picture
                    </span>
                    <button
                      className={`${s.glassBtn} ${s.glassDanger}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        update({ cover_image: "", full_image: "" });
                      }}
                    >
                      <X size={14} /> Remove
                    </button>
                  </div>
                </>
              ) : (
                <div className={s.coverEmpty}>
                  <span className={s.coverEmptyIcon}>
                    <ImageIcon size={24} weight="duotone" />
                  </span>
                  <span className={s.coverEmptyTitle}>Add a cover picture</span>
                  <span className={s.coverEmptySub}>
                    Tap to upload or drag &amp; drop — AI converts it to 16:9 landscape
                  </span>
                </div>
              )}
            </div>

            <input
              className={s.titleInput}
              value={event.title || ""}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Event title"
              aria-label="Event title"
            />
            <textarea
              className={s.summaryInput}
              rows={2}
              value={event.description || ""}
              onChange={(e) => update({ description: e.target.value.slice(0, 200) })}
              placeholder="One-line summary shown on event cards and listings…"
              aria-label="Event summary"
            />

            <div className={s.audWrap}>
              <span className={s.audLabel}>Who is this for?</span>
              {AUDIENCE_OPTIONS.map((a) => {
                const active = (event.audience || []).includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={active}
                    className={`${s.pill}${active ? ` ${s.pillOn}` : ""}`}
                    onClick={() => toggleAudience(a)}
                  >
                    <i style={{ background: AUDIENCE_COLORS[a] || "#4ade80" }} />
                    {a}
                  </button>
                );
              })}
            </div>

            <div className={s.metaRow}>
              <span
                className={`badge${event.status === "published" ? "" : " badge--muted"}`}
              >
                {event.status === "published" ? "Published" : "Draft"}
              </span>
              <span className={s.metaDot} />
              <CalendarDots size={14} />
              <span>{displayDate || "No date set yet"}</span>
              {untilPhrase && (
                <>
                  <span className={s.metaDot} />
                  <span>
                    {untilPhrase === "Today" ? "Today" : `In ${untilPhrase}`}
                  </span>
                </>
              )}
              {(event.description || "").length >= 120 && (
                <span className={s.metaCount}>
                  {(event.description || "").length} / 200
                </span>
              )}
            </div>
          </section>

          {/* About */}
          <Section icon={<NotePencil size={17} weight="duotone" />} title="About the event">
            <RichTextEditor
              value={event.content_html || ""}
              onChange={(html) => update({ content_html: html })}
              placeholder="Write about this event..."
            />
          </Section>

          {/* Dates */}
          <Section
            icon={<Clock size={17} weight="duotone" />}
            title="Dates & Times"
            hint={`${(event.dates_json || []).length} date${
              (event.dates_json || []).length === 1 ? "" : "s"
            }`}
          >
            <DateEditor
              dates={event.dates_json || []}
              onChange={(dates) =>
                update({ ...deriveDateFields(dates), dates_json: dates })
              }
            />
          </Section>

          {/* Location */}
          <Section icon={<MapPin size={17} weight="duotone" />} title="Location">
            <input
              className={s.input}
              value={event.location || ""}
              onChange={(e) => update({ location: e.target.value })}
              placeholder="Masjid As Sunnah, Lakemba"
              aria-label="Event location"
            />
            {event.location && (
              <div className={s.map}>
                <iframe
                  src={`https://www.google.com/maps?q=${encodeURIComponent(event.location)}&output=embed`}
                  title="Event location map"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
          </Section>

          {/* FAQ */}
          <Section
            icon={<Question size={17} weight="duotone" />}
            title="FAQ"
            hint="Optional"
          >
            <div className={s.stack}>
              {(event.faq || []).map((f, i) => (
                <div key={i} className={s.faqItem}>
                  <div className={s.faqTop}>
                    <input
                      className={s.input}
                      value={f.question}
                      onChange={(e) => updateFaq(i, { question: e.target.value })}
                      placeholder="Question (e.g. Do I need to bring anything?)"
                      aria-label="FAQ question"
                    />
                    <button
                      className={s.rowX}
                      onClick={() => removeFaq(i)}
                      aria-label="Remove question"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <textarea
                    className={`${s.input} ${s.textarea}`}
                    value={f.answer}
                    onChange={(e) => updateFaq(i, { answer: e.target.value })}
                    placeholder="Answer"
                    aria-label="FAQ answer"
                  />
                </div>
              ))}
              <button className={s.addBtn} onClick={addFaq}>
                <Plus size={15} /> Add question
              </button>
              {(event.faq || []).length === 0 && (
                <p className={s.empty}>
                  Answers show as an FAQ list on the public event page.
                </p>
              )}
            </div>
          </Section>

          {/* Links & people */}
          <Section
            icon={<UsersThree size={17} weight="duotone" />}
            title="Links & people"
          >
            <div className={s.stack}>
              {(event.links || []).map((link, i) => (
                <div className={s.row} key={`${link.url}-${i}`}>
                  <LinkIcon size={15} className={s.rowIcon} />
                  <div className={s.rowMain}>
                    <div className={s.rowTitle}>{link.label || link.url}</div>
                    {link.label && <div className={s.rowSub}>{link.url}</div>}
                  </div>
                  <button
                    className={s.rowX}
                    onClick={() => removeLink(i)}
                    aria-label="Remove link"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {(event.persons || []).map((p, i) => (
                <div className={s.row} key={`${p.name}-${i}`}>
                  <User size={15} className={s.rowIcon} />
                  <div className={s.rowMain}>
                    <div className={s.rowTitle}>{p.name}</div>
                    {p.role && <div className={s.rowSub}>{p.role}</div>}
                  </div>
                  <button
                    className={s.rowX}
                    onClick={() => removePerson(i)}
                    aria-label="Remove person"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}

              {showLinkForm && (
                <div className={s.miniForm}>
                  <input
                    className={s.input}
                    value={newLink.label}
                    onChange={(e) => setNewLink((l) => ({ ...l, label: e.target.value }))}
                    placeholder="Label (e.g. Register)"
                    aria-label="Link label"
                  />
                  <input
                    className={s.input}
                    value={newLink.url}
                    onChange={(e) => setNewLink((l) => ({ ...l, url: e.target.value }))}
                    placeholder="https://..."
                    onKeyDown={(e) => e.key === "Enter" && addLink()}
                    aria-label="Link URL"
                  />
                  <div className={s.miniActions}>
                    <button className={s.miniAdd} onClick={addLink} disabled={!newLink.url.trim()}>
                      Add link
                    </button>
                    <button
                      className={s.miniCancel}
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

              {showPersonForm && (
                <div className={s.miniForm}>
                  <input
                    className={s.input}
                    value={newPerson.name}
                    onChange={(e) => setNewPerson((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Name"
                    aria-label="Person name"
                  />
                  <input
                    className={s.input}
                    value={newPerson.role}
                    onChange={(e) => setNewPerson((p) => ({ ...p, role: e.target.value }))}
                    placeholder="Role (e.g. Speaker)"
                    onKeyDown={(e) => e.key === "Enter" && addPerson()}
                    aria-label="Person role"
                  />
                  <div className={s.miniActions}>
                    <button className={s.miniAdd} onClick={addPerson} disabled={!newPerson.name.trim()}>
                      Add person
                    </button>
                    <button
                      className={s.miniCancel}
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

              {(!showLinkForm || !showPersonForm) && (
                <div className={s.addRow}>
                  {!showLinkForm && (
                    <button
                      className={s.addBtn}
                      onClick={() => setShowLinkForm(true)}
                    >
                      <LinkIcon size={15} /> Add link
                    </button>
                  )}
                  {!showPersonForm && (
                    <button
                      className={s.addBtn}
                      onClick={() => setShowPersonForm(true)}
                    >
                      <User size={15} /> Add person
                    </button>
                  )}
                </div>
              )}

              {(event.links || []).length === 0 &&
                (event.persons || []).length === 0 &&
                !showLinkForm &&
                !showPersonForm && (
                  <p className={s.empty}>No links or people added yet.</p>
                )}
            </div>
          </Section>
        </div>

        {/* ---------------- Sidebar ---------------- */}
        <aside className={s.side}>
          {/* Publish / status */}
          <div className={`${s.card} ${s.cardDark}`}>
            <div className={s.sideRow}>
              <span className={s.sideLabel}>Status</span>
              <div className={s.seg} role="group" aria-label="Event status">
                {(["draft", "published"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    aria-pressed={event.status === st}
                    onClick={() => update({ status: st })}
                    className={`${s.segBtn}${
                      event.status === st
                        ? st === "published"
                          ? ` ${s.segOnPub}`
                          : ` ${s.segOn}`
                        : ""
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className={s.divider} />

            <div className={s.sideRow}>
              <span className={s.sideLabel}>URL slug</span>
              <div className={s.slugRow}>
                <span className={s.slugPrefix}>/events/</span>
                <input
                  className={s.slugInput}
                  value={event.slug || ""}
                  onChange={(e) =>
                    update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
                  }
                  placeholder="event-url"
                  aria-label="Event URL slug"
                />
              </div>
              <div
                className={`${s.slugState}${
                  checkingSlug ? "" : slugAvailable ? ` ${s.slugOk}` : ` ${s.slugBad}`
                }`}
              >
                {checkingSlug ? (
                  <>
                    <SpinnerGap size={12} className={s.spin} /> Checking availability…
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
              {!isNew && event.slug && (
                <a
                  className={s.viewLink}
                  href={`${SITE_URL}/events/${event.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Eye size={14} /> View on website
                </a>
              )}
            </div>
          </div>

          {/* Details + registration */}
          <div className={`${s.card} ${s.cardDark}`}>
            <div className={s.nextDateVal}>{displayDate || "No date set"}</div>
            <div className={s.nextDateSub}>
              {untilPhrase
                ? untilPhrase === "Today"
                  ? "Happening today"
                  : `Starts in ${untilPhrase}`
                : "Add a date to see the countdown"}
            </div>

            <div className={s.divider} />

            <div className={s.sideMeta}>
              <MapPin size={15} weight="duotone" className={s.sideMetaIcon} />
              {event.location || "No location set"}
            </div>

            <div className={s.divider} />

            <div className={s.sideRow}>
              <span className={s.sideLabel}>Cost</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CurrencyDollar
                  size={16}
                  style={{ color: "rgb(255 255 255 / 0.55)", flex: "none" }}
                />
                <input
                  className={`${s.input} ${s.inputDark}`}
                  value={event.cost || ""}
                  onChange={(e) => update({ cost: e.target.value })}
                  placeholder="Free"
                  aria-label="Event cost"
                />
              </div>
            </div>

            <div className={s.divider} />

            <div className={s.sideRow}>
              <span className={s.sideLabel}>Registration</span>
              {event.form_id ? (
                <div className={s.regChip}>
                  <div className={s.regMain}>
                    <div className={s.regTitle}>
                      {attachedForm ? attachedForm.title : "Attached form"}
                    </div>
                    <div className={s.regSub}>
                      {attachedForm
                        ? `${attachedForm.status === "published" ? "Live" : "Draft"} · ${
                            attachedForm.fields?.length || 0
                          } questions`
                        : "Form may have been deleted"}
                    </div>
                  </div>
                  <div className={s.regActions}>
                    {attachedForm && (
                      <>
                        <a
                          className={s.chipBtn}
                          href={`/dashboard/register/${attachedForm.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in builder"
                        >
                          <ArrowSquareOut size={14} />
                        </a>
                        <a
                          className={s.chipBtn}
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
                      className={`${s.chipBtn} ${s.chipBtnDanger}`}
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
                <div className={s.regChip}>
                  <div className={s.regMain}>
                    <div className={s.regTitle}>External registration</div>
                    <div className={s.regSub}>{event.register_url}</div>
                  </div>
                  <div className={s.regActions}>
                    <a
                      className={s.chipBtn}
                      href={event.register_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open link"
                    >
                      <ArrowSquareOut size={14} />
                    </a>
                    <button
                      className={`${s.chipBtn} ${s.chipBtnDanger}`}
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
                <p className={s.hint} style={{ textAlign: "left" }}>
                  Attach a built-in form or link to an external one so people can sign up.
                </p>
              )}
              <button className={s.addBtn} onClick={openFormModal}>
                <Plus size={15} />{" "}
                {event.form_id || event.register_url ? "Change" : "Add registration"}
              </button>
            </div>
          </div>

          {/* Completeness */}
          <div className={`${s.card} ${s.cardDark}`}>
            <div className={s.checksHead}>
              <span className={s.checksLabel}>Completeness</span>
              <div className={s.ringWrap}>
                <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
                  <circle
                    cx="23"
                    cy="23"
                    r={RING_R}
                    fill="none"
                    stroke="rgb(255 255 255 / 0.12)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="23"
                    cy="23"
                    r={RING_R}
                    fill="none"
                    stroke="var(--color-gold)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={RING_C}
                    strokeDashoffset={RING_C * (1 - pct / 100)}
                    transform="rotate(-90 23 23)"
                    style={{ transition: "stroke-dashoffset 0.4s ease" }}
                  />
                </svg>
                <span className={s.ringNum}>{pct}%</span>
              </div>
            </div>
            <div className={s.checkGrid}>
              {checks.map((c) => (
                <span key={c.label} className={`${s.check}${c.done ? ` ${s.checkOn}` : ""}`}>
                  <i>{c.done ? <Check size={9} weight="bold" /> : null}</i>
                  {c.label}
                </span>
              ))}
            </div>
            <div className={s.divider} />
            <div className={s.hint}>
              {doneCount} of {checks.length} complete · Ctrl / ⌘ + S to save
            </div>
          </div>
        </aside>
      </div>

      {/* Image flow modal */}
      {showImageModal && (
        <ImageFlowModal
          open={showImageModal}
          initialFile={initialFile}
          onClose={() => {
            setShowImageModal(false);
            setInitialFile(null);
          }}
          onDone={(url) => update({ cover_image: url, full_image: url })}
        />
      )}

      {/* Add / change registration form */}
      {showFormModal && (
        <div className={s.overlay} onClick={() => setShowFormModal(false)}>
          <div className={`${s.modal} ${s.modalWide}`} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHead}>
              <div>
                <div className={s.modalEyebrow}>Registration</div>
                <div className={s.modalHeading}>
                  {event.form_id || event.register_url ? "Change registration" : "Add registration"}
                </div>
              </div>
              <button className={s.rowX} onClick={() => setShowFormModal(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className={s.modalTabs}>
              <button
                className={`${s.modalTab}${formModalTab === "choose" ? ` ${s.modalTabOn}` : ""}`}
                onClick={() => setFormModalTab("choose")}
              >
                Built-in form
              </button>
              <button
                className={`${s.modalTab}${formModalTab === "create" ? ` ${s.modalTabOn}` : ""}`}
                onClick={() => setFormModalTab("create")}
              >
                Create new
              </button>
              <button
                className={`${s.modalTab}${formModalTab === "link" ? ` ${s.modalTabOn}` : ""}`}
                onClick={() => setFormModalTab("link")}
              >
                External link
              </button>
            </div>

            {formModalTab === "choose" && (
              <>
                <div className={s.searchRow}>
                  <MagnifyingGlass size={15} />
                  <input
                    className={s.searchInput}
                    value={formSearch}
                    onChange={(e) => setFormSearch(e.target.value)}
                    placeholder="Search your forms…"
                    aria-label="Search forms"
                  />
                </div>
                <div className={s.pickList}>
                  {filteredForms.length === 0 ? (
                    <p className={s.empty}>
                      {formsList.length === 0
                        ? "You have no forms yet — create one in the “Create new” tab."
                        : "No forms match that search."}
                    </p>
                  ) : (
                    filteredForms.map((f) => (
                      <button
                        key={f.id}
                        className={`${s.pick}${pickedFormId === f.id ? ` ${s.pickOn}` : ""}`}
                        onClick={() => setPickedFormId(f.id)}
                      >
                        <span className={s.radio} />
                        <span className={s.pickMain}>
                          <span className={s.pickTitle}>{f.title}</span>
                          <span className={s.pickSub}>
                            {f.fields?.length || 0} question
                            {f.fields?.length === 1 ? "" : "s"} · {f.status}
                          </span>
                        </span>
                        <span className={s.pickCount}>{f.response_count || 0} resp.</span>
                      </button>
                    ))
                  )}
                </div>
                <div className={s.modalRowActions}>
                  <button
                    className={`${s.btn} ${s.btnPrimary}`}
                    onClick={attachPickedForm}
                    disabled={!pickedFormId}
                  >
                    <Check size={15} /> Attach form
                  </button>
                  <button className={s.modalCancel} onClick={() => setFormModalTab("create")}>
                    <Plus size={14} /> New form instead
                  </button>
                  <button className={s.modalCancel} onClick={() => setFormModalTab("link")}>
                    <LinkSimple size={14} /> External link
                  </button>
                </div>
              </>
            )}

            {formModalTab === "link" && (
              <>
                <div className={s.field}>
                  <label className={s.label} htmlFor="ext-url">
                    Registration link
                  </label>
                  <input
                    id="ext-url"
                    className={s.input}
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://"
                    autoFocus
                  />
                </div>
                <div className={s.modalRowActions}>
                  <button className={`${s.btn} ${s.btnPrimary}`} onClick={saveExternalUrl}>
                    <Check size={15} /> Save link
                  </button>
                  <button className={s.modalCancel} onClick={() => setFormModalTab("choose")}>
                    Back
                  </button>
                </div>
                <p className={s.modalHint}>
                  The Register now button on the website opens this link in a new tab.
                </p>
              </>
            )}

            {formModalTab === "create" && (
              <>
                <div className={s.field}>
                  <label className={s.label} htmlFor="new-form-title">
                    Form title
                  </label>
                  <input
                    id="new-form-title"
                    className={s.input}
                    value={newFormTitle}
                    onChange={(e) => setNewFormTitle(e.target.value)}
                    placeholder="Register — Event name"
                  />
                </div>
                <div className={s.modalRowActions}>
                  <button
                    className={`${s.btn} ${s.btnPrimary}`}
                    onClick={openBuilderForNewForm}
                    disabled={creatingForm}
                  >
                    {creatingForm ? (
                      <SpinnerGap size={15} className={s.spin} />
                    ) : (
                      <ArrowSquareOut size={15} />
                    )}
                    {creatingForm ? "Creating…" : "Open form builder"}
                  </button>
                  <button className={s.modalCancel} onClick={() => setFormModalTab("choose")}>
                    Back
                  </button>
                </div>
                <p className={s.modalHint}>
                  The form builder opens — add your questions, press Publish, and you come
                  straight back here with the form attached.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className={s.overlay} onClick={() => setDeleteConfirm(false)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalIcon}>
              <Trash size={24} />
            </div>
            <div className={s.modalTitle}>Delete event?</div>
            <p className={s.modalText}>
              “{event.title || "Untitled event"}” will be permanently removed. This action cannot
              be undone.
            </p>
            <div className={s.modalActions}>
              <button className={s.modalCancel} onClick={() => setDeleteConfirm(false)}>
                Cancel
              </button>
              <button className={s.modalDanger} onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard confirmation */}
      {discardConfirm && (
        <div className={s.overlay} onClick={() => setDiscardConfirm(false)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={`${s.modalIcon} ${s.modalIconGold}`}>
              <Star size={24} />
            </div>
            <div className={s.modalTitle}>Discard changes?</div>
            <p className={s.modalText}>You have unsaved changes. Leaving now will lose them.</p>
            <div className={s.modalActions}>
              <button className={s.modalCancel} onClick={() => setDiscardConfirm(false)}>
                Keep editing
              </button>
              <button
                className={s.modalDanger}
                onClick={() => router.push("/dashboard/events")}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
