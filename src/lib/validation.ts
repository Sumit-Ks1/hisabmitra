import { z } from "zod";
import { DISCOM_CODES } from "@/lib/electricity/types";
import { normalizePhone } from "@/lib/format";
import { normalizeUpiReference } from "@/lib/upi";

/**
 * Zod schemas shared by client forms (instant feedback) and Server Actions
 * (the check that actually counts). Messages are bilingual in one line so they
 * read fine in either language setting.
 */

const text = (max: number) => z.string().trim().max(max, `Maximum ${max} characters`);
const optionalText = (max: number) => text(max).optional().or(z.literal("")).transform((v) => v || "");

export const phone = z
  .string()
  .transform((v) => normalizePhone(v))
  .refine((v) => v.length === 10, "Enter a valid 10-digit mobile number / 10 ank ka mobile number daalein");

export const optionalPhone = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? normalizePhone(v) || "invalid" : ""))
  .refine((v) => v !== "invalid", "Enter a valid 10-digit mobile number / 10 ank ka mobile number daalein");

export const money = z.coerce
  .number({ error: "Enter an amount / Amount daalein" })
  .min(0, "Amount cannot be negative / Amount minus mein nahi ho sakta")
  .max(10_000_000, "Amount is too large / Amount bahut zyada hai");

export const positiveMoney = money.refine((v) => v > 0, "Enter an amount above 0 / 0 se zyada amount daalein");

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date / Date chunein");
export const uuid = z.uuid("Invalid selection");
export const monthString = z.string().regex(/^\d{4}-\d{2}-01$/, "Invalid month");

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const int = (min: number, max: number, label: string) =>
  z.coerce
    .number({ error: `Enter ${label}` })
    .int(`Enter ${label}`)
    .min(min, `${cap(label)}: minimum ${min}`)
    .max(max, `${cap(label)}: maximum ${max}`);

/**
 * Quick setup asks for the starting floor, but owners often type the first room
 * number instead (101, 201, 001). Read 100+ as a room number: 101 → floor 1.
 */
export function startFloorFrom(value: number): number {
  return value >= 100 ? Math.floor(value / 100) : value;
}

/** Room numbers made by quick setup: floor 1 → 101, 102…; ground floor → G01, G02… */
export function bulkRoomName(floor: number, n: number): string {
  return floor === 0 ? `G${String(n).padStart(2, "0")}` : `${floor}${String(n).padStart(2, "0")}`;
}

/* ---------------------------------- auth ---------------------------------- */
export const emailSchema = z.email("Enter a valid email / Sahi email daalein").max(254).transform((v) => v.trim().toLowerCase());
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters / Kam se kam 8 characters rakhein")
  .max(72, "Password is too long");

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password / Password daalein").max(72) });
export const signupSchema = z.object({
  full_name: text(120).min(2, "Enter your name / Apna naam daalein"),
  email: emailSchema,
  password: passwordSchema,
});
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match / Password match nahi kar rahe" });

/* ------------------------------- onboarding ------------------------------- */
export const ownerDetailsSchema = z.object({
  full_name: text(120).min(2, "Enter your name / Apna naam daalein"),
  phone,
  whatsapp: optionalPhone,
  language: z.enum(["hinglish", "en"]),
});

export const buildingDetailsSchema = z.object({
  name: text(120).min(2, "Enter the PG name / PG ka naam daalein"),
  address: text(300).min(5, "Enter the full address / Poora address daalein"),
  state: text(60).min(2, "Enter the state"),
  city: text(80).min(2, "Enter the city / Sheher daalein"),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a 6-digit PIN code / 6 ank ka PIN code daalein"),
  floors_count: int(1, 50, "number of floors"),
  rooms_count: int(1, 2000, "number of rooms"),
  beds_count: z.union([z.literal(""), int(1, 10000, "number of beds")]).optional(),
  pg_type: z.enum(["boys", "girls", "coliving", "other"]),
  description: optionalText(500),
});

export const electricityDetailsSchema = z.object({
  discom: z.enum(DISCOM_CODES),
  consumer_number: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{4,30}$/, "Enter the consumer / account number (letters and digits only)"),
  connection_type: optionalText(40),
  meter_number: optionalText(40),
  billing_cycle: optionalText(40),
});

export const onboardingSchema = z.object({
  owner: ownerDetailsSchema,
  building: buildingDetailsSchema,
  electricity: electricityDetailsSchema,
});
export type OnboardingInput = z.input<typeof onboardingSchema>;

export const paymentSubmissionSchema = z.object({
  reference: z
    .string()
    .transform(normalizeUpiReference)
    .refine((v) => /^[A-Z0-9]{6,40}$/.test(v), "Enter the UPI transaction / UTR number (6–40 letters or digits)"),
  paid_on: isoDate,
  screenshot_path: z.string().max(200).optional().or(z.literal("")),
});

