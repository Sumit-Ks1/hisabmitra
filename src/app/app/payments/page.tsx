import Link from "next/link";
import { ChevronLeft, ChevronRight, ReceiptIndianRupee } from "lucide-react";
import { PaymentDialog } from "@/components/app/payment-dialog";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader, Pill } from "@/components/ui/card";
import { periodFor } from "@/lib/billing/proration";
import { getWorkspace } from "@/lib/data/workspace";
import type { Invoice, InvoiceStatus } from "@/lib/db-types";
import { addMonths, fmtDate, inr, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Payments" };

const FILTERS = ["all", "pending", "paid"] as const;

export default async function PaymentsPage({ searchParams }: PageProps<"/app/payments">) {
  const ws = await getWorkspace();
  const { supabase, userId, building, t, today } = ws;
  const sp = await searchParams;
  const current = periodFor(today, building.billing_day).month;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}-01$/.test(sp.month) && sp.month <= current ? sp.month : current;
  const filter = FILTERS.includes(sp.show as (typeof FILTERS)[number]) ? (sp.show as (typeof FILTERS)[number]) : "all";

  const [invRes, tenantsRes] = await Promise.all([
    supabase.from("v_invoices").select("*").eq("building_id", building.id).eq("owner_id", userId).eq("period_month", month),
    supabase.from("tenants").select("id, full_name").eq("building_id", building.id).eq("owner_id", userId),
  ]);
  const name = new Map((tenantsRes.data ?? []).map((x) => [x.id as string, x.full_name as string]));
  const order: Record<InvoiceStatus, number> = { overdue: 0, unpaid: 1, partial: 2, paid: 3 };
  const all = ((invRes.data ?? []) as Invoice[]).sort((a, b) => order[a.status] - order[b.status] || (name.get(a.tenant_id) ?? "").localeCompare(name.get(b.tenant_id) ?? ""));
  const invoices = all.filter((i) => (filter === "pending" ? i.balance > 0 : filter === "paid" ? i.balance <= 0 : true));

  const sum = (f: (i: Invoice) => number) => all.reduce((a, i) => a + Number(f(i)), 0);
  const expected = sum((i) => i.total_amount);
  const collected = sum((i) => i.paid_amount);
  const pending = sum((i) => Math.max(0, i.balance));

  const pill = (s: InvoiceStatus) =>
    ({ paid: <Pill tone="success">{t("Paid", "Paid")}</Pill>, partial: <Pill tone="warm">{t("Part paid", "Thoda mila")}</Pill>, unpaid: <Pill tone="warm">{t("Unpaid", "Baaki")}</Pill>, overdue: <Pill tone="danger">{t("Overdue", "Late")}</Pill> })[s];
  const href = (m: string, show = filter) => `/app/payments?month=${m}${show === "all" ? "" : `&show=${show}`}`;
  const filterLabel = { all: t("All", "Sabhi"), pending: t("Pending", "Baaki"), paid: t("Paid", "Paid") };

  return (
    <div>
      <PageHeader title={t("Rent & payments", "Rent aur payments")} />

      <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-1.5">
        <Link href={href(addMonths(month, -1))} aria-label={t("Previous month", "Pichhla mahina")} className="flex size-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100">
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <p className="text-[1.02rem] font-semibold text-ink">{monthLabel(month)}</p>
        {month < current ? (
          <Link href={href(addMonths(month, 1))} aria-label={t("Next month", "Agla mahina")} className="flex size-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100">
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        ) : (
          <span className="size-10" />
        )}
      </div>

      <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
        {[
          [t("Expected", "Aana hai"), expected, "text-ink"],
          [t("Collected", "Mila"), collected, "text-success-700"],
          [t("Pending", "Baaki"), pending, pending > 0 ? "text-danger-700" : "text-success-700"],
        ].map(([label, value, tone]) => (
          <div key={label as string} className="rounded-2xl border border-slate-200 bg-white px-2 py-3">
            <dt className="text-[0.78rem] text-slate-500">{label}</dt>
            <dd className={cn("mt-0.5 text-[1.05rem] font-semibold tabular-nums", tone as string)}>{inr(value as number)}</dd>
          </div>
        ))}
      </dl>

      <div className="mb-4 flex gap-1.5" role="tablist" aria-label={t("Filter", "Filter")}>
        {FILTERS.map((f) => (
          <Link key={f} href={href(month, f)} role="tab" aria-selected={f === filter} className={cn("inline-flex h-9 items-center rounded-full px-4 text-[0.88rem] font-medium", f === filter ? "bg-ink text-white" : "border border-slate-200 bg-white text-slate-600")}>
            {filterLabel[f]}
          </Link>
        ))}
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={ReceiptIndianRupee}
          title={t("No bills for this month", "Is mahine ka koi bill nahi")}
          body={t("Bills are created automatically for every active tenant.", "Har active tenant ka bill apne aap ban jaata hai.")}
          action={<LinkButton href="/app/tenants/new">{t("Add tenant", "Tenant jodein")}</LinkButton>}
        />
      ) : invoices.length === 0 ? (
        <EmptyState icon={ReceiptIndianRupee} title={filter === "pending" ? t("Everyone has paid 🎉", "Sabne pay kar diya 🎉") : t("Nothing here", "Yahan kuch nahi")} />
      ) : (
        <ul className="space-y-2.5">
          {invoices.map((inv) => {
            const tenantName = name.get(inv.tenant_id) ?? "—";
            const extra = Number(inv.other_amount) + Number(inv.adjustment_amount);
            return (
              <li key={inv.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/app/tenants/${inv.tenant_id}?tab=rent`} className="min-w-0">
                    <p className="truncate font-semibold text-ink">{tenantName}</p>
                    <p className="text-[0.82rem] text-slate-500">
                      {inv.room_label ? `${t("Room", "Room")} ${inv.room_label} · ` : ""}
                      {t("Due", "Due")} {fmtDate(inv.due_date)}
                    </p>
                  </Link>
                  {pill(inv.status)}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-1 text-[0.85rem]">
                  <div><dt className="text-slate-500">{t("Rent", "Rent")}</dt><dd className="tabular-nums text-ink">{inr(inv.rent_amount)}</dd></div>
                  <div><dt className="text-slate-500">{t("Electricity", "Bijli")}</dt><dd className="tabular-nums text-ink">{inr(inv.electricity_amount)}</dd></div>
                  <div><dt className="text-slate-500">{t("Other / adj.", "Other / adj.")}</dt><dd className="tabular-nums text-ink">{inr(extra)}</dd></div>
                  <div><dt className="text-slate-500">{t("Total", "Total")}</dt><dd className="font-semibold tabular-nums text-ink">{inr(inv.total_amount)}</dd></div>
                  <div><dt className="text-slate-500">{t("Paid", "Mila")}</dt><dd className="tabular-nums text-success-700">{inr(inv.paid_amount)}</dd></div>
                  <div><dt className="text-slate-500">{t("Remaining", "Baaki")}</dt><dd className={cn("font-semibold tabular-nums", inv.balance > 0 ? "text-danger-700" : "text-success-700")}>{inr(Math.max(0, inv.balance))}</dd></div>
                </dl>
                {inv.balance > 0 && (
                  <div className="mt-3">
                    <PaymentDialog tenantId={inv.tenant_id} tenantName={tenantName} invoiceId={inv.id} due={inv.balance} today={today} size="md" variant="success" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
