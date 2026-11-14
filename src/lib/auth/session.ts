import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Lang, OwnerAccount, Profile } from "@/lib/db-types";
import { serverEnv } from "@/lib/env";
import { makeT, type T } from "@/lib/i18n";
import { supabaseConfigured } from "@/lib/public-env";
import { createAdminClient, createClient, serviceRoleAvailable } from "@/lib/supabase/server";

export type SessionContext = {
  supabase: SupabaseClient;
  userId: string;
  email: string;
  profile: Profile;
  owner: OwnerAccount | null;
  isAdmin: boolean;
  lang: Lang;
  t: T;
};

/**
 * The single place where "who is this request?" is answered.
 *  - the user comes from Supabase Auth (verified with the auth server, not just the cookie)
 *  - the role comes from the database, never from anything the browser sent
 * Cached per request, so pages, layouts and actions can all call it freely.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const user = data.user;
  const email = (user.email ?? "").toLowerCase();

  const loadProfile = async () =>
    (await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data as Profile | null;

  let profile = await loadProfile();
  if (!profile) return null;

  // Admin bootstrap: only the exact, verified ADMIN_EMAIL, only from the server,
  // only through a service-role-only database function that re-checks both.
  if (
    profile.role !== "admin" &&
    serverEnv.adminEmail &&
    email === serverEnv.adminEmail &&
    Boolean(user.email_confirmed_at) &&
    serviceRoleAvailable
  ) {
    const { data: ok } = await createAdminClient().rpc("bootstrap_admin", { p_email: email });
    if (ok) profile = (await loadProfile()) ?? profile;
  }

  const owner = (await supabase.from("pg_owners").select("*").eq("id", user.id).maybeSingle())
    .data as OwnerAccount | null;

  const lang: Lang = profile.language === "en" ? "en" : "hinglish";
  return {
    supabase,
    userId: user.id,
    email,
    profile,
    owner,
    isAdmin: profile.role === "admin",
    lang,
    t: makeT(lang),
  };
});

/** Where a signed-in user belongs right now. */
export function homeFor(ctx: SessionContext): string {
  if (ctx.isAdmin) return "/admin";
  const status = ctx.owner?.status ?? "onboarding";
  if (status === "approved") return "/app";
  if (status === "onboarding") return "/onboarding";
  return "/onboarding/status";
}

export async function requireUser(): Promise<SessionContext> {
  if (!supabaseConfigured) redirect("/setup-required");
  const ctx = await getSession();
  if (!ctx) redirect("/login");
  return ctx;
}

/** Approved PG owners only. Everyone else is sent to where they belong. */
export async function requireOwner(): Promise<SessionContext & { owner: OwnerAccount }> {
  const ctx = await requireUser();
  if (ctx.isAdmin || !ctx.owner || ctx.owner.status !== "approved") redirect(homeFor(ctx));
  return ctx as SessionContext & { owner: OwnerAccount };
}

/** Server-verified admins only. */
export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await requireUser();
  if (!ctx.isAdmin) redirect(homeFor(ctx));
  return ctx;
}
