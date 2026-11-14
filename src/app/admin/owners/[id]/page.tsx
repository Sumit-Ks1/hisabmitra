import { notFound } from "next/navigation";
import { ViewFileButton } from "@/components/app/view-file-button";
import { ActionForm, ConfirmAction, FieldError, FormError, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Notice, PageHeader, Pill, Row } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { reviewOwnerAction, reviewPaymentAction, updateOwnerLimitsAction, updateSubscriptionAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/data/admin";
import type { AuditLog, Building, ElectricityConnection, OwnerAccount, PaymentSubmission, Plan, Profile, Subscription } from "@/lib/db-types";
import { fmtDate, fmtDateTime, fmtPhone, inr, maskTail } from "@/lib/format";
import { isUuid } from "@/lib/uploads/rules";

export const metadata = { title: "Owner" };

export default async function AdminOwnerPage({ params }: PageProps<"/admin/owners/[id]">) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [profileRes, ownerRes, buildingsRes, subsRes, paymentsRes, connsRes, plansRes, logsRes, roomsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("pg_owners").select("*").eq("id", id).maybeSingle(),
    supabase.from("buildings").select("*").eq("owner_id", id).order("created_at"),
    supabase.from("building_subscriptions").select("*").eq("owner_id", id).order("created_at", { ascending: false }),
    supabase.from("payment_submissions").select("*").eq("owner_id", id).order("created_at", { ascending: false }),
    supabase.from("electricity_connections").select("*").eq("owner_id", id),
    supabase.from("plans").select("*").order("name"),
    supabase.from("admin_audit_logs").select("*").eq("owner_id", id).order("created_at", { ascending: false }).limit(40),
    supabase.from("rooms").select("building_id").eq("owner_id", id).is("deleted_at", null),
  ]);
  const profile = profileRes.data as Profile | null;
  const owner = ownerRes.data as OwnerAccount | null;
  if (!profile || !owner || profile.role !== "pg_owner") notFound();

  const buildings = (buildingsRes.data ?? []) as Building[];
  const subs = (subsRes.data ?? []) as Subscription[];
  const payments = (paymentsRes.data ?? []) as PaymentSubmission[];
  const conns = (connsRes.data ?? []) as ElectricityConnection[];
  const plans = (plansRes.data ?? []) as Plan[];
  const logs = (logsRes.data ?? []) as AuditLog[];
  const roomCount = (bid: string) => (roomsRes.data ?? []).filter((r) => r.building_id === bid).length;

  const s = owner.status;
  const hasVerified = payments.some((p) => p.status === "verified") || subs.some((x) => x.status === "active");
  const canDecide = ["submitted", "under_review", "payment_pending", "info_required", "rejected"].includes(s);
  const hidden = (action: string) => (
    <>
      <input type="hidden" name="owner_id" value={owner.id} />
      <input type="hidden" name="action" value={action} />
    </>
  );
  const reason = (label: string) => (
    <Field label={label} htmlFor={`note-${label}`}>
      <Textarea id={`note-${label}`} name="note" required minLength={3} maxLength={500} placeholder="The owner will see this message." />
    </Field>
  );

  return (
    <div className="space-y-5">
      <PageHeader back="/admin/owners" title={profile.full_name || profile.email} action={<Pill tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}</Pill>} />

      {owner.review_note && (
        <Notice tone="warm" title="Last note sent to owner">
          <p className="mt-1 whitespace-pre-wrap">{owner.review_note}</p>
        </Notice>
      )}

      {/* Decision */}
      <Card>
        <CardTitle>Decision</CardTitle>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {s === "submitted" && (
            <ActionForm action={reviewOwnerAction}>
              {hidden("under_review")}
              <SubmitButton variant="soft" block>
                Mark as under review
              </SubmitButton>
            </ActionForm>
          )}
          {canDecide && (
            <ConfirmAction
              action={reviewOwnerAction}
              title="Approve this owner?"
              description={hasVerified ? "The subscription starts today and the owner gets full access." : "Verify the payment first — approval is blocked until then."}
              confirmLabel="Approve"
              variant="success"
              trigger={
                <Button variant="success" block disabled={!hasVerified}>
                  Approve owner
                </Button>
              }
            >
              {hidden("approve")}
            </ConfirmAction>
          )}
          {canDecide && s !== "info_required" && (
            <ConfirmAction action={reviewOwnerAction} title="Request more information" confirmLabel="Send request" trigger={<Button variant="outline" block>Request more info</Button>}>
              {hidden("request_info")}
              {reason("What do you need?")}
            </ConfirmAction>
          )}
          {canDecide && s !== "rejected" && (
            <ConfirmAction action={reviewOwnerAction} title="Reject application" confirmLabel="Reject" variant="danger" trigger={<Button variant="danger-outline" block>Reject</Button>}>
              {hidden("reject")}
              {reason("Reason for rejection")}
            </ConfirmAction>
          )}
          {s === "approved" && (
            <ConfirmAction
              action={reviewOwnerAction}
              title="Suspend account"
              description="The owner immediately loses access. No data is deleted."
              confirmLabel="Suspend"
              variant="danger"
              trigger={<Button variant="danger-outline" block>Suspend account</Button>}
            >
              {hidden("suspend")}
              {reason("Reason for suspension")}
            </ConfirmAction>
          )}
          {s === "suspended" && (
            <ConfirmAction action={reviewOwnerAction} title="Reactivate account?" confirmLabel="Reactivate" variant="success" trigger={<Button variant="success" block>Reactivate account</Button>}>
              {hidden("reactivate")}
            </ConfirmAction>
          )}
          {s === "onboarding" && <p className="text-[0.92rem] text-slate-500 sm:col-span-2">This owner has not finished onboarding yet.</p>}
        </div>
        {canDecide && !hasVerified && <p className="mt-3 text-[0.85rem] text-warm-800">Approval unlocks after a payment is verified (or a subscription is activated manually below).</p>}
      </Card>

      {/* Payments */}
      <Card>
        <CardTitle>Payment references</CardTitle>
        {payments.length === 0 ? (
          <p className="mt-2 text-[0.92rem] text-slate-500">No payment submitted yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {payments.map((p) => (
              <li key={p.id} className="space-y-2.5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold tabular-nums text-ink">{inr(p.amount)}</p>
                    <p className="select-all break-all font-mono text-[0.9rem] text-slate-700">{p.upi_reference}</p>
                    <p className="text-[0.8rem] text-slate-500">
                      Paid {fmtDate(p.paid_on)} · submitted {fmtDateTime(p.created_at)}
                    </p>
                    {p.review_note && <p className="mt-1 text-[0.85rem] text-slate-600">Note: {p.review_note}</p>}
                  </div>
                  <Pill tone={p.status === "verified" ? "success" : p.status === "rejected" ? "danger" : "warm"}>{p.status}</Pill>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.screenshot_path && <ViewFileButton kind="payment-proof" path={p.screenshot_path} label="View screenshot" />}
                  {p.status === "pending" && (
                    <>
                      <ConfirmAction
                        action={reviewPaymentAction}
                        title="Mark payment as verified?"
                        description={`Confirm that ${inr(p.amount)} with reference ${p.upi_reference} has really arrived in the business account.`}
                        confirmLabel="Yes, money received"
                        variant="success"
                        trigger={<Button variant="success" size="sm">Verify payment</Button>}
                      >
                        <input type="hidden" name="payment_id" value={p.id} />
                        <input type="hidden" name="verified" value="1" />
                      </ConfirmAction>
                      <ConfirmAction action={reviewPaymentAction} title="Reject this payment" confirmLabel="Reject payment" variant="danger" trigger={<Button variant="danger-outline" size="sm">Reject</Button>}>
                        <input type="hidden" name="payment_id" value={p.id} />
                        <input type="hidden" name="verified" value="0" />
                        {reason("Why could it not be verified?")}
                      </ConfirmAction>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Owner */}
      <Card>
        <CardTitle>Owner details</CardTitle>
        <dl className="mt-1 divide-y divide-slate-100">
          <Row label="Name">{profile.full_name || "—"}</Row>
          <Row label="Email">{profile.email}</Row>
          <Row label="Phone">{fmtPhone(profile.phone)}</Row>
          <Row label="WhatsApp">{fmtPhone(profile.whatsapp ?? profile.phone)}</Row>
          <Row label="Language">{profile.language}</Row>
          <Row label="Signed up">{fmtDateTime(profile.created_at)}</Row>
          <Row label="Submitted">{fmtDateTime(owner.submitted_at)}</Row>
          <Row label="Approved">{fmtDateTime(owner.approved_at)}</Row>
        </dl>
      </Card>

      {/* Buildings */}
      {buildings.map((b) => {
        const conn = conns.find((c) => c.building_id === b.id);
        return (
          <Card key={b.id}>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{b.name}</CardTitle>
              <Pill tone={b.status === "active" ? "success" : "neutral"}>{b.status}</Pill>
            </div>
            <dl className="mt-1 divide-y divide-slate-100">
              <Row label="Address">
                {b.address}, {b.city}, {b.state} {b.pincode}
              </Row>
              <Row label="Type">{b.pg_type}</Row>
              <Row label="Floors / rooms / beds (declared)">
                {b.floors_count} / {b.rooms_count} / {b.beds_count ?? "—"}
              </Row>
              <Row label="Rooms created in app">{roomCount(b.id)}</Row>
              {conn && (
                <Row label="Electricity">
                  {conn.discom} · {maskTail(conn.consumer_number)}
                </Row>
              )}
            </dl>
          </Card>
        );
      })}

      {/* Subscriptions */}
      <Card>
        <CardTitle>Subscriptions</CardTitle>
        {subs.length === 0 && <p className="mt-2 text-[0.92rem] text-slate-500">No subscription yet.</p>}
        <div className="mt-2 space-y-4">
          {subs.map((sub) => (
            <ActionForm key={sub.id} action={updateSubscriptionAction} className="space-y-3 rounded-xl border border-slate-200 p-3.5">
              <input type="hidden" name="subscription_id" value={sub.id} />
              <p className="text-[0.9rem] text-slate-600">
                <b className="text-ink">{buildings.find((b) => b.id === sub.building_id)?.name ?? "Building"}</b> · {inr(sub.amount)} ({sub.rooms_count} × {inr(sub.price_per_room)} × {sub.duration_months} mo)
                {sub.starts_on && <> · from {fmtDate(sub.starts_on)}</>}
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                <Field label="Status" htmlFor={`st-${sub.id}`}>
                  <Select id={`st-${sub.id}`} name="status" defaultValue={sub.status}>
                    {["pending", "active", "expired", "cancelled"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Expires on" htmlFor={`ex-${sub.id}`}>
                  <Input id={`ex-${sub.id}`} name="expires_on" type="date" defaultValue={sub.expires_on ?? ""} />
                </Field>
                <Field label="Rooms" htmlFor={`rc-${sub.id}`}>
                  <Input id={`rc-${sub.id}`} name="rooms_count" type="number" min={1} defaultValue={sub.rooms_count} />
                  <FieldError name="rooms_count" />
                </Field>
              </div>
              <FormError />
              <SubmitButton variant="outline" size="sm">
                Save subscription
              </SubmitButton>
            </ActionForm>
          ))}
        </div>
      </Card>

      {/* Limits */}
      <Card>
        <CardTitle>Limits & plan</CardTitle>
        <ActionForm action={updateOwnerLimitsAction} className="mt-3 space-y-3">
          <input type="hidden" name="owner_id" value={owner.id} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Buildings allowed" htmlFor="building_limit">
              <Input id="building_limit" name="building_limit" type="number" min={1} max={100} defaultValue={owner.building_limit} />
              <FieldError name="building_limit" />
            </Field>
            <Field label="Room limit override" htmlFor="room_limit" hint="Per building. Empty = follow subscription.">
              <Input id="room_limit" name="room_limit" type="number" min={1} defaultValue={owner.room_limit ?? ""} />
              <FieldError name="room_limit" />
            </Field>
          </div>
          <Field label="Custom plan" htmlFor="plan_id" hint="Used to price this owner's next subscription.">
            <Select id="plan_id" name="plan_id" defaultValue={owner.plan_id ?? ""}>
              <option value="">Default pricing</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {inr(p.price_per_room)}/room · {p.duration_months} mo{p.active ? "" : " (inactive)"}
                </option>
              ))}
            </Select>
          </Field>
          <FormError />
          <SubmitButton variant="outline">Save limits</SubmitButton>
        </ActionForm>
      </Card>

      {/* Activity */}
      <Card>
        <CardTitle>Account activity</CardTitle>
        {logs.length === 0 ? (
          <p className="mt-2 text-[0.92rem] text-slate-500">No activity yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 text-[0.9rem]">
            {logs.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="font-mono text-[0.85rem] text-ink">{l.action}</span>
                  {typeof l.details?.note === "string" && l.details.note && <span className="block truncate text-slate-500">{l.details.note}</span>}
                </span>
                <span className="shrink-0 text-[0.8rem] text-slate-500">{fmtDateTime(l.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
