import { addMonths, monthStart, todayIST } from "@/lib/format";
import {
  UP_DISCOMS,
  type Biller,
  type ElectricityProvider,
  type FetchBillResult,
  type PaymentResult,
} from "./types";

/**
 * DEVELOPMENT / SANDBOX ONLY.
 *
 * Returns made-up bills so the screens and the payment state machine can be
 * exercised without BBPS access. Nothing here talks to a DISCOM. Every bill it
 * produces is stored with source = 'mock' and shown with a "Sandbox — not a real
 * bill" label; no money ever moves.
 *
 * Scenarios are chosen by the LAST digit of the consumer number:
 *   …0  → no bill available for the current month
 *   …9  → provider failure
 *   …1  → bill found; a payment stays "pending"
 *   …2  → bill found; a payment fails
 *   …3  → bill found; a payment status is "unknown"
 *   any other → bill found; a payment succeeds
 */
export class MockElectricityProvider implements ElectricityProvider {
  readonly id = "mock" as const;
  readonly isMock = true;

  constructor(private readonly today: string = todayIST()) {}

  async listBillers(): Promise<Biller[]> {
    return UP_DISCOMS.map((d) => ({ discom: d.code, name: d.name, supported: true }));
  }

  async fetchBill(input: { discom: string; consumerNumber: string }): Promise<FetchBillResult> {
    const last = input.consumerNumber.slice(-1);
    if (last === "0") return { status: "no_bill", message: "No bill is available for this month yet." };
    if (last === "9") return { status: "failed", message: "Sandbox provider error (simulated)." };

    const month = monthStart(this.today);
    const seed = [...input.consumerNumber].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
    const units = 1200 + (seed % 900);
    const amount = Math.round(units * 7.5 + 450);
    const prev = addMonths(month, -1);
    return {
      status: "success",
      bill: {
        providerRef: `MOCKBILL-${last}-${month.slice(0, 7)}-${seed}`,
        billMonth: month,
        amount,
        billDate: `${month.slice(0, 7)}-05`,
        dueDate: `${month.slice(0, 7)}-20`,
        periodStart: prev,
        periodEnd: `${prev.slice(0, 7)}-28`,
        units,
      },
    };
  }

  async getFetchStatus(): Promise<FetchBillResult> {
    return { status: "failed", message: "The sandbox provider answers immediately; nothing is pending." };
  }

  async initiatePayment(input: { billRef: string; amount: number; idempotencyKey: string }): Promise<PaymentResult> {
    const scenario = input.billRef.split("-")[1] ?? "5";
    return {
      status: "pending",
      providerRef: `MOCKPAY-${scenario}-${input.idempotencyKey.slice(0, 12)}`,
      message: "Sandbox payment started. No money was moved.",
    };
  }

  async getPaymentStatus(providerRef: string): Promise<PaymentResult> {
    const scenario = providerRef.split("-")[1];
    if (scenario === "1") return { status: "pending", providerRef, message: "Sandbox: still pending." };
    if (scenario === "2") return { status: "failed", providerRef, message: "Sandbox: payment failed (simulated)." };
    if (scenario === "3") return { status: "unknown", providerRef, message: "Sandbox: status unknown (simulated)." };
    return { status: "success", providerRef, message: "Sandbox: payment successful (simulated, no money moved)." };
  }
}
