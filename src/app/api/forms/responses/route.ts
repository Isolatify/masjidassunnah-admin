import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/supabase/server";

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


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const formId = searchParams.get("form_id");
  if (!formId) {
    return json({ success: false, error: "form_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("form_responses")
    .select("*")
    .eq("form_id", formId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return json({ success: false, error: error.message }, { status: 500 });
  return json({ success: true, responses: data || [] });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
  if (!ids.length) {
    return json({ success: false, error: "ids is required" }, { status: 400 });
  }

  const { error } = await supabase.from("form_responses").delete().in("id", ids);
  if (error) return json({ success: false, error: error.message }, { status: 500 });
  return json({ success: true, deleted: ids.length });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.form_id) {
    return json({ success: false, error: "form_id is required" }, { status: 400 });
  }

  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("id, status, settings")
    .eq("id", body.form_id)
    .single();

  if (formError || !form) {
    return json({ success: false, error: "Form not found" }, { status: 404 });
  }

  if (form.status !== "published") {
    const user = await getSessionUser();
    if (!user) {
      return json(
        { success: false, error: "This form is not accepting responses." },
        { status: 400 }
      );
    }
  }

  const settings = (form.settings || {}) as {
    responses?: {
      accept?: boolean;
      start_at?: string;
      end_at?: string;
      max_responses?: number;
      duplicate_per_browser?: boolean;
    };
  };
  const rs = settings.responses || {};
  const now = Date.now();

  if (rs.accept === false) {
    return json(
      { success: false, error: "This form is no longer accepting responses." },
      { status: 400 }
    );
  }
  if (rs.start_at && now < new Date(rs.start_at).getTime()) {
    return json(
      { success: false, error: "This form has not started accepting responses yet." },
      { status: 400 }
    );
  }
  if (rs.end_at && now > new Date(rs.end_at).getTime()) {
    return json(
      { success: false, error: "The deadline for this form has passed." },
      { status: 400 }
    );
  }
  if (rs.duplicate_per_browser) {
    const cookieHeader = request.headers.get("cookie") || "";
    const dupName = `masjid_form_${form.id}`;
    const already = cookieHeader
      .split(";")
      .some((c) => c.trim().startsWith(`${dupName}=`));
    if (already) {
      return json(
        { success: false, error: "You have already responded to this form." },
        { status: 400 }
      );
    }
  }
  if (rs.max_responses && rs.max_responses > 0) {
    const { count } = await supabase
      .from("form_responses")
      .select("id", { count: "exact", head: true })
      .eq("form_id", body.form_id);
    if ((count ?? 0) >= rs.max_responses) {
      return json(
        { success: false, error: "This form has reached its response limit." },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("form_responses")
    .insert({
      form_id: body.form_id,
      answers: body.answers || {},
    })
    .select()
    .single();

  if (error) return json({ success: false, error: error.message }, { status: 500 });

  const res = json({ success: true, response: data });
  if (rs.duplicate_per_browser) {
    res.cookies.set(`masjid_form_${form.id}`, "1", {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });
  }
  return res;
}
