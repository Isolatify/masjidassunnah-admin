"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccess } from "@/lib/access";
import { useSiteSettings } from "@/lib/siteSettings";
import {
  MASJIDBOX_WIDGET_PREFIX,
  prayerWidgetUrl,
  prayerApiUrl,
  normaliseSlug,
  DEFAULT_PRAYER_SLUG,
} from "@/lib/settings";

interface TestResult {
  success: boolean;
  status?: number;
  ms: number;
  count?: number;
  sampleDate?: string | null;
  error?: string;
  apiUrl: string;
}

export default function PrayerSettingsPage() {
  const access = useAccess();
  const canEdit = access.access("prayer") === "write";
  const [settings, refreshSettings] = useSiteSettings();

  const stored = String((settings.prayer as { slug?: unknown })?.slug ?? DEFAULT_PRAYER_SLUG);
  const [slug, setSlug] = useState(stored);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);

  // Keep the field in sync once the remote settings load.
  useEffect(() => {
    setSlug(stored);
  }, [stored]);

  const clean = normaliseSlug(slug);
  const dirty = clean !== normaliseSlug(stored);
  const previewWidget = prayerWidgetUrl(clean);
  const previewApi = prayerApiUrl(clean);

  const valid = useMemo(() => clean.length > 0 && /^[a-z0-9._-]+$/i.test(clean), [clean]);

  async function runTest() {
    if (!valid) return;
    setTesting(true);
    setTest(null);
    try {
      const res = await fetch(`/api/prayer/test?slug=${encodeURIComponent(clean)}`, { cache: "no-store" });
      setTest((await res.json()) as TestResult);
    } catch {
      setTest({ success: false, ms: 0, error: "Network error", apiUrl: previewApi });
    } finally {
      setTesting(false);
    }
  }

  async function doSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { prayer: { slug: clean } } }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to save");
      setSaved(true);
      setConfirmOpen(false);
      refreshSettings();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ps">
      {/* Header */}
      <div className="ps-header">
        <div className="ps-header-icon">
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
        </div>
        <div>
          <h1>Prayer Settings</h1>
          <p>Choose where athan &amp; iqamah times are fetched from. This feeds every prayer container across the site.</p>
        </div>
      </div>

      {/* Source card */}
      <div className="ps-card">
        <div className="ps-card-head">
          <h2>Masjidbox source</h2>
          <span className={`ps-badge ${test ? (test.success ? "ps-badge--ok" : "ps-badge--bad") : ""}`}>
            {test ? (test.success ? "Reachable" : "Unreachable") : "Connected"}
          </span>
        </div>

        <label className="ps-label" htmlFor="prayer-slug">
          Fetch URL
        </label>
        <div className={`ps-urlfield${!valid ? " ps-urlfield--invalid" : ""}`}>
          <span className="ps-urlprefix">{MASJIDBOX_WIDGET_PREFIX}</span>
          <input
            id="prayer-slug"
            className="ps-urlinput"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setTest(null);
            }}
            placeholder={DEFAULT_PRAYER_SLUG}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            disabled={!canEdit}
          />
        </div>
        <p className="ps-hint">
          The <code>{MASJIDBOX_WIDGET_PREFIX}</code> prefix is fixed — only the slug after it can change. Leave it as{" "}
          <code>{DEFAULT_PRAYER_SLUG}</code> unless you know the new Masjidbox slug.
        </p>
        {!valid && slug.length > 0 && (
          <p className="ps-fielderror">Use only letters, numbers, dots, dashes and underscores.</p>
        )}

        {/* Live derived endpoints */}
        <div className="ps-derived">
          <div className="ps-derived-row">
            <span className="ps-derived-k">Public page</span>
            <code className="ps-derived-v">{previewWidget}</code>
          </div>
          <div className="ps-derived-row">
            <span className="ps-derived-k">API endpoint</span>
            <code className="ps-derived-v">{previewApi}</code>
          </div>
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="ps-actions">
            <button className="ps-btn ps-btn--ghost" onClick={runTest} disabled={testing || !valid}>
              {testing ? (
                <>
                  <span className="spinner spinner--sm" /> Testing…
                </>
              ) : (
                <>
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22,4 12,14.01 9,11.01" /></svg>
                  Test connection
                </>
              )}
            </button>
            <button
              className="ps-btn ps-btn--primary"
              onClick={() => setConfirmOpen(true)}
              disabled={!dirty || !valid || saving}
            >
              {saving ? (
                <>
                  <span className="spinner spinner--sm" /> Saving…
                </>
              ) : (
                <>
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" /></svg>
                  Save changes
                </>
              )}
            </button>
          </div>
        )}

        {saved && <p className="ps-saved">Saved. Prayer times now fetch from the new source.</p>}
        {error && <p className="ps-fielderror">{error}</p>}

        {/* Test result */}
        {test && (
          <div className={`ps-test ${test.success ? "ps-test--ok" : "ps-test--bad"}`}>
            <div className="ps-test-row">
              <span>{test.success ? "Connection OK" : "Connection failed"}</span>
              <span className="ps-test-meta">
                {test.status ? `HTTP ${test.status} · ` : ""}
                {test.ms}ms{test.count != null ? ` · ${test.count} days` : ""}
                {test.sampleDate ? ` · from ${test.sampleDate}` : ""}
              </span>
            </div>
            {test.error && <div className="ps-test-err">{test.error}</div>}
          </div>
        )}
      </div>

      {/* Impact note */}
      <div className="ps-note">
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>
        <div>
          <strong>Heads up.</strong> Changing the source re-points prayer times everywhere at once — the public website, this admin panel, and the masjid screens. If the new slug is wrong, all of them will show empty or incorrect times.
        </div>
      </div>

      {/* Back link */}
      <Link href="/dashboard/prayer-times" className="ps-back">
        ← Back to Prayer Times
      </Link>

      {/* ── Warning modal ── */}
      {confirmOpen && (
        <div className="ps-overlay" onClick={() => !saving && setConfirmOpen(false)}>
          <div className="ps-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ps-modal-icon">
              <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>
            </div>
            <h3>Change prayer times source?</h3>
            <p>
              You&apos;re about to change the fetch slug from <code>{normaliseSlug(stored)}</code> to{" "}
              <code>{clean}</code>.
            </p>
            <div className="ps-modal-impact">
              <strong>This affects every prayer container everywhere:</strong>
              <ul>
                <li>Public website prayer times &amp; timetable</li>
                <li>This admin panel</li>
                <li>The masjid&apos;s screens / app</li>
              </ul>
              If the new slug is incorrect, all of them will show empty or wrong times.
            </div>
            <div className="ps-modal-actions">
              <button className="ps-btn ps-btn--ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button className="ps-btn ps-btn--danger" onClick={doSave} disabled={saving}>
                {saving ? (
                  <>
                    <span className="spinner spinner--sm" /> Saving…
                  </>
                ) : (
                  "Yes, change it"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