/* --------------------------------- rooms ---------------------------------- */
export const roomSchema = z.object({
  floor: int(0, 60, "floor number"),
  name: text(30).min(1, "Enter room number / Room number daalein"),
  room_type: z.enum(["single", "shared", "dormitory", "other"]),
  beds: int(1, 30, "number of beds"),
  rent: money,
  deposit: money,
  notes: optionalText(300),
});

export const roomEditSchema = z.object({
  id: uuid,
  name: text(30).min(1, "Enter room number / Room number daalein"),
  room_type: z.enum(["single", "shared", "dormitory", "other"]),
  monthly_rent: money,
  security_deposit: money,
  maintenance: z.enum(["on", ""]).optional(),
  notes: optionalText(300),
  meter_number: optionalText(40),
  meter_type: z.enum(["digital", "analog", "prepaid", "other", ""]).optional(),
  meter_initial_reading: z.coerce.number().min(0).max(99_999_999).optional(),
  per_unit_rate: z.union([z.literal(""), z.coerce.number().min(0).max(1000)]).optional(),
  fixed_charge: z.coerce.number().min(0).max(100000).optional(),
});

export const bulkRoomsSchema = z.object({
  floors: int(1, 30, "floors"),
  rooms_per_floor: int(1, 60, "rooms per floor"),
  start_floor: int(0, 3099, "starting floor")
    .transform(startFloorFrom)
    .pipe(z.number().max(30, "Starting floor: maximum 30 (enter 1 for rooms 101, 102…)")),
  beds: int(1, 30, "beds per room"),
  rent: money,
  deposit: money,
  room_type: z.enum(["single", "shared", "dormitory", "other"]),
});

/* -------------------------------- tenants --------------------------------- */
export const tenantSchema = z
  .object({
    full_name: text(120).min(2, "Enter tenant's name / Tenant ka naam daalein"),
    phone,
    whatsapp: optionalPhone,
    email: z.union([z.literal(""), emailSchema]).optional(),
    gender: z.enum(["male", "female", "other", ""]).optional(),
    joined_on: isoDate,
    emergency_contact: optionalText(120),
    occupation: optionalText(80),
    bed_id: z.union([z.literal(""), uuid]).optional(),
    monthly_rent: positiveMoney,
    security_deposit: money,
    electricity_rule: z.enum(["building", "none", "custom"]),
    electricity_custom_amount: z.union([z.literal(""), money]).optional(),
    proration_rule: z.enum(["calendar", "fixed30", "full", "custom"]),
    first_month_amount: z.union([z.literal(""), money]).optional(),
    first_month_reason: optionalText(200),
    opening_balance: z.union([z.literal(""), money]).optional(),
    whatsapp_opt_in: z.boolean().optional(),
    notes: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.proration_rule === "custom") {
      if (v.first_month_amount === "" || v.first_month_amount === undefined) {
        ctx.addIssue({ code: "custom", path: ["first_month_amount"], message: "Enter the first month amount / Pehle mahine ka amount daalein" });
      }
      if (!v.first_month_reason || v.first_month_reason.length < 3) {
        ctx.addIssue({ code: "custom", path: ["first_month_reason"], message: "Write a short reason / Chhota sa reason likhein" });
      }
    }
    if (v.electricity_rule === "custom" && (v.electricity_custom_amount === "" || v.electricity_custom_amount === undefined)) {
      ctx.addIssue({ code: "custom", path: ["electricity_custom_amount"], message: "Enter the fixed electricity amount" });
    }
  });
export type TenantInput = z.input<typeof tenantSchema>;

export const tenantEditSchema = z.object({
  id: uuid,
  full_name: text(120).min(2, "Enter tenant's name / Tenant ka naam daalein"),
  phone,
  whatsapp: optionalPhone,
  email: z.union([z.literal(""), emailSchema]).optional(),
  emergency_contact: optionalText(120),
  occupation: optionalText(80),
  monthly_rent: positiveMoney,
  security_deposit: money,
  electricity_rule: z.enum(["building", "none", "custom"]),
  electricity_custom_amount: z.union([z.literal(""), money]).optional(),
});

/* -------------------------------- payments -------------------------------- */
export const paymentSchema = z.object({
  tenant_id: uuid,
  invoice_id: z.union([z.literal(""), uuid]).optional(),
  amount: positiveMoney,
  paid_on: isoDate,
  method: z.enum(["cash", "upi", "bank_transfer", "other"]),
  reference: optionalText(60),
  notes: optionalText(300),
  kind: z.enum(["rent", "deposit", "deposit_refund"]),
  idempotency_key: z.string().min(8).max(80),
});

export const invoiceItemSchema = z.object({
  invoice_id: uuid,
  kind: z.enum(["other", "discount"]),
  description: text(120).min(2, "Write what this is for / Yeh kis liye hai likhein"),
  amount: positiveMoney,
});

/* ------------------------------- electricity ------------------------------ */
export const manualBillSchema = z.object({
  bill_month: monthString,
  amount: positiveMoney,
  bill_date: z.union([z.literal(""), isoDate]).optional(),
  due_date: z.union([z.literal(""), isoDate]).optional(),
  units: z.union([z.literal(""), z.coerce.number().min(0).max(10_000_000)]).optional(),
});

