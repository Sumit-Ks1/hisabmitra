"use server";

import { revalidatePath, updateTag } from "next/cache";
import { SETTINGS_TAG } from "@/lib/data/settings";
import { isUuid } from "@/lib/uploads/rules";
import {
  globalSettingsSchema,
  ownerLimitsSchema,
  planSchema,
  pricingSettingsSchema,
  subscriptionUpdateSchema,
} from "@/lib/validation";
import { adminAction, formToObject, must, validate, type ActionResult } from "./helpers";

/**
 * Admin operations. Three independent checks protect each one:
 *   1. adminAction() re-reads the caller's role from the database,
 *   2. the SQL function itself calls private.require_admin(),
 *   3. the SQL function writes the audit log in the same transaction.
 */

const OWNER_ACTIONS = ["under_review", "approve", "reject", "request_info", "suspend", "reactivate"];

export async function reviewOwnerAction(fd: FormData): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const f = formToObject(fd);
    if (!isUuid(f.owner_id) || !OWNER_ACTIONS.includes(f.action)) return { ok: false, error: "Invalid request" };
    must(await supabase.rpc("admin_review_owner", { p_owner: f.owner_id, p_action: f.action, p_note: f.note || null }));
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Done" };
  });
}

export async function reviewPaymentAction(fd: FormData): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const f = formToObject(fd);
    if (!isUuid(f.payment_id) || !["1", "0"].includes(f.verified)) return { ok: false, error: "Invalid request" };
    must(await supabase.rpc("admin_review_payment", { p_payment: f.payment_id, p_verified: f.verified === "1", p_note: f.note || null }));
    revalidatePath("/admin", "layout");
    return { ok: true, message: f.verified === "1" ? "Payment verified" : "Payment rejected" };
  });
}

export async function updateOwnerLimitsAction(fd: FormData): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const v = validate(ownerLimitsSchema, formToObject(fd));
    if (!v.ok) return v.result;
    must(
      await supabase.rpc("admin_update_owner_limits", {
        p_owner: v.data.owner_id,
        p_building_limit: v.data.building_limit,
        p_room_limit: v.data.room_limit === "" || v.data.room_limit === undefined ? null : v.data.room_limit,
        p_plan: v.data.plan_id || null,
      }),
    );
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Limits updated" };
  });
}

export async function updateSubscriptionAction(fd: FormData): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const v = validate(subscriptionUpdateSchema, formToObject(fd));
    if (!v.ok) return v.result;
    must(
      await supabase.rpc("admin_update_subscription", {
        p_subscription: v.data.subscription_id,
        p_status: v.data.status,
        p_expires_on: v.data.expires_on || null,
        p_rooms_count: v.data.rooms_count,
      }),
    );
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Subscription updated" };
  });
}

const VISIBILITY = { pricing: "public", support: "public", upi: "authenticated", integrations: "authenticated", announcement: "authenticated" } as const;

export async function savePricingAction(fd: FormData): Promise<ActionResult> {
  return adminAction(async ({ supabase, userId }) => {
    const v = validate(pricingSettingsSchema, formToObject(fd));
    if (!v.ok) return v.result;
    // a database trigger records this change in the audit log
    must(await supabase.from("app_settings").upsert({ key: "pricing", value: v.data, visibility: VISIBILITY.pricing, updated_by: userId, updated_at: new Date().toISOString() }));
    updateTag(SETTINGS_TAG);
    revalidatePath("/", "layout");
    return { ok: true, message: "Pricing saved. New applications will use this price." };
  });
}

export async function savePlanAction(fd: FormData): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const v = validate(planSchema, formToObject(fd));
    if (!v.ok) return v.result;
    const row = {
      name: v.data.name,
      price_per_room: v.data.price_per_room,
      duration_months: v.data.duration_months,
      building_limit: v.data.building_limit,
      discount_percent: v.data.discount_percent,
      active: v.data.active === "on",
    };
    if (v.data.id) must(await supabase.from("plans").update(row).eq("id", v.data.id));
    else must(await supabase.from("plans").insert(row));
    revalidatePath("/admin/pricing");
    return { ok: true, message: "Plan saved" };
  });
}

export async function deletePlanAction(fd: FormData): Promise<ActionResult> {
  return adminAction(async ({ supabase }) => {
    const id = String(fd.get("id") ?? "");
    if (!isUuid(id)) return { ok: false, error: "Invalid plan" };
    must(await supabase.from("plans").delete().eq("id", id));
    revalidatePath("/admin/pricing");
    return { ok: true, message: "Plan deleted" };
  });
}

export async function saveGlobalSettingsAction(fd: FormData): Promise<ActionResult> {
  return adminAction(async ({ supabase, userId }) => {
    const v = validate(globalSettingsSchema, formToObject(fd));
    if (!v.ok) return v.result;
    const d = v.data;
    const now = new Date().toISOString();
    const rows = [
      { key: "upi", value: { upi_id: d.upi_id, payee_name: d.payee_name } },
      { key: "support", value: { phone: d.support_phone, email: d.support_email } },
      { key: "integrations", value: { electricity: d.electricity, whatsapp: d.whatsapp } },
      { key: "announcement", value: { message: d.announcement, active: d.announcement_active === "on" && d.announcement.length > 0 } },
    ].map((r) => ({ ...r, visibility: VISIBILITY[r.key as keyof typeof VISIBILITY], updated_by: userId, updated_at: now }));
    must(await supabase.from("app_settings").upsert(rows));
    updateTag(SETTINGS_TAG);
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved" };
  });
}
