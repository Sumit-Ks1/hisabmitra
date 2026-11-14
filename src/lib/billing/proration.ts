/**
 * Rent proration. Pure functions — no I/O.
 *
 * MIRRORED in SQL: private.prorated_rent / private.period_month_for
 * (supabase/migrations/0003_billing.sql). The database is what actually writes
 * invoices; this copy exists so the UI can show the same calculation before the
 * owner saves. tests/unit/proration.test.ts keeps both honest.
 */

export type ProrationRule = "calendar" | "fixed30" | "full" | "custom";

export type Period = { month: string; start: string; end: string; days: number };

const DAY = 86_400_000;
const toUTC = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const fromUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((toUTC(to) - toUTC(from)) / DAY);

function addMonthsToDate(iso: string, n: number): string {
  const y = +iso.slice(0, 4);
  const m = +iso.slice(5, 7) - 1 + n;
  const d = +iso.slice(8, 10);
  return fromUTC(Date.UTC(y, m, d));
}

/** The billing period that contains `date`, for a building whose cycle starts on `billingDay` (1–28). */
export function periodFor(date: string, billingDay = 1): Period {
  const day = +date.slice(8, 10);
  let month = `${date.slice(0, 7)}-01`;
  if (day < billingDay) month = addMonthsToDate(month, -1);
  const start = `${month.slice(0, 7)}-${String(billingDay).padStart(2, "0")}`;
  const end = fromUTC(toUTC(addMonthsToDate(start, 1)) - DAY);
  return { month, start, end, days: daysBetween(start, end) + 1 };
}

export type ProrationResult = {
  amount: number;
  occupiedDays: number;
  periodDays: number;
  /** true when the tenant stays the whole period (no proration applied) */
  fullPeriod: boolean;
};

/**
 * Rent for the part of a period a tenant actually occupies.
 * @param from first day of stay inside the period (joining date)
 * @param to   last day of stay (vacating date), or null when still staying
 */
export function proratedRent(
  monthlyRent: number,
  rule: ProrationRule,
  period: Pick<Period, "start" | "end">,
  from: string,
  to: string | null = null,
  customAmount?: number | null,
): ProrationResult {
  const periodDays = daysBetween(period.start, period.end) + 1;
  const first = from > period.start ? from : period.start;
  const last = to && to < period.end ? to : period.end;
  const occupiedDays = Math.max(0, daysBetween(first, last) + 1);
  const fullPeriod = occupiedDays >= periodDays;

  if (occupiedDays === 0) return { amount: 0, occupiedDays, periodDays, fullPeriod: false };
  if (rule === "custom" && !fullPeriod) {
    return { amount: Math.round(customAmount ?? 0), occupiedDays, periodDays, fullPeriod };
  }
  if (fullPeriod || rule === "full") return { amount: Math.round(monthlyRent), occupiedDays, periodDays, fullPeriod };
  if (rule === "fixed30") {
    return { amount: Math.round((monthlyRent * Math.min(occupiedDays, 30)) / 30), occupiedDays, periodDays, fullPeriod };
  }
  return { amount: Math.round((monthlyRent * occupiedDays) / periodDays), occupiedDays, periodDays, fullPeriod };
}
