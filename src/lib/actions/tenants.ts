"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/uploads/rules";
import { isoDate, tenantEditSchema, tenantSchema } from "@/lib/validation";
import { formToObject, must, ownerAction, validate, type ActionResult } from "./helpers";

const done = () => revalidatePath("/app", "layout");

export async function createTenantAction(buildingId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return ownerAction<{ id: string }>(async ({ supabase, t }) => {
    if (!isUuid(buildingId)) return { ok: false, error: t("Invalid building", "Building galat hai") };
    const v = validate(tenantSchema, input);
    if (!v.ok) return v.result;
    const d = v.data;
    const num = (x: number | "" | undefined) => (x === "" || x === undefined ? null : x);
    // The tenant, billing preference, consent, allocation and first invoice are
    // created in ONE database transaction: either all of it exists or none.
    const id = must(
      await supabase.rpc("create_tenant", {
        p: {
          building_id: buildingId,
          full_name: d.full_name,
          phone: d.phone,
          whatsapp: d.whatsapp,
          email: d.email || "",
          gender: d.gender || "",
          joined_on: d.joined_on,
          emergency_contact: d.emergency_contact,
          occupation: d.occupation,
          monthly_rent: d.monthly_rent,
          security_deposit: d.security_deposit,
          electricity_rule: d.electricity_rule,
          electricity_custom_amount: d.electricity_rule === "custom" ? num(d.electricity_custom_amount) : null,
          notes: d.notes,
          bed_id: d.bed_id || "",
          proration_rule: d.proration_rule,
          first_month_amount: d.proration_rule === "custom" ? num(d.first_month_amount) : null,
          first_month_reason: d.first_month_reason,
          opening_balance: num(d.opening_balance),
          whatsapp_opt_in: d.whatsapp_opt_in ?? false,
        },
      }),
    ) as string;
    done();
    return { ok: true, message: t("Tenant added", "Tenant jud gaya"), data: { id } };
  });
}

export async function updateTenantAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const v = validate(tenantEditSchema, formToObject(fd));
    if (!v.ok) return v.result;
    const d = v.data;
    must(
      await supabase
        .from("tenants")
        .update({
          full_name: d.full_name,
          phone: d.phone,
          whatsapp: d.whatsapp || null,
          email: d.email || null,
          emergency_contact: d.emergency_contact || null,
          occupation: d.occupation || null,
          monthly_rent: d.monthly_rent,
          security_deposit: d.security_deposit,
          electricity_rule: d.electricity_rule,
          electricity_custom_amount: d.electricity_rule === "custom" && d.electricity_custom_amount !== "" ? (d.electricity_custom_amount ?? null) : null,
        })
        .eq("id", d.id)
        .eq("owner_id", userId),
    );
    done();
    return { ok: true, message: t("Saved. New rent applies from the next invoice.", "Save ho gaya. Naya rent agle invoice se lagega.") };
  });
}

export async function saveTenantNotesAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const f = formToObject(fd);
    if (!isUuid(f.id)) return { ok: false, error: t("Tenant not found", "Tenant nahi mila") };
    must(await supabase.from("tenants").update({ notes: f.notes ? f.notes.slice(0, 2000) : null }).eq("id", f.id).eq("owner_id", userId));
    done();
    return { ok: true, message: t("Notes saved", "Notes save ho gaye") };
  });
}

export async function vacateTenantAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, t }) => {
    const f = formToObject(fd);
    if (!isUuid(f.id) || !isoDate.safeParse(f.date).success) return { ok: false, error: t("Choose the vacating date", "Jaane ki date chunein") };
    must(await supabase.rpc("vacate_tenant", { p_tenant: f.id, p_date: f.date, p_prorate: f.prorate === "on" }));
    done();
    return { ok: true, message: t("Tenant marked as vacated. All records are kept.", "Tenant vacated mark ho gaya. Saare records surakshit hain.") };
  });
}

export async function setWhatsappConsentAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const f = formToObject(fd);
    if (!isUuid(f.tenant_id)) return { ok: false, error: t("Tenant not found", "Tenant nahi mila") };
    const opted = f.opted_in === "1";
    const now = new Date().toISOString();
    must(
      await supabase.from("whatsapp_consents").upsert({
        tenant_id: f.tenant_id,
        owner_id: userId,
        opted_in: opted,
        ...(opted ? { opted_in_at: now, opted_out_at: null } : { opted_out_at: now }),
        source: "owner_confirmed",
      }),
    );
    done();
    return { ok: true, message: opted ? t("WhatsApp consent recorded", "WhatsApp consent record ho gayi") : t("WhatsApp reminders stopped for this tenant", "Is tenant ke WhatsApp reminders band") };
  });
}

/** Owner confirms the tenant agreed to their ID documents being stored. Required before any upload. */
export async function setDocumentConsentAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const id = String(fd.get("id") ?? "");
    if (!isUuid(id) || fd.get("consent") !== "on") return { ok: false, error: t("Please tick the consent box", "Consent box tick karein") };
    must(await supabase.from("tenants").update({ documents_consent_at: new Date().toISOString() }).eq("id", id).eq("owner_id", userId));
    done();
    return { ok: true, message: t("Consent recorded", "Consent record ho gayi") };
  });
}

/** Deletes one document (id) or every document of a tenant (tenant_id) — file first, then the record. */
export async function deleteDocumentsAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const f = formToObject(fd);
    let q = supabase.from("tenant_documents").select("id, storage_path").eq("owner_id", userId);
    if (isUuid(f.id)) q = q.eq("id", f.id);
    else if (isUuid(f.tenant_id)) q = q.eq("tenant_id", f.tenant_id);
    else return { ok: false, error: t("Document not found", "Document nahi mila") };
    const docs = (must(await q) ?? []) as { id: string; storage_path: string }[];
    if (docs.length === 0) return { ok: false, error: t("Document not found", "Document nahi mila") };
    const { error } = await supabase.storage.from("tenant-documents").remove(docs.map((d) => d.storage_path));
    if (error) throw new Error(error.message);
    must(await supabase.from("tenant_documents").delete().in("id", docs.map((d) => d.id)).eq("owner_id", userId));
    if (isUuid(f.tenant_id) && !isUuid(f.id)) {
      await supabase.from("tenants").update({ documents_consent_at: null }).eq("id", f.tenant_id).eq("owner_id", userId);
    }
    done();
    return { ok: true, message: t("Deleted permanently", "Hamesha ke liye delete ho gaya") };
  });
}
