import Link from "next/link";
import { ChartColumn } from "lucide-react";
import { CollectionChart, type MonthPoint } from "@/components/app/collection-chart";
import { Card, CardTitle, EmptyState, PageHeader, StatCard } from "@/components/ui/card";
import { periodFor } from "@/lib/billing/proration";
import { getRoomMap } from "@/lib/data/rooms";
import { getWorkspace } from "@/lib/data/workspace";
import type { Invoice } from "@/lib/db-types";
import { addMonths, inr, monthLabel, monthShort } from "@/lib/format";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const ws = await getWorkspace();
  const { supabase, userId, building, t, today } = ws;
  const current = periodFor(today, building.billing_day).month;
  const from = addMonths(current, -5);

  const [invRes, map, balRes, tenantsRes, payRes] = await Promise.all([
    supabase.from("v_invoices").select("period_month, total_amount, paid_amount, balance, rent_amount, electricity_amount").eq("building_id", building.id).eq("owner_id", userId).gte("period_month", from),
    getRoomMap(ws),
    supabase.from("v_tenant_balances").select("tenant_id, balance, deposit_held").eq("building_id", building.id).eq("owner_id", userId),
    supabase.from("tenants").select("id, full_name").eq("building_id", building.id).eq("owner_id", userId),
    supabase.from("rent_payments").select("amount, method, kind").eq("building_id", building.id).eq("owner_id", userId).is("voided_at", null).in("kind", ["rent", "advance"]).gte("paid_on", current),
  ]);
  const invoices = (invRes.data ?? []) as Pick<Invoice, "period_month" | "total_amount" | "paid_amount" | "balance" | "rent_amount" | "electricity_amount">[];
  const months = Array.from({ length: 6 }, (_, i) => addMonths(from, i));
  const sum = (xs: number[]) => xs.reduce((a, b) => a + Number(b), 0);

  const table = months.map((m) => {
    const list = invoices.filter((i) => i.period_month === m);
    return { month: m, billed: sum(list.map((i) => i.total_amount)), collected: sum(list.map((i) => i.paid_amount)), pending: sum(list.map((i) => Math.max(0, i.balance))), electricity: sum(list.map((i) => i.electricity_amount)) };
  });
  const chart: MonthPoint[] = table.map((r) => ({ label: monthShort(r.month), collected: r.collected, pending: r.pending }));
  const hasData = table.some((r) => r.billed > 0);

  const beds = map.rooms.filter((r) => !r.maintenance).reduce((a, r) => a + r.bed_count, 0);
  const occupied = map.occupants.length;
  const name = new Map((tenantsRes.data ?? []).map((x) => [x.id as string, x.full_name as string]));
  const dues = (balRes.data ?? []).filter((b) => Number(b.balance) > 0).sort((a, b) => Number(b.balance) - Number(a.balance));
  const deposits = sum((balRes.data ?? []).map((b) => b.deposit_held as number));
  const byMethod = new Map<string, number>();
  (payRes.data ?? []).forEach((p) => byMethod.set(p.method as string, (byMethod.get(p.method as string) ?? 0) + Number(p.amount)));
  const methodLabel: Record<string, string> = { cash: t("Cash", "Cash"), upi: "UPI", bank_transfer: t("Bank transfer", "Bank transfer"), other: t("Other", "Other") };

  return (
    <div className="space-y-5">
      <PageHeader title={t("Reports", "Reports")} subtitle={building.name} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("Beds occupied", "Beds bhare")} value={`${occupied}/${beds}`} hint={beds > 0 ? `${Math.round((occupied / beds) * 100)}%` : undefined} />
        <StatCard label={t("Beds free", "Beds khaali")} value={Math.max(0, beds - occupied)} tone="success" />
        <StatCard label={t("Total outstanding", "Kul baaki")} value={inr(sum(dues.map((d) => d.balance as number)))} tone="danger" />
        <StatCard label={t("Deposits held", "Deposit jama")} value={inr(deposits)} />
      </div>

      {!hasData ? (
        <EmptyState icon={ChartColumn} title={t("No bills yet", "Abhi koi bill nahi")} body={t("Reports fill up as you add tenants and record payments.", "Tenants jodne aur payment likhne par reports bharti jayengi.")} />
      ) : (
        <>
          <Card>
            <CardTitle>{t("Collection — last 6 months", "Collection — pichhle 6 mahine")}</CardTitle>
            <ul className="mt-1 flex gap-4 text-[0.8rem] text-slate-600">
              <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-success-500" aria-hidden /> {t("Collected", "Mila")}</li>
              <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-warm-400" aria-hidden /> {t("Pending", "Baaki")}</li>
            </ul>
            <div className="mt-2">
              <CollectionChart data={chart} labels={{ collected: t("Collected", "Mila"), pending: t("Pending", "Baaki") }} />
            </div>
          </Card>

          <Card className="overflow-x-auto">
            <CardTitle>{t("Month by month", "Mahine ke hisaab se")}</CardTitle>
            <table className="mt-2 w-full min-w-[22rem] text-right text-[0.9rem]">
              <thead className="text-[0.78rem] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 text-left font-semibold">{t("Month", "Mahina")}</th>
                  <th className="py-2 font-semibold">{t("Billed", "Bill")}</th>
                  <th className="py-2 font-semibold">{t("Collected", "Mila")}</th>
                  <th className="py-2 font-semibold">{t("Pending", "Baaki")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {[...table].reverse().map((r) => (
                  <tr key={r.month}>
                    <td className="py-2.5 text-left">
                      <Link href={`/app/payments?month=${r.month}`} className="font-medium text-brand-700">
                        {monthLabel(r.month)}
                      </Link>
                    </td>
                    <td className="py-2.5">{inr(r.billed)}</td>
                    <td className="py-2.5 text-success-700">{inr(r.collected)}</td>
                    <td className={r.pending > 0 ? "py-2.5 font-semibold text-danger-700" : "py-2.5"}>{inr(r.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {byMethod.size > 0 && (
        <Card>
          <CardTitle>{t("Received this month, by method", "Is mahine kaise mila")}</CardTitle>
          <dl className="mt-2 divide-y divide-slate-100">
            {[...byMethod.entries()].sort((a, b) => b[1] - a[1]).map(([m, v]) => (
              <div key={m} className="flex justify-between py-2.5 text-[0.95rem]">
                <dt className="text-slate-600">{methodLabel[m] ?? m}</dt>
                <dd className="font-semibold tabular-nums text-ink">{inr(v)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {dues.length > 0 && (
        <Card>
          <CardTitle>{t("Who owes the most", "Sabse zyada kiska baaki")}</CardTitle>
          <ul className="mt-2 divide-y divide-slate-100">
            {dues.slice(0, 10).map((d) => (
              <li key={d.tenant_id as string}>
                <Link href={`/app/tenants/${d.tenant_id}?tab=rent`} className="flex justify-between gap-3 py-2.5 text-[0.95rem]">
                  <span className="truncate text-ink">{name.get(d.tenant_id as string) ?? "—"}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-danger-700">{inr(d.balance as number)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
