import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/supabase/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// register_url / full_image are added by sql/legacy/supabase-migration-rls-hardening.sql.
// Until that SQL is applied, silently skip those fields instead of failing saves.
let newColumnsOk: boolean | null = null;
async function hasRegistrationColumns(): Promise<boolean> {
  if (newColumnsOk === null) {
    const { error } = await supabase
      .from("events")
      .select("register_url, full_image")
      .limit(1);
    newColumnsOk = !error;
  }
  return newColumnsOk;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const slug = searchParams.get("slug");
  const id = searchParams.get("id");

  if (id) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    return NextResponse.json({ success: true, event: data });
  }

  if (slug) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("slug", slug)
      .single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    return NextResponse.json({ success: true, event: data });
  }

  let query = supabase.from("events").select("*");

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("date_start", { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, events: data });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json();
  if (!body.title?.trim()) {
    return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
  }

  const slug = body.slug?.trim() || generateSlug(body.title);

  const { data: existing } = await supabase
    .from("events")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    return NextResponse.json(
      { success: false, error: "An event with this URL already exists" },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      title: body.title.trim(),
      slug,
      description: body.description || "",
      content_html: body.content_html || "",
      cover_image: body.cover_image || "",
      image_url: body.image_url || "",
      date_start: body.date_start || new Date().toISOString().slice(0, 10),
      date_end: body.date_end || null,
      date_type: body.date_type || "one-day",
      recurring_pattern: body.recurring_pattern || null,
      location: body.location || "",
      location_lat: body.location_lat || null,
      location_lng: body.location_lng || null,
      audience: body.audience || [],
      dates_json: body.dates_json || [],
      faq: body.faq || [],
      links: body.links || [],
      persons: body.persons || [],
      cost: body.cost || "",
      tags: body.tags || [],
      form_id: body.form_id || null,
      ...(await hasRegistrationColumns())
        ? {
            register_url: body.register_url || "",
            full_image: body.full_image || "",
          }
        : {},
      status: body.status || "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, event: data });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ success: false, error: "Event ID required" }, { status: 400 });
  }

  const { id, ...updates } = body;
  updates.updated_at = new Date().toISOString();
  if (!(await hasRegistrationColumns())) {
    delete updates.register_url;
    delete updates.full_image;
  }

  if (updates.slug) {
    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .eq("slug", updates.slug)
      .neq("id", id)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: "An event with this URL already exists" },
        { status: 409 }
      );
    }
  }

  const { data, error } = await supabase
    .from("events")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, event: data });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ success: false, error: "Event ID required" }, { status: 400 });
  }

  const { error } = await supabase.from("events").delete().eq("id", body.id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
