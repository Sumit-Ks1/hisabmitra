import Link from "next/link";
import { notFound } from "next/navigation";
import { DoorOpen, LogOut, MessageCircle, Pencil, Phone, Plus, Undo2 } from "lucide-react";
import { DocumentsPanel, type Doc } from "@/components/app/documents-panel";
import { PaymentDialog } from "@/components/app/payment-dialog";
import { ActionForm, ConfirmAction, FieldError, FormDialog, FormError, SubmitButton } from "@/components/ui/action-form";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardTitle, EmptyState, Notice, PageHeader, Pill, Row } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { addInvoiceItemAction, deleteInvoiceItemAction, voidPaymentAction } from "@/lib/actions/billing";
import { saveTenantNotesAction, setWhatsappConsentAction, updateTenantAction, vacateTenantAction } from "@/lib/actions/tenants";
import { getWorkspace } from "@/lib/data/workspace";
import type { Invoice, InvoiceItem, RentPayment, Tenant, TenantBalance } from "@/lib/db-types";
import { fmtDate, fmtPhone, inr, monthLabel } from "@/lib/format";
import { isUuid } from "@/lib/uploads/rules";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tenant" };

const TABS = ["overview", "rooms", "rent", "electricity", "documents", "notes"] as const;
type Tab = (typeof TABS)[number];

