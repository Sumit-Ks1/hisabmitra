"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSettings } from "@/lib/data/settings";
import type { ElectricityBill, ElectricityConnection, ElectricityPayment } from "@/lib/db-types";
import { BILL_FETCH_COOLDOWN_MINUTES, resolveElectricity } from "@/lib/electricity/provider";
import type { DiscomCode } from "@/lib/electricity/types";
import { createAdminClient, serviceRoleAvailable } from "@/lib/supabase/server";
import { isOwnedPath, isUuid } from "@/lib/uploads/rules";
import { allocationRowSchema, electricityRateSchema, manualBillSchema, monthString, readingSchema } from "@/lib/validation";
import { formToObject, must, ownerAction, validate, type ActionResult } from "./helpers";

const done = () => revalidatePath("/app", "layout");

/** The DISCOM bill typed in by the owner from the paper / SMS bill. */
export async function saveManualBillAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const f = formToObject(fd);
    if (/^\d{4}-\d{2}$/.test(f.bill_month ?? "")) f.bill_month += "-01"; // <input type="month">
    const v = validate(manualBillSchema, f);
    if (!v.ok) return v.result;
    if (!isUuid(f.building_id)) return { ok: false, error: t("Invalid building", "Building galat hai") };
    const { data: conn } = await supabase.from("electricity_connections").select("id").eq("building_id", f.building_id).eq("owner_id", userId).maybeSingle();
    if (!conn) return { ok: false, error: t("Add your electricity connection in Settings first.", "Pehle Settings mein bijli connection jodein.") };
    const d = v.data;
    const row = {
      amount: d.amount,
      bill_date: d.bill_date || null,
      due_date: d.due_date || null,
      units: d.units === "" || d.units === undefined ? null : d.units,
    };
    const { data: existing } = await supabase
      .from("electricity_bills").select("id, status").eq("connection_id", conn.id).eq("bill_month", d.bill_month).eq("source", "manual").maybeSingle();
    if (existing) must(await supabase.from("electricity_bills").update(row).eq("id", existing.id).eq("owner_id", userId));
    else must(await supabase.from("electricity_bills").insert({ ...row, owner_id: userId, building_id: f.building_id, connection_id: conn.id, bill_month: d.bill_month, source: "manual" }));
    done();
    return { ok: true, message: t("Bill saved", "Bill save ho gaya") };
  });
}

/**
 * Manual refresh of the main bill through the configured provider.
 * Never runs on page render; limited per connection (cooldown) and per user.
 */
export async function fetchBillAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const buildingId = String(fd.get("building_id") ?? "");
    if (!isUuid(buildingId)) return { ok: false, error: t("Invalid building", "Building galat hai") };
    const { integrations } = await getSettings(supabase, ["integrations"]);
    const mode = resolveElectricity(integrations.electricity);
    if (mode.mode === "manual" || !serviceRoleAvailable) {
      return { ok: false, error: t("Automatic bill fetch is not active yet. Please enter the bill amount yourself.", "Automatic bill fetch abhi chalu nahi hai. Bill amount khud daalein.") };
    }
    const conn = (await supabase.from("electricity_connections").select("*").eq("building_id", buildingId).eq("owner_id", userId).maybeSingle()).data as ElectricityConnection | null;
    if (!conn) return { ok: false, error: t("Add your electricity connection in Settings first.", "Pehle Settings mein bijli connection jodein.") };

    if (conn.last_fetch_at && Date.now() - new Date(conn.last_fetch_at).getTime() < BILL_FETCH_COOLDOWN_MINUTES * 60_000) {
      return { ok: false, error: t(`Bill was checked recently. Try again after ${BILL_FETCH_COOLDOWN_MINUTES} minutes.`, `Bill abhi check hua tha. ${BILL_FETCH_COOLDOWN_MINUTES} minute baad try karein.`) };
    }
    const { data: allowed } = await supabase.rpc("check_rate_limit", { p_action: "bill_fetch" });
    if (!allowed) return { ok: false, error: t("Too many attempts. Try again later.", "Bahut zyada koshish. Thodi der baad try karein.") };

    const result = await mode.provider.fetchBill({ discom: conn.discom as DiscomCode, consumerNumber: conn.consumer_number });
    const admin = createAdminClient();
    const status = result.status === "pending" ? "failed" : result.status;
    const message = result.status === "success" ? null : result.status === "pending" ? "Provider has not answered yet" : result.message;
    await admin.from("electricity_connections").update({ last_fetch_at: new Date().toISOString(), last_fetch_status: status, last_fetch_message: message }).eq("id", conn.id).eq("owner_id", userId);

    if (result.status === "success") {
      const b = result.bill;
      must(
        await admin.from("electricity_bills").upsert(
          {
            owner_id: userId, building_id: buildingId, connection_id: conn.id, bill_month: b.billMonth, amount: b.amount,
            bill_date: b.billDate, due_date: b.dueDate, period_start: b.periodStart, period_end: b.periodEnd, units: b.units,
            source: mode.provider.id, provider_ref: b.providerRef, fetched_at: new Date().toISOString(),
          },
          { onConflict: "connection_id,bill_month,source" },
        ),
      );
    }
    done();
    if (result.status === "success") return { ok: true, message: mode.provider.isMock ? t("Sandbox bill loaded (not a real bill)", "Sandbox bill aaya (asli bill nahi)") : t("Latest bill fetched", "Naya bill aa gaya") };
    if (result.status === "no_bill") return { ok: false, error: t("No bill is available for this month yet.", "Is mahine ka bill abhi available nahi hai.") };
    return { ok: false, error: t("Could not fetch the bill right now. Please try later.", "Bill abhi fetch nahi ho paya. Baad mein try karein.") };
  });
}

