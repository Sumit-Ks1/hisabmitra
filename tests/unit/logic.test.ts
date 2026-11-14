import { describe, expect, it } from "vitest";
import { createDb } from "../db/harness";
import { periodFor, proratedRent, type ProrationRule } from "@/lib/billing/proration";
import { computeElectricity, reconcile, splitByWeights, type AllocInput } from "@/lib/electricity/allocation";
import { MockElectricityProvider } from "@/lib/electricity/mock-provider";
import { addMonths, inr, maskTail, monthLabel, normalizePhone, todayIST } from "@/lib/format";
import { estimateSubscription, FALLBACK_PRICING } from "@/lib/pricing";
import { isOwnedPath, safeDisplayName, sniffMime } from "@/lib/uploads/rules";
import { buildUpiUri, isValidUpiId, normalizeUpiReference } from "@/lib/upi";
import { checkEligibility, dedupeKey, reminderText, templateParams, type ReminderData } from "@/lib/whatsapp/message";

describe("billing periods", () => {
  it("calendar month when billing day is 1", () => {
    expect(periodFor("2026-11-16", 1)).toEqual({ month: "2026-11-01", start: "2026-11-01", end: "2026-11-30", days: 30 });
    expect(periodFor("2026-02-10", 1).days).toBe(28);
    expect(periodFor("2028-02-10", 1).days).toBe(29);
  });
  it("custom billing day spans two calendar months", () => {
    expect(periodFor("2026-11-16", 10)).toMatchObject({ month: "2026-11-01", start: "2026-11-10", end: "2026-12-09" });
    expect(periodFor("2026-11-05", 10)).toMatchObject({ month: "2026-10-01", start: "2026-10-10", end: "2026-11-09" });
    expect(periodFor("2027-01-03", 10)).toMatchObject({ month: "2026-12-01", start: "2026-12-10", end: "2027-01-09" });
  });
});

describe("proration", () => {
  const nov = periodFor("2026-11-16", 1);
  it("spec example: ₹8,000, joins 16 Nov → 15 days → ₹4,000", () => {
    expect(proratedRent(8000, "calendar", nov, "2026-11-16")).toMatchObject({ amount: 4000, occupiedDays: 15, periodDays: 30 });
  });
  it("joining on the first day is a full month under every rule", () => {
    for (const rule of ["calendar", "fixed30", "full", "custom"] as ProrationRule[]) {
      expect(proratedRent(8000, rule, nov, "2026-11-01", null, 123).amount).toBe(8000);
    }
  });
  it("fixed-30, full-month and custom rules", () => {
    const dec = periodFor("2026-12-16", 1);
    expect(proratedRent(9300, "calendar", dec, "2026-12-16").amount).toBe(4800); // 16/31
    expect(proratedRent(9300, "fixed30", dec, "2026-12-16").amount).toBe(4960); // 16/30
    expect(proratedRent(9300, "full", dec, "2026-12-16").amount).toBe(9300);
    expect(proratedRent(9300, "custom", dec, "2026-12-16", null, 4000).amount).toBe(4000);
  });
  it("vacating mid-month and a stay entirely inside the month", () => {
    expect(proratedRent(8000, "calendar", nov, "2026-11-01", "2026-11-20")).toMatchObject({ amount: 5333, occupiedDays: 20 });
    expect(proratedRent(8000, "calendar", nov, "2026-11-10", "2026-11-19")).toMatchObject({ amount: 2667, occupiedDays: 10 });
    expect(proratedRent(8000, "calendar", nov, "2026-12-05").amount).toBe(0);
  });

  it("matches the SQL implementation used for real invoices", async () => {
    const db = await createDb();
    const cases: [number, ProrationRule, string, string, string, string | null][] = [
      [8000, "calendar", "2026-11-01", "2026-11-30", "2026-11-16", null],
      [8000, "calendar", "2026-11-01", "2026-11-30", "2026-11-01", "2026-11-20"],
      [9300, "fixed30", "2026-12-01", "2026-12-31", "2026-12-16", null],
      [9300, "full", "2026-12-01", "2026-12-31", "2026-12-16", null],
      [7777, "calendar", "2026-02-01", "2026-02-28", "2026-02-11", null],
      [6500, "fixed30", "2026-02-01", "2026-02-28", "2026-02-11", "2026-02-20"],
      [8000, "calendar", "2026-11-10", "2026-12-09", "2026-11-25", null],
      [5000, "calendar", "2026-11-01", "2026-11-30", "2026-10-01", null],
    ];
    for (const [rent, rule, ps, pe, from, to] of cases) {
      const sql = await db.root<{ v: number }>(
        `select private.prorated_rent($1, $2, $3, $4, $5, $6)::float as v`, [rent, rule, ps, pe, from, to]);
      expect(proratedRent(rent, rule, { start: ps, end: pe }, from, to).amount, JSON.stringify([rent, rule, from, to])).toBe(sql[0].v);
    }
    for (const [date, day] of [["2026-11-16", 1], ["2026-11-05", 10], ["2027-01-03", 10], ["2026-03-28", 28]] as [string, number][]) {
      const sql = await db.root<{ v: string }>(`select private.period_month_for($1, $2)::text as v`, [day, date]);
      expect(periodFor(date, day).month).toBe(sql[0].v);
    }
  });
});

