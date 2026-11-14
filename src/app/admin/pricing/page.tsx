import { Plus, Trash2 } from "lucide-react";
import { ActionForm, ConfirmAction, FieldError, FormDialog, FormError, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, PageHeader, Pill } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { deletePlanAction, savePlanAction, savePricingAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import { getSettings } from "@/lib/data/settings";
import type { Plan } from "@/lib/db-types";
import { inr } from "@/lib/format";
import { estimateSubscription } from "@/lib/pricing";

export const metadata = { title: "Pricing" };

function PlanFields({ plan }: { plan?: Plan }) {
  return (
    <>
      <input type="hidden" name="id" value={plan?.id ?? ""} />
      <Field label="Plan name" htmlFor="name">
        <Input id="name" name="name" defaultValue={plan?.name} required maxLength={80} />
        <FieldError name="name" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price per room (₹/month)" htmlFor="price_per_room">
          <Input id="price_per_room" name="price_per_room" type="number" min={0} step="0.01" defaultValue={plan?.price_per_room ?? 50} />
        </Field>
        <Field label="Duration (months)" htmlFor="duration_months">
          <Input id="duration_months" name="duration_months" type="number" min={1} max={36} defaultValue={plan?.duration_months ?? 1} />
        </Field>
        <Field label="Buildings included" htmlFor="building_limit">
          <Input id="building_limit" name="building_limit" type="number" min={1} max={100} defaultValue={plan?.building_limit ?? 1} />
        </Field>
        <Field label="Discount %" htmlFor="discount_percent">
          <Input id="discount_percent" name="discount_percent" type="number" min={0} max={100} step="0.01" defaultValue={plan?.discount_percent ?? 0} />
        </Field>
      </div>
      <Checkbox name="active" defaultChecked={plan?.active ?? true} label="Active (can be assigned to owners)" />
    </>
  );
}

export default async function AdminPricingPage() {
  const { supabase } = await requireAdmin();
  const [{ pricing }, plansRes] = await Promise.all([getSettings(supabase, ["pricing"]), supabase.from("plans").select("*").order("created_at")]);
  const plans = (plansRes.data ?? []) as Plan[];

  return (
    <div className="space-y-5">
      <PageHeader title="Pricing" subtitle="The price every new owner sees. Stored in one place and applied by the database." />

      <Card>
        <CardTitle>Default pricing</CardTitle>
        <ActionForm action={savePricingAction} className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price per room (₹/month)" htmlFor="p_price">
              <Input id="p_price" name="price_per_room" type="number" min={0} step="0.01" defaultValue={pricing.price_per_room} />
              <FieldError name="price_per_room" />
            </Field>
            <Field label="Subscription duration (months)" htmlFor="p_dur">
              <Input id="p_dur" name="duration_months" type="number" min={1} max={36} defaultValue={pricing.duration_months} />
              <FieldError name="duration_months" />
            </Field>
            <Field label="Buildings per owner (default)" htmlFor="p_bl" hint="Shown on the website. Raise a specific owner's limit on their page.">
              <Input id="p_bl" name="default_building_limit" type="number" min={1} max={100} defaultValue={pricing.default_building_limit} />
            </Field>
            <Field label="Special discount %" htmlFor="p_disc">
              <Input id="p_disc" name="discount_percent" type="number" min={0} max={100} step="0.01" defaultValue={pricing.discount_percent} />
            </Field>
          </div>
          <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[0.88rem] text-slate-600">
            With the saved values: 10 rooms = {inr(estimateSubscription(10, pricing))}, 30 rooms = {inr(estimateSubscription(30, pricing))}, 50 rooms = {inr(estimateSubscription(50, pricing))}.
          </p>
          <FormError />
          <SubmitButton>Save pricing</SubmitButton>
        </ActionForm>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Custom plans</CardTitle>
          <FormDialog
            action={savePlanAction}
            title="New plan"
            submitLabel="Create plan"
            trigger={
              <Button variant="soft" size="sm">
                <Plus aria-hidden /> New plan
              </Button>
            }
          >
            <PlanFields />
          </FormDialog>
        </div>
        {plans.length === 0 ? (
          <p className="mt-2 text-[0.92rem] text-slate-500">No custom plans. Create one to give a specific owner a different price or term.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">
                    {p.name} {!p.active && <Pill>inactive</Pill>}
                  </p>
                  <p className="text-[0.85rem] text-slate-500">
                    {inr(p.price_per_room)}/room · {p.duration_months} mo · {p.building_limit} building(s){p.discount_percent > 0 && ` · ${p.discount_percent}% off`}
                  </p>
                </div>
                <FormDialog action={savePlanAction} title="Edit plan" submitLabel="Save plan" trigger={<Button variant="outline" size="sm">Edit</Button>}>
                  <PlanFields plan={p} />
                </FormDialog>
                <ConfirmAction
                  action={deletePlanAction}
                  title="Delete this plan?"
                  description="Owners on this plan go back to default pricing."
                  confirmLabel="Delete"
                  variant="danger"
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={`Delete ${p.name}`}>
                      <Trash2 aria-hidden />
                    </Button>
                  }
                >
                  <input type="hidden" name="id" value={p.id} />
                </ConfirmAction>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
