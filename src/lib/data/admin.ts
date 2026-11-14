import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OwnerStatus } from "@/lib/db-types";

export type OwnerListRow = {
  id: string;
  status: OwnerStatus;
  building_limit: number;
  submitted_at: string | null;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
};

/** All PG owner accounts (admins excluded). RLS only returns rows to an admin. */
export async function listOwners(supabase: SupabaseClient): Promise<OwnerListRow[]> {
  // pg_owners links to profiles twice (id and approved_by), so the join must name
  // the foreign key; otherwise PostgREST refuses it as ambiguous (PGRST201).
  const { data, error } = await supabase
    .from("pg_owners")
    .select(
      "id, status, building_limit, submitted_at, created_at, profiles!pg_owners_id_fkey!inner(full_name, email, phone, role)",
    )
    .eq("profiles.role", "pg_owner")
    .order("created_at", { ascending: false })
    .limit(2000);
  // Fail loudly: an empty list here would hide owners waiting for approval.
  if (error) throw new Error(`Could not load owners: ${error.message}`);
  return (data ?? []).map((r) => {
    const p = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as { full_name: string; email: string; phone: string | null };
    return {
      id: r.id as string,
      status: r.status as OwnerStatus,
      building_limit: r.building_limit as number,
      submitted_at: r.submitted_at as string | null,
      created_at: r.created_at as string,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
    };
  });
}

export const STATUS_LABEL: Record<OwnerStatus, string> = {
  onboarding: "Onboarding",
  submitted: "Submitted",
  under_review: "Under review",
  payment_pending: "Payment pending",
  info_required: "Info required",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

export const STATUS_TONE: Record<OwnerStatus, "neutral" | "brand" | "success" | "warm" | "danger"> = {
  onboarding: "neutral",
  submitted: "brand",
  under_review: "brand",
  payment_pending: "warm",
  info_required: "warm",
  approved: "success",
  rejected: "danger",
  suspended: "danger",
};

export const NEEDS_REVIEW: OwnerStatus[] = ["submitted", "under_review"];
