import { Users } from "lucide-react";
import { ChargesReview } from "@/components/app/charges-review";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { periodFor } from "@/lib/billing/proration";
import { getRoomMap } from "@/lib/data/rooms";
import { getWorkspace } from "@/lib/data/workspace";
import type { ElectricityBill, MeterReading, Tenant } from "@/lib/db-types";
import type { AllocTenant } from "@/lib/electricity/allocation";
import { monthLabel } from "@/lib/format";

export const metadata = { title: "Electricity charges" };

export default async function ChargesPage({ searchParams }: PageProps<"/app/electricity/charges">) {
  const ws = await getWorkspace();
  const { supabase, userId, building, t, today } = ws;
  const sp = await searchParams;
  const current = periodFor(today, building.billing_day).month;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}-01$/.test(sp.month) && sp.month <= current ? sp.month : current;

  const [map, invRes, readRes, billRes, allocRes] = await Promise.all([
    getRoomMap(ws),
    // everyone who has a bill for this month (includes tenants who left during it)
    supabase.from("invoices").select("tenant_id, tenants(full_name, electricity_rule, electricity_custom_amount)").eq("building_id", building.id).eq("owner_id", userId).eq("period_month", month),
    supabase.from("electricity_meter_readings").select("*").eq("building_id", building.id).eq("owner_id", userId).eq("period_month", month),
    supabase.from("electricity_bills").select("*").eq("building_id", building.id).eq("owner_id", userId).eq("bill_month", month),
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

  const readings = ((readRes.data ?? []) as MeterReading[]).map((r) => ({ roomId: r.room_id, units: Number(r.units), rate: Number(r.per_unit_rate), fixedCharge: Number(r.fixed_charge) }));
  const bills = (billRes.data ?? []) as ElectricityBill[];
  // a sandbox bill is never used as the real main bill
  const mainBill = bills.find((b) => !b.is_mock)?.amount ?? null;
  const confirmed = Object.fromEntries((allocRes.data ?? []).map((a) => [a.tenant_id as string, Number(a.amount)]));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back="/app/electricity" title={t("Tenant electricity charges", "Tenant bijli charges")} subtitle={monthLabel(month)} />
      {tenants.length === 0 ? (
        <EmptyState icon={Users} title={t("No tenant bills for this month", "Is mahine kisi tenant ka bill nahi")} action={<LinkButton href="/app/tenants/new">{t("Add tenant", "Tenant jodein")}</LinkButton>} />
      ) : (
        <ChargesReview
          buildingId={building.id}
          month={month}
          tenants={tenants}
          readings={readings}
          mainBill={mainBill == null ? null : Number(mainBill)}
          defaults={{ method: building.electricity_method, commonRule: building.common_area_rule }}
          alreadyConfirmed={confirmed}
        />
      )}
    </div>
  );
}
