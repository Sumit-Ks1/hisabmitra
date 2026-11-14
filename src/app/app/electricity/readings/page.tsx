import Link from "next/link";
import { CheckCircle2, Gauge } from "lucide-react";
import { FileUpload } from "@/components/app/file-upload";
import { ViewFileButton } from "@/components/app/view-file-button";
import { ActionForm, FieldError, FormError, SubmitButton } from "@/components/ui/action-form";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { saveReadingAction } from "@/lib/actions/electricity";
import { periodFor } from "@/lib/billing/proration";
import { getRoomMap } from "@/lib/data/rooms";
import { getWorkspace } from "@/lib/data/workspace";
import type { MeterReading } from "@/lib/db-types";
import { addMonths, inr, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Meter readings" };

export default async function ReadingsPage({ searchParams }: PageProps<"/app/electricity/readings">) {
  const ws = await getWorkspace();
  const { supabase, userId, building, t, today } = ws;
  const sp = await searchParams;
  const current = periodFor(today, building.billing_day).month;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}-01$/.test(sp.month) && sp.month <= current ? sp.month : current;

  const [{ rooms }, readRes] = await Promise.all([
    getRoomMap(ws),
    supabase.from("electricity_meter_readings").select("*").eq("building_id", building.id).eq("owner_id", userId).lte("period_month", month).order("period_month", { ascending: false }),
  ]);
  const readings = (readRes.data ?? []) as MeterReading[];
  const floors = [...new Set(rooms.map((r) => r.floor_number))];
  const floor = typeof sp.floor === "string" && floors.includes(Number(sp.floor)) ? Number(sp.floor) : null;
  const list = rooms.filter((r) => floor === null || r.floor_number === floor);
  const done = rooms.filter((r) => readings.some((x) => x.room_id === r.id && x.period_month === month)).length;
  const href = (m: string, f: number | null) => `/app/electricity/readings?month=${m}${f === null ? "" : `&floor=${f}`}`;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back="/app/electricity" title={t("Electricity readings", "Bijli readings")} subtitle={t(`${done} of ${rooms.length} rooms done`, `${rooms.length} mein se ${done} rooms ho gaye`)} />

      <div className="mb-3 flex gap-1.5">
        {[addMonths(current, -1), current].map((m) => (
          <Link key={m} href={href(m, floor)} aria-current={m === month ? "page" : undefined} className={cn("inline-flex h-10 flex-1 items-center justify-center rounded-xl text-[0.9rem] font-medium", m === month ? "bg-ink text-white" : "border border-slate-200 bg-white text-slate-600")}>
            {monthLabel(m)}
          </Link>
        ))}
      </div>
      {floors.length > 1 && (
        <div className="-mx-4 mb-4 overflow-x-auto px-4">
          <div className="flex w-max gap-1.5">
            {[null, ...floors].map((f) => (
              <Link key={String(f)} href={href(month, f)} aria-current={f === floor ? "page" : undefined} className={cn("inline-flex h-9 items-center whitespace-nowrap rounded-full px-3.5 text-[0.85rem] font-medium", f === floor ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600")}>
                {f === null ? t("All floors", "Sabhi floors") : f === 0 ? t("Ground", "Ground") : `${t("Floor", "Floor")} ${f}`}
              </Link>
            ))}
          </div>
        </div>
      )}

      {rooms.length === 0 ? (
        <EmptyState icon={Gauge} title={t("Add rooms first", "Pehle rooms jodein")} action={<LinkButton href="/app/rooms">{t("Go to rooms", "Rooms par jayein")}</LinkButton>} />
      ) : (
        <ul className="space-y-3">
          {list.map((room) => {
            const mine = readings.filter((x) => x.room_id === room.id);
            const saved = mine.find((x) => x.period_month === month);
            const prev = saved ? Number(saved.previous_reading) : Number(mine.find((x) => x.period_month < month)?.current_reading ?? room.meter_initial_reading ?? 0);
            const rate = saved ? Number(saved.per_unit_rate) : Number(room.per_unit_rate ?? building.electricity_rate ?? 0);
            return (
              <li key={room.id} className={cn("rounded-2xl border bg-white p-4 shadow-soft", saved ? "border-success-500/40" : "border-slate-200")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold leading-tight text-ink">
                      {t("Room", "Room")} {room.name}
                    </p>
                    <p className="text-[0.82rem] text-slate-500">
                      {t("Previous reading", "Pichhli reading")}: <b className="tabular-nums text-ink">{prev}</b>
                      {room.meter_number && ` · ${t("Meter", "Meter")} ${room.meter_number}`}
                    </p>
                  </div>
                  {saved && (
                    <span className="flex items-center gap-1 text-[0.85rem] font-semibold text-success-700">
                      <CheckCircle2 className="size-4" aria-hidden /> {saved.units} {t("units", "units")} · {inr(Number(saved.units) * Number(saved.per_unit_rate) + Number(saved.fixed_charge))}
                    </span>
                  )}
                </div>

                <ActionForm action={saveReadingAction} className="mt-3 space-y-3">
                  <input type="hidden" name="room_id" value={room.id} />
                  <input type="hidden" name="month" value={month} />
                  <input type="hidden" name="fixed" value={saved ? saved.fixed_charge : room.fixed_charge} />
                  <div className="grid grid-cols-[1.4fr_1fr] gap-2.5">
                    <Field label={t("Current reading", "Abhi ki reading")} htmlFor={`cur-${room.id}`}>
                      <Input id={`cur-${room.id}`} name="current" type="number" inputMode="decimal" min={0} step="0.01" required defaultValue={saved?.current_reading ?? ""} className="text-lg font-semibold" />
                      <FieldError name="current" />
                    </Field>
                    <Field label={t("Rate / unit (₹)", "Rate / unit (₹)")} htmlFor={`rate-${room.id}`}>
                      <Input id={`rate-${room.id}`} name="rate" type="number" inputMode="decimal" min={0} step="0.01" required defaultValue={rate || ""} />
                      <FieldError name="rate" />
                    </Field>
                  </div>
                  <details className="rounded-xl border border-slate-200 px-3.5 py-2.5">
                    <summary className="cursor-pointer text-[0.88rem] font-medium text-slate-600">{t("Date, photo, meter changed?", "Date, photo, meter badla?")}</summary>
                    <div className="mt-3 space-y-3">
                      <Field label={t("Reading date", "Reading ki date")} htmlFor={`date-${room.id}`}>
                        <Input id={`date-${room.id}`} name="reading_date" type="date" defaultValue={saved?.reading_date ?? today} max={today} />
                      </Field>
                      <Field label={t("Meter photo", "Meter ki photo")} optional>
                        <FileUpload kind="meter-photo" name="photo_path" capture="environment" label={t("Take / choose photo", "Photo lein / chunein")} />
                        {saved?.photo_path && <ViewFileButton kind="meter-photo" path={saved.photo_path} label={t("View saved photo", "Saved photo dekhein")} className="mt-2" />}
                      </Field>
                      <Checkbox name="correction" defaultChecked={saved?.is_correction} label={t("Correction: meter was replaced or reset (allows a lower reading)", "Correction: meter badla ya reset hua (kam reading allowed)")} />
                      <Field label={t("New starting reading", "Naye meter ki shuruaati reading")} htmlFor={`po-${room.id}`} optional hint={t("Only for a correction. Usually 0 for a new meter.", "Sirf correction ke liye. Naye meter ke liye aksar 0.")}>
                        <Input id={`po-${room.id}`} name="previous_override" type="number" inputMode="decimal" min={0} step="0.01" />
                      </Field>
                      <Field label={t("Reason for correction", "Correction ka reason")} htmlFor={`cr-${room.id}`} optional>
                        <Input id={`cr-${room.id}`} name="correction_reason" maxLength={200} defaultValue={saved?.correction_reason ?? ""} />
                      </Field>
                    </div>
                  </details>
                  <FormError />
                  <SubmitButton variant={saved ? "outline" : "default"} block>
                    {saved ? t("Update reading", "Reading update karein") : t("Save reading", "Reading save karein")}
                  </SubmitButton>
                </ActionForm>
              </li>
            );
          })}
        </ul>
      )}

      {done > 0 && (
        <LinkButton href={`/app/electricity/charges?month=${month}`} size="lg" block className="mt-5">
          {t("Next: calculate tenant charges", "Aage: tenant charges nikalein")}
        </LinkButton>
      )}
    </div>
  );
}
