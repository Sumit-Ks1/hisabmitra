/** UPI deep link for a QR code. See NPCI's UPI linking specification (upi://pay). */

const VPA = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/;

export function isValidUpiId(id: string | null | undefined): id is string {
  return typeof id === "string" && VPA.test(id.trim());
}

export function buildUpiUri(opts: { upiId: string; payeeName: string; amount: number; note?: string }): string {
  if (!isValidUpiId(opts.upiId)) throw new Error("Invalid UPI ID");
  if (!Number.isFinite(opts.amount) || opts.amount <= 0) throw new Error("Invalid amount");
  const params = new URLSearchParams({
    pa: opts.upiId.trim(),
    pn: opts.payeeName.trim().slice(0, 50) || "HisabMitra",
    am: opts.amount.toFixed(2),
    cu: "INR",
  });
  if (opts.note) params.set("tn", opts.note.slice(0, 50));
  // URLSearchParams encodes spaces as "+"; UPI apps expect %20.
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

/** Normalises what a user typed as a UPI reference / UTR: letters and digits only, upper-case. */
export function normalizeUpiReference(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}
