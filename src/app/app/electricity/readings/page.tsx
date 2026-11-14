import Link from "next/link";
import { Gauge, Info } from "lucide-react";
import { MeterReadingCard } from "@/components/app/meter-reading-card";
import { ActionForm, FieldError, FormError, SubmitButton } from "@/components/ui/action-form";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, Notice, PageHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { saveElectricityRateAction } from "@/lib/actions/electricity";
import { periodFor } from "@/lib/billing/proration";
import { getMeterRooms } from "@/lib/data/meter";
import { getWorkspace } from "@/lib/data/workspace";
import { fmtDate, inr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Meter readings" };

export default async function ReadingsPage({ searchParams }: PageProps<"/app/electricity/readings">) {
  const ws = await getWorkspace();
  const { building, t, today } = ws;
  const sp = await searchParams;
  const rooms = await getMeterRooms(ws);

  const charging = building.electricity_method === "submeter";
  const rate = Number(building.electricity_rate ?? 0);
  const needsRate = charging && rate <= 0;
  const period = periodFor(today, building.billing_day);
  const readThisPeriod = rooms.filter((r) => r.last && r.last.date >= period.start).length;

  const floors = [...new Set(rooms.map((r) => r.floor))];
  const floor = typeof sp.floor === "string" && floors.includes(Number(sp.floor)) ? Number(sp.floor) : null;
  const list = rooms.filter((r) => floor === null || r.floor === floor);
  const href = (f: number | null) => (f === null ? "/app/electricity/readings" : `/app/electricity/readings?floor=${f}`);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back="/app/electricity"
        title={t("Meter readings", "Meter readings")}
        subtitle={t(
          `${readThisPeriod} of ${rooms.length} rooms read since ${fmtDate(period.start)}`,
          `${fmtDate(period.start)} se ${rooms.length} mein se ${readThisPeriod} rooms ki reading ho gayi`,
        )}
      />

      {charging ? (
        <Card className="mb-4">
          <ActionForm action={saveElectricityRateAction} className="space-y-2">
            <input type="hidden" name="building_id" value={building.id} />
            <div className="flex items-end gap-2">
              <Field label={t("Rate per unit (₹) — same for every room", "Per unit rate (₹) — har room ke liye same")} htmlFor="rate" className="min-w-0 flex-1">
                <Input id="rate" name="rate" type="number" inputMode="decimal" min={0} step="0.01" required defaultValue={rate > 0 ? rate : ""} placeholder="10" className="text-lg font-semibold" />
              </Field>
              <SubmitButton variant={needsRate ? "default" : "outline"} className="h-12 shrink-0 px-5">
                {t("Save rate", "Rate save")}
              </SubmitButton>
            </div>
            <FieldError name="rate" />
            <FormError />
            <p className="text-[0.82rem] leading-snug text-slate-500">
              {t(
                "When you save a reading, units × this rate is added to the bill of the tenants in that room (split by days stayed if tenants changed). A new rate applies to readings saved after the change.",
                "Reading save karte hi units × yeh rate us room ke tenants ke bill mein jud jata hai (tenant badle hon to rehne ke dino ke hisaab se). Naya rate sirf uske baad ki readings par lagta hai.",
              )}
            </p>
          </ActionForm>
        </Card>
      ) : (
        <Notice tone="brand" icon={Info} className="mb-4" title={t("Readings are saved, not charged", "Readings save hoti hain, charge nahi")}>
          {t(
            "This building splits the main electricity bill. Tenant charges are worked out on the Tenant charges page.",
            "Yeh building main bijli bill baant-ti hai. Tenant charges “Tenant charges” page par bante hain.",
          )}{" "}
          <Link href="/app/electricity/charges" className="font-semibold underline">
            {t("Open", "Kholein")}
          </Link>
        </Notice>
      )}

      {needsRate && (
        <Notice tone="warm" className="mb-4" title={t("Set the rate first", "Pehle rate set karein")}>
          {t("Readings can be saved after you set the rate per unit above.", "Upar per unit rate set karne ke baad readings save hongi.")}
        </Notice>
      )}

      {floors.length > 1 && (
        <div className="-mx-4 mb-4 overflow-x-auto px-4">
          <div className="flex w-max gap-1.5">
            {[null, ...floors].map((f) => (
              <Link key={String(f)} href={href(f)} aria-current={f === floor ? "page" : undefined} className={cn("inline-flex h-9 items-center whitespace-nowrap rounded-full px-3.5 text-[0.85rem] font-medium", f === floor ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600")}>
                {f === null ? t("All floors", "Sabhi floors") : f === 0 ? t("Ground", "Ground") : `${t("Floor", "Floor")} ${f}`}
              </Link>
            ))}
          </div>
        </div>
      )}

      {rooms.length === 0 ? (
        <EmptyState icon={Gauge} title={t("Add rooms first", "Pehle rooms jodein")} action={<LinkButton href="/app/rooms">{t("Go to rooms", "Rooms par jayein")}</LinkButton>} />
      ) : (
        <ul className={cn("space-y-3", needsRate && "opacity-60")} inert={needsRate}>
          {list.map((room) => (
            <MeterReadingCard key={room.id} room={room} rate={rate} charging={charging} today={today} />
          ))}
        </ul>
      )}

      {charging && rate > 0 && rooms.some((r) => r.last) && (
        <p className="mt-5 text-center text-[0.85rem] text-slate-500">
          {t(`Rate ${inr(rate)}/unit · see every tenant's electricity on`, `Rate ${inr(rate)}/unit · har tenant ki bijli dekhein`)}{" "}
          <Link href="/app/electricity/charges" className="font-medium text-brand-700 underline">
            {t("Tenant charges", "Tenant charges")}
          </Link>
        </p>
      )}
    </div>
  );
}
