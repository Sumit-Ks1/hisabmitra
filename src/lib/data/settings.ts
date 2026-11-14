import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import type {
  AnnouncementSettings,
  IntegrationSettings,
  PricingSettings,
  SupportSettings,
  UpiSettings,
} from "@/lib/db-types";
import { FALLBACK_PRICING } from "@/lib/pricing";
import { supabaseConfigured } from "@/lib/public-env";
import { createPublicClient } from "@/lib/supabase/server";

export const SETTINGS_TAG = "app-settings";

const DEFAULTS = {
  pricing: FALLBACK_PRICING,
  support: { phone: "", email: "" } as SupportSettings,
  upi: { upi_id: "", payee_name: "HisabMitra" } as UpiSettings,
  integrations: { electricity: "disabled", whatsapp: "disabled" } as IntegrationSettings,
  announcement: { message: "", active: false } as AnnouncementSettings,
};
type Key = keyof typeof DEFAULTS;

/**
 * Public settings (pricing + support contact) for the static marketing pages.
 * Cached, and refreshed when the admin saves settings.
 */
export async function getPublicSettings(): Promise<{ pricing: PricingSettings; support: SupportSettings }> {
  "use cache";
  cacheLife("hours");
  cacheTag(SETTINGS_TAG);
  if (!supabaseConfigured) return { pricing: DEFAULTS.pricing, support: DEFAULTS.support };
  try {
    const { data } = await createPublicClient().from("app_settings").select("key, value").in("key", ["pricing", "support"]);
    const map = new Map((data ?? []).map((r) => [r.key as string, r.value]));
    return {
      pricing: { ...DEFAULTS.pricing, ...(map.get("pricing") as Partial<PricingSettings> | undefined) },
      support: { ...DEFAULTS.support, ...(map.get("support") as Partial<SupportSettings> | undefined) },
    };
  } catch {
    return { pricing: DEFAULTS.pricing, support: DEFAULTS.support };
  }
}

/** Settings as the signed-in user is allowed to see them (RLS decides). */
export async function getSettings<K extends Key>(supabase: SupabaseClient, keys: K[]): Promise<{ [P in K]: (typeof DEFAULTS)[P] }> {
  const { data } = await supabase.from("app_settings").select("key, value").in("key", keys);
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as object]));
  const out = {} as { [P in K]: (typeof DEFAULTS)[P] };
  for (const k of keys) out[k] = { ...DEFAULTS[k], ...(map.get(k) ?? {}) } as (typeof DEFAULTS)[K];
  return out;
}
