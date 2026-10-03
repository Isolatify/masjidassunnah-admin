"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

type Phase = "checking" | "password" | "expired";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 46px 13px 16px",
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "var(--color-bg)",
  color: "var(--color-ink)",
};

function PasswordInput(props: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        style={inputStyle}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? "Hide password" : "Show password"}
        style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer",
          color: "var(--color-muted)", padding: 4, display: "flex",
        }}
      >
        {show ? (
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

/**
 * Landing page for manager invitation links. The invite link verifies the
 * token (session arrives via URL hash) and the manager only has to choose a
 * password — then they are signed in and taken to the dashboard.
 */
export default function InviteLoginPage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Invite Login — Masjid As Sunnah Admin";

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const hashError = params.get("error_description") || params.get("error") || "";
    if (hashError) {
      setError(
        hashError.toLowerCase().includes("expired") || hashError.toLowerCase().includes("invalid")
          ? "This invitation link is invalid or has expired. Ask an administrator to resend it."
          : hashError
      );
      setPhase("expired");
      return;
    }

    let cancelled = false;
    const apply = (session: { user?: { email?: string | null } | null } | null) => {
      if (cancelled || !session) return;
      setPhase("password");
      setEmail(session.user?.email ?? "");
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session));

    const timer = setTimeout(() => {
      if (!cancelled) setPhase((p) => (p === "checking" ? "expired" : p));
    }, 6000);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error: upd } = await supabase.auth.updateUser({ password });
    if (upd) {
      setLoading(false);
      const msg = upd.message.toLowerCase();
      if (msg.includes("session") || msg.includes("jwt")) {
        setError("Your invitation link has expired. Ask an administrator to resend it.");
        setPhase("expired");
      } else {
        setError(upd.message);
      }
      return;
    }
    setSuccess("Password set — taking you to the dashboard…");
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 700);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #026839 0%, #012a1a 100%)",
        backgroundImage: "url('/pattern.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <style>{`@keyframes invite-spin { to { transform: rotate(360deg) } }`}</style>
      <div
        style={{
          display: "flex",
          background: "#fff",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(6, 20, 15, 0.35)",
          maxWidth: 940,
          width: "100%",
          minHeight: 540,
        }}
      >
        {/* Left - Image */}
        <div style={{ flex: "0 0 46%", position: "relative", overflow: "hidden" }}>
          <Image src="/masjid-hero.jpg" alt="Masjid As Sunnah" fill priority unoptimized style={{ objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(2,104,57,0.4) 0%, rgba(1,42,26,0.82) 100%)" }} />
          <div style={{ position: "absolute", top: 24, left: 24, zIndex: 2 }}>
            <Image src="/logo-white.png" alt="Masjid As Sunnah" width={200} height={70} priority style={{ objectFit: "contain", width: 200, height: 70 }} />
          </div>
          <a
            href="https://masjidassunnah.com.au"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              position: "absolute", top: 24, right: 24, zIndex: 2,
              color: "#fff", fontSize: 13, fontWeight: 500, textDecoration: "none",
              background: "rgba(255,255,255,0.12)", border: "1px solid rgba(200,166,93,0.5)",
              padding: "8px 16px", borderRadius: 9999, backdropFilter: "blur(4px)",
            }}
          >
            Back to website →
          </a>
          <div style={{ position: "absolute", bottom: 40, left: 28, right: 28, zIndex: 2 }}>
            <p style={{ color: "#fff", fontSize: 28, fontWeight: 700, lineHeight: 1.1, margin: 0, fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
              Masjid As Sunnah
            </p>
            <p style={{ color: "#c8a65d", fontSize: 12, margin: "10px 0 0 0", letterSpacing: "0.28em", textTransform: "uppercase" }}>
              Admin Panel
            </p>
          </div>
        </div>

        {/* Right - Form */}
        <div style={{ flex: "0 0 54%", padding: "44px 40px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 11, color: "var(--color-gold-deep)", letterSpacing: "0.28em", textTransform: "uppercase", marginBottom: 14 }}>
            Invite Login
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--color-ink)", letterSpacing: "-0.028em", marginBottom: 6 }}>
            Set your password
          </h1>
          <p style={{ fontSize: 14, color: "var(--color-muted)", marginBottom: 28 }}>
            Choose a password for your account and you&apos;re straight in.
          </p>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 12, background: "var(--color-danger-soft)", color: "var(--color-danger)", fontSize: 13, marginBottom: 16, border: "1px solid rgba(185,28,28,0.25)" }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ padding: "10px 14px", borderRadius: 12, background: "var(--color-primary-mist)", color: "var(--color-primary-dark)", fontSize: 13, marginBottom: 16, border: "1px solid rgba(2,104,57,0.25)" }}>
              {success}
            </div>
          )}

          {phase === "checking" && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: "var(--color-muted)" }}>
              <span style={{ width: 18, height: 18, border: "2px solid var(--color-line)", borderTopColor: "var(--color-primary)", borderRadius: "50%", animation: "invite-spin 0.8s linear infinite" }} />
              Verifying your invitation link…
            </div>
          )}

          {phase === "password" && (
            <form onSubmit={handleSetPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {email && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "var(--color-bg)", border: "1px solid var(--color-line)", fontSize: 13, color: "var(--color-muted)" }}>
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-10 6L2 7" />
                  </svg>
                  <span style={{ color: "var(--color-ink)", fontWeight: 500 }}>{email}</span>
                </div>
              )}
              <PasswordInput placeholder="Create a password" value={password} onChange={setPassword} autoComplete="new-password" />
              <PasswordInput placeholder="Confirm your password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
              <p style={{ fontSize: 12, color: "var(--color-muted)", margin: 0 }}>
                At least 8 characters. You can use this password to log in any time.
              </p>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%", padding: "13px", borderRadius: 9999, border: "none",
                  background: loading ? "var(--color-secondary-light)" : "var(--color-primary-deep)", color: "#fff",
                  fontFamily: "var(--font-heading)", fontSize: 14, fontWeight: 500, letterSpacing: "0.025em",
                  cursor: loading ? "not-allowed" : "pointer", marginTop: 4, transition: "all 0.3s var(--ease-out)",
                }}
              >
                {loading ? "Setting up…" : "Set password & enter"}
              </button>
            </form>
          )}

          {phase === "expired" && !error && (
            <div style={{ fontSize: 14, color: "var(--color-muted)", marginBottom: 8 }}>
              This invitation link is invalid or has expired. Ask an administrator to resend it.
            </div>
          )}

          {phase === "expired" && (
            <a
              href="/login"
              style={{
                display: "inline-flex", justifyContent: "center", marginTop: 12, padding: "13px 24px",
                borderRadius: 9999, border: "1px solid var(--color-border)", background: "#fff",
                color: "var(--color-ink)", fontSize: 14, fontWeight: 500, textDecoration: "none",
                fontFamily: "var(--font-heading)", letterSpacing: "0.025em",
              }}
            >
              Go to log in →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
