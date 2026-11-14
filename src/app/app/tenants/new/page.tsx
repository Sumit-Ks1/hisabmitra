import { TenantForm, type FreeRoom } from "@/components/app/tenant-form";
import { PageHeader } from "@/components/ui/card";
import { getRoomMap } from "@/lib/data/rooms";
import { getWorkspace } from "@/lib/data/workspace";
import { isUuid } from "@/lib/uploads/rules";

export const metadata = { title: "Add tenant" };

export default async function NewTenantPage({ searchParams }: PageProps<"/app/tenants/new">) {
  const ws = await getWorkspace();
  const { t, building } = ws;
  const sp = await searchParams;
  const { rooms, beds, occupants } = await getRoomMap(ws);
  const taken = new Set(occupants.map((o) => o.bedId));

  const free: FreeRoom[] = rooms
    .filter((r) => !r.maintenance)
    .map((r) => ({
      id: r.id,
      name: r.name,
      floor: r.floor_number,
      rent: Number(r.monthly_rent),
      deposit: Number(r.security_deposit),
      beds: beds.filter((b) => b.room_id === r.id && !taken.has(b.id)).map((b) => ({ id: b.id, label: b.label })),
    }))
    .filter((r) => r.beds.length > 0);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader back="/app/tenants" title={t("Add tenant", "Tenant jodein")} />
      <TenantForm
        buildingId={building.id}
        rooms={free}
        billingDay={building.billing_day}
        defaultRule={building.proration_rule}
        today={ws.today}
        preselectBed={isUuid(sp.bed) ? sp.bed : undefined}
      />
    </div>
  );
}
