"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { createTenantAction } from "@/lib/actions/tenants";
import { periodFor, proratedRent } from "@/lib/billing/proration";
import { fmtDay, inr, monthLabel } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { tenantSchema } from "@/lib/validation";

type In = z.input<typeof tenantSchema>;
type Out = z.output<typeof tenantSchema>;

export type FreeRoom = { id: string; name: string; floor: number; rent: number; deposit: number; beds: { id: string; label: string }[] };

export function TenantForm({
  buildingId,
  rooms,
  billingDay,
  defaultRule,
  today,
  preselectBed,
}: {
  buildingId: string;
  rooms: FreeRoom[];
  billingDay: number;
  defaultRule: "calendar" | "fixed30" | "full";
  today: string;
  preselectBed?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const preRoom = rooms.find((r) => r.beds.some((b) => b.id === preselectBed));
  const [floor, setFloor] = useState<string>(preRoom ? String(preRoom.floor) : "");
  const [roomId, setRoomId] = useState<string>(preRoom?.id ?? "");

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(tenantSchema),
    mode: "onTouched",
    defaultValues: {
      full_name: "", phone: "", whatsapp: "", email: "", gender: "", joined_on: today, emergency_contact: "", occupation: "",
      bed_id: preselectBed ?? "", monthly_rent: preRoom?.rent || "", security_deposit: preRoom?.deposit ?? 0,
      electricity_rule: "building", electricity_custom_amount: "", proration_rule: defaultRule, first_month_amount: "",
      first_month_reason: "", opening_balance: "", whatsapp_opt_in: false, notes: "",
    } as In,
  });
  const { register, formState, setValue } = form;
  const err = (n: FieldPath<In>) => form.getFieldState(n, formState).error?.message;
  const w = useWatch({ control: form.control }) as In;

  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
  const floorRooms = rooms.filter((r) => String(r.floor) === floor);
  const room = rooms.find((r) => r.id === roomId);

  // live, transparent first-month calculation (the server computes the real one the same way)
  const rent = Number(w.monthly_rent) || 0;
  const joined = /^\d{4}-\d{2}-\d{2}$/.test(String(w.joined_on)) ? String(w.joined_on) : today;
  const currentPeriod = periodFor(today, billingDay);
  const old = joined < currentPeriod.start; // staying since before this billing period
  const period = periodFor(old ? today : joined, billingDay);
  const calc = proratedRent(rent, w.proration_rule, period, old ? period.start : joined, null, Number(w.first_month_amount) || 0);

  const submit = form.handleSubmit((data) => {
    setError(null);
    start(async () => {
      try {
        const res = await createTenantAction(buildingId, data);
        if (res.ok && res.data) {
          toast.success(res.message ?? t("Tenant added", "Tenant jud gaya"));
          router.push(`/app/tenants/${res.data.id}?tab=documents&new=1`);
        } else if (!res.ok) {
          setError(res.error);
          Object.entries(res.fieldErrors ?? {}).forEach(([k, message]) => form.setError(k as FieldPath<In>, { message }));
        }
      } catch {
        setError(t("Not saved. Check your internet and try again.", "Save nahi hua. Internet check karke dobara try karein."));
      }
    });
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-ink">{t("Tenant", "Tenant")}</h2>
        <Field label={t("Full name", "Poora naam")} htmlFor="full_name" error={err("full_name")}>
          <Input id="full_name" autoComplete="off" {...register("full_name")} />
        </Field>
        <Field label={t("Phone number", "Phone number")} htmlFor="phone" error={err("phone")}>
          <Input id="phone" type="tel" inputMode="numeric" autoComplete="off" placeholder="98765 43210" {...register("phone")} />
        </Field>
        <Field label={t("WhatsApp number", "WhatsApp number")} htmlFor="whatsapp" optional error={err("whatsapp")} hint={t("Only if different from phone", "Sirf tab, jab phone se alag ho")}>
          <Input id="whatsapp" type="tel" inputMode="numeric" autoComplete="off" {...register("whatsapp")} />
        </Field>
        <Checkbox
          {...register("whatsapp_opt_in")}
          label={t("The tenant has agreed to receive rent reminders on WhatsApp.", "Tenant WhatsApp par rent reminder lene ke liye raazi hai.")}
        />
        <Field label={t("Date of joining", "Joining date")} htmlFor="joined_on" error={err("joined_on")}>
          <Input id="joined_on" type="date" {...register("joined_on")} />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-ink">{t("Room", "Room")}</h2>
        {rooms.length === 0 ? (
          <Notice tone="warm">{t("No free bed right now. You can add the tenant and give a room later.", "Abhi koi bed khaali nahi. Tenant jod lein, room baad mein de sakte hain.")}</Notice>
        ) : (
          <>
            <Field label={t("1. Floor", "1. Floor")} htmlFor="floor">
              <Select
                id="floor"
                value={floor}
                onChange={(e) => {
                  setFloor(e.target.value);
                  setRoomId("");
                  setValue("bed_id", "");
                }}
              >
                <option value="">{t("Choose later", "Baad mein chunenge")}</option>
                {floors.map((f) => (
                  <option key={f} value={f}>
                    {f === 0 ? t("Ground floor", "Ground floor") : `${t("Floor", "Floor")} ${f}`}
                  </option>
                ))}
              </Select>
            </Field>
            {floor !== "" && (
              <Field label={t("2. Room (only rooms with a free bed)", "2. Room (sirf khaali bed wale)")} htmlFor="room">
                <Select
                  id="room"
                  value={roomId}
                  onChange={(e) => {
                    const r = rooms.find((x) => x.id === e.target.value);
                    setRoomId(e.target.value);
                    setValue("bed_id", r?.beds.length === 1 ? r.beds[0].id : "");
                    if (r) {
                      if (r.rent > 0) setValue("monthly_rent", r.rent, { shouldValidate: true });
                      setValue("security_deposit", r.deposit);
                    }
                  }}
                >
                  <option value="">{t("Choose room", "Room chunein")}</option>
                  {floorRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {t(`${r.beds.length} free`, `${r.beds.length} khaali`)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {room && (
              <Field label={t("3. Bed", "3. Bed")} htmlFor="bed_id" error={err("bed_id")}>
                <Select id="bed_id" {...register("bed_id")}>
                  <option value="">{t("Choose bed", "Bed chunein")}</option>
                  {room.beds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-ink">{t("Rent", "Rent")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Monthly rent (₹)", "Mahine ka rent (₹)")} htmlFor="monthly_rent" error={err("monthly_rent")}>
            <Input id="monthly_rent" type="number" inputMode="numeric" min={0} {...register("monthly_rent")} />
          </Field>
          <Field label={t("Security deposit (₹)", "Security deposit (₹)")} htmlFor="security_deposit" error={err("security_deposit")}>
            <Input id="security_deposit" type="number" inputMode="numeric" min={0} {...register("security_deposit")} />
          </Field>
        </div>

        {old ? (
          <>
            <Notice tone="neutral">
              {t(
                `This tenant joined before ${fmtDay(currentPeriod.start)}. Billing in HisabMitra starts from ${monthLabel(currentPeriod.month)} with full rent.`,
                `Yeh tenant ${fmtDay(currentPeriod.start)} se pehle aaya tha. HisabMitra mein billing ${monthLabel(currentPeriod.month)} se poore rent ke saath shuru hogi.`,
              )}
            </Notice>
            <Field label={t("Old dues before this month (₹)", "Is mahine se pehle ka baaki (₹)")} htmlFor="opening_balance" optional error={err("opening_balance")} hint={t("Any unpaid amount from earlier months", "Pichhle mahino ka koi baaki amount")}>
              <Input id="opening_balance" type="number" inputMode="numeric" min={0} {...register("opening_balance")} />
            </Field>
          </>
        ) : (
          !calc.fullPeriod && (
            <>
              <Field label={t("First month rent", "Pehle mahine ka rent")} htmlFor="proration_rule">
                <Select id="proration_rule" {...register("proration_rule")}>
                  <option value="calendar">{t("By days (actual days in month)", "Dino ke hisaab se (mahine ke asli din)")}</option>
                  <option value="fixed30">{t("By days (30-day month)", "Dino ke hisaab se (30 din ka mahina)")}</option>
                  <option value="full">{t("Full month rent", "Poore mahine ka rent")}</option>
                  <option value="custom">{t("I will enter the amount", "Main amount khud daalunga")}</option>
                </Select>
              </Field>
              {w.proration_rule === "custom" && (
                <>
                  <Field label={t("First month amount (₹)", "Pehle mahine ka amount (₹)")} htmlFor="first_month_amount" error={err("first_month_amount")}>
                    <Input id="first_month_amount" type="number" inputMode="numeric" min={0} {...register("first_month_amount")} />
                  </Field>
                  <Field label={t("Reason", "Reason")} htmlFor="first_month_reason" error={err("first_month_reason")}>
                    <Input id="first_month_reason" maxLength={200} {...register("first_month_reason")} />
                  </Field>
                </>
              )}
              {rent > 0 && (
                <div className="rounded-2xl bg-brand-50 p-4 text-[0.9rem] text-brand-800">
                  <p className="flex items-center gap-2 font-semibold">
                    <Calculator className="size-4" aria-hidden /> {t("How we calculated", "Hisaab aise laga")}
                  </p>
                  <dl className="mt-2 space-y-1">
                    <div className="flex justify-between"><dt>{t("Monthly rent", "Mahine ka rent")}</dt><dd className="tabular-nums">{inr(rent)}</dd></div>
                    <div className="flex justify-between"><dt>{t("Joining date", "Joining date")}</dt><dd>{fmtDay(joined)}</dd></div>
                    <div className="flex justify-between"><dt>{t("Billing period", "Billing period")}</dt><dd>{fmtDay(period.start)} – {fmtDay(period.end)}</dd></div>
                    <div className="flex justify-between"><dt>{t("Days stayed", "Rehne ke din")}</dt><dd className="tabular-nums">{calc.occupiedDays} / {w.proration_rule === "fixed30" ? 30 : calc.periodDays}</dd></div>
                    <div className="flex justify-between border-t border-brand-200 pt-1.5 text-base font-semibold"><dt>{t("First month rent", "Pehle mahine ka rent")}</dt><dd className="tabular-nums">{inr(calc.amount)}</dd></div>
                  </dl>
                  <p className="mt-2 text-[0.82rem] text-brand-700">{t("From next month, full rent applies.", "Agle mahine se poora rent lagega.")}</p>
                </div>
              )}
            </>
          )
        )}

        <Field label={t("Electricity", "Bijli")} htmlFor="electricity_rule">
          <Select id="electricity_rule" {...register("electricity_rule")}>
            <option value="building">{t("As per building rule (meter / sharing)", "Building ke rule se (meter / sharing)")}</option>
            <option value="custom">{t("Fixed amount every month", "Har mahine fixed amount")}</option>
            <option value="none">{t("Included in rent (no charge)", "Rent mein shaamil (koi charge nahi)")}</option>
          </Select>
        </Field>
        {w.electricity_rule === "custom" && (
          <Field label={t("Fixed electricity amount (₹/month)", "Fixed bijli amount (₹/mahina)")} htmlFor="electricity_custom_amount" error={err("electricity_custom_amount")}>
            <Input id="electricity_custom_amount" type="number" inputMode="numeric" min={0} {...register("electricity_custom_amount")} />
          </Field>
        )}
      </Card>

      <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
        <summary className="cursor-pointer text-base font-semibold text-ink">{t("More details (optional)", "Aur details (optional)")}</summary>
        <div className="mt-4 space-y-4">
          <Field label="Email" htmlFor="email" optional error={err("email")}>
            <Input id="email" type="email" inputMode="email" autoComplete="off" {...register("email")} />
          </Field>
          <Field label={t("Emergency contact", "Emergency contact")} htmlFor="emergency_contact" optional hint={t("Name and phone of a family member", "Parivaar ke kisi sadasya ka naam aur phone")}>
            <Input id="emergency_contact" maxLength={120} {...register("emergency_contact")} />
          </Field>
          <Field label={t("Student / job", "Student / job")} htmlFor="occupation" optional>
            <Input id="occupation" maxLength={80} {...register("occupation")} />
          </Field>
          <Field label={t("Notes", "Notes")} htmlFor="notes" optional>
            <Textarea id="notes" maxLength={500} {...register("notes")} />
          </Field>
        </div>
      </details>

      {error && (
        <p role="alert" className="rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-[0.9rem] font-medium text-danger-700">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" block disabled={pending} aria-busy={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t("Save tenant", "Tenant save karein")}
      </Button>
      <p className="text-center text-[0.82rem] text-slate-500">{t("Documents can be added on the next screen.", "Documents agli screen par jod sakte hain.")}</p>
    </form>
  );
}
