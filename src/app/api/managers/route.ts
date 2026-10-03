import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.FORM_CORS_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Navigation components a manager can be given Hide / Read / Write on.
export const COMPONENTS = ["overview", "events", "register", "settings"] as const;
export type ComponentKey = (typeof COMPONENTS)[number];
export type Access = "hide" | "read" | "write";

export const DEFAULT_PERMS: Record<ComponentKey, Access> = {
  overview: "read",
  events: "read",
  register: "hide",
  settings: "hide",
};

type ManagerMeta = {
  role?: string;
  manager?: boolean;
  perms?: Partial<Record<ComponentKey, Access>>;
};

function toManagerRow(u: { id: string; email?: string; created_at: string; last_sign_in_at?: string | null; app_metadata: unknown; user_metadata: unknown }) {
  const meta = (u.app_metadata ?? {}) as ManagerMeta;
  return {
    id: u.id,
    email: u.email ?? "",
    role: meta.role ?? (meta.manager ? "manager" : "admin"),
    perms: { ...DEFAULT_PERMS, ...(meta.perms ?? {}) },
    invited: !u.last_sign_in_at,
    lastSignIn: u.last_sign_in_at ?? null,
    createdAt: u.created_at,
  };
}

async function requireSession() {
  const user = await getSessionUser();
  if (!user) return null;
  return user;
}

export async function GET() {
  const user = await requireSession();
  if (!user) return unauthorized();
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);
    return NextResponse.json(
      { success: true, managers: (data.users ?? []).map(toManagerRow), components: COMPONENTS },
      { headers: CORS_HEADERS }
    );
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load managers" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

async function findUserByEmail(email: string) {
  const list = await supabase.auth.admin.listUsers({ perPage: 200 });
  return (list.data?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
}

async function grantAccess(id: string, perms: Partial<Record<ComponentKey, Access>>, role: string) {
  const { data: current } = await supabase.auth.admin.getUserById(id);
  const meta = (current.user?.app_metadata ?? {}) as ManagerMeta;
  await supabase.auth.admin.updateUserById(id, {
    app_metadata: { ...meta, role, manager: role !== "admin", perms: { ...meta.perms, ...perms } },
  });
  const updated = await supabase.auth.admin.getUserById(id);
  return updated.data.user ? toManagerRow(updated.data.user as never) : null;
}

// generateLink() creates the user if missing, sends the invite mail and
// always returns a copyable action_link — unlike /invite, which 429s.
async function sendInvite(email: string, invitedBy: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo: `${appUrl}/invite-login`, data: { invited_by: invitedBy } },
  });
  if (error) return { link: null as string | null, mailError: error.message };
  const link = (data as unknown as { properties?: { action_link?: string } } | null)?.properties?.action_link ?? null;
  return { link, mailError: null };
}

export async function POST(request: Request) {
  const user = await requireSession();
  if (!user) return unauthorized();
  try {
    const body = (await request.json()) as {
      email?: string;
      perms?: Partial<Record<ComponentKey, Access>>;
      action?: "invite" | "resend";
    };
    const email = (body.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: "Enter a valid email address" }, { status: 400 });
    }
    const perms = sanitizePerms(body.perms);
    const resend = body.action === "resend";

    const existing = await findUserByEmail(email);

    if (existing) {
      const manager = await grantAccess(existing.id, perms, "manager");
      const shouldInvite = resend || !existing.last_sign_in_at;
      const { link, mailError } = shouldInvite ? await sendInvite(email, user.email ?? "") : { link: null, mailError: null };
      let message: string;
      if (!shouldInvite) message = "Existing account granted manager access — no invite needed";
      else if (link) message = resend ? "Invitation resent — copy the link below if the email does not arrive" : "Invitation sent — copy the link below to share directly";
      else message = `Account updated, but the invite email failed: ${mailError ?? "unknown error"}`;
      return NextResponse.json(
        { success: true, manager, existed: true, inviteLink: link, mailError, message },
        { headers: CORS_HEADERS }
      );
    }

    const { link, mailError } = await sendInvite(email, user.email ?? "");
    const created = await findUserByEmail(email);
    if (!created) {
      return NextResponse.json(
        {
          success: false,
          error: mailError || "Invitation could not be sent",
          inviteLink: link,
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    const manager = await grantAccess(created.id, perms, "manager");
    return NextResponse.json(
      {
        success: true,
        manager,
        existed: false,
        inviteLink: link,
        mailError,
        message: link
          ? "Invitation sent — copy the link below to share directly"
          : `Account created, but the invite email failed: ${mailError ?? "unknown error"}`,
      },
      { headers: CORS_HEADERS }
    );
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to invite manager" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function PATCH(request: Request) {
  const user = await requireSession();
  if (!user) return unauthorized();
  try {
    const body = (await request.json()) as { id?: string; perms?: Partial<Record<ComponentKey, Access>>; role?: string };
    if (!body.id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

    const { data: current } = await supabase.auth.admin.getUserById(body.id);
    if (!current.user) return NextResponse.json({ success: false, error: "Manager not found" }, { status: 404 });

    const meta = (current.user.app_metadata ?? {}) as ManagerMeta;
    const nextMeta: ManagerMeta = { ...meta };
    if (body.perms) nextMeta.perms = sanitizePerms({ ...meta.perms, ...body.perms });
    if (body.role === "manager" || body.role === "admin") nextMeta.role = body.role;
    nextMeta.manager = nextMeta.role !== "admin";

    const { error } = await supabase.auth.admin.updateUserById(body.id, { app_metadata: nextMeta as Record<string, unknown> });
    if (error) throw new Error(error.message);

    const updated = await supabase.auth.admin.getUserById(body.id);
    return NextResponse.json(
      { success: true, manager: updated.data.user ? toManagerRow(updated.data.user as never) : null },
      { headers: CORS_HEADERS }
    );
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to update manager" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function DELETE(request: Request) {
  const user = await requireSession();
  if (!user) return unauthorized();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    if (id === user.id) {
      return NextResponse.json({ success: false, error: "You cannot remove your own access" }, { status: 400 });
    }
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to remove manager" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

function sanitizePerms(input: Partial<Record<ComponentKey, Access>> | undefined): Partial<Record<ComponentKey, Access>> {
  const out: Partial<Record<ComponentKey, Access>> = {};
  if (!input) return out;
  for (const key of COMPONENTS) {
    const v = input[key];
    if (v === "hide" || v === "read" || v === "write") out[key] = v;
  }
  return out;
}
