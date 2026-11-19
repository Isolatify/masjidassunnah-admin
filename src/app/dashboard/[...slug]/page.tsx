"use client";

import { use } from "react";

/* Catch-all for dashboard sections that are wired into the nav shell but whose
   pages aren't built yet. Specific routes (events, settings, prayer-times, …)
   always take precedence — this only catches the rest. */
export default function Placeholder({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = use(params);
  const title = slug[slug.length - 1]
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div>
      <div className="page-header">
        <div className="page-eyebrow">Coming soon</div>
        <h1>{title}</h1>
        <p>This section is part of the admin shell but isn&apos;t built yet.</p>
      </div>

      <div className="panel" style={{ maxWidth: 640 }}>
        <div className="panel-title">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
          Under construction
        </div>
        <p className="panel-empty">
          The <strong>{title}</strong> area will live here. For now the working pages are Events,
          Prayer Times, Register and Settings.
        </p>
      </div>
    </div>
  );
}
