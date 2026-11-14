/** Row shapes used by the app. Money columns arrive from PostgREST as numbers. */

export type Lang = "hinglish" | "en";
export type Role = "admin" | "pg_owner";

export type OwnerStatus =
  | "onboarding"
  | "submitted"
  | "under_review"
  | "payment_pending"
  | "info_required"
  | "approved"
  | "rejected"
  | "suspended";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  whatsapp: string | null;
  language: Lang;
  avatar_path: string | null;
  role: Role;
  created_at: string;
};

export type OwnerAccount = {
  id: string;
  status: OwnerStatus;
  onboarding_draft: Record<string, unknown>;
  review_note: string | null;
  building_limit: number;
  room_limit: number | null;
  plan_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
};

export type Building = {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  state: string;
  city: string;
  pincode: string | null;
  floors_count: number;
  rooms_count: number;
  beds_count: number | null;
  pg_type: "boys" | "girls" | "coliving" | "other";
  description: string | null;
  status: "pending" | "active" | "archived";
  billing_day: number;
  rent_due_day: number;
  grace_days: number;
  late_fee_amount: number;
  proration_rule: "calendar" | "fixed30" | "full";
  rent_basis: "room" | "bed";
  electricity_billing_day: number | null;
  electricity_method: ElectricityMethod;
  electricity_rate: number;
  common_area_rule: "none" | "equal" | "proportional";
  created_at: string;
};

export type Subscription = {
  id: string;
  owner_id: string;
  building_id: string;
  plan_id: string | null;
  rooms_count: number;
  price_per_room: number;
  duration_months: number;
  discount_percent: number;
  amount: number;
  status: "pending" | "active" | "expired" | "cancelled";
  starts_on: string | null;
  expires_on: string | null;
  created_at: string;
};

export type PaymentSubmission = {
  id: string;
  owner_id: string;
  subscription_id: string;
  amount: number;
  upi_reference: string;
  paid_on: string;
  screenshot_path: string | null;
  status: "pending" | "verified" | "rejected";
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

export type Plan = {
  id: string;
  name: string;
  price_per_room: number;
  duration_months: number;
  building_limit: number;
  discount_percent: number;
  active: boolean;
};

export type RoomRow = {
  id: string;
  building_id: string;
  floor_id: string;
  floor_number: number;
  floor_name: string;
  name: string;
  room_type: "single" | "shared" | "dormitory" | "other";
  monthly_rent: number;
  security_deposit: number;
  maintenance: boolean;
  notes: string | null;
  meter_number: string | null;
  meter_type: string | null;
  meter_initial_reading: number;
  per_unit_rate: number | null;
  fixed_charge: number;
  bed_count: number;
  occupied_count: number;
};

export type Bed = { id: string; room_id: string; label: string; monthly_rent: number | null };

export type Tenant = {
  id: string;
  building_id: string;
  full_name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  gender: string | null;
  joined_on: string;
  vacated_on: string | null;
  billing_from: string;
  emergency_contact: string | null;
  occupation: string | null;
  monthly_rent: number;
  security_deposit: number;
  electricity_rule: "building" | "none" | "custom";
  electricity_custom_amount: number | null;
  notes: string | null;
  status: "active" | "vacated";
  documents_consent_at: string | null;
  created_at: string;
};

export type InvoiceStatus = "paid" | "partial" | "unpaid" | "overdue";

export type Invoice = {
  id: string;
  building_id: string;
  tenant_id: string;
  period_month: string;
  period_start: string;
  period_end: string;
  due_date: string;
  room_label: string | null;
  rent_amount: number;
  electricity_amount: number;
  other_amount: number;
  adjustment_amount: number;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: InvoiceStatus;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  kind: "rent" | "electricity" | "other" | "late_fee" | "opening_balance" | "discount" | "adjustment";
  description: string;
  amount: number;
  source: "system" | "manual" | "electricity";
};

export type RentPayment = {
  id: string;
  tenant_id: string;
  invoice_id: string | null;
  kind: "rent" | "advance" | "deposit" | "deposit_refund";
  amount: number;
  paid_on: string;
  method: "cash" | "upi" | "bank_transfer" | "other";
  reference: string | null;
  notes: string | null;
  group_id: string;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
};

export type TenantBalance = {
  tenant_id: string;
  invoiced_total: number;
  paid_total: number;
  advance_credit: number;
  balance: number;
  deposit_held: number;
};

export type ElectricityMethod = "submeter" | "proportional" | "equal" | "custom";

export type ElectricityConnection = {
  id: string;
  building_id: string;
  discom: string;
  consumer_number: string;
  connection_type: string | null;
  meter_number: string | null;
  billing_cycle: string | null;
  last_fetch_at: string | null;
  last_fetch_status: "success" | "no_bill" | "failed" | "not_configured" | null;
  last_fetch_message: string | null;
};

export type ElectricityBill = {
  id: string;
  building_id: string;
  connection_id: string;
  bill_month: string;
  amount: number;
  bill_date: string | null;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  units: number | null;
  source: "manual" | "mock" | "setu";
  is_mock: boolean;
  provider_ref: string | null;
  status: "unpaid" | "payment_pending" | "paid";
  fetched_at: string;
};

export type ElectricityPayment = {
  id: string;
  bill_id: string;
  amount: number;
  provider: "mock" | "setu" | "manual";
  provider_ref: string | null;
  status: "initiated" | "pending" | "success" | "failed" | "unknown";
  message: string | null;
  created_at: string;
};

export type MeterReading = {
  id: string;
  room_id: string;
  period_month: string;
  previous_reading: number;
  current_reading: number;
  units: number;
  reading_date: string;
  per_unit_rate: number;
  fixed_charge: number;
  photo_path: string | null;
  is_correction: boolean;
  correction_reason: string | null;
};

export type WhatsappMessage = {
  id: string;
  tenant_id: string;
  period_month: string;
  to_phone: string;
  body_preview: string;
  status: "queued" | "sending" | "sent" | "delivered" | "read" | "failed";
  error: string | null;
  created_at: string;
  sent_at: string | null;
};

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  owner_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type PricingSettings = {
  price_per_room: number;
  duration_months: number;
  default_building_limit: number;
  discount_percent: number;
};
export type UpiSettings = { upi_id: string; payee_name: string };
export type SupportSettings = { phone: string; email: string };
export type IntegrationSettings = {
  electricity: "disabled" | "sandbox" | "live";
  whatsapp: "disabled" | "live";
};
export type AnnouncementSettings = { message: string; active: boolean };
