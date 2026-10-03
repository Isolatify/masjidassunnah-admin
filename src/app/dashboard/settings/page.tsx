"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/Toast";
import { SECTIONS, DEFAULT_SETTINGS, mergeSettings, getPath, setPath, type FieldDef } from "@/lib/settings";

type SettingsState = Record<string, Record<string, unknown>>;

const ICONS: Record<string, React.ReactNode> = {
  building: <path d="M3 21h18M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16M9 7h2M13 7h2M9 11h2M13 11h2M9 15h6v6H9z" />,
  palette: <path d="M12 22a10 10 0 110-20 8 8 0 018 8 4 4 0 01-4 4h-2a2 2 0 00-1.5 3.3A2 2 0 0112 22z M7.5 10.5h.01 M9.5 7h.01 M14 6.5h.01 M16.5 9.5h.01" />,
  calendar: <path d="M3 4h18v18H3zM16 2v4M8 2v4M3 10h18" />,
  form: <path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zM8 8h8M8 12h8M8 16h5" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" />,
  share: <path d="M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />,
  search: <path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3" />,
  bell: <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  users: <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />,
  user: <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8" />,
  logout: <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />,
  mail: <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6" />,
  chevron: <path d="M9 18l6-6-6-6" />,
  back: <path d="M15 18l-6-6 6-6" />,
  check: <path d="M20 6L9 17l-5-5" />,
  download: <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  refresh: <path d="M3 12a9 9 0 019-9 9 9 0 016.7 3M21 12a9 9 0 01-9 9 9 9 0 01-6.7-3M21 3v6h-6M3 21v-6h6" />,
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
      {ICONS[name] ?? ICONS.sliders}
    </svg>
  );
}

