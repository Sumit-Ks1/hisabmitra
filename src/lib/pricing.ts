import type { PricingSettings } from "@/lib/db-types";

/**
 * The ONE place the default price lives in code. It is only a fallback for when
 * the database is unreachable or not configured yet — the real value comes from
 * app_settings.pricing (editable in the admin panel), and the amount an owner
 * actually owes is always computed by the database (private.quote_subscription).
 */
export const FALLBACK_PRICING: PricingSettings = {
  price_per_room: 50,
  duration_months: 1,
  default_building_limit: 1,
  discount_percent: 0,
};

/** Display-only estimate. Mirrors private.quote_subscription. */
export function estimateSubscription(rooms: number, p: PricingSettings): number {
  if (!Number.isFinite(rooms) || rooms <= 0) return 0;
  return Math.round(rooms * p.price_per_room * p.duration_months * (1 - p.discount_percent / 100));
}

export function durationLabel(months: number): string {
  if (months === 1) return "1 month";
  if (months === 12) return "1 year";
  return `${months} months`;
}
