import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/forms";
import { getSessionUser, unauthorized } from "@/lib/supabase/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "form";
  let candidate = root;
  for (let n = 1; n <= 50; n++) {
    let q = supabase.from("forms").select("id").eq("slug", candidate).limit(1);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q;
    if (!data || data.length === 0) return candidate;
    candidate = `${root}-${n + 1}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const slug = searchParams.get("slug");

  if (slug) {
    const { data, error } = await supabase
      .from("forms")
      .select("*")
      .eq("slug", slug)
      .single();
    if (error || !data) {
      return NextResponse.json({ success: false, error: "Form not found" }, { status: 404 });
    }
    if (data.status !== "published") {
      const user = await getSessionUser();
      if (!user) {
        return NextResponse.json({ success: false, error: "Form not found" }, { status: 404 });
      }
    }
    return NextResponse.json({ success: true, form: data });
  }

  const user = await getSessionUser();
  if (!user) return unauthorized();

  if (id) {
    const { data, error } = await supabase
      .from("forms")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    return NextResponse.json({ success: true, form: data });
  }

  const { data, error } = await supabase
    .from("forms")
    .select("*, response_count:form_responses(count)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const forms = (data || []).map((f: Record<string, unknown>) => ({
    ...f,
    response_count: Array.isArray(f.response_count)
      ? (f.response_count[0] as { count?: number })?.count || 0
      : Number(f.response_count) || 0,
  }));

  return NextResponse.json({ success: true, forms });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const title = (body.title || "").trim();
  if (!title) {
    return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
  }

  const slug = await uniqueSlug(body.slug || title);

  const { data, error } = await supabase
    .from("forms")
    .insert({
      title,
      slug,
      description: body.description || "",
      fields: body.fields || [],
      settings: body.settings || {},
      status: body.status || "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, form: data });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ success: false, error: "Form ID required" }, { status: 400 });
  }

  const { id, ...rest } = body;
  const updates: Record<string, unknown> = { ...rest };
  updates.updated_at = new Date().toISOString();

  if (updates.slug !== undefined && updates.slug !== null) {
    updates.slug = await uniqueSlug(String(updates.slug), id);
  }
  if (updates.title !== undefined && !String(updates.title).trim()) {
    return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("forms")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, form: data });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ success: false, error: "Form ID required" }, { status: 400 });
  }

  const { error } = await supabase.from("forms").delete().eq("id", body.id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