describe("pricing and UPI", () => {
  it("₹50 per room per month", () => {
    for (const [rooms, amount] of [[10, 500], [20, 1000], [30, 1500], [40, 2000], [50, 2500]]) {
      expect(estimateSubscription(rooms, FALLBACK_PRICING)).toBe(amount);
    }
    expect(estimateSubscription(20, { ...FALLBACK_PRICING, duration_months: 12, discount_percent: 10 })).toBe(10800);
    expect(estimateSubscription(-5, FALLBACK_PRICING)).toBe(0);
  });
  it("builds a UPI payment link and validates ids", () => {
    const uri = buildUpiUri({ upiId: "hisabmitra@okaxis", payeeName: "Hisab Mitra", amount: 1500, note: "HisabMitra subscription" });
    expect(uri).toBe("upi://pay?pa=hisabmitra%40okaxis&pn=Hisab%20Mitra&am=1500.00&cu=INR&tn=HisabMitra%20subscription");
    expect(isValidUpiId("name@bank")).toBe(true);
    expect(isValidUpiId("not-a-upi")).toBe(false);
    expect(isValidUpiId("")).toBe(false);
    expect(() => buildUpiUri({ upiId: "bad", payeeName: "x", amount: 10 })).toThrow();
    expect(() => buildUpiUri({ upiId: "a@b", payeeName: "x", amount: 0 })).toThrow();
    expect(normalizeUpiReference(" 4321 8765-0912 ")).toBe("432187650912");
  });
});

describe("formatting", () => {
  it("money, phones, masking, dates", () => {
    expect(inr(125000)).toBe("₹1,25,000");
    expect(inr(-500)).toBe("−₹500");
    expect(normalizePhone("+91 98765-43210")).toBe("9876543210");
    expect(normalizePhone("09876543210")).toBe("9876543210");
    expect(normalizePhone("12345")).toBe("");
    expect(maskTail("1234567890")).toBe("••••••7890");
    expect(monthLabel("2026-11-01")).toBe("November 2026");
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(todayIST(new Date("2026-11-14T20:00:00Z"))).toBe("2026-11-15");
  });
});

