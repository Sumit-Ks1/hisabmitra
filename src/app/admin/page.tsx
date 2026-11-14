import Link from "next/link";
import { BadgeCheck, BedDouble, Building2, ChevronRight, Clock, CreditCard, Inbox, IndianRupee, UserX, Users } from "lucide-react";
import { Card, CardTitle, EmptyState, PageHeader, Pill, StatCard } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { NEEDS_REVIEW, STATUS_LABEL, STATUS_TONE, listOwners } from "@/lib/data/admin";
import { fmtDateTime } from "@/lib/format";

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdmin();
  const head = { count: "exact" as const, head: true };
  const [owners, buildings, rooms, activeSubs, pendingPayments] = await Promise.all([
    listOwners(supabase),
    supabase.from("buildings").select("id", head).neq("status", "archived"),
    supabase.from("rooms").select("id", head).is("deleted_at", null),
    supabase.from("building_subscriptions").select("id", head).eq("status", "active"),
    supabase.from("payment_submissions").select("id", head).eq("status", "pending"),
  ]);

  const by = (s: string[]) => owners.filter((o) => s.includes(o.status)).length;
  const queue = owners
    .filter((o) => NEEDS_REVIEW.includes(o.status))
    .sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? ""));

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle="Everything that needs your attention." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Registered owners" value={owners.length} icon={Users} href="/admin/owners" />
        <StatCard label="Pending approvals" value={by(NEEDS_REVIEW)} icon={Clock} tone="warm" href="/admin/owners?status=review" />
        <StatCard label="Approved owners" value={by(["approved"])} icon={BadgeCheck} tone="success" href="/admin/owners?status=approved" />
        <StatCard label="Rejected" value={by(["rejected"])} icon={UserX} tone="danger" href="/admin/owners?status=rejected" />
        <StatCard label="Buildings" value={buildings.count ?? 0} icon={Building2} />
        <StatCard label="Rooms created" value={rooms.count ?? 0} icon={BedDouble} />
        <StatCard label="Active subscriptions" value={activeSubs.count ?? 0} icon={CreditCard} tone="brand" />
        <StatCard label="Payments to verify" value={pendingPayments.count ?? 0} icon={IndianRupee} tone="warm" href="/admin/owners?status=review" />
      </div>

      <Card>
        <CardTitle>Review queue</CardTitle>
        {queue.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon={Inbox} title="Nothing waiting" body="New applications will appear here, oldest first." />
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {queue.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/owners/${o.id}`} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{o.full_name || o.email}</span>
                    <span className="block truncate text-[0.82rem] text-slate-500">Submitted {fmtDateTime(o.submitted_at)}</span>
                  </span>
                  <Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill>
                  <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
