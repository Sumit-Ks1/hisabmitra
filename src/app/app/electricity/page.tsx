import { AlertTriangle, ChevronRight, FlaskConical, Gauge, Calculator, RefreshCw, Zap } from "lucide-react";
import Link from "next/link";
import { ActionForm, ConfirmAction, FieldError, FormDialog, SubmitButton } from "@/components/ui/action-form";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardTitle, EmptyState, Notice, PageHeader, Pill, Row } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { fetchBillAction, markBillPaidOutsideAction, payBillAction, refreshPaymentStatusAction, saveManualBillAction } from "@/lib/actions/electricity";
import { getSettings } from "@/lib/data/settings";
import { getWorkspace } from "@/lib/data/workspace";
import type { ElectricityBill, ElectricityConnection, ElectricityPayment } from "@/lib/db-types";
import { resolveElectricity } from "@/lib/electricity/provider";
import { fmtDate, fmtDateTime, inr, maskTail, monthLabel, monthStart } from "@/lib/format";
import { serviceRoleAvailable } from "@/lib/supabase/server";

export const metadata = { title: "Electricity" };

export default async function ElectricityPage() {
  const ws = await getWorkspace();
  const { supabase, userId, building, t, today } = ws;
  const thisMonth = monthStart(today);

  const [connRes, billsRes, settings] = await Promise.all([
    supabase.from("electricity_connections").select("*").eq("building_id", building.id).eq("owner_id", userId).maybeSingle(),
    supabase.from("electricity_bills").select("*").eq("building_id", building.id).eq("owner_id", userId).order("bill_month", { ascending: false }).order("fetched_at", { ascending: false }).limit(12),
    getSettings(supabase, ["integrations"]),
  ]);
  const conn = connRes.data as ElectricityConnection | null;
  const bills = (billsRes.data ?? []) as ElectricityBill[];
  const mode = resolveElectricity(settings.integrations.electricity);
  const canFetch = mode.mode !== "manual" && serviceRoleAvailable;
  // prefer a real (non-sandbox) bill when both exist for a month
  const latest = bills.find((b) => b.bill_month === bills[0]?.bill_month && !b.is_mock) ?? bills[0];
  const isCurrent = latest?.bill_month === thisMonth;
  const payments = latest
    ? (((await supabase.from("electricity_payments").select("*").eq("bill_id", latest.id).eq("owner_id", userId).order("created_at", { ascending: false }).limit(5)).data ?? []) as ElectricityPayment[])
    : [];
  const inFlight = payments.find((p) => ["initiated", "pending", "unknown"].includes(p.status));
  const canPayOnline = latest && canFetch && mode.provider?.id === latest.source && latest.status !== "paid" && !inFlight;

  const payTone = { success: "success", failed: "danger", pending: "warm", initiated: "warm", unknown: "warm" } as const;
  const payLabel = {
    success: t("Successful", "Safal"), failed: t("Failed", "Fail"), pending: t("Pending", "Pending"),
    initiated: t("Started", "Shuru hua"), unknown: t("Status not known yet", "Status abhi pata nahi"),
  };

  const manualForm = (
    <FormDialog
      action={saveManualBillAction}
      title={t("Enter electricity bill", "Bijli bill daalein")}
      description={t("Copy the amount from your DISCOM bill or SMS.", "Apne DISCOM bill ya SMS se amount dekhkar daalein.")}
      submitLabel={t("Save bill", "Bill save karein")}
      trigger={<Button variant={canFetch ? "outline" : "default"}>{t("Enter bill myself", "Bill khud daalein")}</Button>}
    >
      <input type="hidden" name="building_id" value={building.id} />
      <Field label={t("Bill month", "Bill ka mahina")} htmlFor="bill_month">
        <Input id="bill_month" name="bill_month" type="month" required defaultValue={thisMonth.slice(0, 7)} max={thisMonth.slice(0, 7)} />
        <FieldError name="bill_month" />
      </Field>
      <Field label={t("Bill amount (₹)", "Bill amount (₹)")} htmlFor="amount">
        <Input id="amount" name="amount" type="number" inputMode="decimal" min={1} step="0.01" required />
        <FieldError name="amount" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Bill date", "Bill date")} htmlFor="bill_date" optional>
          <Input id="bill_date" name="bill_date" type="date" />
        </Field>
        <Field label={t("Due date", "Due date")} htmlFor="due_date" optional>
          <Input id="due_date" name="due_date" type="date" />
        </Field>
      </div>
      <Field label={t("Units used", "Kitne unit")} htmlFor="units" optional>
        <Input id="units" name="units" type="number" inputMode="decimal" min={0} step="0.01" />
      </Field>
    </FormDialog>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={t("Electricity", "Bijli")} subtitle={t("Main bill of the building and tenant-wise charges.", "Building ka main bill aur tenant-wise charges.")} />

      <div className="grid grid-cols-2 gap-3">
        <Link href="/app/electricity/readings" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft hover:border-brand-300">
          <Gauge className="size-6 text-brand-600" aria-hidden />
          <p className="mt-2 font-semibold leading-tight text-ink">{t("Meter readings", "Meter readings")}</p>
          <p className="mt-0.5 text-[0.8rem] text-slate-500">{t("Enter room meter readings", "Room meter ki reading daalein")}</p>
        </Link>
        <Link href="/app/electricity/charges" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft hover:border-brand-300">
          <Calculator className="size-6 text-brand-600" aria-hidden />
          <p className="mt-2 font-semibold leading-tight text-ink">{t("Tenant charges", "Tenant charges")}</p>
          <p className="mt-0.5 text-[0.8rem] text-slate-500">{t("Review and add to bills", "Check karke bill mein jodein")}</p>
        </Link>
      </div>

      {!conn ? (
        <EmptyState icon={Zap} title={t("No electricity connection added", "Bijli connection nahi joda")} body={t("Add your DISCOM and consumer number in Settings.", "Settings mein DISCOM aur consumer number jodein.")} action={<LinkButton href="/app/settings#electricity">{t("Open settings", "Settings kholein")}</LinkButton>} />
      ) : (
        <>
          {mode.mode === "sandbox" && (
            <Notice tone="warm" icon={FlaskConical} title={t("Sandbox mode — test data only", "Sandbox mode — sirf test data")}>
              {t("Bills fetched here are made-up examples for testing. They are not your real DISCOM bill and no money moves.", "Yahan fetch hue bills sirf testing ke liye banaye gaye namoone hain. Yeh aapka asli DISCOM bill nahi hai aur koi paisa nahi katega.")}
            </Notice>
          )}
          {mode.mode === "manual" && (
            <Notice tone="neutral" title={t("Automatic bill fetch is not active yet", "Automatic bill fetch abhi chalu nahi hai")}>
              {t("It needs approved BBPS provider access, which is still pending. Until then, enter the bill amount yourself — everything else works the same.", "Iske liye approved BBPS provider access chahiye, jo abhi pending hai. Tab tak bill amount khud daalein — baaki sab waise hi kaam karega.")}
            </Notice>
          )}

          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{t("Main electricity bill", "Main bijli bill")}</CardTitle>
                <p className="text-[0.82rem] text-slate-500">
                  {conn.discom} · {maskTail(conn.consumer_number)}
                </p>
              </div>
              {latest && (
                <Pill tone={latest.status === "paid" ? "success" : latest.status === "payment_pending" ? "warm" : "neutral"}>
                  {latest.status === "paid" ? t("Paid", "Paid") : latest.status === "payment_pending" ? t("Payment in progress", "Payment chal raha hai") : t("Unpaid", "Unpaid")}
                </Pill>
              )}
            </div>

            {!latest ? (
              <p className="mt-4 text-[0.95rem] text-slate-600">{t("No bill saved yet.", "Abhi koi bill save nahi hai.")}</p>
            ) : (
              <>
                {!isCurrent && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-warm-50 px-3 py-2 text-[0.88rem] font-medium text-warm-800">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {t(`This is a previous bill (${monthLabel(latest.bill_month)}). This month's bill is not available yet.`, `Yeh pichhla bill hai (${monthLabel(latest.bill_month)}). Is mahine ka bill abhi available nahi hai.`)}
                  </p>
                )}
                {latest.is_mock && (
                  <p className="mt-3 flex items-center gap-2 rounded-xl bg-warm-50 px-3 py-2 text-[0.88rem] font-semibold text-warm-800">
                    <FlaskConical className="size-4 shrink-0" aria-hidden /> {t("SANDBOX — not a real bill", "SANDBOX — asli bill nahi")}
                  </p>
                )}
                <p className="mt-4 text-[0.85rem] text-slate-500">{isCurrent ? t("Current bill amount", "Is mahine ka bill") : t("Previous bill amount", "Pichhle bill ka amount")}</p>
                <p className="text-[2rem] font-semibold leading-tight tracking-[-0.03em] tabular-nums text-ink">{inr(latest.amount)}</p>
                <dl className="mt-2 divide-y divide-slate-100">
                  <Row label={t("Bill month", "Bill ka mahina")}>{monthLabel(latest.bill_month)}</Row>
                  <Row label={t("Due date", "Due date")}>{fmtDate(latest.due_date)}</Row>
                  <Row label={t("Bill date", "Bill date")}>{fmtDate(latest.bill_date)}</Row>
                  <Row label={t("Billing period", "Billing period")}>{latest.period_start ? `${fmtDate(latest.period_start)} – ${fmtDate(latest.period_end)}` : "—"}</Row>
                  {latest.units != null && <Row label={t("Units", "Units")}>{latest.units}</Row>}
                  <Row label={t("Source", "Kahan se")}>{latest.source === "manual" ? t("Entered by you", "Aapne daala") : latest.is_mock ? "Sandbox" : "BBPS"}</Row>
                  <Row label={latest.source === "manual" ? t("Saved on", "Save kiya") : t("Last fetched", "Aakhri baar fetch")}>{fmtDateTime(latest.fetched_at)}</Row>
                </dl>
              </>
            )}

            {conn.last_fetch_at && (
              <p className="mt-3 text-[0.82rem] text-slate-500">
                {t("Last check", "Aakhri check")}: {fmtDateTime(conn.last_fetch_at)} ·{" "}
                {{ success: t("bill found", "bill mila"), no_bill: t("no bill available", "bill available nahi"), failed: t("failed", "fail hua"), not_configured: t("not set up", "set up nahi") }[conn.last_fetch_status ?? "failed"]}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {canFetch && (
                <ActionForm action={fetchBillAction}>
                  <input type="hidden" name="building_id" value={building.id} />
                  <SubmitButton>
                    <RefreshCw aria-hidden /> {t("Fetch latest bill", "Naya bill fetch karein")}
                  </SubmitButton>
                </ActionForm>
              )}
              {manualForm}
              {canPayOnline && (
                <ConfirmAction
                  action={payBillAction}
                  title={latest.is_mock ? t("Start a TEST payment?", "TEST payment shuru karein?") : t("Pay this bill?", "Yeh bill pay karein?")}
                  description={
                    latest.is_mock
                      ? t("Sandbox only: no money will move. This lets you see how payment status works.", "Sirf sandbox: koi paisa nahi katega. Isse payment status ka flow dikhega.")
                      : t(`${inr(latest.amount)} will be paid to ${conn.discom} through the BBPS provider.`, `${inr(latest.amount)} BBPS provider ke zariye ${conn.discom} ko pay hoga.`)
                  }
                  confirmLabel={latest.is_mock ? t("Start test payment", "Test payment shuru karein") : t("Confirm payment", "Payment confirm karein")}
                  variant="success"
                  trigger={<Button variant="success">{latest.is_mock ? t("Pay Now (test)", "Pay Now (test)") : t("Pay Now", "Pay Now")}</Button>}
                >
                  <input type="hidden" name="bill_id" value={latest.id} />
                </ConfirmAction>
              )}
              {latest?.source === "manual" && latest.status === "unpaid" && serviceRoleAvailable && (
                <ConfirmAction
                  action={markBillPaidOutsideAction}
                  title={t("Did you already pay this bill?", "Kya aapne yeh bill pay kar diya?")}
                  description={t("This only records that you paid the DISCOM yourself (outside HisabMitra). No money moves here.", "Yeh sirf note karta hai ki aapne DISCOM ko khud pay kiya (HisabMitra ke bahar). Yahan se koi paisa nahi jaata.")}
                  confirmLabel={t("Yes, I paid it", "Haan, maine pay kiya")}
                  trigger={<Button variant="outline">{t("I paid it myself", "Maine khud pay kiya")}</Button>}
                >
                  <input type="hidden" name="bill_id" value={latest.id} />
                </ConfirmAction>
              )}
            </div>
          </Card>

          {payments.length > 0 && (
            <Card>
              <CardTitle>{t("Bill payment status", "Bill payment status")}</CardTitle>
              <ul className="mt-2 divide-y divide-slate-100">
                {payments.map((p) => (
                  <li key={p.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold tabular-nums text-ink">{inr(p.amount)}</p>
                      <Pill tone={payTone[p.status]}>{payLabel[p.status]}</Pill>
                    </div>
                    <p className="mt-0.5 text-[0.82rem] text-slate-500">
                      {fmtDateTime(p.created_at)} · {p.provider === "manual" ? t("paid outside the app", "app ke bahar pay kiya") : p.provider === "mock" ? "Sandbox" : "BBPS"}
                    </p>
                    {p.provider_ref && <p className="break-all font-mono text-[0.8rem] text-slate-600">Ref: {p.provider_ref}</p>}
                    {p.status === "unknown" && <p className="mt-1 text-[0.85rem] text-warm-800">{t("We could not confirm this payment yet. Do not pay again until the status is clear.", "Yeh payment abhi confirm nahi ho paya. Status saaf hone tak dobara pay na karein.")}</p>}
                    {["initiated", "pending", "unknown"].includes(p.status) && p.provider !== "manual" && (
                      <ActionForm action={refreshPaymentStatusAction} className="mt-2">
                        <input type="hidden" name="payment_id" value={p.id} />
                        <SubmitButton variant="outline" size="sm">
                          <RefreshCw aria-hidden /> {t("Check status", "Status check karein")}
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {bills.length > 1 && (
            <Card>
              <CardTitle>{t("Earlier bills", "Purane bills")}</CardTitle>
              <ul className="mt-2 divide-y divide-slate-100">
                {bills.filter((b) => b.id !== latest?.id).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-[0.92rem]">
                    <span className="text-slate-600">
                      {monthLabel(b.bill_month)} {b.is_mock && <Pill tone="warm">Sandbox</Pill>}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium tabular-nums text-ink">{inr(b.amount)}</span>
                      <ChevronRight className="size-4 text-transparent" aria-hidden />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
