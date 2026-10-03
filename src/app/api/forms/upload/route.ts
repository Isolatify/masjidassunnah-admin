import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.FORM_CORS_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, init: ResponseInit = {}): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: { ...(init.headers || {}), ...CORS_HEADERS },
  });
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}


const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "form-uploads";

async function ensureBucket(): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, {
    headers: { Authorization: `Bearer ${SERVICE}` },
  });
  if (res.ok) return;
  await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: BUCKET,
      name: "Form uploads",
      public: true,
      file_size_limit: 10485760,
      allowed_mime_types: [
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "image/svg+xml",
        "application/pdf",
        "text/plain",
        "text/csv",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "audio/mpeg",
        "video/mp4",
        "video/webm",
      ],
    }),
  });
}

export async function POST(req: Request) {
  try {
    if (!SUPABASE_URL || !SERVICE) {
      return json(
        { success: false, error: "Server upload is not configured" },
        { status: 500 }
      );
    }
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return json({ success: false, error: "No files provided" }, { status: 400 });
    }
    if (files.length > 10) {
      return json(
        { success: false, error: "Too many files (max 10 per request)" },
        { status: 400 }
      );
    }
    await ensureBucket();
    const urls: string[] = [];
    for (const file of files) {
      const rawExt = file.name.includes(".")
        ? file.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
        : "";
      const ext = rawExt ? `.${rawExt}` : "";
      const day = new Date().toISOString().slice(0, 10);
      const path = `${day}/${randomUUID()}${ext}`;
      const buf = Buffer.from(await file.arrayBuffer());
      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE}`,
          "Content-Type": file.type || "application/octet-stream",
          "x-upsert": "true",
          "Cache-Control": "3600",
        },
        body: buf,
      });
      if (!up.ok) {
        const text = await up.text().catch(() => "");
        return json(
          { success: false, error: `Storage upload failed: ${text.slice(0, 200)}` },
          { status: 500 }
        );
      }
      urls.push(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`);
    }
    return json({ success: true, urls });
  } catch (err: unknown) {
    return json(
      { success: false, error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
