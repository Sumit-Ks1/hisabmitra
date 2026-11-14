import { fmtPhone, inr, monthLabel, normalizePhone } from "@/lib/format";

/** Everything a reminder needs, already calculated from invoices and payments. */
export type ReminderData = {
  tenantId: string;
  tenantName: string;
  phone: string | null;
  whatsapp: string | null;
  optedIn: boolean;
  periodMonth: string;
  room: string | null;
  rent: number;
  electricity: number;
  other: number;
  total: number;
  paid: number;
  /** remaining for this month */
  remaining: number;
  /** unpaid amount from earlier months */
  previousDue: number;
};

export type Eligibility =
  | { eligible: true; to: string }
  | { eligible: false; reason: "no_consent" | "invalid_number" | "nothing_due" };

/** WhatsApp destination in international format without "+", e.g. 919811111111. */
export function whatsappNumber(d: Pick<ReminderData, "phone" | "whatsapp">): string | null {
  const n = normalizePhone(d.whatsapp) || normalizePhone(d.phone);
  return n ? `91${n}` : null;
}

export function totalDue(d: Pick<ReminderData, "remaining" | "previousDue">): number {
  return Math.max(0, d.remaining) + Math.max(0, d.previousDue);
}

/**
 * Business-initiated template messages need BOTH a valid number and the tenant's
 * opt-in. A tenant who owes nothing is never reminded.
 */
export function checkEligibility(d: ReminderData): Eligibility {
  if (totalDue(d) <= 0) return { eligible: false, reason: "nothing_due" };
  const to = whatsappNumber(d);
  if (!to) return { eligible: false, reason: "invalid_number" };
  if (!d.optedIn) return { eligible: false, reason: "no_consent" };
  return { eligible: true, to };
}

/**
 * Parameters for the approved Meta template, in order. The template body the
 * business registers with Meta must use exactly these nine variables:
 *
 *   Namaste {{1}} ji,
 *   {{2}} ka PG bill:
 *   Room: {{3}}
 *   Rent: {{4}}
 *   Electricity: {{5}}
 *   Other charges: {{6}}
 *   Total: {{7}}
 *   Paid: {{8}}
 *   Remaining: {{9}}
 *   Kripya remaining amount jama kar dein.
 */
export function templateParams(d: ReminderData): string[] {
  return [
    firstName(d.tenantName),
    monthLabel(d.periodMonth),
    d.room ?? "-",
    inr(d.rent),
    inr(d.electricity),
    inr(d.other + d.previousDue),
    inr(d.total + d.previousDue),
    inr(d.paid),
    inr(totalDue(d)),
  ];
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Plain-text version: shown as the preview and used for the manual copy / wa.me option. */
export function reminderText(d: ReminderData, pgName: string): string {
  const lines = [
    `Namaste ${firstName(d.tenantName)} ji,`,
    "",
    `${monthLabel(d.periodMonth)} ka PG bill:`,
    "",
    `Room: ${d.room ?? "-"}`,
    `Rent: ${inr(d.rent)}`,
    `Electricity: ${inr(d.electricity)}`,
    `Other charges: ${inr(d.other)}`,
  ];
  if (d.previousDue > 0) lines.push(`Pichhla baaki: ${inr(d.previousDue)}`);
  lines.push(
    `Total: ${inr(d.total + d.previousDue)}`,
    `Paid: ${inr(d.paid)}`,
    `Remaining: ${inr(totalDue(d))}`,
    "",
    "Kripya remaining amount jama kar dein.",
    "",
    "Thank you,",
    pgName,
  );
  return lines.join("\n");
}

/** Click-to-chat link: opens WhatsApp on the owner's own phone with the text filled in. */
export function waMeLink(to: string, text: string): string {
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

/** One reminder per tenant, per bill month, per calendar day. */
export function dedupeKey(tenantId: string, periodMonth: string, today: string): string {
  return `${tenantId}:${periodMonth}:${today}`;
}

export function displayNumber(d: Pick<ReminderData, "phone" | "whatsapp">): string {
  return fmtPhone(normalizePhone(d.whatsapp) || normalizePhone(d.phone) || d.phone);
}
