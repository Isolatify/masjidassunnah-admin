"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";
import AccessGate from "@/components/AccessGate";
import { ToastContainer } from "@/components/Toast";
import { useSiteSettings, applyAppearanceAll } from "@/lib/siteSettings";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();
  // Loads settings once and paints theme/accent/density/motion/pattern/fontScale.
  const [settings] = useSiteSettings();

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.push("/login"); return; }
      setAuthorized(true);
    }
    check();
  }, [router]);

  // Re-apply whenever the cached settings object changes (e.g. after a save).
  useEffect(() => {
    applyAppearanceAll(settings);
  }, [settings]);

  if (!authorized) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg)" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto 12px" }} />
          <p style={{ color: "var(--color-muted)", fontSize: 14 }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <Sidebar />
      <div className="main-content">
        <AccessGate>{children}</AccessGate>
      </div>
      <ToastContainer />
    </div>
  );
}