export const readingSchema = z.object({
  room_id: uuid,
  month: monthString,
  current: z.coerce.number({ error: "Enter the meter reading / Meter reading daalein" }).min(0).max(99_999_999),
  reading_date: isoDate,
  rate: z.coerce.number({ error: "Enter rate per unit / Per unit rate daalein" }).min(0).max(1000),
  fixed: z.coerce.number().min(0).max(100000).optional(),
  photo_path: z.string().max(200).optional().or(z.literal("")),
  correction: z.enum(["on", ""]).optional(),
  correction_reason: optionalText(200),
  previous_override: z.union([z.literal(""), z.coerce.number().min(0).max(99_999_999)]).optional(),
});

export const allocationRowSchema = z.object({
  tenant_id: uuid,
  room_id: z.union([z.null(), uuid]),
  method: z.enum(["submeter", "proportional", "equal", "custom"]),
  units: z.union([z.null(), z.number().min(0)]),
  base_amount: z.number().min(0).max(1_000_000),
  common_amount: z.number().min(0).max(1_000_000),
  amount: z.number().min(0).max(1_000_000),
});

/* -------------------------------- settings -------------------------------- */
export const buildingSettingsSchema = z.object({
  id: uuid,
  name: text(120).min(2),
  address: text(300),
  city: text(80),
  pincode: z.union([z.literal(""), z.string().regex(/^[1-9]\d{5}$/, "Enter a 6-digit PIN code")]).optional(),
  pg_type: z.enum(["boys", "girls", "coliving", "other"]),
});

export const billingSettingsSchema = z.object({
  id: uuid,
  billing_day: int(1, 28, "a day between 1 and 28"),
  rent_due_day: int(1, 28, "a day between 1 and 28"),
  grace_days: int(0, 30, "grace days"),
  late_fee_amount: money,
  proration_rule: z.enum(["calendar", "fixed30", "full"]),
  rent_basis: z.enum(["room", "bed"]),
});

export const electricitySettingsSchema = z.object({
  id: uuid,
  electricity_method: z.enum(["submeter", "proportional", "equal", "custom"]),
  electricity_rate: z.coerce.number().min(0).max(1000),
  common_area_rule: z.enum(["none", "equal", "proportional"]),
  electricity_billing_day: z.union([z.literal(""), int(1, 28, "a day between 1 and 28")]).optional(),
  discom: z.enum(DISCOM_CODES),
  consumer_number: z.string().trim().regex(/^[A-Za-z0-9]{4,30}$/, "Enter the consumer / account number"),
  meter_number: optionalText(40),
});

export const profileSchema = z.object({
  full_name: text(120).min(2, "Enter your name / Apna naam daalein"),
  phone,
  whatsapp: optionalPhone,
  language: z.enum(["hinglish", "en"]),
});

export const addBuildingSchema = buildingDetailsSchema.pick({
  name: true, address: true, state: true, city: true, pincode: true, floors_count: true, rooms_count: true, pg_type: true,
});

/* ---------------------------------- admin --------------------------------- */
export const pricingSettingsSchema = z.object({
  price_per_room: z.coerce.number().min(0).max(100000),
  duration_months: int(1, 36, "months"),
  default_building_limit: int(1, 100, "building limit"),
  discount_percent: z.coerce.number().min(0).max(100),
});

export const planSchema = z.object({
  id: z.union([z.literal(""), uuid]).optional(),
  name: text(80).min(2, "Enter a plan name"),
  price_per_room: z.coerce.number().min(0).max(100000),
  duration_months: int(1, 36, "months"),
  building_limit: int(1, 100, "building limit"),
  discount_percent: z.coerce.number().min(0).max(100),
  active: z.enum(["on", ""]).optional(),
});

export const globalSettingsSchema = z.object({
  upi_id: z.union([z.literal(""), z.string().trim().regex(/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/, "Enter a valid UPI ID, e.g. name@bank")]),
  payee_name: text(50).min(2, "Enter the payee name"),
  support_phone: optionalPhone,
  support_email: z.union([z.literal(""), emailSchema]),
  electricity: z.enum(["disabled", "sandbox", "live"]),
  whatsapp: z.enum(["disabled", "live"]),
  announcement: optionalText(300),
  announcement_active: z.enum(["on", ""]).optional(),
});

export const ownerLimitsSchema = z.object({
  owner_id: uuid,
  building_limit: int(1, 100, "building limit"),
  room_limit: z.union([z.literal(""), int(1, 2000, "room limit")]).optional(),
  plan_id: z.union([z.literal(""), uuid]).optional(),
});

export const subscriptionUpdateSchema = z.object({
  subscription_id: uuid,
  status: z.enum(["pending", "active", "expired", "cancelled"]),
  expires_on: z.union([z.literal(""), isoDate]).optional(),
  rooms_count: int(1, 2000, "rooms"),
});
