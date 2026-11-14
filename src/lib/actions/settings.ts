"use server";

import { revalidatePath } from "next/cache";
import { billingSettingsSchema, buildingSettingsSchema, electricitySettingsSchema } from "@/lib/validation";
import { formToObject, must, ownerAction, validate, type ActionResult } from "./helpers";

const done = () => revalidatePath("/app", "layout");

export async function updateBuildingAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const v = validate(buildingSettingsSchema, formToObject(fd));
    if (!v.ok) return v.result;
    const { id, pincode, ...rest } = v.data;
    must(await supabase.from("buildings").update({ ...rest, pincode: pincode || null }).eq("id", id).eq("owner_id", userId));
    done();
    return { ok: true, message: t("Building saved", "Building save ho gayi") };
  });
}

export async function updateBillingSettingsAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const v = validate(billingSettingsSchema, formToObject(fd));
    if (!v.ok) return v.result;
    const { id, ...rest } = v.data;
    must(await supabase.from("buildings").update(rest).eq("id", id).eq("owner_id", userId));
    done();
    return { ok: true, message: t("Saved. Applies to bills created from now on.", "Save ho gaya. Ab se banne wale bills par lagega.") };
  });
}

export async function updateElectricitySettingsAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    const v = validate(electricitySettingsSchema, formToObject(fd));
    if (!v.ok) return v.result;
    const d = v.data;
    must(
      await supabase
        .from("buildings")
        .update({
          electricity_method: d.electricity_method,
          electricity_rate: d.electricity_rate,
          common_area_rule: d.common_area_rule,
          electricity_billing_day: d.electricity_billing_day === "" || d.electricity_billing_day === undefined ? null : d.electricity_billing_day,
        })
        .eq("id", d.id)
        .eq("owner_id", userId),
    );
    must(
      await supabase
        .from("electricity_connections")
        .upsert({ owner_id: userId, building_id: d.id, discom: d.discom, consumer_number: d.consumer_number, meter_number: d.meter_number || null }, { onConflict: "building_id" }),
    );
    done();
    return { ok: true, message: t("Electricity settings saved", "Bijli settings save ho gayi") };
  });
}
