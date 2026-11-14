import Link from "next/link";
import { ChevronRight, Gauge, Users } from "lucide-react";
import { ChargesReview } from "@/components/app/charges-review";
import { LinkButton } from "@/components/ui/button";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/card";
import { periodFor } from "@/lib/billing/proration";
import { getRoomMap } from "@/lib/data/rooms";
import { getWorkspace, type Workspace } from "@/lib/data/workspace";
import type { ElectricityBill, MeterReading, Tenant } from "@/lib/db-types";
import type { AllocReading, AllocTenant } from "@/lib/electricity/allocation";
import { reconcile } from "@/lib/electricity/allocation";
import { addMonths, inr, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Electricity charges" };

export default async function ChargesPage({ searchParams }: PageProps<"/app/electricity/charges">) {
  const ws = await getWorkspace();
  const { building, t, today } = ws;
  const sp = await searchParams;
  const current = periodFor(today, building.billing_day).month;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}-01$/.test(sp.month) && sp.month <= current ? sp.month : current;
  const months = [addMonths(current, -2), addMonths(current, -1), current];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back="/app/electricity" title={t("Tenant electricity charges", "Tenant bijli charges")} subtitle={monthLabel(month)} />
      <div className="mb-4 flex gap-1.5">
        {months.map((m) => (
          <Link key={m} href={`/app/electricity/charges?month=${m}`} aria-current={m === month ? "page" : undefined} className={cn("inline-flex h-10 flex-1 items-center justify-center rounded-xl text-[0.88rem] font-medium", m === month ? "bg-ink text-white" : "border border-slate-200 bg-white text-slate-600")}>
            {monthLabel(m)}
          </Link>
        ))}
      </div>
      {building.electricity_method === "submeter" ? <MeterSummary ws={ws} month={month} /> : <SplitMainBill ws={ws} month={month} />}
    </div>
  );
}

async function mainBillFor(ws: Workspace, month: string) {
  const { data } = await ws.supabase.from("electricity_bills").select("*").eq("building_id", ws.building.id).eq("owner_id", ws.userId).eq("bill_month", month);
  // a sandbox bill is never used as the real main bill
  const bill = ((data ?? []) as ElectricityBill[]).find((b) => !b.is_mock);
  return bill ? Number(bill.amount) : null;
}

