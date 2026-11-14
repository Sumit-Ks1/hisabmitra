import Link from "next/link";
import { ChevronRight, Search, Users } from "lucide-react";
import { EmptyState, PageHeader, Pill } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { NEEDS_REVIEW, STATUS_LABEL, STATUS_TONE, listOwners } from "@/lib/data/admin";
import type { OwnerStatus } from "@/lib/db-types";
import { fmtDate, fmtPhone } from "@/lib/format";

export const metadata = { title: "Owners" };

export default async function AdminOwnersPage({ searchParams }: PageProps<"/admin/owners">) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase().slice(0, 80);
  const status = typeof sp.status === "string" ? sp.status : "";

  const all = await listOwners(supabase);
  const owners = all.filter((o) => {
    if (status === "review" ? !NEEDS_REVIEW.includes(o.status) : status && o.status !== status) return false;
    if (!q) return true;
    return [o.full_name, o.email, o.phone ?? ""].some((v) => v.toLowerCase().includes(q));
  });

  return (
    <div>
      <PageHeader title="PG owners" subtitle={`${owners.length} of ${all.length}`} />
      <form className="mb-4 grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_12rem_auto]" role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Search name, email or phone" aria-label="Search owners" className="pl-10" />
        </div>
        <Select name="status" defaultValue={status} aria-label="Status" className="max-sm:col-span-2 max-sm:row-start-2">
          <option value="">All statuses</option>
          <option value="review">Needs review</option>
          {(Object.keys(STATUS_LABEL) as OwnerStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Button type="submit" size="lg">
          Search
        </Button>
      </form>

      {owners.length === 0 ? (
        <EmptyState icon={Users} title="No owners found" body="Try a different search or status." />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {owners.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/owners/${o.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{o.full_name || "—"}</span>
                  <span className="block truncate text-[0.82rem] text-slate-500">
                    {o.email} {o.phone && `· ${fmtPhone(o.phone)}`}
                  </span>
                  <span className="block text-[0.78rem] text-slate-400">Joined {fmtDate(o.created_at)}</span>
                </span>
                <Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill>
                <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
