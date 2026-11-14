import "server-only";
import type { IntegrationSettings } from "@/lib/db-types";
import { MockElectricityProvider } from "./mock-provider";
import { SetuBillPayProvider } from "./setu-provider";
import type { ElectricityProvider } from "./types";

export type ElectricityMode =
  | { mode: "live"; provider: ElectricityProvider }
  | { mode: "sandbox"; provider: ElectricityProvider }
  | { mode: "manual"; provider: null; reason: "disabled" | "live_not_configured" };

/**
 * Decides which adapter (if any) is in use.
 *  - "live" needs the admin switch AND real provider configuration.
 *  - "sandbox" is the mock adapter; it is only reachable when an admin
 *    explicitly selects it, and its bills are always labelled as not real.
 *  - otherwise owners enter the DISCOM bill by hand.
 */
export function resolveElectricity(setting: IntegrationSettings["electricity"] | undefined): ElectricityMode {
  if (setting === "live") {
    return SetuBillPayProvider.isConfigured()
      ? { mode: "live", provider: new SetuBillPayProvider() }
      : { mode: "manual", provider: null, reason: "live_not_configured" };
  }
  if (setting === "sandbox") return { mode: "sandbox", provider: new MockElectricityProvider() };
  return { mode: "manual", provider: null, reason: "disabled" };
}

/** Minimum time between two provider fetches for one connection. */
export const BILL_FETCH_COOLDOWN_MINUTES = 30;