describe("electricity allocation", () => {
  const tenants = [
    { tenantId: "a", name: "A", roomId: "r1", roomName: "101", rule: "building" as const },
    { tenantId: "b", name: "B", roomId: "r1", roomName: "101", rule: "building" as const },
    { tenantId: "c", name: "C", roomId: "r2", roomName: "102", rule: "building" as const },
  ];
  const readings = [
    { roomId: "r1", units: 100, rate: 8, fixedCharge: 0 },
    { roomId: "r2", units: 50, rate: 8, fixedCharge: 20 },
  ];
  const base: AllocInput = { method: "submeter", tenants, readings, poolAmount: 0, commonAmount: 0, commonRule: "none" };

  it("sub-meter: units × rate, shared by the room", () => {
    const r = computeElectricity(base);
    expect(r.rows.map((x) => x.amount)).toEqual([400, 400, 420]);
    expect(r.total).toBe(1220);
  });
  it("proportional: main bill split by units", () => {
    const r = computeElectricity({ ...base, method: "proportional", poolAmount: 1500 });
    expect(r.rows.map((x) => x.amount)).toEqual([500, 500, 500]);
    expect(r.total).toBe(1500);
  });
  it("equal sharing adds up exactly even when it does not divide", () => {
    const r = computeElectricity({ ...base, method: "equal", poolAmount: 1000 });
    expect(r.rows.map((x) => x.amount).sort()).toEqual([333, 333, 334]);
    expect(r.total).toBe(1000);
  });
  it("common-area charge: equal or proportional", () => {
    const eq = computeElectricity({ ...base, commonAmount: 300, commonRule: "equal" });
    expect(eq.rows.map((x) => x.commonAmount)).toEqual([100, 100, 100]);
    const prop = computeElectricity({ ...base, commonAmount: 305, commonRule: "proportional" });
    expect(prop.totalCommon).toBe(305);
    expect(prop.rows[2].commonAmount).toBeGreaterThan(prop.rows[0].commonAmount);
  });
  it("exempt tenants pay nothing; fixed-amount tenants pay their amount", () => {
    const r = computeElectricity({
      ...base,
      commonAmount: 200,
      commonRule: "equal",
      tenants: [
        { ...tenants[0], rule: "none" },
        { ...tenants[1], rule: "custom", customAmount: 250 },
        tenants[2],
      ],
    });
    expect(r.rows[0]).toMatchObject({ amount: 0, note: "exempt" });
    expect(r.rows[1]).toMatchObject({ baseAmount: 250, commonAmount: 100, note: "fixed" });
    expect(r.rows[2].amount).toBe(520);
  });
  it("flags tenants without a room or a reading instead of guessing", () => {
    const r = computeElectricity({
      ...base,
      tenants: [...tenants, { tenantId: "d", name: "D", roomId: null, roomName: null, rule: "building" }, { tenantId: "e", name: "E", roomId: "r9", roomName: "109", rule: "building" }],
    });
    expect(r.rows[3]).toMatchObject({ amount: 0, note: "no_room" });
    expect(r.rows[4]).toMatchObject({ amount: 0, note: "no_reading" });
  });
  it("shows the gap between the main bill and tenant recovery", () => {
    expect(reconcile(18500, 15200)).toEqual({ mainBill: 18500, recovered: 15200, difference: 3300 });
    expect(reconcile(null, 100).difference).toBeNull();
    expect(splitByWeights(10, [0, 0])).toEqual([0, 0]);
    expect(splitByWeights(100, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("sandbox electricity provider", () => {
  const p = new MockElectricityProvider("2026-11-14");
  it("is marked as mock and returns a bill for the current month", async () => {
    expect(p.isMock).toBe(true);
    const r = await p.fetchBill({ discom: "PVVNL", consumerNumber: "1234567895" });
    expect(r.status).toBe("success");
    if (r.status === "success") {
      expect(r.bill.billMonth).toBe("2026-11-01");
      expect(r.bill.providerRef.startsWith("MOCKBILL-")).toBe(true);
      expect(r.bill.amount).toBeGreaterThan(0);
    }
  });
  it("simulates unavailable bills and provider failures", async () => {
    expect((await p.fetchBill({ discom: "PVVNL", consumerNumber: "1234567890" })).status).toBe("no_bill");
    expect((await p.fetchBill({ discom: "PVVNL", consumerNumber: "1234567899" })).status).toBe("failed");
  });
  it("payment is never successful at initiation; outcomes come from a status check", async () => {
    const outcome = async (consumer: string) => {
      const bill = await p.fetchBill({ discom: "PVVNL", consumerNumber: consumer });
      if (bill.status !== "success") throw new Error("no bill");
      const start = await p.initiatePayment({ billRef: bill.bill.providerRef, amount: bill.bill.amount, idempotencyKey: "abcdefabcdef1234" });
      expect(start.status).toBe("pending");
      return (await p.getPaymentStatus(start.providerRef!)).status;
    };
    expect(await outcome("1234567891")).toBe("pending");
    expect(await outcome("1234567892")).toBe("failed");
    expect(await outcome("1234567893")).toBe("unknown");
    expect(await outcome("1234567895")).toBe("success");
  });
});

describe("whatsapp reminders", () => {
  const d: ReminderData = {
    tenantId: "t1", tenantName: "Rahul Sharma", phone: "9811111111", whatsapp: null, optedIn: true,
    periodMonth: "2026-11-01", room: "102", rent: 8000, electricity: 650, other: 0, total: 8650, paid: 5000,
    remaining: 3650, previousDue: 0,
  };
  it("eligible only with consent, a valid number and a pending balance", () => {
    expect(checkEligibility(d)).toEqual({ eligible: true, to: "919811111111" });
    expect(checkEligibility({ ...d, optedIn: false })).toEqual({ eligible: false, reason: "no_consent" });
    expect(checkEligibility({ ...d, phone: "12345" })).toEqual({ eligible: false, reason: "invalid_number" });
    expect(checkEligibility({ ...d, paid: 8650, remaining: 0 })).toEqual({ eligible: false, reason: "nothing_due" });
    expect(checkEligibility({ ...d, whatsapp: "9822222222" })).toEqual({ eligible: true, to: "919822222222" });
  });
  it("builds the message from the spec", () => {
    const text = reminderText(d, "Shanti PG");
    expect(text).toContain("Namaste Rahul ji,");
    expect(text).toContain("November 2026 ka PG bill:");
    expect(text).toContain("Room: 102");
    expect(text).toContain("Rent: ₹8,000");
    expect(text).toContain("Electricity: ₹650");
    expect(text).toContain("Total: ₹8,650");
    expect(text).toContain("Paid: ₹5,000");
    expect(text).toContain("Remaining: ₹3,650");
    expect(text.endsWith("Shanti PG")).toBe(true);
    expect(templateParams(d)).toEqual(["Rahul", "November 2026", "102", "₹8,000", "₹650", "₹0", "₹8,650", "₹5,000", "₹3,650"]);
  });
  it("includes earlier unpaid months", () => {
    const withPrev = { ...d, previousDue: 2000 };
    expect(reminderText(withPrev, "PG")).toContain("Remaining: ₹5,650");
    expect(templateParams(withPrev)[8]).toBe("₹5,650");
  });
  it("one reminder per tenant per month per day", () => {
    expect(dedupeKey("t1", "2026-11-01", "2026-11-14")).toBe(dedupeKey("t1", "2026-11-01", "2026-11-14"));
    expect(dedupeKey("t1", "2026-11-01", "2026-11-14")).not.toBe(dedupeKey("t1", "2026-11-01", "2026-11-15"));
  });
});

describe("upload safety", () => {
  it("detects file type from content, not from the name", () => {
    expect(sniffMime(new TextEncoder().encode("%PDF-1.7 ..."))).toBe("application/pdf");
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffMime(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    expect(sniffMime(new TextEncoder().encode("MZ\u0090\u0000"))).toBeNull();
  });
  it("accepts only server-generated paths inside the owner's folder", () => {
    const owner = "11111111-1111-4111-8111-111111111111";
    const file = "22222222-2222-4222-8222-222222222222";
    expect(isOwnedPath(`${owner}/docs/${file}.pdf`, owner)).toBe(true);
    expect(isOwnedPath(`${owner}/../other/${file}.pdf`, owner)).toBe(false);
    expect(isOwnedPath(`other/docs/${file}.pdf`, owner)).toBe(false);
    expect(isOwnedPath(`${owner}/docs/${file}.exe`, owner)).toBe(false);
    expect(isOwnedPath(`${owner}/docs/evil.pdf`, owner)).toBe(false);
    expect(isOwnedPath(`${owner}/docs/x/${file}.pdf`, owner)).toBe(false);
  });
  it("cleans display names", () => {
    expect(safeDisplayName("../../etc/passwd")).toBe("passwd");
    expect(safeDisplayName("C:\\Users\\me\\Aadhaar card.pdf")).toBe("Aadhaar card.pdf");
    expect(safeDisplayName("")).toBe("file");
  });
});
