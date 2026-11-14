"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Loader2, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import type { z } from "zod";
import { FileUpload } from "@/components/app/file-upload";
import { Button } from "@/components/ui/button";
import { Card, Notice, Row } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { saveOnboardingDraftAction, submitOnboardingAction } from "@/lib/actions/onboarding";
import type { PricingSettings } from "@/lib/db-types";
import { UP_DISCOMS } from "@/lib/electricity/types";
import { fmtPhone, inr, maskTail } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { durationLabel, estimateSubscription } from "@/lib/pricing";
import { onboardingSchema } from "@/lib/validation";
import { StepProgress } from "./progress";

type In = z.input<typeof onboardingSchema>;
type Out = z.output<typeof onboardingSchema>;
type Name = FieldPath<In>;

const SECTIONS = ["owner", "building", "electricity"] as const;

export function OnboardingWizard({
  email,
  defaults,
  pricing,
  reviewNote,
}: {
  email: string;
  defaults: In;
  pricing: PricingSettings;
  reviewNote: string | null;
}) {
  const t = useT();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(onboardingSchema), defaultValues: defaults, mode: "onTouched" });
  const { register, formState } = form;
  const err = (name: Name) => form.getFieldState(name, formState).error?.message;
  const values = useWatch({ control: form.control }) as In;
  const rooms = Number(values.building.rooms_count) || 0;

  async function next() {
    const ok = await form.trigger(SECTIONS[step]);
    if (!ok) return;
    // best effort: lets the owner close the app and continue later
    void saveOnboardingDraftAction(form.getValues()).catch(() => {});
    setStep((s) => s + 1);
    window.scrollTo({ top: 0 });
  }

  const submit = form.handleSubmit(
    (data) => {
      setError(null);
      start(async () => {
        try {
          const res = await submitOnboardingAction(data);
          if (res && !res.ok) setError(res.error);
        } catch (e) {
          if (e && typeof e === "object" && "digest" in e) throw e;
          setError(t("Not submitted. Check your internet and try again.", "Submit nahi hua. Internet check karke dobara try karein."));
        }
      });
    },
    () => setError(t("Some details are missing. Please check each step.", "Kuch details adhoori hain. Har step check karein.")),
  );

  const labels = [t("You", "Aap"), t("PG", "PG"), t("Electricity", "Bijli"), t("Review", "Review"), t("Price", "Price"), t("Payment", "Payment")];
  const pgTypes = [
    { v: "boys", l: t("Boys", "Boys") },
    { v: "girls", l: t("Girls", "Girls") },
    { v: "coliving", l: t("Co-living", "Co-living") },
    { v: "other", l: t("Other", "Other") },
  ];

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <StepProgress steps={labels} current={step} />

      {reviewNote && (
        <Notice tone="warm" title={t("Message from our team", "Hamari team ka message")}>
          <p className="mt-1 whitespace-pre-wrap">{reviewNote}</p>
        </Notice>
      )}

      {step === 0 && (
        <Card className="space-y-4">
          <StepTitle title={t("About you", "Aapke baare mein")} sub={t("So we know who manages this PG.", "Taaki hume pata rahe PG kaun sambhalta hai.")} />
          <Field label={t("Full name", "Poora naam")} htmlFor="o-name" error={err("owner.full_name")}>
            <Input id="o-name" autoComplete="name" {...register("owner.full_name")} />
          </Field>
          <Field label="Email" htmlFor="o-email" hint={t("Verified · cannot be changed here", "Verified · yahan badal nahi sakte")}>
            <Input id="o-email" value={email} readOnly disabled />
          </Field>
          <Field label={t("Phone number", "Phone number")} htmlFor="o-phone" error={err("owner.phone")}>
            <Input id="o-phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" {...register("owner.phone")} />
          </Field>
          <Field label={t("WhatsApp number", "WhatsApp number")} htmlFor="o-wa" optional error={err("owner.whatsapp")} hint={t("Only if different from phone", "Sirf tab, jab phone se alag ho")}>
            <Input id="o-wa" type="tel" inputMode="numeric" {...register("owner.whatsapp")} />
          </Field>
          <Field label={t("App language", "App ki bhasha")} htmlFor="o-lang">
            <Select id="o-lang" {...register("owner.language")}>
              <option value="hinglish">Hinglish</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <Field label={t("Profile photo", "Profile photo")} optional>
            <FileUpload kind="avatar" label={t("Add a photo", "Photo lagayein")} />
          </Field>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-4">
          <StepTitle title={t("Your PG building", "Aapki PG building")} sub={t("One building for now. More can be added later.", "Abhi ek building. Baad mein aur jod sakte hain.")} />
          <Field label={t("PG / building name", "PG / building ka naam")} htmlFor="b-name" error={err("building.name")}>
            <Input id="b-name" placeholder="Shanti Boys PG" {...register("building.name")} />
          </Field>
          <Field label={t("Full address", "Poora address")} htmlFor="b-address" error={err("building.address")}>
            <Textarea id="b-address" rows={2} autoComplete="street-address" {...register("building.address")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("City", "Sheher")} htmlFor="b-city" error={err("building.city")}>
              <Input id="b-city" autoComplete="address-level2" {...register("building.city")} />
            </Field>
            <Field label={t("PIN code", "PIN code")} htmlFor="b-pin" error={err("building.pincode")}>
              <Input id="b-pin" inputMode="numeric" maxLength={6} autoComplete="postal-code" {...register("building.pincode")} />
            </Field>
          </div>
          <Field label={t("State", "State")} htmlFor="b-state" error={err("building.state")}>
            <Input id="b-state" autoComplete="address-level1" {...register("building.state")} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("Floors", "Floors")} htmlFor="b-floors" error={err("building.floors_count")}>
              <Input id="b-floors" type="number" inputMode="numeric" min={1} {...register("building.floors_count")} />
            </Field>
            <Field label={t("Rooms", "Rooms")} htmlFor="b-rooms" error={err("building.rooms_count")}>
              <Input id="b-rooms" type="number" inputMode="numeric" min={1} {...register("building.rooms_count")} />
            </Field>
            <Field label={t("Beds", "Beds")} htmlFor="b-beds" error={err("building.beds_count")}>
              <Input id="b-beds" type="number" inputMode="numeric" min={1} placeholder="—" {...register("building.beds_count")} />
            </Field>
          </div>
          {rooms > 0 && (
            <p className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-[0.9rem] text-brand-800">
              {t("Estimated subscription", "Andaazan subscription")}: <b>{inr(estimateSubscription(rooms, pricing))}</b> / {durationLabel(pricing.duration_months)} ({rooms} × {inr(pricing.price_per_room)})
            </p>
          )}
          <Field label={t("PG type", "PG type")} htmlFor="b-type">
            <Select id="b-type" {...register("building.pg_type")}>
              {pgTypes.map((p) => (
                <option key={p.v} value={p.v}>
                  {p.l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("Short description", "Chhota description")} htmlFor="b-desc" optional error={err("building.description")}>
            <Textarea id="b-desc" rows={2} {...register("building.description")} />
          </Field>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-4">
          <StepTitle
            title={t("Electricity connection", "Bijli connection")}
            sub={t("The main connection of this building. Find these on any old electricity bill.", "Is building ka main connection. Yeh details purane bijli bill par milti hain.")}
          />
          <Field label={t("Electricity company (DISCOM)", "Bijli company (DISCOM)")} htmlFor="e-discom" error={err("electricity.discom")}>
            <Select id="e-discom" {...register("electricity.discom")}>
              {UP_DISCOMS.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} — {d.region}
                </option>
              ))}
              <option value="OTHER">{t("Other", "Koi aur")}</option>
            </Select>
          </Field>
          <Field label={t("Consumer / account number", "Consumer / account number")} htmlFor="e-consumer" error={err("electricity.consumer_number")}>
            <Input id="e-consumer" inputMode="text" autoCapitalize="characters" {...register("electricity.consumer_number")} />
          </Field>
          <Field label={t("Connection type", "Connection type")} htmlFor="e-type" optional>
            <Select id="e-type" {...register("electricity.connection_type")}>
              <option value="">—</option>
              <option value="domestic">{t("Domestic", "Domestic (gharelu)")}</option>
              <option value="commercial">{t("Commercial", "Commercial")}</option>
              <option value="other">{t("Other", "Koi aur")}</option>
            </Select>
          </Field>
          <Field label={t("Meter number", "Meter number")} htmlFor="e-meter" optional error={err("electricity.meter_number")}>
            <Input id="e-meter" {...register("electricity.meter_number")} />
          </Field>
          <Field label={t("Billing cycle", "Billing cycle")} htmlFor="e-cycle" optional>
            <Select id="e-cycle" {...register("electricity.billing_cycle")}>
              <option value="">{t("Not sure", "Pata nahi")}</option>
              <option value="monthly">{t("Monthly", "Har mahine")}</option>
              <option value="bimonthly">{t("Every 2 months", "Har 2 mahine")}</option>
            </Select>
          </Field>
          <Notice tone="neutral">
            {t(
              "HisabMitra is not affiliated with any DISCOM. Automatic bill fetch works only after our BBPS provider access is live; until then you can enter the bill amount yourself.",
              "HisabMitra kisi DISCOM se juda nahi hai. Automatic bill fetch tabhi chalega jab hamara BBPS provider access live hoga; tab tak aap bill amount khud daal sakte hain.",
            )}
          </Notice>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <StepTitle title={t("Check your details", "Apni details check karein")} sub={t("You can edit anything before submitting.", "Submit se pehle kuch bhi badal sakte hain.")} />
          <ReviewCard title={t("You", "Aap")} onEdit={() => setStep(0)}>
            <Row label={t("Name", "Naam")}>{values.owner.full_name}</Row>
            <Row label="Email">{email}</Row>
            <Row label={t("Phone", "Phone")}>{fmtPhone(String(values.owner.phone))}</Row>
            {values.owner.whatsapp ? <Row label="WhatsApp">{fmtPhone(String(values.owner.whatsapp))}</Row> : null}
            <Row label={t("Language", "Bhasha")}>{values.owner.language === "en" ? "English" : "Hinglish"}</Row>
          </ReviewCard>
          <ReviewCard title={t("PG building", "PG building")} onEdit={() => setStep(1)}>
            <Row label={t("Name", "Naam")}>{values.building.name}</Row>
            <Row label={t("Address", "Address")}>
              {values.building.address}, {values.building.city}, {values.building.state} {values.building.pincode}
            </Row>
            <Row label={t("Floors / Rooms / Beds", "Floors / Rooms / Beds")}>
              {String(values.building.floors_count)} / {String(values.building.rooms_count)} / {values.building.beds_count ? String(values.building.beds_count) : "—"}
            </Row>
            <Row label={t("Type", "Type")}>{pgTypes.find((p) => p.v === values.building.pg_type)?.l}</Row>
          </ReviewCard>
          <ReviewCard title={t("Electricity", "Bijli")} onEdit={() => setStep(2)}>
            <Row label="DISCOM">{values.electricity.discom}</Row>
            <Row label={t("Consumer number", "Consumer number")}>{maskTail(values.electricity.consumer_number)}</Row>
            {values.electricity.meter_number ? <Row label={t("Meter number", "Meter number")}>{values.electricity.meter_number}</Row> : null}
          </ReviewCard>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-[0.9rem] font-medium text-danger-700">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        {step > 0 && (
          <Button variant="outline" size="lg" onClick={() => setStep((s) => s - 1)} disabled={pending}>
            <ArrowLeft aria-hidden /> {t("Back", "Peeche")}
          </Button>
        )}
        {step < 3 ? (
          <Button size="lg" block onClick={next}>
            {t("Next", "Aage")} <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button type="submit" size="lg" block disabled={pending} aria-busy={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("Confirm & see price", "Confirm karein aur price dekhein")}
          </Button>
        )}
      </div>
    </form>
  );
}

function StepTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-0.5 text-[0.9rem] text-slate-500">{sub}</p>
    </div>
  );
}

function ReviewCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[0.95rem] font-semibold text-ink">{title}</h3>
        <Button variant="soft" size="sm" onClick={onEdit}>
          <Pencil aria-hidden /> Edit
        </Button>
      </div>
      <dl className="divide-y divide-slate-100">{children}</dl>
    </Card>
  );
}
