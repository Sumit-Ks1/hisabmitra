"use server";

import { revalidatePath } from "next/cache";
import { getReminderRows } from "@/lib/data/reminders";
import { getSettings } from "@/lib/data/settings";
import type { Building } from "@/lib/db-types";
import { serverEnv } from "@/lib/env";
import { todayIST } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uploads/rules";
import { checkEligibility, dedupeKey, reminderText, templateParams } from "@/lib/whatsapp/message";
import { whatsappState } from "@/lib/whatsapp/provider";
import { processWhatsappQueue } from "@/lib/whatsapp/queue";
import { must, ownerAction, type ActionResult } from "./helpers";

type Summary = { queued: number; sent: number; failed: number; waiting: number; skipped: number; alreadySent: number };

/**
 * Queues rent reminders for the selected tenants and sends what fits in this
 * request. Everything is recomputed on the server: who is eligible, what they
 * owe, and the message text. Tenants without consent, a valid number or a
 * pending balance are skipped — never messaged.
 */
export async function sendRemindersAction(buildingId: string, tenantIds: string[]): Promise<ActionResult<Summary>> {
  return ownerAction<Summary>(async (ctx) => {
    const { supabase, userId, t } = ctx;
    if (!isUuid(buildingId) || !Array.isArray(tenantIds) || tenantIds.length === 0 || tenantIds.length > 500 || !tenantIds.every(isUuid)) {
      return { ok: false, error: t("Choose at least one tenant", "Kam se kam ek tenant chunein") };
    }
    const { integrations } = await getSettings(supabase, ["integrations"]);
    const state = whatsappState(integrations.whatsapp);
    if (!state.live) {
      return { ok: false, error: t("WhatsApp sending is not set up yet. Use “Copy message” instead.", "WhatsApp sending abhi set up nahi hai. “Copy message” use karein.") };
    }
    const building = (await supabase.from("buildings").select("*").eq("id", buildingId).eq("owner_id", userId).maybeSingle()).data as Building | null;
    if (!building) return { ok: false, error: t("Building not found", "Building nahi mili") };
    const { data: allowed } = await supabase.rpc("check_rate_limit", { p_action: "whatsapp_send" });
    if (!allowed) return { ok: false, error: t("Too many attempts. Try again later.", "Bahut zyada koshish. Thodi der baad try karein.") };

    const today = todayIST();
    const { rows } = await getReminderRows({ supabase, userId, building, today });
    const wanted = new Set(tenantIds);
    const messages = [];
    let skipped = 0;
    for (const row of rows.filter((r) => wanted.has(r.tenantId))) {
      const e = checkEligibility(row);
      if (!e.eligible) {
        skipped++;
        continue;
      }
      messages.push({
        owner_id: userId,
        building_id: building.id,
        tenant_id: row.tenantId,
        period_month: row.periodMonth,
        to_phone: e.to,
        template_name: serverEnv.whatsapp.templateName!,
        template_params: templateParams(row),
        body_preview: reminderText(row, building.name),
        dedupe_key: dedupeKey(row.tenantId, row.periodMonth, today),
      });
    }
    if (messages.length === 0) {
      return { ok: false, error: t("None of the selected tenants can be messaged.", "Chune gaye tenants mein se kisi ko message nahi ja sakta.") };
    }

    // ignoreDuplicates: a tenant already reminded today for this month is not queued again
    const admin = createAdminClient();
    const inserted = must(await admin.from("whatsapp_messages").upsert(messages, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id")) ?? [];
    const alreadySent = messages.length - inserted.length;

    // send what we can now; the cron job picks up anything left
    const r = inserted.length > 0 ? await processWhatsappQueue({ ownerId: userId, limit: 25, budgetMs: 7000 }) : { sent: 0, failed: 0, requeued: 0 };
    revalidatePath("/app/reminders");
    const waiting = Math.max(0, inserted.length - r.sent - r.failed);
    const parts = [
      r.sent > 0 && t(`${r.sent} sent`, `${r.sent} bhej diye`),
      waiting > 0 && t(`${waiting} queued`, `${waiting} line mein hain`),
      r.failed > 0 && t(`${r.failed} failed`, `${r.failed} fail hue`),
      alreadySent > 0 && t(`${alreadySent} already reminded today`, `${alreadySent} ko aaj pehle hi bheja`),
      skipped > 0 && t(`${skipped} skipped`, `${skipped} skip hue`),
    ].filter(Boolean);
    return { ok: true, message: parts.join(" · "), data: { queued: inserted.length, sent: r.sent, failed: r.failed, waiting, skipped, alreadySent } };
  });
}
