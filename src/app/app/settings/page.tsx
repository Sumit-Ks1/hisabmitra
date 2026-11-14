import { CheckCircle2, CircleAlert, ShieldCheck } from "lucide-react";
import { FileUpload } from "@/components/app/file-upload";
import { SignOutButton } from "@/components/app/nav";
import { ActionForm, FieldError, FormError, SubmitButton } from "@/components/ui/action-form";
import { LinkButton } from "@/components/ui/button";
import { Card, CardTitle, PageHeader, Pill, Row } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { updateBillingSettingsAction, updateBuildingAction, updateElectricitySettingsAction } from "@/lib/actions/settings";
import { updateProfileAction } from "@/lib/actions/workspace";
import { getSettings } from "@/lib/data/settings";
import { getSubscription, getWorkspace } from "@/lib/data/workspace";
import type { ElectricityConnection } from "@/lib/db-types";
import { resolveElectricity } from "@/lib/electricity/provider";
import { UP_DISCOMS } from "@/lib/electricity/types";
import { fmtDate, fmtPhone, inr } from "@/lib/format";
import { durationLabel } from "@/lib/pricing";
import { whatsappState } from "@/lib/whatsapp/provider";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ws = await getWorkspace();
  const { supabase, userId, building: b, profile, t } = ws;
  const [sub, settings, connRes, docCount] = await Promise.all([
    getSubscription(ws),
    getSettings(supabase, ["support", "integrations"]),
    supabase.from("electricity_connections").select("*").eq("building_id", b.id).eq("owner_id", userId).maybeSingle(),
    supabase.from("tenant_documents").select("id", { count: "exact", head: true }).eq("owner_id", userId),
  ]);
  const conn = connRes.data as ElectricityConnection | null;
  const wa = whatsappState(settings.integrations.whatsapp);
  const el = resolveElectricity(settings.integrations.electricity);
  const days = Array.from({ length: 28 }, (_, i) => i + 1);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={t("Settings", "Settings")} />

      <Card id="profile">
        <CardTitle>{t("Profile & language", "Profile aur bhasha")}</CardTitle>
        <ActionForm action={updateProfileAction} className="mt-3 space-y-3">
          <Field label={t("Full name", "Poora naam")} htmlFor="full_name">
            <Input id="full_name" name="full_name" defaultValue={profile.full_name} required />
            <FieldError name="full_name" />
          </Field>
          <Field label="Email" htmlFor="email" hint={t("Cannot be changed here", "Yahan badal nahi sakte")}>
            <Input id="email" value={profile.email} readOnly disabled />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Phone", "Phone")} htmlFor="phone">
              <Input id="phone" name="phone" type="tel" inputMode="numeric" defaultValue={profile.phone ?? ""} required />
              <FieldError name="phone" />
            </Field>
            <Field label="WhatsApp" htmlFor="whatsapp" optional>
              <Input id="whatsapp" name="whatsapp" type="tel" inputMode="numeric" defaultValue={profile.whatsapp ?? ""} />
              <FieldError name="whatsapp" />
            </Field>
          </div>
          <Field label={t("App language", "App ki bhasha")} htmlFor="language">
            <Select id="language" name="language" defaultValue={profile.language}>
              <option value="hinglish">Hinglish</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <Field label={t("Profile photo", "Profile photo")} optional>
            <FileUpload kind="avatar" label={profile.avatar_path ? t("Change photo", "Photo badlein") : t("Add a photo", "Photo lagayein")} />
          </Field>
          <FormError />
          <SubmitButton>{t("Save profile", "Profile save karein")}</SubmitButton>
        </ActionForm>
      </Card>

      <Card id="building">
        <CardTitle>{t("Building details", "Building ki details")}</CardTitle>
        <ActionForm action={updateBuildingAction} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={b.id} />
          <Field label={t("PG / building name", "PG / building ka naam")} htmlFor="b_name">
            <Input id="b_name" name="name" defaultValue={b.name} required />
            <FieldError name="name" />
          </Field>
          <Field label={t("Address", "Address")} htmlFor="b_address">
            <Textarea id="b_address" name="address" rows={2} defaultValue={b.address} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("City", "Sheher")} htmlFor="b_city">
              <Input id="b_city" name="city" defaultValue={b.city} />
            </Field>
            <Field label={t("PIN code", "PIN code")} htmlFor="b_pin">
              <Input id="b_pin" name="pincode" inputMode="numeric" maxLength={6} defaultValue={b.pincode ?? ""} />
              <FieldError name="pincode" />
            </Field>
          </div>
          <Field label={t("PG type", "PG type")} htmlFor="b_type">
            <Select id="b_type" name="pg_type" defaultValue={b.pg_type}>
              <option value="boys">Boys</option>
              <option value="girls">Girls</option>
              <option value="coliving">Co-living</option>
              <option value="other">{t("Other", "Other")}</option>
            </Select>
          </Field>
          <FormError />
          <SubmitButton variant="outline">{t("Save building", "Building save karein")}</SubmitButton>
        </ActionForm>
      </Card>

      <Card id="billing">
        <CardTitle>{t("Rent billing rules", "Rent billing ke rules")}</CardTitle>
        <ActionForm action={updateBillingSettingsAction} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={b.id} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Month starts on", "Mahina kis din shuru")} htmlFor="billing_day" hint={t("Bills are created on this day", "Is din bill banta hai")}>
              <Select id="billing_day" name="billing_day" defaultValue={b.billing_day}>
                {days.map((d) => <option key={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label={t("Rent due by", "Rent kab tak dena hai")} htmlFor="rent_due_day">
              <Select id="rent_due_day" name="rent_due_day" defaultValue={b.rent_due_day}>
                {days.map((d) => <option key={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label={t("Grace days", "Chhoot ke din")} htmlFor="grace_days" hint={t("After this, rent shows as overdue", "Iske baad rent late dikhega")}>
              <Input id="grace_days" name="grace_days" type="number" inputMode="numeric" min={0} max={30} defaultValue={b.grace_days} />
            </Field>
            <Field label={t("Late fee (₹)", "Late fee (₹)")} htmlFor="late_fee_amount" hint={t("0 = no late fee", "0 = late fee nahi")}>
              <Input id="late_fee_amount" name="late_fee_amount" type="number" inputMode="numeric" min={0} defaultValue={b.late_fee_amount} />
            </Field>
          </div>
          <Field label={t("Tenant joins or leaves mid-month", "Tenant mahine ke beech mein aaye ya jaye")} htmlFor="proration_rule">
            <Select id="proration_rule" name="proration_rule" defaultValue={b.proration_rule}>
              <option value="calendar">{t("Charge by days (actual days in month)", "Dino ke hisaab se (mahine ke asli din)")}</option>
              <option value="fixed30">{t("Charge by days (30-day month)", "Dino ke hisaab se (30 din ka mahina)")}</option>
              <option value="full">{t("Always charge the full month", "Hamesha poora mahina")}</option>
            </Select>
          </Field>
          <Field label={t("Rent is set", "Rent kaise tay hota hai")} htmlFor="rent_basis">
            <Select id="rent_basis" name="rent_basis" defaultValue={b.rent_basis}>
              <option value="bed">{t("Per bed", "Har bed ka")}</option>
              <option value="room">{t("Per room", "Poore room ka")}</option>
            </Select>
          </Field>
          <FormError />
          <SubmitButton variant="outline">{t("Save billing rules", "Billing rules save karein")}</SubmitButton>
        </ActionForm>
      </Card>

      <Card id="electricity">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{t("Electricity", "Bijli")}</CardTitle>
          <Pill tone={el.mode === "live" ? "success" : "neutral"}>
            {el.mode === "live" ? t("Auto fetch: on", "Auto fetch: chalu") : el.mode === "sandbox" ? "Sandbox" : t("Auto fetch: not active", "Auto fetch: band")}
          </Pill>
        </div>
        <ActionForm action={updateElectricitySettingsAction} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={b.id} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="DISCOM" htmlFor="discom">
              <Select id="discom" name="discom" defaultValue={conn?.discom ?? "PVVNL"}>
                {UP_DISCOMS.map((d) => <option key={d.code} value={d.code}>{d.code}</option>)}
                <option value="OTHER">{t("Other", "Other")}</option>
              </Select>
            </Field>
            <Field label={t("Consumer number", "Consumer number")} htmlFor="consumer_number">
              <Input id="consumer_number" name="consumer_number" defaultValue={conn?.consumer_number ?? ""} required />
              <FieldError name="consumer_number" />
            </Field>
          </div>
          <Field label={t("Main meter number", "Main meter number")} htmlFor="meter_number" optional>
            <Input id="meter_number" name="meter_number" defaultValue={conn?.meter_number ?? ""} />
          </Field>
          <Field label={t("How tenants are charged", "Tenants se kaise lete hain")} htmlFor="electricity_method">
            <Select id="electricity_method" name="electricity_method" defaultValue={b.electricity_method}>
              <option value="submeter">{t("Room meter: units × rate", "Room meter: units × rate")}</option>
              <option value="proportional">{t("Split main bill by units used", "Main bill ko units ke hisaab se")}</option>
              <option value="equal">{t("Split main bill equally", "Main bill barabar")}</option>
              <option value="custom">{t("I type each amount", "Har amount khud daalta hoon")}</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Rate per unit (₹)", "Per unit rate (₹)")} htmlFor="electricity_rate" hint={t("Your own rate. DISCOM slab rates vary.", "Aapka apna rate. DISCOM ke slab rate alag hote hain.")}>
              <Input id="electricity_rate" name="electricity_rate" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={b.electricity_rate} />
              <FieldError name="electricity_rate" />
            </Field>
            <Field label={t("Reading day", "Reading ka din")} htmlFor="electricity_billing_day" optional>
              <Select id="electricity_billing_day" name="electricity_billing_day" defaultValue={b.electricity_billing_day ?? ""}>
                <option value="">—</option>
                {days.map((d) => <option key={d}>{d}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={t("Common-area electricity", "Common area ki bijli")} htmlFor="common_area_rule">
            <Select id="common_area_rule" name="common_area_rule" defaultValue={b.common_area_rule}>
              <option value="none">{t("Not charged to tenants", "Tenants se nahi lete")}</option>
              <option value="equal">{t("Shared equally", "Barabar baant-te hain")}</option>
              <option value="proportional">{t("Shared by usage", "Use ke hisaab se")}</option>
            </Select>
          </Field>
          <FormError />
          <SubmitButton variant="outline">{t("Save electricity settings", "Bijli settings save karein")}</SubmitButton>
        </ActionForm>
      </Card>

      <Card id="whatsapp">
        <CardTitle>WhatsApp</CardTitle>
        <p className="mt-2 flex items-start gap-2 text-[0.92rem] text-slate-700">
          {wa.live ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-700" aria-hidden /> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-warm-800" aria-hidden />}
          {wa.live
            ? t("Connected. Reminders are sent through the official WhatsApp Business API.", "Connected. Reminder official WhatsApp Business API se jaate hain.")
            : t("Setup required. Automatic sending is not connected yet; you can still copy reminder messages and send them yourself.", "Setup baaki hai. Automatic sending abhi connect nahi hai; aap reminder message copy karke khud bhej sakte hain.")}
        </p>
        <LinkButton href="/app/reminders" variant="outline" size="sm" className="mt-3">
          {t("Open reminders", "Reminders kholein")}
        </LinkButton>
      </Card>

      <Card id="subscription">
        <CardTitle>{t("Subscription", "Subscription")}</CardTitle>
        {sub ? (
          <dl className="mt-1 divide-y divide-slate-100">
            <Row label={t("Status", "Status")}>
              <Pill tone={sub.status === "active" ? "success" : "danger"}>{sub.status === "active" ? t("Active", "Active") : t("Expired", "Expired")}</Pill>
            </Row>
            <Row label={t("Rooms covered", "Kitne rooms")}>{sub.rooms_count}</Row>
            <Row label={t("Price", "Price")}>
              {inr(sub.price_per_room)} × {sub.rooms_count} × {durationLabel(sub.duration_months)} = {inr(sub.amount)}
            </Row>
            <Row label={t("Valid till", "Kab tak valid")}>{fmtDate(sub.expires_on)}</Row>
            <Row label={t("Buildings allowed", "Kitni buildings")}>{ws.owner.building_limit}</Row>
          </dl>
        ) : (
          <p className="mt-2 text-[0.92rem] text-slate-500">{t("No subscription found.", "Subscription nahi mila.")}</p>
        )}
        <p className="mt-3 text-[0.85rem] text-slate-500">{t("To renew or change your plan, contact support.", "Renew ya plan badalne ke liye support se baat karein.")}</p>
      </Card>

      <Card id="privacy">
        <CardTitle>{t("Document privacy", "Document privacy")}</CardTitle>
        <ul className="mt-2 space-y-2 text-[0.92rem] leading-relaxed text-slate-700">
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-700" aria-hidden /> {t("Tenant documents are stored privately. Only you can open them, through links that expire in 60 seconds.", "Tenant documents private rehte hain. Sirf aap khol sakte hain, aur link 60 second mein expire ho jaata hai.")}</li>
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-700" aria-hidden /> {t("The HisabMitra admin panel has no access to your tenants, their documents or their payments.", "HisabMitra ke admin panel ko aapke tenants, unke documents ya payments ka access nahi hai.")}</li>
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-700" aria-hidden /> {t("We never ask for or store Aadhaar numbers.", "Hum Aadhaar number kabhi nahi maangte ya store karte.")}</li>
        </ul>
        <p className="mt-3 text-[0.92rem] text-slate-700">
          {t(`You have ${docCount.count ?? 0} document(s) stored.`, `Aapke ${docCount.count ?? 0} document store hain.`)}{" "}
          {t("Delete a tenant's documents from their profile → Documents, any time. When a tenant leaves, we recommend deleting their papers.", "Kisi tenant ke documents unki profile → Documents se kabhi bhi delete karein. Tenant ke jaane par unke papers delete kar dena behtar hai.")}
        </p>
        <LinkButton href="/app/tenants?status=vacated" variant="outline" size="sm" className="mt-3">
          {t("Review vacated tenants", "Jo tenants ja chuke unhe dekhein")}
        </LinkButton>
      </Card>

      <Card id="support">
        <CardTitle>{t("Support", "Support")}</CardTitle>
        {settings.support.phone || settings.support.email ? (
          <dl className="mt-1 divide-y divide-slate-100">
            {settings.support.phone && (
              <Row label={t("Phone", "Phone")}>
                <a href={`tel:+91${settings.support.phone}`} className="text-brand-700">{fmtPhone(settings.support.phone)}</a>
              </Row>
            )}
            {settings.support.email && (
              <Row label="Email">
                <a href={`mailto:${settings.support.email}`} className="break-all text-brand-700">{settings.support.email}</a>
              </Row>
            )}
          </dl>
        ) : (
          <p className="mt-2 text-[0.92rem] text-slate-500">{t("Support contact details will appear here soon.", "Support ki details jald yahan dikhengi.")}</p>
        )}
      </Card>

      <div className="lg:hidden">
        <SignOutButton label={t("Logout", "Logout")} className="border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
