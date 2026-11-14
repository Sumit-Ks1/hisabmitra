import Link from "next/link";
import {
  BedDouble,
  ChevronRight,
  DoorOpen,
  Gauge,
  IndianRupee,
  MessageCircle,
  UserPlus,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Card, CardTitle, EmptyState, StatCard } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { periodFor } from "@/lib/billing/proration";
import { getWorkspace } from "@/lib/data/workspace";
import type { Invoice, RoomRow } from "@/lib/db-types";
import { inr, monthLabel } from "@/lib/format";
import { firstName } from "@/lib/whatsapp/message";

export default async function DashboardPage() {
  const ws = await getWorkspace();
  const { supabase, building, t, userId } = ws;
  const period = periodFor(ws.today, building.billing_day);

  const [roomsRes, tenantsRes, invoicesRes, balancesRes] = await Promise.all([
    supabase.from("v_rooms").select("id, maintenance, bed_count, occupied_count").eq("building_id", building.id).eq("owner_id", userId),
    supabase.from("tenants").select("id", { count: "exact", head: true }).eq("building_id", building.id).eq("owner_id", userId).eq("status", "active").is("deleted_at", null),
    supabase.from("v_invoices").select("total_amount, paid_amount, balance, electricity_amount").eq("building_id", building.id).eq("owner_id", userId).eq("period_month", period.month),
    supabase.from("v_tenant_balances").select("balance").eq("building_id", building.id).eq("owner_id", userId).gt("balance", 0),
  ]);

  const rooms = (roomsRes.data ?? []) as Pick<RoomRow, "id" | "maintenance" | "bed_count" | "occupied_count">[];
  const invoices = (invoicesRes.data ?? []) as Pick<Invoice, "total_amount" | "paid_amount" | "balance" | "electricity_amount">[];
  const sum = (xs: number[]) => xs.reduce((a, b) => a + Number(b), 0);

  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter((r) => r.occupied_count > 0).length;
  const availableRooms = rooms.filter((r) => !r.maintenance && r.occupied_count < r.bed_count).length;
  const freeBeds = sum(rooms.filter((r) => !r.maintenance).map((r) => Math.max(0, r.bed_count - r.occupied_count)));
  const expected = sum(invoices.map((i) => i.total_amount));
  const collected = sum(invoices.map((i) => i.paid_amount));
  const pending = sum(invoices.map((i) => Math.max(0, i.balance)));
  const electricity = sum(invoices.map((i) => i.electricity_amount));
  const outstanding = sum((balancesRes.data ?? []).map((b) => b.balance as number));
  const tenantCount = tenantsRes.count ?? 0;

  const actions: { href: string; label: string; icon: LucideIcon }[] = [
    { href: "/app/tenants/new", label: t("Add tenant", "Tenant jodein"), icon: UserPlus },
    { href: "/app/rooms", label: t("Allocate room", "Room allocate karein"), icon: DoorOpen },
    { href: "/app/payments", label: t("Record payment", "Payment likhein"), icon: IndianRupee },
    { href: "/app/electricity/readings", label: t("Add meter reading", "Bijli reading add karein"), icon: Gauge },
    { href: "/app/reminders", label: t("Send reminder", "Reminder bhejein"), icon: MessageCircle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {t(`Hello, ${firstName(ws.profile.full_name) || "there"}`, `Namaste, ${firstName(ws.profile.full_name) || ""} ji`)}
        </h1>
        <p className="mt-1 text-[0.95rem] text-slate-500">
          {t("Today's summary", "Aaj ka hisaab")} · {monthLabel(period.month)}
        </p>
      </div>

      {totalRooms === 0 ? (
        <EmptyState
          icon={BedDouble}
          title={t("Start by adding your rooms", "Sabse pehle apne rooms jodein")}
          body={t("Add floors, rooms and beds once. After that you can add tenants and track rent.", "Ek baar floors, rooms aur beds jod lein. Phir tenants jodkar rent track karein.")}
          action={<LinkButton href="/app/rooms">{t("Set up rooms", "Rooms set up karein")}</LinkButton>}
        />
      ) : (
        <>
          {/* the one number an owner opens the app for */}
          <Link href="/app/payments" className="block rounded-3xl bg-ink p-5 text-white shadow-lift">
            <div className="flex items-center justify-between">
              <p className="text-[0.9rem] text-slate-300">{t("Total rent pending", "Total rent baaki")}</p>
              <ChevronRight className="size-5 text-slate-400" aria-hidden />
            </div>
            <p className="mt-2 text-[2.1rem] font-semibold leading-none tracking-[-0.03em] tabular-nums">{inr(pending)}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-success-500" style={{ width: `${expected > 0 ? Math.min(100, (collected / expected) * 100) : 0}%` }} />
            </div>
            <div className="mt-2.5 flex justify-between text-[0.85rem] text-slate-300">
              <span>
                {t("Collected", "Mila")} <b className="font-semibold text-white tabular-nums">{inr(collected)}</b>
              </span>
              <span>
                {t("Expected", "Aana hai")} <b className="font-semibold text-white tabular-nums">{inr(expected)}</b>
              </span>
            </div>
          </Link>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={t("Tenants", "Tenants")} value={tenantCount} icon={Users} tone="brand" href="/app/tenants" />
            <StatCard
              label={t("Rooms occupied", "Rooms bhare")}
              value={`${occupiedRooms}/${totalRooms}`}
              hint={t(`${availableRooms} rooms · ${freeBeds} beds free`, `${availableRooms} rooms · ${freeBeds} beds khaali`)}
              icon={BedDouble}
              href="/app/rooms"
            />
            <StatCard label={t("Electricity this month", "Is mahine bijli")} value={inr(electricity)} icon={Zap} tone="warm" href="/app/electricity" />
            <StatCard
              label={t("Total outstanding", "Kul baaki")}
              value={inr(outstanding)}
              hint={t("All months together", "Sabhi mahine milakar")}
              icon={Wallet}
              tone={outstanding > 0 ? "danger" : "success"}
              href="/app/tenants?status=due"
            />
          </div>
        </>
      )}

      <Card>
        <CardTitle>{t("Quick actions", "Jaldi ke kaam")}</CardTitle>
        <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {actions.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex h-full min-h-24 flex-col items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-canvas p-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50/60"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white">
                  <Icon className="size-[1.1rem]" aria-hidden />
                </span>
                <span className="text-[0.9rem] font-semibold leading-tight text-ink">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
