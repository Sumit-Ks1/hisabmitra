import { CheckCircle2, CircleAlert } from "lucide-react";
import { SignOutButton } from "@/components/app/nav";
import { ActionForm, FieldError, FormError, SubmitButton } from "@/components/ui/action-form";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { saveGlobalSettingsAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import { getSettings } from "@/lib/data/settings";
import { SetuBillPayProvider } from "@/lib/electricity/setu-provider";
import { serverEnv, whatsappCredentialsPresent } from "@/lib/env";
import { serviceRoleAvailable } from "@/lib/supabase/server";

export const metadata = { title: "Settings" };

function Check({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  const Icon = ok ? CheckCircle2 : CircleAlert;
  return (
    <li className="flex items-start gap-2.5 py-2">
      <Icon className={ok ? "mt-0.5 size-4 shrink-0 text-success-700" : "mt-0.5 size-4 shrink-0 text-warm-800"} aria-hidden />
      <span className="text-[0.9rem]">
        <span className="font-medium text-ink">{label}</span>
        <span className="block text-slate-500">{detail}</span>
      </span>
    </li>
  );
}

export default async function AdminSettingsPage() {
  const { supabase } = await requireAdmin();
  const s = await getSettings(supabase, ["upi", "support", "integrations", "announcement"]);
  const setuReady = SetuBillPayProvider.isConfigured();

  return (
    <div className="space-y-5">
      <PageHeader title="Global settings" />

      <ActionForm action={saveGlobalSettingsAction} className="space-y-5">
        <Card className="space-y-3">
          <CardTitle>UPI payment details</CardTitle>
          <p className="text-[0.88rem] text-slate-500">Owners pay their subscription to this UPI ID. Until it is set, the payment step stays closed.</p>
          <Field label="UPI ID" htmlFor="upi_id">
            <Input id="upi_id" name="upi_id" defaultValue={s.upi.upi_id} placeholder="business@bank" autoCapitalize="none" />
            <FieldError name="upi_id" />
          </Field>
          <Field label="Payee name" htmlFor="payee_name">
            <Input id="payee_name" name="payee_name" defaultValue={s.upi.payee_name} />
            <FieldError name="payee_name" />
          </Field>
        </Card>

        <Card className="space-y-3">
          <CardTitle>Support contact</CardTitle>
          <Field label="Support phone" htmlFor="support_phone" optional>
            <Input id="support_phone" name="support_phone" type="tel" inputMode="numeric" defaultValue={s.support.phone} />
            <FieldError name="support_phone" />
          </Field>
          <Field label="Support email" htmlFor="support_email" optional>
            <Input id="support_email" name="support_email" type="email" defaultValue={s.support.email} />
            <FieldError name="support_email" />
          </Field>
        </Card>

        <Card className="space-y-3">
          <CardTitle>Integrations</CardTitle>
          <Field
            label="Electricity bill fetch (BBPS)"
            htmlFor="electricity"
            hint={setuReady ? "Provider credentials detected." : "Live needs provider credentials + biller details on the server. Without them, “Live” behaves like “Off”."}
          >
            <Select id="electricity" name="electricity" defaultValue={s.integrations.electricity}>
              <option value="disabled">Off — owners enter bills by hand</option>
              <option value="sandbox">Sandbox — fake bills, clearly labelled (testing only)</option>
              <option value="live">Live — real provider</option>
            </Select>
          </Field>
          <Field
            label="WhatsApp reminders (Meta Cloud API)"
            htmlFor="whatsapp"
            hint={whatsappCredentialsPresent ? "Credentials and template name detected." : "Live needs Meta credentials and an approved template on the server. Until then owners get a copy-message option."}
          >
            <Select id="whatsapp" name="whatsapp" defaultValue={s.integrations.whatsapp}>
              <option value="disabled">Off — manual copy / open in WhatsApp</option>
              <option value="live">Live — send approved template messages</option>
            </Select>
          </Field>
        </Card>

        <Card className="space-y-3">
          <CardTitle>Announcement</CardTitle>
          <Field label="Message shown to all owners" htmlFor="announcement" optional>
            <Textarea id="announcement" name="announcement" defaultValue={s.announcement.message} maxLength={300} rows={2} />
          </Field>
          <Checkbox name="announcement_active" defaultChecked={s.announcement.active} label="Show this announcement in the app" />
        </Card>

        <FormError />
        <SubmitButton size="lg" block>
          Save settings
        </SubmitButton>
      </ActionForm>

      <Card>
        <CardTitle>Server configuration</CardTitle>
        <p className="mt-1 text-[0.85rem] text-slate-500">Read from server environment variables. Values are never shown.</p>
        <ul className="mt-2 divide-y divide-slate-100">
          <Check ok={serviceRoleAvailable} label="Supabase service-role key" detail="Needed for admin bootstrap, WhatsApp queue, bill fetch and the daily job." />
          <Check ok={Boolean(serverEnv.adminEmail)} label="ADMIN_EMAIL" detail="The one verified email that becomes admin." />
          <Check ok={Boolean(serverEnv.cronSecret)} label="CRON_SECRET" detail="Protects the daily maintenance endpoint." />
          <Check ok={whatsappCredentialsPresent} label="WhatsApp Cloud API" detail="Phone number ID, access token and approved template name." />
          <Check ok={Boolean(serverEnv.whatsapp.appSecret && serverEnv.whatsapp.webhookVerifyToken)} label="WhatsApp webhook" detail="App secret + verify token, for delivery status updates." />
          <Check ok={setuReady} label="BBPS provider (Setu BillPay)" detail="Credentials and biller map. The live adapter also needs its API mapping completed." />
        </ul>
      </Card>

      <div className="lg:hidden">
        <SignOutButton label="Logout" className="border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
