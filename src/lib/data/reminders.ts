import "server-only";
import { periodFor } from "@/lib/billing/proration";
import type { Invoice, Tenant } from "@/lib/db-types";
import type { ReminderData } from "@/lib/whatsapp/message";
import type { Workspace } from "./workspace";

/**
 * One row per active tenant with everything a reminder needs, calculated on the
 * server from invoices and payments (never from numbers sent by the browser).
 */
export async function getReminderRows(ws: Pick<Workspace, "supabase" | "userId" | "building" | "today">): Promise<{ month: string; rows: ReminderData[] }> {
  const { supabase, userId, building } = ws;
  const month = periodFor(ws.today, building.billing_day).month;

  const [tenantsRes, invoicesRes, consentsRes, allocRes] = await Promise.all([
    supabase.from("tenants").select("id, full_name, phone, whatsapp").eq("building_id", building.id).eq("owner_id", userId).eq("status", "active").is("deleted_at", null).order("full_name"),
    supabase.from("v_invoices").select("tenant_id, period_month, room_label, rent_amount, electricity_amount, other_amount, adjustment_amount, total_amount, paid_amount, balance").eq("building_id", building.id).eq("owner_id", userId),
    supabase.from("whatsapp_consents").select("tenant_id, opted_in").eq("owner_id", userId),
    supabase.from("room_allocations").select("tenant_id, rooms(name)").eq("building_id", building.id).eq("owner_id", userId).is("ended_on", null),
  ]);

  const tenants = (tenantsRes.data ?? []) as Pick<Tenant, "id" | "full_name" | "phone" | "whatsapp">[];
  const invoices = (invoicesRes.data ?? []) as Invoice[];
  const consent = new Map((consentsRes.data ?? []).map((c) => [c.tenant_id as string, c.opted_in as boolean]));
  const room = new Map(
    (allocRes.data ?? []).map((a) => {
      const r = (Array.isArray(a.rooms) ? a.rooms[0] : a.rooms) as { name: string } | null;
      return [a.tenant_id as string, r?.name ?? null];
    }),
  );

  const rows = tenants.map((t): ReminderData => {
    const mine = invoices.filter((i) => i.tenant_id === t.id);
    const cur = mine.find((i) => i.period_month === month);
    const previousDue = mine.filter((i) => i.period_month < month).reduce((a, i) => a + Math.max(0, Number(i.balance)), 0);
    return {
      tenantId: t.id,
      tenantName: t.full_name,
      phone: t.phone,
      whatsapp: t.whatsapp,
      optedIn: consent.get(t.id) ?? false,
      periodMonth: month,
      room: room.get(t.id) ?? cur?.room_label ?? null,
      rent: Number(cur?.rent_amount ?? 0),
      electricity: Number(cur?.electricity_amount ?? 0),
      other: Number(cur?.other_amount ?? 0) + Number(cur?.adjustment_amount ?? 0),
      total: Number(cur?.total_amount ?? 0),
      paid: Number(cur?.paid_amount ?? 0),
      remaining: Math.max(0, Number(cur?.balance ?? 0)),
      previousDue,
    };
  });
  return { month, rows };
}