export default async function TenantPage({ params, searchParams }: PageProps<"/app/tenants/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const ws = await getWorkspace();
  const { supabase, userId, t, today } = ws;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "overview";

  const tenant = (await supabase.from("tenants").select("*").eq("id", id).eq("owner_id", userId).is("deleted_at", null).maybeSingle()).data as Tenant | null;
  if (!tenant) notFound();

  const [balRes, allocRes, consentRes] = await Promise.all([
    supabase.from("v_tenant_balances").select("*").eq("tenant_id", id).eq("owner_id", userId).maybeSingle(),
    supabase.from("room_allocations").select("id, started_on, ended_on, reason, end_reason, rooms(name), beds(label)").eq("tenant_id", id).eq("owner_id", userId).order("started_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("whatsapp_consents").select("opted_in").eq("tenant_id", id).eq("owner_id", userId).maybeSingle(),
  ]);
  const bal = (balRes.data ?? { balance: 0, advance_credit: 0, deposit_held: 0 }) as TenantBalance;
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const allocs = (allocRes.data ?? []).map((a) => ({
    id: a.id as string, from: a.started_on as string, to: a.ended_on as string | null, reason: a.reason as string, endReason: a.end_reason as string | null,
    room: one(a.rooms as { name: string } | { name: string }[] | null)?.name ?? "?", bed: one(a.beds as { label: string } | { label: string }[] | null)?.label ?? "?",
  }));
  const current = allocs.find((a) => !a.to);
  const optedIn = Boolean(consentRes.data?.opted_in);
  const active = tenant.status === "active";
  const balance = Number(bal.balance);

  const tabLabel: Record<Tab, string> = {
    overview: t("Overview", "Overview"), rooms: t("Room history", "Room history"), rent: t("Rent history", "Rent history"),
    electricity: t("Electricity", "Bijli"), documents: t("Documents", "Documents"), notes: t("Notes", "Notes"),
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back="/app/tenants"
        title={tenant.full_name}
        subtitle={current ? `${t("Room", "Room")} ${current.room} · ${current.bed}` : active ? t("No room allocated", "Room allocate nahi hua") : t("Vacated", "Ja chuke")}
        action={<Pill tone={active ? "success" : "neutral"}>{active ? t("Active", "Active") : t("Vacated", "Ja chuke")}</Pill>}
      />

      {sp.new === "1" && tab === "documents" && (
        <Notice tone="success" className="mb-4" title={t("Tenant saved", "Tenant save ho gaya")}>
          {t("You can add documents now, or skip this and do it later.", "Ab documents jod sakte hain, ya baad mein bhi kar sakte hain.")}
        </Notice>
      )}

      <nav aria-label={t("Tenant sections", "Tenant sections")} className="-mx-4 mb-5 overflow-x-auto px-4">
        <ul className="flex w-max gap-1.5">
          {TABS.map((x) => (
            <li key={x}>
              <Link
                href={`/app/tenants/${id}?tab=${x}`}
                aria-current={x === tab ? "page" : undefined}
                className={cn("inline-flex h-10 items-center whitespace-nowrap rounded-full px-4 text-[0.9rem] font-medium", x === tab ? "bg-ink text-white" : "border border-slate-200 bg-white text-slate-600")}
              >
                {tabLabel[x]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "overview" && (
        <div className="space-y-4">
          <Card>
            <p className="text-[0.88rem] text-slate-500">{balance > 0 ? t("Total due", "Kul baaki") : balance < 0 ? t("Advance with you", "Aapke paas advance") : t("Nothing due", "Kuch baaki nahi")}</p>
            <p className={cn("mt-1 text-[2rem] font-semibold leading-none tracking-[-0.03em] tabular-nums", balance > 0 ? "text-danger-700" : "text-success-700")}>{inr(Math.abs(balance))}</p>
            <p className="mt-2 text-[0.85rem] text-slate-500">
              {t("Deposit held", "Deposit jama")}: <b className="text-ink">{inr(bal.deposit_held)}</b> / {inr(tenant.security_deposit)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <PaymentDialog tenantId={id} tenantName={tenant.full_name} due={Math.max(0, balance)} today={today} size="md" variant="success" />
              <PaymentDialog tenantId={id} tenantName={tenant.full_name} today={today} kind="deposit" size="md" variant="outline" />
              {Number(bal.deposit_held) > 0 && <PaymentDialog tenantId={id} tenantName={tenant.full_name} today={today} kind="deposit_refund" size="md" variant="outline" />}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>{t("Details", "Details")}</CardTitle>
              <FormDialog
                action={updateTenantAction}
                title={t("Edit tenant", "Tenant edit karein")}
                submitLabel={t("Save", "Save karein")}
                trigger={
                  <Button variant="soft" size="sm">
                    <Pencil aria-hidden /> {t("Edit", "Edit")}
                  </Button>
                }
              >
                <input type="hidden" name="id" value={id} />
                <Field label={t("Full name", "Poora naam")} htmlFor="e-name">
                  <Input id="e-name" name="full_name" defaultValue={tenant.full_name} required />
                  <FieldError name="full_name" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("Phone", "Phone")} htmlFor="e-phone">
                    <Input id="e-phone" name="phone" type="tel" inputMode="numeric" defaultValue={tenant.phone} required />
                    <FieldError name="phone" />
                  </Field>
                  <Field label="WhatsApp" htmlFor="e-wa" optional>
                    <Input id="e-wa" name="whatsapp" type="tel" inputMode="numeric" defaultValue={tenant.whatsapp ?? ""} />
                    <FieldError name="whatsapp" />
                  </Field>
                  <Field label={t("Monthly rent (₹)", "Mahine ka rent (₹)")} htmlFor="e-rent">
                    <Input id="e-rent" name="monthly_rent" type="number" inputMode="numeric" min={1} defaultValue={tenant.monthly_rent} required />
                    <FieldError name="monthly_rent" />
                  </Field>
                  <Field label={t("Deposit (₹)", "Deposit (₹)")} htmlFor="e-dep">
                    <Input id="e-dep" name="security_deposit" type="number" inputMode="numeric" min={0} defaultValue={tenant.security_deposit} />
                  </Field>
                </div>
                <Field label="Email" htmlFor="e-email" optional>
                  <Input id="e-email" name="email" type="email" defaultValue={tenant.email ?? ""} />
                  <FieldError name="email" />
                </Field>
                <Field label={t("Emergency contact", "Emergency contact")} htmlFor="e-em" optional>
                  <Input id="e-em" name="emergency_contact" defaultValue={tenant.emergency_contact ?? ""} />
                </Field>
                <Field label={t("Student / job", "Student / job")} htmlFor="e-occ" optional>
                  <Input id="e-occ" name="occupation" defaultValue={tenant.occupation ?? ""} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("Electricity", "Bijli")} htmlFor="e-el">
                    <Select id="e-el" name="electricity_rule" defaultValue={tenant.electricity_rule}>
                      <option value="building">{t("Building rule", "Building rule")}</option>
                      <option value="custom">{t("Fixed amount", "Fixed amount")}</option>
                      <option value="none">{t("Included in rent", "Rent mein shaamil")}</option>
                    </Select>
                  </Field>
                  <Field label={t("Fixed amount (₹)", "Fixed amount (₹)")} htmlFor="e-elc" optional>
                    <Input id="e-elc" name="electricity_custom_amount" type="number" inputMode="numeric" min={0} defaultValue={tenant.electricity_custom_amount ?? ""} />
                  </Field>
                </div>
              </FormDialog>
            </div>
            <dl className="mt-1 divide-y divide-slate-100">
              <Row label={t("Phone", "Phone")}>
                <a href={`tel:+91${tenant.phone}`} className="inline-flex items-center gap-1.5 text-brand-700">
                  <Phone className="size-3.5" aria-hidden /> {fmtPhone(tenant.phone)}
                </a>
              </Row>
              {tenant.whatsapp && <Row label="WhatsApp">{fmtPhone(tenant.whatsapp)}</Row>}
              {tenant.email && <Row label="Email">{tenant.email}</Row>}
              <Row label={t("Monthly rent", "Mahine ka rent")}>{inr(tenant.monthly_rent)}</Row>
              <Row label={t("Joined on", "Joining date")}>{fmtDate(tenant.joined_on)}</Row>
              {tenant.vacated_on && <Row label={t("Vacated on", "Jaane ki date")}>{fmtDate(tenant.vacated_on)}</Row>}
              {tenant.occupation && <Row label={t("Student / job", "Student / job")}>{tenant.occupation}</Row>}
              {tenant.emergency_contact && <Row label={t("Emergency contact", "Emergency contact")}>{tenant.emergency_contact}</Row>}
              <Row label={t("Electricity", "Bijli")}>
                {tenant.electricity_rule === "none" ? t("Included in rent", "Rent mein shaamil") : tenant.electricity_rule === "custom" ? `${inr(tenant.electricity_custom_amount)} ${t("fixed", "fixed")}` : t("Building rule", "Building rule")}
              </Row>
            </dl>
          </Card>

          {active && (
            <Card>
              <div className="flex items-start gap-3">
                <MessageCircle className={cn("mt-0.5 size-5 shrink-0", optedIn ? "text-success-700" : "text-slate-400")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{optedIn ? t("WhatsApp reminders: allowed", "WhatsApp reminders: allowed") : t("WhatsApp reminders: not allowed", "WhatsApp reminders: allowed nahi")}</p>
                  <p className="text-[0.85rem] text-slate-500">{t("Reminders are sent only if the tenant has agreed.", "Reminder tabhi jaata hai jab tenant raazi ho.")}</p>
                </div>
              </div>
              <ActionForm action={setWhatsappConsentAction} className="mt-3">
                <input type="hidden" name="tenant_id" value={id} />
                <input type="hidden" name="opted_in" value={optedIn ? "0" : "1"} />
                <SubmitButton variant="outline" size="sm">
                  {optedIn ? t("Tenant said stop", "Tenant ne mana kiya") : t("Tenant has agreed", "Tenant raazi hai")}
                </SubmitButton>
              </ActionForm>
            </Card>
          )}

          {active && (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <LinkButton href="/app/rooms" variant="outline" block>
                <DoorOpen aria-hidden /> {current ? t("Change room", "Room badlein") : t("Allocate room", "Room allocate karein")}
              </LinkButton>
              <ConfirmAction
                action={vacateTenantAction}
                title={t(`Mark ${tenant.full_name} as vacated?`, `${tenant.full_name} ko vacated mark karein?`)}
                description={t("The bed becomes free. All bills, payments and history are kept.", "Bed khaali ho jayega. Saare bills, payments aur history surakshit rahenge.")}
                confirmLabel={t("Mark vacated", "Vacated mark karein")}
                variant="danger"
                trigger={
                  <Button variant="danger-outline" block>
                    <LogOut aria-hidden /> {t("Tenant is leaving", "Tenant ja raha hai")}
                  </Button>
                }
              >
                <input type="hidden" name="id" value={id} />
                <Field label={t("Last day of stay", "Rehne ka aakhri din")} htmlFor="vac-date">
                  <Input id="vac-date" name="date" type="date" defaultValue={today} min={tenant.joined_on} required />
                </Field>
                <Checkbox name="prorate" defaultChecked label={t("Charge this month only for the days stayed", "Is mahine sirf rehne ke dino ka rent lein")} />
                {balance > 0 && <p className="text-[0.88rem] font-medium text-danger-700">{t(`${inr(balance)} is still due from this tenant.`, `Is tenant se ${inr(balance)} abhi baaki hai.`)}</p>}
              </ConfirmAction>
            </div>
          )}
        </div>
      )}

      {tab === "rooms" &&
        (allocs.length === 0 ? (
          <EmptyState icon={DoorOpen} title={t("No room given yet", "Abhi tak room nahi diya")} action={active ? <LinkButton href="/app/rooms">{t("Allocate room", "Room allocate karein")}</LinkButton> : undefined} />
        ) : (
          <Card>
            <ol className="divide-y divide-slate-100">
              {allocs.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-ink">
                      {t("Room", "Room")} {a.room} · {a.bed}
                    </p>
                    <p className="text-[0.82rem] text-slate-500">
                      {fmtDate(a.from)} → {a.to ? fmtDate(a.to) : t("now", "ab tak")}
                    </p>
                  </div>
                  <Pill tone={a.to ? "neutral" : "success"}>{a.to ? ({ swap: t("Swapped", "Swap hua"), transfer: t("Moved", "Shift hua"), vacated: t("Vacated", "Chhoda") }[a.endReason ?? ""] ?? "—") : t("Current", "Abhi")}</Pill>
                </li>
              ))}
            </ol>
          </Card>
        ))}

      {tab === "rent" && <RentHistory tenantId={id} tenantName={tenant.full_name} />}
      {tab === "electricity" && <ElectricityHistory tenantId={id} />}
      {tab === "documents" && <DocumentsTab tenantId={id} consentAt={tenant.documents_consent_at} />}

      {tab === "notes" && (
        <Card>
          <ActionForm action={saveTenantNotesAction} className="space-y-3">
            <input type="hidden" name="id" value={id} />
            <Field label={t("Notes about this tenant", "Is tenant ke baare mein notes")} htmlFor="notes" hint={t("Only you can see these.", "Yeh sirf aap dekh sakte hain.")}>
              <Textarea id="notes" name="notes" rows={7} maxLength={2000} defaultValue={tenant.notes ?? ""} />
            </Field>
            <FormError />
            <SubmitButton block>{t("Save notes", "Notes save karein")}</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

async function DocumentsTab({ tenantId, consentAt }: { tenantId: string; consentAt: string | null }) {
  const { supabase, userId } = await getWorkspace();
  const { data } = await supabase.from("tenant_documents").select("id, doc_type, file_name, storage_path, size_bytes, created_at").eq("tenant_id", tenantId).eq("owner_id", userId).order("created_at", { ascending: false });
  return <DocumentsPanel tenantId={tenantId} consentAt={consentAt} docs={(data ?? []) as Doc[]} />;
}

async function ElectricityHistory({ tenantId }: { tenantId: string }) {
  const { supabase, userId, t } = await getWorkspace();
  const { data } = await supabase.from("electricity_allocations").select("id, period_month, method, units, base_amount, common_amount, amount").eq("tenant_id", tenantId).eq("owner_id", userId).order("period_month", { ascending: false });
  if (!data?.length) return <EmptyState icon={Plus} title={t("No electricity charges yet", "Abhi koi bijli charge nahi")} body={t("Charges appear here after you confirm them in Electricity.", "Bijli section mein confirm karne ke baad yahan dikhenge.")} />;
  return (
    <Card>
      <ul className="divide-y divide-slate-100">
        {data.map((a) => (
          <li key={a.id as string} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="font-medium text-ink">{monthLabel(a.period_month as string)}</p>
              <p className="text-[0.82rem] text-slate-500">
                {a.units != null ? `${a.units} ${t("units", "units")} · ` : ""}
                {Number(a.common_amount) > 0 ? `${t("incl. common area", "common area sahit")} ${inr(a.common_amount as number)}` : (a.method as string)}
              </p>
            </div>
            <p className="font-semibold tabular-nums text-ink">{inr(a.amount as number)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function RentHistory({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const { supabase, userId, t, today } = await getWorkspace();
  const [invRes, payRes] = await Promise.all([
    supabase.from("v_invoices").select("*").eq("tenant_id", tenantId).eq("owner_id", userId).order("period_month", { ascending: false }),
    supabase.from("rent_payments").select("*").eq("tenant_id", tenantId).eq("owner_id", userId).order("paid_on", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  const invoices = (invRes.data ?? []) as Invoice[];
  const payments = (payRes.data ?? []) as RentPayment[];
  const itemsRes = invoices.length ? await supabase.from("invoice_items").select("*").in("invoice_id", invoices.map((i) => i.id)).eq("owner_id", userId).order("created_at") : { data: [] };
  const items = (itemsRes.data ?? []) as InvoiceItem[];

  const statusPill = (s: Invoice["status"]) =>
    ({ paid: <Pill tone="success">{t("Paid", "Paid")}</Pill>, partial: <Pill tone="warm">{t("Part paid", "Thoda mila")}</Pill>, unpaid: <Pill tone="warm">{t("Unpaid", "Baaki")}</Pill>, overdue: <Pill tone="danger">{t("Overdue", "Late")}</Pill> })[s];
  const method: Record<string, string> = { cash: t("Cash", "Cash"), upi: "UPI", bank_transfer: t("Bank", "Bank"), other: t("Other", "Other") };
  const kindLabel: Record<string, string> = { rent: t("Rent", "Rent"), advance: t("Advance", "Advance"), deposit: t("Deposit", "Deposit"), deposit_refund: t("Deposit refund", "Deposit wapas") };

  // one row per recorded payment (a payment split across months shares a group)
  const groups = [...new Map(payments.map((p) => [p.group_id, payments.filter((x) => x.group_id === p.group_id)])).values()];

  return (
    <div className="space-y-4">
      {invoices.length === 0 && <EmptyState icon={Plus} title={t("No bills yet", "Abhi koi bill nahi")} />}
      {invoices.map((inv) => (
        <Card key={inv.id}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{monthLabel(inv.period_month)}</CardTitle>
              <p className="text-[0.8rem] text-slate-500">
                {t("Due", "Due")} {fmtDate(inv.due_date)} {inv.room_label && `· ${t("Room", "Room")} ${inv.room_label}`}
              </p>
            </div>
            {statusPill(inv.status)}
          </div>
          <ul className="mt-3 space-y-1.5 text-[0.92rem]">
            {items.filter((i) => i.invoice_id === inv.id).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-slate-600">{i.description || i.kind}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className={cn("tabular-nums", i.amount < 0 ? "text-success-700" : "text-ink")}>{inr(i.amount)}</span>
                  {i.source === "manual" && (
                    <ActionForm action={deleteInvoiceItemAction}>
                      <input type="hidden" name="id" value={i.id} />
                      <SubmitButton variant="ghost" size="sm" className="h-7 px-1.5 text-slate-400" aria-label={t("Remove line", "Line hatayein")}>
                        ✕
                      </SubmitButton>
                    </ActionForm>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 border-t border-slate-100 pt-2 text-[0.95rem]">
            <div className="flex justify-between py-0.5"><dt className="text-slate-500">{t("Total", "Total")}</dt><dd className="font-semibold tabular-nums">{inr(inv.total_amount)}</dd></div>
            <div className="flex justify-between py-0.5"><dt className="text-slate-500">{t("Paid", "Mila")}</dt><dd className="tabular-nums text-success-700">{inr(inv.paid_amount)}</dd></div>
            <div className="flex justify-between py-0.5"><dt className="text-slate-500">{t("Remaining", "Baaki")}</dt><dd className={cn("font-semibold tabular-nums", inv.balance > 0 ? "text-danger-700" : "text-success-700")}>{inr(Math.max(0, inv.balance))}</dd></div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            {inv.balance > 0 && <PaymentDialog tenantId={tenantId} tenantName={tenantName} invoiceId={inv.id} due={inv.balance} today={today} variant="success" />}
            <FormDialog
              action={addInvoiceItemAction}
              title={t("Add charge or discount", "Charge ya discount jodein")}
              description={monthLabel(inv.period_month)}
              submitLabel={t("Add", "Jodein")}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus aria-hidden /> {t("Charge / discount", "Charge / discount")}
                </Button>
              }
            >
              <input type="hidden" name="invoice_id" value={inv.id} />
              <Field label={t("Type", "Type")} htmlFor={`k-${inv.id}`}>
                <Select id={`k-${inv.id}`} name="kind" defaultValue="other">
                  <option value="other">{t("Extra charge (adds to bill)", "Extra charge (bill mein judega)")}</option>
                  <option value="discount">{t("Discount (reduces bill)", "Discount (bill kam hoga)")}</option>
                </Select>
              </Field>
              <Field label={t("What is it for?", "Kis liye?")} htmlFor={`d-${inv.id}`}>
                <Input id={`d-${inv.id}`} name="description" required maxLength={120} placeholder={t("Laundry, food, repair…", "Laundry, khana, repair…")} />
                <FieldError name="description" />
              </Field>
              <Field label={t("Amount (₹)", "Amount (₹)")} htmlFor={`a-${inv.id}`}>
                <Input id={`a-${inv.id}`} name="amount" type="number" inputMode="numeric" min={1} required />
                <FieldError name="amount" />
              </Field>
            </FormDialog>
          </div>
        </Card>
      ))}

      {groups.length > 0 && (
        <Card>
          <CardTitle>{t("Payment history", "Payment history")}</CardTitle>
          <ul className="mt-2 divide-y divide-slate-100">
            {groups.map((g) => {
              const first = g[0];
              const total = g.reduce((a, p) => a + Number(p.amount), 0);
              const voided = Boolean(first.voided_at);
              return (
                <li key={first.group_id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-semibold tabular-nums", voided ? "text-slate-400 line-through" : "text-ink")}>{inr(total)}</p>
                    <p className="truncate text-[0.82rem] text-slate-500">
                      {fmtDate(first.paid_on)} · {method[first.method]} · {kindLabel[g.some((p) => p.kind === "rent") ? "rent" : first.kind]}
                      {first.reference && ` · ${first.reference}`}
                    </p>
                    {voided && <p className="text-[0.8rem] text-danger-700">{t("Cancelled", "Cancelled")}: {first.void_reason}</p>}
                  </div>
                  {!voided && (
                    <ConfirmAction
                      action={voidPaymentAction}
                      title={t("Cancel this payment?", "Yeh payment cancel karein?")}
                      description={t("Use this only if it was entered by mistake. It stays in history as cancelled.", "Sirf galti se likhe payment ke liye. History mein cancelled dikhega.")}
                      confirmLabel={t("Cancel payment", "Payment cancel karein")}
                      variant="danger"
                      trigger={
                        <Button variant="ghost" size="sm" className="text-slate-500">
                          <Undo2 aria-hidden /> {t("Undo", "Undo")}
                        </Button>
                      }
                    >
                      <input type="hidden" name="group_id" value={first.group_id} />
                      <Field label={t("Reason", "Reason")} htmlFor={`vr-${first.group_id}`}>
                        <Input id={`vr-${first.group_id}`} name="reason" required minLength={3} maxLength={200} />
                      </Field>
                    </ConfirmAction>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