async function loadBill(supabase: Parameters<Parameters<typeof ownerAction>[0]>[0]["supabase"], userId: string, id: string) {
  if (!isUuid(id)) return null;
  return (await supabase.from("electricity_bills").select("*").eq("id", id).eq("owner_id", userId).maybeSingle()).data as ElectricityBill | null;
}

/** Starts a bill payment with the provider. The bill is NOT marked paid here. */
export async function payBillAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const bill = await loadBill(supabase, userId, String(fd.get("bill_id") ?? ""));
    if (!bill) return { ok: false, error: t("Bill not found", "Bill nahi mila") };
    if (bill.status === "paid") return { ok: false, error: t("This bill is already paid.", "Yeh bill pehle hi paid hai.") };
    const { integrations } = await getSettings(supabase, ["integrations"]);
    const mode = resolveElectricity(integrations.electricity);
    if (mode.mode === "manual" || !serviceRoleAvailable || bill.source !== mode.provider.id || !bill.provider_ref) {
      return { ok: false, error: t("Online bill payment is not available yet.", "Online bill payment abhi available nahi hai.") };
    }
    const { data: allowed } = await supabase.rpc("check_rate_limit", { p_action: "bill_payment" });
    if (!allowed) return { ok: false, error: t("Too many attempts. Try again later.", "Bahut zyada koshish. Thodi der baad try karein.") };

    const admin = createAdminClient();
    const ins = await admin
      .from("electricity_payments")
      .insert({ owner_id: userId, building_id: bill.building_id, bill_id: bill.id, amount: bill.amount, provider: mode.provider.id, status: "initiated" })
      .select("id")
      .single();
    if (ins.error?.code === "23505") return { ok: false, error: t("A payment for this bill is already in progress.", "Is bill ka payment pehle se chal raha hai.") };
    const paymentId = (must(ins) as { id: string }).id;

    let res;
    try {
      res = await mode.provider.initiatePayment({ billRef: bill.provider_ref, amount: bill.amount, idempotencyKey: paymentId });
    } catch {
      // we do not know what the provider did — never guess "failed" or "success"
      res = { status: "unknown" as const, providerRef: null, message: "No answer from provider" };
    }
    await admin.from("electricity_payments").update({ status: res.status, provider_ref: res.providerRef, message: res.message ?? null }).eq("id", paymentId);
    done();
    return { ok: true, message: t("Payment started. Check the status below.", "Payment shuru ho gaya. Neeche status dekhein.") };
  });
}

export async function refreshPaymentStatusAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const id = String(fd.get("payment_id") ?? "");
    if (!isUuid(id) || !serviceRoleAvailable) return { ok: false, error: t("Payment not found", "Payment nahi mila") };
    const pay = (await supabase.from("electricity_payments").select("*").eq("id", id).eq("owner_id", userId).maybeSingle()).data as ElectricityPayment | null;
    if (!pay || !pay.provider_ref || pay.provider === "manual") return { ok: false, error: t("Payment not found", "Payment nahi mila") };
    if (pay.status === "success" || pay.status === "failed") return { ok: true };
    const { integrations } = await getSettings(supabase, ["integrations"]);
    const mode = resolveElectricity(integrations.electricity);
    if (mode.mode === "manual" || mode.provider.id !== pay.provider) return { ok: false, error: t("Status cannot be checked right now.", "Status abhi check nahi ho sakta.") };
    const res = await mode.provider.getPaymentStatus(pay.provider_ref);
    await createAdminClient().from("electricity_payments").update({ status: res.status, message: res.message ?? null }).eq("id", id);
    done();
    return { ok: true, message: t(`Status: ${res.status}`, `Status: ${res.status}`) };
  });
}

