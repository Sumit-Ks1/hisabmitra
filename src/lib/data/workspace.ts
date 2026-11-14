import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuthUser, requireOwner } from "@/lib/auth/session";
import type { Building, Subscription } from "@/lib/db-types";
import { todayIST } from "@/lib/format";

export const BUILDING_COOKIE = "hm_building";

/**
 * The approved owner + the building they are currently working in.
 * The building id in the cookie is only a preference: it is always matched
 * against the buildings this owner actually owns.
 */
export const getWorkspace = cache(async () => {
  // Start the buildings query as soon as the user is known, alongside the
  // profile/owner lookups in requireOwner, instead of after them. RLS limits it
  // to this user's rows, and its result is used only once requireOwner passes.
  const auth = await getAuthUser();
  const buildingsQuery = auth
    ? auth.supabase.from("buildings").select("*").eq("owner_id", auth.user.id).eq("status", "active").order("created_at")
    : null;
  const [ctx, buildingsRes] = await Promise.all([requireOwner(), buildingsQuery]);
  const { supabase } = ctx;

  const buildings = (buildingsRes?.data ?? []) as Building[];
  if (buildings.length === 0) redirect("/onboarding/status");

  const preferred = (await cookies()).get(BUILDING_COOKIE)?.value;
  const building = buildings.find((b) => b.id === preferred) ?? buildings[0];
  const today = todayIST();

  // Idempotent: creates this month's invoices if they do not exist yet. The
  // database records the day it last checked (IST); skip the round trip when
  // that is today — the function would return immediately anyway.
  if (building.last_cycle_check !== today) {
    await supabase.rpc("ensure_billing", { p_building: building.id, p_force: false });
  }

  return { ...ctx, buildings, building, today };
});

export type Workspace = Awaited<ReturnType<typeof getWorkspace>>;

export async function getSubscription(ws: Workspace): Promise<Subscription | null> {
  const { data } = await ws.supabase
    .from("building_subscriptions")
    .select("*")
    .eq("building_id", ws.building.id)
    .eq("owner_id", ws.userId)
    .in("status", ["active", "expired"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Subscription | null) ?? null;
}
