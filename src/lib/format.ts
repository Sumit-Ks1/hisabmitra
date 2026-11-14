/** Formatting helpers shared by server and client. All dates are plain YYYY-MM-DD strings. */

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const INR2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function inr(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  const body = Number.isInteger(n) ? INR.format(Math.abs(n)) : INR2.format(Math.abs(n));
  return `${n < 0 ? "−" : ""}₹${body}`;
}

/** Today's date in India, as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "16 Nov 2026" */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const { y, m, d } = parts(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "16 Nov" */
export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const { m, d } = parts(iso);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "November 2026" from any date inside the month */
export function monthLabel(iso: string): string {
  const { y, m } = parts(iso);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function monthShort(iso: string): string {
  const { y, m } = parts(iso);
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

/** First day of the month containing `iso`. */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: string, n: number): string {
  const { y, m } = parts(iso);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Keeps only digits and returns the 10-digit Indian mobile number, or "" when it isn't one. */
export function normalizePhone(input: string | null | undefined): string {
  let digits = (input ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : "";
}

export function fmtPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  return phone.length === 10 ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone;
}

/** "XXXXXX7890" — never show a full consumer / account number on screen. */
export function maskTail(value: string | null | undefined, visible = 4): string {
  if (!value) return "—";
  if (value.length <= visible) return value;
  return "•".repeat(Math.min(value.length - visible, 8)) + value.slice(-visible);
}

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
