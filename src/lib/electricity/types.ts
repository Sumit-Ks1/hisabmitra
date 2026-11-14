/**
 * Provider-independent contract for fetching and paying a building's main
 * electricity bill through a BBPS-enabled provider.
 *
 * Adapters: MockElectricityProvider (development / sandbox only) and
 * SetuBillPayProvider (live — disabled until real credentials and biller
 * metadata are configured). The rest of the app only ever talks to this interface.
 */

export const UP_DISCOMS = [
  { code: "PVVNL", name: "Paschimanchal Vidyut Vitran Nigam (PVVNL)", region: "Meerut & West UP" },
  { code: "PUVVNL", name: "Purvanchal Vidyut Vitran Nigam (PUVVNL)", region: "Varanasi & East UP" },
  { code: "MVVNL", name: "Madhyanchal Vidyut Vitran Nigam (MVVNL)", region: "Lucknow & Central UP" },
  { code: "DVVNL", name: "Dakshinanchal Vidyut Vitran Nigam (DVVNL)", region: "Agra & South UP" },
  { code: "KESCO", name: "Kanpur Electricity Supply Company (KESCO)", region: "Kanpur" },
] as const;

export const DISCOM_CODES = ["PVVNL", "PUVVNL", "MVVNL", "DVVNL", "KESCO", "OTHER"] as const;
export type DiscomCode = (typeof DISCOM_CODES)[number];

export type Biller = { discom: DiscomCode; name: string; supported: boolean };

export type NormalizedBill = {
  providerRef: string;
  /** first day of the month the bill belongs to (YYYY-MM-01) */
  billMonth: string;
  amount: number;
  billDate: string | null;
  dueDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  units: number | null;
};

export type FetchBillResult =
  | { status: "success"; bill: NormalizedBill }
  /** the request was accepted but the biller has not answered yet */
  | { status: "pending"; requestId: string }
  | { status: "no_bill"; message: string }
  | { status: "failed"; message: string }
  | { status: "not_configured"; message: string };

export type BillPaymentStatus = "initiated" | "pending" | "success" | "failed" | "unknown";

export type PaymentResult = {
  status: BillPaymentStatus;
  providerRef: string | null;
  message?: string;
  /** where the user completes the provider's own payment flow, when there is one */
  redirectUrl?: string;
};

export interface ElectricityProvider {
  readonly id: "mock" | "setu";
  /** true for the sandbox adapter — its bills must always be labelled as not real */
  readonly isMock: boolean;
  listBillers(): Promise<Biller[]>;
  fetchBill(input: { discom: DiscomCode; consumerNumber: string }): Promise<FetchBillResult>;
  getFetchStatus(requestId: string): Promise<FetchBillResult>;
  initiatePayment(input: { billRef: string; amount: number; idempotencyKey: string }): Promise<PaymentResult>;
  getPaymentStatus(providerRef: string): Promise<PaymentResult>;
}
