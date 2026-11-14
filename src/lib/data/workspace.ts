import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { requireOwner } from "@/lib/auth/session";
import type { Building, Subscription } from "@/lib/db-types";
import { todayIST } from "@/lib/format";

export const BUILDING_COOKIE = "hm_building";

/**
 * The approved owner + the building they are currently working in.
 * The building id in the cookie is only a preference: it is always matched
 * against the buildings this owner actually owns.
 */
export const getWorkspace = cache(async () => {
  const ctx = await requireOwner();
  const { supabase, userId } = ctx;

  const { data } = await supabase
    .from("buildings")
    .select("*")
    .eq("owner_id", userId)
    .eq("status", "active")
    .order("created_at");
  const buildings = (data ?? []) as Building[];
  if (buildings.length === 0) redirect("/onboarding/status");

  const preferred = (await cookies()).get(BUILDING_COOKIE)?.value;
  const building = buildings.find((b) => b.id === preferred) ?? buildings[0];

  // Idempotent: creates this month's invoices if they do not exist yet. Guarded
  // in the database so it does real work at most once a day per building.
  await supabase.rpc("ensure_billing", { p_building: building.id, p_force: false });

  return { ...ctx, buildings, building, today: todayIST() };
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
