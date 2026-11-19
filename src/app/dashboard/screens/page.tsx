"use client";

/* ==========================================================================
   Screens — landing page for the masjid's displays.
     · header: eyebrow / display title / sub, with "Link New Device"
     · Link wizard: enter the 6-digit code the screen is showing →
       name the screen → Done (the device picks the pairing up itself)
     · "My screens": every paired device as a card whose preview — a
       scaled-down replica of what that screen displays — is the
       dominant part of the container, with name + status underneath
   Motion mirrors the global wsite layer (reveal stagger).
   ========================================================================== */

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Monitor } from "@phosphor-icons/react";
import Reveal from "@/components/site/Reveal";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/Toast";
import s from "./page.module.css";

interface ScreenRow {
  id: string;
  device_id: string;
  status: "pending" | "paired";
  name: string;
  color: string;
  last_seen: string | null;
  paired_at: string | null;
}

/** No heartbeat for this long reads as Offline on the card. */
const ONLINE_MS = 120_000;
const TICK_MS = 30_000;
const CODE_RE = /^\d{6}$/;

/** 3F2A-91C4 — short enough to sit under the screen's name. */
function shortId(value: string) {
  const hex = value.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}

/** The strip of prayer cells in every preview — the reference layout. */
const PREVIEW_CELLS = [
  { label: "Fajr", time: "03:49", iqamah: "03:50" },
  { label: "Shuruq", time: "05:48", iqamah: "--" },
  { label: "Dhuhr", time: "13:49", iqamah: "13:50" },
  { label: "Asr", time: "18:05", iqamah: "18:06", next: true },
  { label: "Maghrib", time: "21:50", iqamah: "21:51" },
  { label: "Isha", time: "23:29", iqamah: "23:30" },
];

/** Paired screens newest-first. Returns rows plus an error message and never
 *  touches state — the caller decides where the result lands. */
async function queryScreens(): Promise<{ rows: ScreenRow[]; error: string }> {
  const { data, error } = await supabase
    .from("screens")
    .select("id, device_id, status, name, color, last_seen, paired_at")
    .eq("status", "paired")
    .order("paired_at", { ascending: false });
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as ScreenRow[], error: "" };
}

