import { redirect } from "next/navigation";
import type { z } from "zod";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { homeFor, requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/data/settings";
import type { Building, ElectricityConnection } from "@/lib/db-types";
import { LangProvider } from "@/lib/i18n/client";
import type { onboardingSchema } from "@/lib/validation";

type In = z.input<typeof onboardingSchema>;

const EDITABLE = ["onboarding", "rejected", "info_required"];

export default async function OnboardingPage() {
  const ctx = await requireUser();
  const status = ctx.owner?.status ?? "onboarding";
  if (ctx.isAdmin || !EDITABLE.includes(status)) redirect(ctx.isAdmin || status === "approved" ? homeFor(ctx) : "/onboarding/status");

  const { supabase, userId, profile } = ctx;
  const [{ data: b }, settings] = await Promise.all([
    supabase.from("buildings").select("*").eq("owner_id", userId).eq("status", "pending").order("created_at").limit(1).maybeSingle(),
    getSettings(supabase, ["pricing"]),
  ]);
  const building = b as Building | null;
  const conn = building
    ? ((await supabase.from("electricity_connections").select("*").eq("building_id", building.id).eq("owner_id", userId).maybeSingle()).data as ElectricityConnection | null)
    : null;

  // priority: unsaved draft → what was submitted before → profile
  const draft = (ctx.owner?.onboarding_draft ?? {}) as Partial<In>;
  const defaults: In = {
    owner: {
      full_name: profile.full_name,
      phone: profile.phone ?? "",
      whatsapp: profile.whatsapp ?? "",
      language: profile.language,
      ...draft.owner,
    },
    building: {
      name: building?.name ?? "",
      address: building?.address ?? "",
      state: building?.state ?? "Uttar Pradesh",
      city: building?.city ?? "",
      pincode: building?.pincode ?? "",
      floors_count: building?.floors_count ?? "",
      rooms_count: building?.rooms_count ?? "",
      beds_count: building?.beds_count ?? "",
      pg_type: building?.pg_type ?? "boys",
      description: building?.description ?? "",
      ...draft.building,
    } as In["building"],
    electricity: {
      discom: (conn?.discom as In["electricity"]["discom"]) ?? "PVVNL",
      consumer_number: conn?.consumer_number ?? "",
      connection_type: conn?.connection_type ?? "",
      meter_number: conn?.meter_number ?? "",
      billing_cycle: conn?.billing_cycle ?? "",
      ...draft.electricity,
    },
  };

  return (
    <LangProvider lang={ctx.lang}>
      <OnboardingWizard email={ctx.email} defaults={defaults} pricing={settings.pricing} reviewNote={status === "onboarding" ? null : (ctx.owner?.review_note ?? null)} />
    </LangProvider>
  );
}
