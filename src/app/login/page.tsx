"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import localFont from "next/font/local";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { supabase } from "@/lib/supabase";
import styles from "./page.module.css";

const dazzed = localFont({
  src: [
    { path: "../../../assets/fonts/Dazzed/Dazzed-TRIAL-Light.otf", weight: "300", style: "normal" },
    { path: "../../../assets/fonts/Dazzed/Dazzed-TRIAL-Regular.otf", weight: "400", style: "normal" },
    { path: "../../../assets/fonts/Dazzed/Dazzed-TRIAL-Medium.otf", weight: "500", style: "normal" },
    { path: "../../../assets/fonts/Dazzed/Dazzed-TRIAL-SemiBold.otf", weight: "600", style: "normal" },
    { path: "../../../assets/fonts/Dazzed/Dazzed-TRIAL-Bold.otf", weight: "700", style: "normal" },
    { path: "../../../assets/fonts/Dazzed/Dazzed-TRIAL-Heavy.otf", weight: "800", style: "normal" },
  ],
  variable: "--font-dazzed",
  display: "swap",
});

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3 7 7.6 5.2a2 2 0 0 0 2.2 0L20.4 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
      <path d="M7.75 10.5V7.4a4.25 4.25 0 0 1 8.5 0v3.1" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.2 12S5.9 5.5 12 5.5 21.8 12 21.8 12 18.1 18.5 12 18.5 2.2 12 2.2 12Z" />
      <circle cx="12" cy="12" r="3.1" />
    </svg>
  ) : (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.2 12S5.9 5.5 12 5.5c1.6 0 3 .4 4.2 1M21.8 12s-3.7 6.5-9.8 6.5c-1.7 0-3.1-.5-4.3-1.1" />
      <path d="M9.9 9.9a3.1 3.1 0 0 0 4.3 4.3" />
      <path d="M3.5 3.5 20.5 20.5" />
    </svg>
  );
}

function SignInIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h3.5A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5H15" />
      <polyline points="10.2 7.6 15 12 10.2 16.4" />
      <line x1="15" y1="12" x2="3.4" y2="12" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

type OAuthProvider = "google" | "github" | "apple";

export default function LoginPage() {
  const shellRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Background parallax: the pattern leans toward the cursor (site's hero-depth).
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onPointer = (e: PointerEvent) => {
      const r = shell.getBoundingClientRect();
      shell.style.setProperty("--hmx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      shell.style.setProperty("--hmy", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    };
    const onLeave = () => {
      shell.style.setProperty("--hmx", "0");
      shell.style.setProperty("--hmy", "0");
    };

    shell.addEventListener("pointermove", onPointer);
    shell.addEventListener("pointerleave", onLeave);
    return () => {
      shell.removeEventListener("pointermove", onPointer);
      shell.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth_failed") {
      toast.error("Google sign-in failed. Please try again.");
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter your email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Signed in — taking you to the dashboard…");
      window.location.href = "/dashboard";
    }
  }

  async function handleOAuth(provider: OAuthProvider) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + "/auth/callback" },
    });
    if (error) toast.error(error.message);
  }

  async function handleForgotPassword() {
    if (!email) {
      toast.error("Enter your email above, then request a reset link.");
      return;
    }
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setResetting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`If an account exists for ${email}, a reset link is on its way.`);
    }
  }

  return (
    <div ref={shellRef} className={`${styles.shell} ${dazzed.variable}`}>
      {/* ── Living background ── */}
      <div className={styles.bg} aria-hidden="true">
        <div className={styles.bgDepth}>
          <Image
            src="/background.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className={styles.kenburns}
          />
        </div>
      </div>
      <div className={styles.scrim} aria-hidden="true" />

      {/* ── Logo ── */}
      <header className={styles.header}>
        <a
          className={`${styles.logo} ${styles.rise}`}
          style={{ animationDelay: "0.05s" }}
          href="https://masjidassunnah.com.au"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image src="/logo-white.png" alt="Masjid As Sunnah" width={340} height={92} priority />
        </a>
      </header>

      {/* ── Card: rises from the bottom as one piece ── */}
      <main className={styles.main}>
        <div className={`${styles.card} ${styles.riseBottom}`}>
          <div className={styles.iconTile}>
            <SignInIcon />
          </div>

          <h1 className={styles.title}>Sign in with email</h1>
          <p className={styles.subtitle}>
            Manage prayer times, events and registrations for Masjid As-Sunnah — all in one place.
          </p>

          <form onSubmit={handleLogin} className={styles.form} noValidate>
            <div className={styles.field}>
              <span className={styles.inputIcon}>
                <MailIcon />
              </span>
              <input
                id="email"
                className={styles.input}
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className={styles.field}>
              <span className={styles.inputIcon}>
                <LockIcon />
              </span>
              <input
                id="password"
                className={`${styles.input} ${styles.inputWithAction}`}
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.eye}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>

            <div className={styles.forgotRow}>
              <button type="button" className={styles.forgot} onClick={handleForgotPassword} disabled={resetting}>
                {resetting ? "Sending…" : "Forgot password?"}
              </button>
            </div>

            <button type="submit" className={styles.submit} disabled={loading}>
              {loading ? "Signing in…" : "Get Started"}
            </button>
          </form>

          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>Or sign in with</span>
            <span className={styles.dividerLine} />
          </div>

          <div className={styles.socials}>
            <button type="button" className={styles.social} onClick={() => handleOAuth("google")} aria-label="Sign in with Google">
              <GoogleIcon />
            </button>
            <button type="button" className={styles.social} onClick={() => handleOAuth("github")} aria-label="Sign in with GitHub">
              <GitHubIcon />
            </button>
            <button type="button" className={styles.social} onClick={() => handleOAuth("apple")} aria-label="Sign in with Apple">
              <AppleIcon />
            </button>
          </div>
        </div>
      </main>

      {/* ── Copyright ── */}
      <footer className={styles.footer}>
        <p className={`${styles.copyright} ${styles.rise}`} style={{ animationDelay: "0.7s" }}>
          © 2026 Masjid As-Sunnah. All rights reserved.
        </p>
      </footer>

      <ToastContainer position="top-center" autoClose={4500} newestOnTop closeOnClick pauseOnHover />
    </div>
  );
}