export default function ScreensPage() {
  const [screens, setScreens] = useState<ScreenRow[] | null>(null); // null = loading
  const [loadError, setLoadError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  /* Link wizard */
  const [linkOpen, setLinkOpen] = useState(false);
  const [step, setStep] = useState<"code" | "name">("code");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkError, setLinkError] = useState("");

  const loadScreens = useCallback(async () => {
    const { rows, error } = await queryScreens();
    setLoadError(error);
    setScreens(rows);
  }, []);

  /* First load runs the query inside the effect's own async callback, the
     shape the linter accepts — setters only after the await. */
  useEffect(() => {
    let alive = true;
    (async () => {
      const { rows, error } = await queryScreens();
      if (!alive) return;
      setLoadError(error);
      setScreens(rows);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* Re-reads Online/Offline every 30s. */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  /* Escape closes the wizard unless a request is in flight. */
  useEffect(() => {
    if (!linkOpen) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLinkOpen((open) => (busy ? open : false));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [linkOpen, busy]);

  function openLink() {
    setStep("code");
    setCode("");
    setName("");
    setLinkError("");
    setBusy(false);
    setLinkOpen(true);
  }

  function closeLink() {
    if (!busy) setLinkOpen(false);
  }

  /* Step 1 — is the screen showing a real, unused code? */
  async function checkCode() {
    setBusy(true);
    setLinkError("");
    try {
      const res = await fetch(`/api/screens/link?code=${encodeURIComponent(code)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Could not check that code");
      if (!json.valid) {
        setLinkError("No screen is showing that code. Check the device and try again.");
        return;
      }
      setStep("name");
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "Could not check that code");
    } finally {
      setBusy(false);
    }
  }

  /* Step 2 — name it, claim it, reload the list. */
  async function finishLink() {
    setBusy(true);
    setLinkError("");
    try {
      const res = await fetch("/api/screens/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Could not link that screen");
      setLinkOpen(false);
      toast.success(`“${json.screen.name}” is now linked`);
      await loadScreens();
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "Could not link that screen");
    } finally {
      setBusy(false);
    }
  }

  const online = (row: ScreenRow) =>
    !!row.last_seen && now - Date.parse(row.last_seen) < ONLINE_MS;

  return (
    <div className={`wsite ${s.root}`}>
      <section className={s.band}>
        <div className={s.inner}>
          {/* ── Header ── */}
          <header className={s.head}>
            <Reveal className={s.headText}>
              <span className="eyebrow">Screens</span>
              <h1 className="section-title">
                The masjid&apos;s displays,
                <br />
                from one place.
              </h1>
              <p className="section-sub">
                Prayer times, announcements and events — composed for every
                screen around the masjid.
              </p>
            </Reveal>

            <Reveal delay={90}>
              <button type="button" className="btn-primary" onClick={openLink}>
                <Monitor size={15} weight="bold" /> Link New Device
              </button>
            </Reveal>
          </header>

          {/* ── My screens ── */}
          <section className={s.section} aria-labelledby="my-screens">
            <Reveal className={s.sectionHead}>
              <h2 className={s.sectionTitle} id="my-screens">
                My screens
              </h2>
              <span className={s.count}>{screens?.length ?? 0}</span>
            </Reveal>

            {loadError ? (
              <p className={s.empty}>
                Couldn&apos;t load your screens — {loadError}{" "}
                <button type="button" className={s.retry} onClick={loadScreens}>
                  Try again
                </button>
              </p>
            ) : screens === null ? (
              <div className={s.grid} aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div className={`${s.card} ${s.skel}`} key={i}>
                    <div className={s.skelPreview} />
                    <div className={s.skelMeta} />
                  </div>
                ))}
              </div>
            ) : screens.length === 0 ? (
              <Reveal delay={120}>
                <p className={s.empty}>
                  No screens linked yet — open the app on a display, then use
                  <strong> Link New Device</strong> with the code it shows.
                </p>
              </Reveal>
            ) : (
              <div className={s.grid}>
                {screens.map((screen, i) => (
                  <Reveal key={screen.id} delay={120 + i * 70} className={s.card}>
                    {/* A replica of what this display actually shows. */}
                    <div
                      className={s.preview}
                      style={{ "--scr": screen.color } as React.CSSProperties}
                      aria-hidden="true"
                    >
                      <span className={s.miniBadge}>
                        <Image src="/logo-color.png" alt="" width={40} height={12} style={{ width: "100%", height: "auto" }} />
                      </span>

                      <div className={s.miniHero}>
                        <span className={s.miniLine}>
                          The call to prayer of <b>Asr</b> is in
                        </span>
                        <span className={s.miniCount}>03 : 03 : 22</span>
                        <span className={s.miniPills}>
                          <i>Hours</i>
                          <i>Minutes</i>
                          <i>Seconds</i>
                        </span>
                      </div>

                      <div className={s.miniStrip}>
                        <div className={s.miniClockBlock}>
                          <span className={s.miniClock}>15 : 01</span>
                          <span className={s.miniDate}>Sunday, Nov 8, 2026</span>
                        </div>
                        <div className={s.miniCells}>
                          {PREVIEW_CELLS.map((cell) => (
                            <span
                              className={`${s.miniCell}${cell.next ? ` ${s.miniCellNext}` : ""}`}
                              key={cell.label}
                            >
                              <span className={s.miniLabel}>{cell.label}</span>
                              <span className={s.miniTime}>{cell.time}</span>
                              <span
                                className={`${s.miniBox}${cell.next ? ` ${s.miniBoxNext}` : ""}`}
                              >
                                {cell.iqamah}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className={s.meta}>
                      <div className={s.metaText}>
                        <span className={s.name}>{screen.name}</span>
                        <span className={s.detail}>Device {shortId(screen.device_id)}</span>
                      </div>
                      <span className={`${s.status} ${online(screen) ? s.statusOn : s.statusOff}`}>
                        <i className={s.dot} aria-hidden="true" />
                        {online(screen) ? "Online" : "Offline"}
                      </span>
                    </div>
                  </Reveal>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>

      {/* ── Link New Device wizard ── */}
      {linkOpen && (
        <div className="ps-overlay" onClick={closeLink}>
          <div
            className="ps-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Link new device"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={s.linkIcon}>
              <Monitor size={22} weight="bold" />
            </div>

            {step === "code" ? (
              <>
                <h3>Link new device</h3>
                <p>
                  Enter the 6-digit code shown on the screen you&apos;re
                  pairing.
                </p>

                <div className={s.codeField}>
                  <input
                    className={s.codeInput}
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    aria-label="6-digit pairing code"
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && CODE_RE.test(code) && !busy) checkCode();
                    }}
                  />
                  <div className={s.codeSlots} aria-hidden="true">
                    {Array.from({ length: 6 }, (_, i) => (
                      <span
                        key={i}
                        className={`${s.codeSlot}${code.length === i ? ` ${s.codeSlotActive}` : ""}`}
                      >
                        {code[i] ?? ""}
                      </span>
                    ))}
                  </div>
                </div>

                {linkError && <p className={s.linkError}>{linkError}</p>}

                <div className="ps-modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={closeLink}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!CODE_RE.test(code) || busy}
                    onClick={checkCode}
                  >
                    {busy ? "Checking…" : "Continue"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>Name your screen</h3>
                <p>
                  That code checks out. Give the display a name so you can
                  recognise it in <strong>My screens</strong> — it switches
                  over the moment you tap Done.
                </p>

                <input
                  className="oui-input"
                  autoFocus
                  value={name}
                  maxLength={40}
                  placeholder="e.g. Foyer Display"
                  aria-label="Screen name"
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim() && !busy) finishLink();
                  }}
                />

                {linkError && <p className={s.linkError}>{linkError}</p>}

                <div className="ps-modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => {
                      setStep("code");
                      setLinkError("");
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!name.trim() || busy}
                    onClick={finishLink}
                  >
                    {busy ? "Saving…" : "Done"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