/** Owner's own note that they paid the DISCOM outside the app (counter, UPI app…). No money moves here. */
export async function markBillPaidOutsideAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const bill = await loadBill(supabase, userId, String(fd.get("bill_id") ?? ""));
    if (!bill || bill.source !== "manual") return { ok: false, error: t("Bill not found", "Bill nahi mila") };
    if (bill.status !== "unpaid") return { ok: false, error: t("This bill is already paid.", "Yeh bill pehle hi paid hai.") };
    if (!serviceRoleAvailable) return { ok: false, error: t("This is not available yet.", "Yeh abhi available nahi hai.") };
    must(
      await createAdminClient().from("electricity_payments").insert({
        owner_id: userId, building_id: bill.building_id, bill_id: bill.id, amount: bill.amount, provider: "manual", status: "success",
        message: "Marked by owner as paid outside HisabMitra",
      }),
    );
    done();
    return { ok: true, message: t("Marked as paid by you", "Aapke hisaab se paid mark ho gaya") };
  });
}

/**
 * Saves a new meter reading (or fixes the room's latest one). The database works
 * out the previous reading, the units and — for room-meter buildings — charges
 * them to the room's tenants straight away.
 */
export async function saveReadingAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const v = validate(readingSchema, formToObject(fd));
    if (!v.ok) return v.result;
    const d = v.data;
    const photo = d.photo_path || null;
    if (photo && !isOwnedPath(photo, userId)) return { ok: false, error: t("Invalid photo", "Photo galat hai") };
    const correction = d.correction === "on";
    must(
      await supabase.rpc("save_meter_reading", {
        p_room: d.room_id,
        p_current: d.current,
        p_reading_date: d.reading_date,
        p_photo_path: photo,
        p_correction: correction,
        p_correction_reason: correction ? d.correction_reason : null,
        p_previous_override: correction && d.previous_override !== "" && d.previous_override !== undefined ? d.previous_override : null,
        p_reading: d.reading_id || null,
      }),
    );
    done();
    return { ok: true, message: d.reading_id ? t("Reading corrected", "Reading theek ho gayi") : t("Reading saved", "Reading save ho gayi") };
  });
}

/** Deletes the room's latest reading and the charges it put on tenant bills. */
export async function deleteReadingAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, t }) => {
    const id = String(fd.get("reading_id") ?? "");
    if (!isUuid(id)) return { ok: false, error: t("Reading not found", "Reading nahi mili") };
    must(await supabase.rpc("delete_meter_reading", { p_reading: id }));
    done();
    return { ok: true, message: t("Reading deleted", "Reading delete ho gayi") };
  });
}

/** One per-unit rate for the whole building. Applies to readings saved from now on. */
export async function saveElectricityRateAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const v = validate(electricityRateSchema, formToObject(fd));
    if (!v.ok) return v.result;
    const rows = must(
      await supabase.from("buildings").update({ electricity_rate: v.data.rate }).eq("id", v.data.building_id).eq("owner_id", userId).select("id"),
    );
    if (!rows?.length) return { ok: false, error: t("Building not found", "Building nahi mili") };
    done();
    return { ok: true, message: t("Rate saved", "Rate save ho gaya") };
  });
}

/** Adds the reviewed charges to this month's tenant bills (replaces an earlier confirmation). */
export async function confirmChargesAction(buildingId: string, month: string, rows: unknown): Promise<ActionResult> {
  return ownerAction(async ({ supabase, t }) => {
    const v = validate(z.object({ month: monthString, rows: z.array(allocationRowSchema).min(1).max(1000) }), { month, rows });
    if (!v.ok || !isUuid(buildingId)) return { ok: false, error: t("Please check the amounts.", "Amounts check karein.") };
    const n = must(await supabase.rpc("confirm_electricity_charges", { p_building: buildingId, p_month: v.data.month, p_rows: v.data.rows })) as number;
    done();
    return { ok: true, message: t(`Electricity added to ${n} tenant bills`, `${n} tenants ke bill mein bijli jud gayi`) };
  });
}
