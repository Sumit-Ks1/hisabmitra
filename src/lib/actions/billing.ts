"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/uploads/rules";
import { invoiceItemSchema, paymentSchema } from "@/lib/validation";
import { formToObject, must, ownerAction, validate, type ActionResult } from "./helpers";

const done = () => revalidatePath("/app", "layout");

/**
 * Records money the owner has actually received. The form carries a one-time
 * key, so a double tap or a retry on a slow network records the payment once.
 */
export async function recordPaymentAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, t }) => {
    const v = validate(paymentSchema, formToObject(fd));
    if (!v.ok) return v.result;
    const d = v.data;
    must(
      await supabase.rpc("record_payment", {
        p_tenant: d.tenant_id,
        p_invoice: d.invoice_id || null,
        p_amount: d.amount,
        p_paid_on: d.paid_on,
        p_method: d.method,
        p_reference: d.reference || null,
        p_notes: d.notes || null,
        p_kind: d.kind,
        p_idempotency_key: d.idempotency_key,
      }),
    );
    done();
    return { ok: true, message: t("Payment recorded", "Payment likh liya") };
  });
}

export async function voidPaymentAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, t }) => {
    const f = formToObject(fd);
    if (!isUuid(f.group_id)) return { ok: false, error: t("Payment not found", "Payment nahi mila") };
    must(await supabase.rpc("void_payment", { p_group: f.group_id, p_reason: f.reason ?? "" }));
    done();
    return { ok: true, message: t("Payment cancelled. It stays in history as cancelled.", "Payment cancel ho gaya. History mein cancelled dikhega.") };
  });
}

/** Extra charge (positive) or discount (stored negative) on one invoice. */
export async function addInvoiceItemAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const v = validate(invoiceItemSchema, formToObject(fd));
    if (!v.ok) return v.result;
    const d = v.data;
    const { data: inv } = await supabase.from("invoices").select("id").eq("id", d.invoice_id).eq("owner_id", userId).maybeSingle();
    if (!inv) return { ok: false, error: t("Bill not found", "Bill nahi mila") };
    must(
      await supabase.from("invoice_items").insert({
        owner_id: userId,
        invoice_id: d.invoice_id,
        kind: d.kind,
        description: d.description,
        amount: d.kind === "discount" ? -d.amount : d.amount,
        source: "manual",
      }),
    );
    done();
    return { ok: true, message: d.kind === "discount" ? t("Discount added", "Discount jud gaya") : t("Charge added", "Charge jud gaya") };
  });
}

export async function deleteInvoiceItemAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const id = String(fd.get("id") ?? "");
    if (!isUuid(id)) return { ok: false, error: t("Not found", "Nahi mila") };
    // only lines the owner added by hand; system rent / electricity lines stay
    const rows = must(await supabase.from("invoice_items").delete().eq("id", id).eq("owner_id", userId).eq("source", "manual").select("id"));
    if (!rows?.length) return { ok: false, error: t("This line cannot be removed.", "Yeh line hata nahi sakte.") };
    done();
    return { ok: true, message: t("Removed", "Hata diya") };
  });
}
