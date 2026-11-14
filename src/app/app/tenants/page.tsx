import Link from "next/link";
import { ChevronRight, Search, UserPlus, Users } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader, Pill } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { periodFor } from "@/lib/billing/proration";
import { getRoomMap } from "@/lib/data/rooms";
import { getWorkspace } from "@/lib/data/workspace";
import type { InvoiceStatus, Tenant } from "@/lib/db-types";
import { fmtPhone, initials, inr } from "@/lib/format";

export const metadata = { title: "Tenants" };

type Row = Pick<Tenant, "id" | "full_name" | "phone" | "monthly_rent" | "status"> & {
  room: string | null;
  roomId: string | null;
  floor: number | null;
  balance: number;
  pay: InvoiceStatus | "none";
};

export default async function TenantsPage({ searchParams }: PageProps<"/app/tenants">) {
  const ws = await getWorkspace();
  const { supabase, userId, building, t } = ws;
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = str("q").trim().toLowerCase().slice(0, 60);
  const floor = str("floor");
  const roomFilter = str("room");
  const status = str("status");
  const sort = str("sort") || "name";
  const showVacated = status === "vacated";
  const month = periodFor(ws.today, building.billing_day).month;

  const [tenantsRes, map, balRes, invRes] = await Promise.all([
    supabase.from("tenants").select("id, full_name, phone, monthly_rent, status").eq("building_id", building.id).eq("owner_id", userId).is("deleted_at", null).eq("status", showVacated ? "vacated" : "active"),
    getRoomMap(ws),
    supabase.from("v_tenant_balances").select("tenant_id, balance").eq("building_id", building.id).eq("owner_id", userId),
    supabase.from("v_invoices").select("tenant_id, status").eq("building_id", building.id).eq("owner_id", userId).eq("period_month", month),
  ]);
  const balance = new Map((balRes.data ?? []).map((b) => [b.tenant_id as string, Number(b.balance)]));
  const pay = new Map((invRes.data ?? []).map((i) => [i.tenant_id as string, i.status as InvoiceStatus]));

  const all: Row[] = ((tenantsRes.data ?? []) as Row[]).map((x) => {
    const occ = map.occupants.find((o) => o.tenantId === x.id);
    const room = occ ? map.rooms.find((r) => r.id === occ.roomId) : undefined;
    return { ...x, room: room?.name ?? null, roomId: room?.id ?? null, floor: room?.floor_number ?? null, balance: balance.get(x.id) ?? 0, pay: pay.get(x.id) ?? "none" };
  });

  const rows = all
    .filter((r) => {
      if (q && !r.full_name.toLowerCase().includes(q) && !r.phone.includes(q) && !(r.room ?? "").toLowerCase().includes(q)) return false;
      if (floor && String(r.floor) !== floor) return false;
      if (roomFilter && r.roomId !== roomFilter) return false;
      if (status === "due") return r.balance > 0;
      if (status && status !== "vacated") return r.pay === status;
      return true;
    })
    .sort((a, b) => (sort === "due" ? b.balance - a.balance || a.full_name.localeCompare(b.full_name) : a.full_name.localeCompare(b.full_name)));

  const floors = [...new Set(map.rooms.map((r) => r.floor_number))];
  const payLabel: Record<Row["pay"], [string, "success" | "warm" | "danger" | "neutral"]> = {
    paid: [t("Paid", "Paid"), "success"],
    partial: [t("Part paid", "Thoda mila"), "warm"],
    unpaid: [t("Unpaid", "Baaki"), "warm"],
    overdue: [t("Overdue", "Late"), "danger"],
    none: [t("No bill", "Bill nahi"), "neutral"],
  };
  const filtered = Boolean(q || floor || roomFilter || status);

  return (
    <div>
      <PageHeader
        title={t("Tenants", "Tenants")}
        subtitle={t(`${rows.length} shown`, `${rows.length} dikh rahe hain`)}
        action={
          <LinkButton href="/app/tenants/new">
            <UserPlus aria-hidden /> {t("Add", "Jodein")}
          </LinkButton>
        }
      />

      <form className="mb-4 space-y-2" role="search">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input name="q" defaultValue={q} placeholder={t("Search name, phone or room", "Naam, phone ya room khojein")} aria-label={t("Search", "Khojein")} className="pl-10" />
          </div>
          <Button type="submit" size="lg">
            {t("Search", "Khojein")}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select name="status" defaultValue={status} aria-label={t("Payment status", "Payment status")} className="h-11 text-[0.9rem]">
            <option value="">{t("All active", "Sabhi active")}</option>
            <option value="due">{t("Any amount due", "Jinka baaki hai")}</option>
            <option value="paid">{t("Paid this month", "Is mahine paid")}</option>
            <option value="partial">{t("Part paid", "Thoda mila")}</option>
            <option value="unpaid">{t("Unpaid", "Baaki")}</option>
            <option value="overdue">{t("Overdue", "Late")}</option>
            <option value="vacated">{t("Vacated tenants", "Jo ja chuke")}</option>
          </Select>
          <Select name="floor" defaultValue={floor} aria-label={t("Floor", "Floor")} className="h-11 text-[0.9rem]">
            <option value="">{t("All floors", "Sabhi floors")}</option>
            {floors.map((f) => (
              <option key={f} value={f}>
                {f === 0 ? t("Ground floor", "Ground floor") : `${t("Floor", "Floor")} ${f}`}
              </option>
            ))}
          </Select>
          <Select name="room" defaultValue={roomFilter} aria-label={t("Room", "Room")} className="h-11 text-[0.9rem]">
            <option value="">{t("All rooms", "Sabhi rooms")}</option>
            {map.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {t("Room", "Room")} {r.name}
              </option>
            ))}
          </Select>
          <Select name="sort" defaultValue={sort} aria-label={t("Sort", "Sort")} className="h-11 text-[0.9rem]">
            <option value="name">{t("Sort: name", "Sort: naam")}</option>
            <option value="due">{t("Sort: highest due", "Sort: sabse zyada baaki")}</option>
          </Select>
        </div>
      </form>

      {rows.length === 0 ? (
        filtered ? (
          <EmptyState icon={Search} title={t("No tenant matches", "Koi tenant nahi mila")} action={<LinkButton href="/app/tenants" variant="outline">{t("Clear filters", "Filters hatayein")}</LinkButton>} />
        ) : (
          <EmptyState
            icon={Users}
            title={t("No tenants yet", "Abhi koi tenant nahi")}
            body={t("Add your first tenant to start tracking rent.", "Rent track karne ke liye pehla tenant jodein.")}
            action={<LinkButton href="/app/tenants/new">{t("Add tenant", "Tenant jodein")}</LinkButton>}
          />
        )
      ) : (
        <>
          {/* phones: cards */}
          <ul className="space-y-2.5 md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/app/tenants/${r.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-soft">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{initials(r.full_name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{r.full_name}</span>
                    <span className="block truncate text-[0.82rem] text-slate-500">
                      {r.room ? `${t("Room", "Room")} ${r.room}` : t("No room", "Room nahi")} · {inr(r.monthly_rent)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={r.balance > 0 ? "block font-semibold tabular-nums text-danger-700" : "block font-semibold tabular-nums text-success-700"}>
                      {r.balance > 0 ? inr(r.balance) : r.balance < 0 ? `+${inr(-r.balance)}` : "₹0"}
                    </span>
                    {r.status === "active" ? <Pill tone={payLabel[r.pay][1]}>{payLabel[r.pay][0]}</Pill> : <Pill>{t("Vacated", "Ja chuke")}</Pill>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* larger screens: table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-[0.92rem]">
              <thead className="bg-slate-50 text-[0.8rem] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("Name", "Naam")}</th>
                  <th className="px-4 py-3 font-semibold">{t("Room", "Room")}</th>
                  <th className="px-4 py-3 font-semibold">{t("Phone", "Phone")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t("Monthly rent", "Mahine ka rent")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t("Balance", "Baaki")}</th>
                  <th className="px-4 py-3 font-semibold">{t("Status", "Status")}</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/app/tenants/${r.id}`} className="font-semibold text-ink hover:text-brand-700">
                        {r.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.room ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{fmtPhone(r.phone)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{inr(r.monthly_rent)}</td>
                    <td className={r.balance > 0 ? "px-4 py-3 text-right font-semibold tabular-nums text-danger-700" : "px-4 py-3 text-right tabular-nums text-success-700"}>{inr(r.balance)}</td>
                    <td className="px-4 py-3">{r.status === "active" ? <Pill tone={payLabel[r.pay][1]}>{payLabel[r.pay][0]}</Pill> : <Pill>{t("Vacated", "Ja chuke")}</Pill>}</td>
                    <td className="pr-3 text-slate-400">
                      <ChevronRight className="size-4" aria-hidden />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
