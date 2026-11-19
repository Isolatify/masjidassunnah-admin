"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Access = "hide" | "read" | "write";

export type Perms = Record<string, Access>;

export type ComponentKey =
  | "overview"
  | "events"
  | "register"
  | "responses"
  | "prayer"
  | "settings";

export const DEFAULT_PERMS: Perms = {
  overview: "read",
  events: "read",
  register: "hide",
  responses: "read",
  prayer: "read",
  settings: "hide",
};

export type AccessState = {
  ready: boolean;
  role: "admin" | "manager";
  email: string;
  perms: Perms;
  access: (component: string) => Access;
};

const HIDDEN: Access = "hide";

export function useAccess(): AccessState {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<"admin" | "manager">("admin");
  const [email, setEmail] = useState("");
  const [perms, setPerms] = useState<Perms>({});

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const u = data.user;
      if (!u) return;
      const meta = (u.app_metadata ?? {}) as { role?: string; perms?: Perms };
      const isManager = meta.role === "manager";
      setRole(isManager ? "manager" : "admin");
      setEmail(u.email ?? "");
      setPerms(isManager ? { ...DEFAULT_PERMS, ...(meta.perms ?? {}) } : {});
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const access = (component: string): Access => {
    if (role === "admin") return "write";
    return perms[component] ?? HIDDEN;
  };

  return { ready, role, email, perms, access };
}

/** True when the signed-in manager cannot edit this page. */
export function isReadOnly(state: AccessState, component: string): boolean {
  if (state.role === "admin") return false;
  return state.access(component) !== "write";
}
