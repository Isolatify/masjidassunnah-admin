"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAccess, type Access } from "@/lib/access";

function componentForPath(pathname: string): string {
  if (pathname.startsWith("/dashboard/events")) return "events";
  if (pathname.startsWith("/dashboard/register")) return "register";
  if (pathname.startsWith("/dashboard/settings")) return "settings";
  return "overview";
}

/**
 * Enforces per-manager Hide / Read / Write access.
 *  hide  → bounced to the dashboard
 *  read  → children rendered but form controls & buttons are inert
 *  write → unchanged
 */
export default function AccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const access = useAccess();
  const component = componentForPath(pathname);

  const level: Access = access.access(component);

  useEffect(() => {
    if (!access.ready) return;
    if (level === "hide") router.replace("/dashboard");
  }, [access.ready, level, router]);

  if (!access.ready) return null;

  if (level === "hide") {
    return (
      <div className="access-denied">
        <svg width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12h6" />
        </svg>
        <h2>You don’t have access to this page</h2>
        <p>Ask an administrator to change your permissions.</p>
      </div>
    );
  }

  if (level === "read") {
    return (
      <div className="ro-mode">
        <div className="ro-banner" role="status">
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Read-only access — you can view this page but not change it.
        </div>
        <div className="ro-content">{children}</div>
      </div>
    );
  }

  return <>{children}</>;
}
