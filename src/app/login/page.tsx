"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      setSuccess("Login successful!");
      window.location.href = "/dashboard";
    }
  }

  async function handleGoogleLogin() {
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth/callback" },
    });
    if (authError) setError(authError.message);
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #026839 0%, #012a1a 100%)",
      backgroundImage: "url('/pattern.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        display: "flex",
        background: "#fff",
        borderRadius: 24,
        overflow: "hidden",
        boxShadow: "0 30px 80px rgba(6, 20, 15, 0.35)",
        maxWidth: 940,
        width: "100%",
        minHeight: 540,
      }}>
        {/* Left - Image */}
        <div style={{ flex: "0 0 46%", position: "relative", overflow: "hidden" }}>
          <Image src="/masjid-hero.jpg" alt="Masjid As Sunnah" fill priority unoptimized style={{ objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(2,104,57,0.4) 0%, rgba(1,42,26,0.82) 100%)" }} />
          <div style={{ position: "absolute", top: 24, left: 24, zIndex: 2 }}>
            <Image src="/logo-white.png" alt="Masjid As Sunnah" width={200} height={70} priority style={{ objectFit: "contain", width: 200, height: 70 }} />
          </div>
          <a href="https://masjidassunnah.com.au" target="_blank" rel="noopener noreferrer" style={{
            position: "absolute", top: 24, right: 24, zIndex: 2,
            color: "#fff", fontSize: 13, fontWeight: 500, textDecoration: "none",
            background: "rgba(255,255,255,0.12)", border: "1px solid rgba(200,166,93,0.5)",
            padding: "8px 16px", borderRadius: 9999, backdropFilter: "blur(4px)",
          }}>
            Back to website →
          </a>
          <div style={{ position: "absolute", bottom: 40, left: 28, right: 28, zIndex: 2 }}>
            <p style={{ color: "#fff", fontSize: 28, fontWeight: 700, lineHeight: 1.1, margin: 0, fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>Masjid As Sunnah</p>
            <p style={{ color: "#c8a65d", fontSize: 12, margin: "10px 0 0 0", letterSpacing: "0.28em", textTransform: "uppercase" }}>Admin Panel</p>
          </div>
        </div>

        {/* Right - Form */}
        <div style={{ flex: "0 0 54%", padding: "44px 40px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 11, color: "var(--color-gold-deep)", letterSpacing: "0.28em", textTransform: "uppercase", marginBottom: 14 }}>Welcome back</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--color-ink)", letterSpacing: "-0.028em", marginBottom: 6 }}>Log In</h1>
          <p style={{ fontSize: 14, color: "var(--color-muted)", marginBottom: 28 }}>Enter your credentials to access the admin panel.</p>

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

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input
              type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
              style={{ width: "100%", padding: "13px 16px", borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 14, fontFamily: "inherit", outline: "none", background: "var(--color-bg)", color: "var(--color-ink)" }}
            />
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
                style={{ width: "100%", padding: "13px 46px 13px 16px", borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 14, fontFamily: "inherit", outline: "none", background: "var(--color-bg)", color: "var(--color-ink)" }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", padding: 4 }}>
                {showPassword
                  ? <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "13px", borderRadius: 9999, border: "none",
              background: loading ? "var(--color-secondary-light)" : "var(--color-primary-deep)", color: "#fff",
              fontFamily: "var(--font-heading)", fontSize: 14, fontWeight: 500, letterSpacing: "0.025em",
              cursor: loading ? "not-allowed" : "pointer", marginTop: 4, transition: "all 0.3s var(--ease-out)",
            }}>
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--color-line)" }} />
            <span style={{ fontSize: 12, color: "var(--color-muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Or continue with</span>
            <div style={{ flex: 1, height: 1, background: "var(--color-line)" }} />
          </div>

          <button onClick={handleGoogleLogin} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            width: "100%", padding: "12px", borderRadius: 9999, border: "1px solid var(--color-border)",
            background: "#fff", color: "var(--color-ink)", fontSize: 14, fontWeight: 500,
            fontFamily: "var(--font-heading)", cursor: "pointer", transition: "all 0.3s var(--ease-out)",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
        </div>
      </div>
    </div>
  );
}