/* ── Field controls ──────────────────────────────────────────── */

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`oui-switch ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="oui-knob" />
    </button>
  );
}

function Field({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const id = `f-${field.key.replace(/\./g, "-")}`;

  if (field.type === "toggle") {
    return (
      <div className="oui-field">
        <div className="oui-field-text">
          <label htmlFor={id}>{field.label}</label>
          {field.hint && <p>{field.hint}</p>}
        </div>
        <Toggle checked={Boolean(value)} onChange={onChange} label={field.label} />
      </div>
    );
  }

  return (
    <div className="oui-field block">
      <label htmlFor={id}>{field.label}</label>
      {field.hint && <p className="oui-hint">{field.hint}</p>}
      {field.type === "textarea" ? (
        <textarea id={id} rows={3} className="oui-input" value={String(value ?? "")} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "select" ? (
        <div className="oui-select-wrap">
          <select id={id} className="oui-input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
        </div>
      ) : field.type === "color" ? (
        <div className="oui-color">
          <input id={id} type="color" className="oui-color-swatch" value={String(value ?? "#0f4a36")} onChange={(e) => onChange(e.target.value)} />
          <input className="oui-input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} aria-label={`${field.label} hex`} />
        </div>
      ) : (
        <input
          id={id}
          type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
          className="oui-input"
          value={value === undefined || value === null ? "" : String(value)}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
        />
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS as unknown as SettingsState);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      if (cancelled) return;
      setEmail(data.user.email ?? "");
      setNewEmail(data.user.email ?? "");
      setUserId(data.user.id);
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.success) {
          const merged = mergeSettings(DEFAULT_SETTINGS, json.settings) as unknown as SettingsState;
          setSettings(merged);
          const appearance = (merged.appearance ?? {}) as Record<string, unknown>;
          for (const k of ["theme", "accent", "density", "motion", "pattern", "fontScale"]) {
            if (appearance[k] !== undefined) applyAppearance(`appearance.${k}`, appearance[k], merged);
          }
        }
      } catch {
        /* offline → defaults stay */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // One UI signature: big title collapses into a compact sticky bar on scroll.
  useEffect(() => {
    const el = scrollRef.current;
    const onScroll = () => {
      const top = el && el.scrollTop > 0 ? el.scrollTop : window.scrollY;
      setCollapsed(top > 42);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    el?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      el?.removeEventListener("scroll", onScroll);
    };
  }, []);

  const persist = useCallback(async (next: SettingsState) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: next }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Save failed");
      setDirty(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings");
      setDirty(true);
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(
    (path: string, value: unknown) => {
      const next = setPath(settings, path, value) as SettingsState;
      setSettings(next);
      setDirty(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void persist(next), 700);
      applyAppearance(path, value, settings);
    },
    [persist, settings]
  );

  const saveNow = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void persist(settings);
    toast.success("Settings saved");
  }, [persist, settings]);

  async function updateEmail() {
    if (!newEmail || newEmail === email) return;
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) toast.error(error.message);
    else toast.success("Confirmation email sent. Check your inbox.");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.info("Signed out successfully");
    router.push("/login");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.subtitle.toLowerCase().includes(q) ||
        s.fields.some((f) => f.label.toLowerCase().includes(q))
    );
  }, [query]);

  const active = useMemo(() => SECTIONS.find((s) => s.id === openSection) ?? null, [openSection]);

  if (loading) {
    return (
      <div className="oui-loading">
        <div className="spinner" />
        <p>Loading settings…</p>
      </div>
    );
  }

  /* ── Detail view ── */
  if (active) {
    return (
      <div className="oui-detail" key={active.id}>
        <header className={`oui-detail-bar ${collapsed ? "stuck" : ""}`}>
          <button className="oui-back" onClick={() => setOpenSection(null)} aria-label="Back to settings">
            <Icon name="back" size={22} />
          </button>
          <div>
            <span className="oui-detail-eyebrow">Settings</span>
            <h2>{active.title}</h2>
          </div>
          <button className={`oui-save ${dirty ? "active" : ""}`} disabled={!dirty && !saving} onClick={saveNow}>
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        </header>

        <div className="oui-group">
          {active.fields.map((f) => (
            <Field key={f.key} field={f} value={getPath(settings, f.key)} onChange={(v) => update(f.key, v)} />
          ))}
        </div>

        <p className="oui-footnote">Changes save automatically. You can also press Save in the header.</p>
      </div>
    );
  }

  /* ── Main list ── */
  return (
    <div className="oui" ref={scrollRef}>
      <header className={`oui-hero ${collapsed ? "stuck" : ""}`}>
        <div className="oui-hero-inner">
          <div>
            <span className="oui-eyebrow">Masjid As Sunnah</span>
            <h1>Settings</h1>
          </div>
          <div className="oui-hero-actions">
            <span className={`oui-status ${saving ? "busy" : dirty ? "dirty" : ""}`}>
              {saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}
            </span>
            <button className="oui-icon-btn" onClick={() => window.location.reload()} aria-label="Reload settings">
              <Icon name="refresh" size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="oui-body">
        <div className="oui-search">
          <Icon name="search" size={18} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search settings" aria-label="Search settings" />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search">
              ×
            </button>
          )}
        </div>

        {/* Profile card */}
        <button className="oui-profile" onClick={() => setOpenSection("__account")}>
          <span className="oui-avatar">{email ? email.charAt(0).toUpperCase() : "?"}</span>
          <span className="oui-profile-text">
            <strong>{email || "Not signed in"}</strong>
            <em>Account, password and sign out</em>
          </span>
          <Icon name="chevron" size={18} />
        </button>

        {/* Managers shortcut */}
        <button className="oui-profile alt" onClick={() => setOpenSection("__managers")}>
          <span className="oui-avatar square">
            <Icon name="users" size={20} />
          </span>
          <span className="oui-profile-text">
            <strong>Managers</strong>
            <em>Invite people and set Hide / Read / Write access</em>
          </span>
          <Icon name="chevron" size={18} />
        </button>

        {filtered.map((s) => (
          <section key={s.id} className="oui-card">
            <button className="oui-card-head" onClick={() => setOpenSection(s.id)}>
              <span className="oui-card-icon">
                <Icon name={s.icon} size={19} />
              </span>
              <span className="oui-card-text">
                <strong>{s.title}</strong>
                <em>{s.subtitle}</em>
              </span>
              <span className="oui-card-count">{s.fields.length}</span>
              <Icon name="chevron" size={18} />
            </button>
          </section>
        ))}

        {!filtered.length && <p className="oui-empty">No settings match “{query}”.</p>}

        <div className="oui-card">
          <button className="oui-card-head danger" onClick={handleLogout}>
            <span className="oui-card-icon">
              <Icon name="logout" size={19} />
            </span>
            <span className="oui-card-text">
              <strong>Sign out</strong>
              <em>End this session on this device</em>
            </span>
          </button>
        </div>

        <p className="oui-version">Admin Panel · Masjid As Sunnah · v1.0</p>
      </div>

      {openSection === "__account" && (
        <AccountSheet
          email={email}
          newEmail={newEmail}
          setNewEmail={setNewEmail}
          userId={userId}
          onUpdateEmail={updateEmail}
          onLogout={handleLogout}
          onClose={() => setOpenSection(null)}
        />
      )}

      {openSection === "__managers" && <ManagersSheet onClose={() => setOpenSection(null)} />}
    </div>
  );
}

/* ── Account sheet ───────────────────────────────────────────── */

function AccountSheet({
  email,
  newEmail,
  setNewEmail,
  userId,
  onUpdateEmail,
  onLogout,
  onClose,
}: {
  email: string;
  newEmail: string;
  setNewEmail: (v: string) => void;
  userId: string;
  onUpdateEmail: () => void;
  onLogout: () => void;
  onClose: () => void;
}) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function changePassword() {
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== pw2) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPw("");
    setPw2("");
    toast.success("Password updated");
  }

  return (
    <div className="oui-sheet" role="dialog" aria-modal="true" aria-label="Account">
      <div className="oui-sheet-panel">
        <header className="oui-detail-bar stuck">
          <button className="oui-back" onClick={onClose} aria-label="Close">
            <Icon name="back" size={22} />
          </button>
          <div>
            <span className="oui-detail-eyebrow">Settings</span>
            <h2>Account</h2>
          </div>
        </header>

        <div className="oui-group">
          <div className="oui-field block">
            <label htmlFor="acc-email">Email address</label>
            <div className="oui-inline">
              <input id="acc-email" className="oui-input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <button className="btn-primary sm" onClick={onUpdateEmail}>
                Update
              </button>
            </div>
          </div>
          <div className="oui-field block">
            <label htmlFor="acc-pw">New password</label>
            <input id="acc-pw" type="password" className="oui-input" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <div className="oui-field block">
            <label htmlFor="acc-pw2">Confirm password</label>
            <input id="acc-pw2" type="password" className="oui-input" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          <button className="oui-row-btn" onClick={changePassword} disabled={busy}>
            <Icon name="check" size={18} />
            {busy ? "Updating…" : "Change password"}
          </button>
        </div>

        <div className="oui-group">
          <div className="oui-meta-row">
            <span>User ID</span>
            <code>{userId || "—"}</code>
          </div>
          <div className="oui-meta-row">
            <span>Signed in as</span>
            <code>{email}</code>
          </div>
        </div>

        <button className="oui-row-btn danger" onClick={onLogout}>
          <Icon name="logout" size={18} />
          Sign out
        </button>
      </div>
    </div>
  );
}

/* ── Managers sheet ──────────────────────────────────────────── */

type Access = "hide" | "read" | "write";
type ManagerRow = {
  id: string;
  email: string;
  role: string;
  perms: Record<string, Access>;
  invited: boolean;
  lastSignIn: string | null;
  createdAt: string;
};

const COMPONENT_LABELS: Record<string, string> = {
  overview: "Overview",
  events: "Events",
  register: "Register",
  settings: "Settings",
};

function ManagersSheet({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<ManagerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkBox, setLinkBox] = useState<{ link: string; note: string } | null>(null);
  const [draftPerms, setDraftPerms] = useState<Record<string, Access>>({
    overview: "read",
    events: "read",
    register: "hide",
    settings: "hide",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/managers", { cache: "no-store" });
      const json = await res.json();
      if (json.success) setRows(json.managers);
      else toast.error(json.error || "Failed to load managers");
    } catch {
      toast.error("Failed to load managers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch("/api/managers", { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (json.success) setRows(json.managers);
        else toast.error(json.error || "Failed to load managers");
      } catch {
        if (!cancelled) toast.error("Failed to load managers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function invite() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), perms: draftPerms, action: "invite" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Invite failed");
      toast.success(json.message || (json.existed ? "Existing account given manager access" : "Invitation sent"));
      if (json.inviteLink) setLinkBox({ link: json.inviteLink, note: json.message || "Invite link" });
      setEmail("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function resend(row: ManagerRow) {
    setBusy(true);
    try {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: row.email, perms: row.perms, action: "resend" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Could not resend");
      toast.success(json.message || "Invitation resent");
      if (json.inviteLink) setLinkBox({ link: json.inviteLink, note: json.message || "Invite link" });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not resend");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy — select the link and copy manually");
    }
  }

  async function setPerm(id: string, component: string, access: Access) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, perms: { ...r.perms, [component]: access } } : r)));
    const res = await fetch("/api/managers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, perms: { [component]: access } }),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error || "Could not update access");
      void load();
    }
  }

  async function remove(id: string, who: string) {
    if (!window.confirm(`Remove ${who}? Their account will be deleted and they will lose access immediately.`)) return;
    const res = await fetch(`/api/managers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.success) return toast.error(json.error || "Could not remove");
    toast.success("Account deleted");
    void load();
  }

  const components = ["overview", "events", "register", "settings"];

  return (
    <div className="oui-sheet" role="dialog" aria-modal="true" aria-label="Managers">
      <div className="oui-sheet-panel">
        <header className="oui-detail-bar stuck">
          <button className="oui-back" onClick={onClose} aria-label="Close">
            <Icon name="back" size={22} />
          </button>
          <div>
            <span className="oui-detail-eyebrow">Settings</span>
            <h2>Managers</h2>
          </div>
          <button className="oui-save" onClick={() => void load()}>
            Refresh
          </button>
        </header>

        {linkBox && (
          <div className="oui-group invite-link">
            <div className="oui-field block">
              <label>Invite link</label>
              <p className="oui-hint">{linkBox.note} — send this directly if the email never arrives.</p>
              <div className="oui-inline">
                <input className="oui-input" readOnly value={linkBox.link} onFocus={(e) => e.currentTarget.select()} />
                <button className="btn-primary sm" onClick={() => void copyLink(linkBox.link)}>
                  Copy
                </button>
              </div>
            </div>
            <button className="oui-remove" onClick={() => setLinkBox(null)}>
              Dismiss
            </button>
          </div>
        )}

        <div className="oui-group invite">
          <div className="oui-field block">
            <label htmlFor="mgr-email">Invite by email</label>
            <p className="oui-hint">Supabase sends them a link to set their password. They then sign in at /login.</p>
            <div className="oui-inline">
              <input id="mgr-email" type="email" className="oui-input" value={email} placeholder="name@example.com" onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void invite()} />
              <button className="btn-primary sm" onClick={() => void invite()} disabled={busy}>
                {busy ? "Sending…" : "Invite"}
              </button>
            </div>
          </div>

          <div className="oui-perm-editor">
            <span className="oui-perm-title">New manager’s access</span>
            {components.map((c) => (
              <div className="oui-field" key={c}>
                <div className="oui-field-text">
                  <label>{COMPONENT_LABELS[c]}</label>
                </div>
                <div className="oui-seg" role="radiogroup" aria-label={`${COMPONENT_LABELS[c]} access`}>
                  {(["hide", "read", "write"] as Access[]).map((a) => (
                    <button
                      key={a}
                      role="radio"
                      aria-checked={draftPerms[c] === a}
                      className={draftPerms[c] === a ? "on" : ""}
                      onClick={() => setDraftPerms((p) => ({ ...p, [c]: a }))}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="oui-loading sm">
            <div className="spinner" />
          </div>
        ) : rows.length === 0 ? (
          <p className="oui-empty">No accounts yet.</p>
        ) : (
          rows.map((r) => (
            <section className="oui-card" key={r.id}>
              <div className="oui-mgr-head">
                <span className="oui-avatar square">
                  <Icon name="user" size={18} />
                </span>
                <span className="oui-profile-text">
                  <strong>{r.email}</strong>
                  <em>
                    {r.role === "admin" ? "Owner — full access" : r.invited ? "Invitation pending — has not signed in" : `Last seen ${r.lastSignIn ? new Date(r.lastSignIn).toLocaleDateString() : "never"}`}
                  </em>
                </span>
                {r.role === "admin" ? (
                  <span className="oui-badge">Admin</span>
                ) : (
                  <span className="oui-mgr-actions">
                    {r.invited && (
                      <button className="oui-remove ghost" disabled={busy} onClick={() => void resend(r)}>
                        Resend
                      </button>
                    )}
                    <button className="oui-remove" disabled={busy} onClick={() => void remove(r.id, r.email)}>
                      Delete
                    </button>
                  </span>
                )}
              </div>

              {r.role !== "admin" &&
                components.map((c) => (
                  <div className="oui-field mgr" key={c}>
                    <div className="oui-field-text">
                      <label>{COMPONENT_LABELS[c]}</label>
                    </div>
                    <div className="oui-seg" role="radiogroup" aria-label={`${r.email} — ${COMPONENT_LABELS[c]}`}>
                      {(["hide", "read", "write"] as Access[]).map((a) => (
                        <button
                          key={a}
                          role="radio"
                          aria-checked={r.perms[c] === a}
                          className={r.perms[c] === a ? "on" : ""}
                          onClick={() => void setPerm(r.id, c, a)}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </section>
          ))
        )}

        <p className="oui-footnote">
          <strong>Hide</strong> removes it from their sidebar · <strong>Read</strong> opens pages without editing · <strong>Write</strong> is full control.
        </p>
      </div>
    </div>
  );
}

/* ── Apply appearance instantly (theme / density / motion / scale) ── */

function applyAppearance(path: string, value: unknown, settings: SettingsState) {
  if (!path.startsWith("appearance.")) return;
  const root = document.documentElement;
  const key = path.split(".")[1];

  if (key === "theme") {
    const mode = value === "auto" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : String(value);
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
  } else if (key === "accent") {
    const v = String(value);
    root.style.setProperty("--color-primary", v);
    root.style.setProperty("--accent", v);
  } else if (key === "density") {
    root.dataset.density = String(value);
  } else if (key === "motion") {
    root.dataset.motion = String(value);
  } else if (key === "pattern") {
    root.dataset.pattern = String(value);
  } else if (key === "fontScale") {
    const n = Number(value);
    if (Number.isFinite(n)) root.style.fontSize = `${n}%`;
  }
  // Reflect in the loaded state too (first paint after load).
  void settings;
}
