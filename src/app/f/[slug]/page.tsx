"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import FormRenderer from "@/components/forms/FormRenderer";
import type { FormRecord } from "@/lib/forms";

export default function PublicFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = use(params);
  const sp = use(searchParams);
  const preview = sp.preview === "1";

  const [form, setForm] = useState<FormRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/forms?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (!alive) return;
        if (!data.success || !data.form) {
          setMissing(true);
        } else {
          setForm({
            ...data.form,
            fields: data.form.fields || [],
            settings: data.form.settings || {},
          });
        }
      } catch {
        if (alive) setMissing(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="jff jff--loading">
        <div className="spinner" />
      </div>
    );
  }

  if (missing || !form) {
    return (
      <div className="jff jff--loading">
        <div className="jff-card jff-center">
          <span className="jff-missing-art">404</span>
          <h1 className="jff-title">Form not found</h1>
          <p className="jff-desc">This link may have been removed or mistyped.</p>
          <Link className="jff-submit" href="/">
            Go to website
          </Link>
        </div>
      </div>
    );
  }

  if (form.status !== "published" && !preview) {
    return (
      <div className="jff jff--loading">
        <div className="jff-card jff-center">
          <span className="jff-missing-art">✦</span>
          <h1 className="jff-title">Not accepting responses</h1>
          <p className="jff-desc">This form is still a draft. Try again later.</p>
          <Link className="jff-submit" href="/dashboard/register">
            Open form dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <FormRenderer form={form} preview={preview} />;
}
