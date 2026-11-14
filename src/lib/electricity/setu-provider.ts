import "server-only";
import { serverEnv, setuCredentialsPresent } from "@/lib/env";
import type {
  Biller,
  DiscomCode,
  ElectricityProvider,
  FetchBillResult,
  PaymentResult,
} from "./types";

/**
 * Live BBPS adapter for Setu BillPay — STRUCTURE ONLY, intentionally not wired.
 *
 * Why it does not make HTTP calls yet:
 *   Live BillPay needs COU / agent-institution onboarding, production
 *   credentials, and the biller catalogue for each DISCOM (biller ids and the
 *   exact customer-parameter names). None of that exists for this project yet,
 *   and inventing endpoints, parameter names or response shapes would produce
 *   code that looks finished but silently breaks with real money involved.
 *
 * To activate (see docs/SETUP.md → "Electricity (BBPS)"):
 *   1. Complete Setu BillPay onboarding and obtain credentials.
 *   2. Set SETU_BILLPAY_BASE_URL, SETU_BILLPAY_CLIENT_ID, SETU_BILLPAY_CLIENT_SECRET.
 *   3. Set SETU_BILLPAY_BILLER_MAP to JSON taken from Setu's biller catalogue:
 *        { "PVVNL": { "billerId": "…", "customerParam": "…" }, … }
 *   4. Implement the four `TODO(setu)` methods below against Setu's current
 *      API reference, mapping responses into NormalizedBill / PaymentResult.
 *   5. In Admin → Settings set the electricity integration to "Live".
 *
 * Until then every method reports `not_configured`, and the app falls back to
 * manual bill entry (or the clearly-labelled sandbox).
 */

type BillerConfig = { billerId: string; customerParam: string };

function readBillerMap(): Partial<Record<DiscomCode, BillerConfig>> {
  if (!serverEnv.setu.billerMap) return {};
  try {
    const parsed = JSON.parse(serverEnv.setu.billerMap) as Record<string, BillerConfig>;
    const out: Partial<Record<DiscomCode, BillerConfig>> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.billerId === "string" && typeof v.customerParam === "string") {
        out[k as DiscomCode] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

const NOT_WIRED =
  "Live BBPS bill fetch is not active yet. Provider onboarding and biller details are still pending.";

export class SetuBillPayProvider implements ElectricityProvider {
  readonly id = "setu" as const;
  readonly isMock = false;
  private readonly billers = readBillerMap();

  /** True only when credentials AND biller metadata are present. */
  static isConfigured(): boolean {
    return setuCredentialsPresent && Object.keys(readBillerMap()).length > 0;
  }

  async listBillers(): Promise<Biller[]> {
    return (Object.keys(this.billers) as DiscomCode[]).map((discom) => ({
      discom,
      name: discom,
      supported: true,
    }));
  }

  async fetchBill(input: { discom: DiscomCode; consumerNumber: string }): Promise<FetchBillResult> {
    if (!SetuBillPayProvider.isConfigured()) return { status: "not_configured", message: NOT_WIRED };
    if (!this.billers[input.discom]) {
      return { status: "not_configured", message: `No BBPS biller is configured for ${input.discom}.` };
    }
    // TODO(setu): create a bill-fetch request for this.billers[input.discom] and
    // the consumer number, then normalise the response. Not implemented on purpose.
    return { status: "not_configured", message: NOT_WIRED };
  }

  async getFetchStatus(): Promise<FetchBillResult> {
    // TODO(setu): poll the bill-fetch request.
    return { status: "not_configured", message: NOT_WIRED };
  }

  async initiatePayment(): Promise<PaymentResult> {
    // TODO(setu): create the bill payment. Must be idempotent on idempotencyKey.
    return { status: "failed", providerRef: null, message: NOT_WIRED };
  }

  async getPaymentStatus(providerRef: string): Promise<PaymentResult> {
    // TODO(setu): read the payment status. Never report success unless the provider does.
    return { status: "unknown", providerRef, message: NOT_WIRED };
  }
}