/** Room-meter buildings: everything is charged per reading — this is the month's summary. */
async function MeterSummary({ ws, month }: { ws: Workspace; month: string }) {
  const { supabase, userId, building, t } = ws;
  const [invRes, tenantRes, mainBill] = await Promise.all([
    supabase.from("v_invoices").select("id, tenant_id, room_label, electricity_amount, balance").eq("building_id", building.id).eq("owner_id", userId).eq("period_month", month),
    supabase.from("tenants").select("id, full_name").eq("building_id", building.id).eq("owner_id", userId),
    mainBillFor(ws, month),
  ]);
  const names = new Map((tenantRes.data ?? []).map((x) => [x.id as string, x.full_name as string]));
  const rows = (invRes.data ?? [])
    .map((i) => ({ tenantId: i.tenant_id as string, name: names.get(i.tenant_id as string) ?? "—", room: i.room_label as string | null, electricity: Number(i.electricity_amount), due: Number(i.balance) }))
    .sort((a, b) => (a.room ?? "~").localeCompare(b.room ?? "~", undefined, { numeric: true }) || a.name.localeCompare(b.name));
  const total = rows.reduce((a, r) => a + r.electricity, 0);
  const rec = reconcile(mainBill, total);

  if (rows.length === 0) {
    return <EmptyState icon={Users} title={t("No tenant bills for this month", "Is mahine kisi tenant ka bill nahi")} action={<LinkButton href="/app/tenants/new">{t("Add tenant", "Tenant jodein")}</LinkButton>} />;
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>{t("Charged from meter readings", "Meter readings se laga charge")}</CardTitle>
        <p className="mt-0.5 text-[0.85rem] text-slate-500">
          {t("Added to each tenant's bill automatically when a reading is saved.", "Reading save hote hi har tenant ke bill mein apne aap jud jata hai.")}
        </p>
        <ul className="mt-3 divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.tenantId}>
              <Link href={`/app/tenants/${r.tenantId}?tab=electricity`} className="flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{r.name}</span>
                  <span className="block truncate text-[0.8rem] text-slate-500">
                    {r.room ? `${t("Room", "Room")} ${r.room}` : t("No room", "Room nahi")} · {t("bill due", "bill baaki")} {inr(Math.max(0, r.due))}
                  </span>
                </span>
                <span className={cn("shrink-0 font-semibold tabular-nums", r.electricity > 0 ? "text-ink" : "text-slate-400")}>{inr(r.electricity)}</span>
                <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle>{t("Check the totals", "Total check karein")}</CardTitle>
        <dl className="mt-2 space-y-1.5 text-[0.95rem]">
          <div className="flex justify-between"><dt className="text-slate-500">{t("Main electricity bill", "Main bijli bill")}</dt><dd className="font-medium tabular-nums">{rec.mainBill == null ? t("not saved", "save nahi") : inr(rec.mainBill)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">{t("Charged to tenants", "Tenants par charge")}</dt><dd className="font-semibold tabular-nums text-ink">{inr(total)}</dd></div>
          {rec.difference != null && (
            <div className="flex justify-between border-t border-slate-100 pt-1.5">
              <dt className="text-slate-500">{rec.difference >= 0 ? t("Not recovered (you pay)", "Wasool nahi hua (aap denge)") : t("Collected above the bill", "Bill se zyada wasool")}</dt>
              <dd className={rec.difference > 0 ? "font-semibold tabular-nums text-warm-800" : "font-semibold tabular-nums text-ink"}>{inr(Math.abs(rec.difference))}</dd>
            </div>
          )}
        </dl>
      </Card>
      <LinkButton href="/app/electricity/readings" variant="outline" block>
        <Gauge aria-hidden /> {t("Enter meter readings", "Meter readings daalein")}
      </LinkButton>
    </div>
  );
}

/** Buildings that split the main bill: review the month's split and add it to bills. */
async function SplitMainBill({ ws, month }: { ws: Workspace; month: string }) {
  const { supabase, userId, building, t } = ws;
  const [map, invRes, readRes, mainBill, allocRes] = await Promise.all([
    getRoomMap(ws),
    // everyone who has a bill for this month (includes tenants who left during it)
    supabase.from("invoices").select("tenant_id, tenants(full_name, electricity_rule, electricity_custom_amount)").eq("building_id", building.id).eq("owner_id", userId).eq("period_month", month),
    supabase.from("electricity_meter_readings").select("room_id, units, per_unit_rate, fixed_charge").eq("building_id", building.id).eq("owner_id", userId).eq("period_month", month),
    mainBillFor(ws, month),
    supabase.from("electricity_allocations").select("tenant_id, amount").eq("building_id", building.id).eq("owner_id", userId).eq("period_month", month),
  ]);

  const tenants: AllocTenant[] = (invRes.data ?? [])
    .map((row) => {
      const tn = (Array.isArray(row.tenants) ? row.tenants[0] : row.tenants) as Pick<Tenant, "full_name" | "electricity_rule" | "electricity_custom_amount"> | null;
      const occ = map.occupants.find((o) => o.tenantId === row.tenant_id);
      const room = occ ? map.rooms.find((r) => r.id === occ.roomId) : undefined;
      return {
        tenantId: row.tenant_id as string,
        name: tn?.full_name ?? "—",
        roomId: room?.id ?? null,
        roomName: room?.name ?? null,
        rule: tn?.electricity_rule ?? "building",
        customAmount: tn?.electricity_custom_amount ?? null,
      };
    })
    .sort((a, b) => (a.roomName ?? "~").localeCompare(b.roomName ?? "~", undefined, { numeric: true }) || a.name.localeCompare(b.name));

  // a room can have several readings in a month: add up its units
  const perRoom = new Map<string, AllocReading>();
  for (const r of (readRes.data ?? []) as Pick<MeterReading, "room_id" | "units" | "per_unit_rate" | "fixed_charge">[]) {
    const prev = perRoom.get(r.room_id);
    perRoom.set(r.room_id, {
      roomId: r.room_id,
      units: (prev?.units ?? 0) + Number(r.units),
      rate: Number(building.electricity_rate) || Number(r.per_unit_rate),
      fixedCharge: (prev?.fixedCharge ?? 0) + Number(r.fixed_charge),
    });
  }
  const confirmed = Object.fromEntries((allocRes.data ?? []).map((a) => [a.tenant_id as string, Number(a.amount)]));

  if (tenants.length === 0) {
    return <EmptyState icon={Users} title={t("No tenant bills for this month", "Is mahine kisi tenant ka bill nahi")} action={<LinkButton href="/app/tenants/new">{t("Add tenant", "Tenant jodein")}</LinkButton>} />;
  }
  return (
    <ChargesReview
      buildingId={building.id}
      month={month}
      tenants={tenants}
      readings={[...perRoom.values()]}
      mainBill={mainBill}
      defaults={{ method: building.electricity_method, commonRule: building.common_area_rule }}
      alreadyConfirmed={confirmed}
    />
  );
}
