import { Building2, Check, Plus } from "lucide-react";
import { ActionForm, FieldError, FormDialog, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Notice, PageHeader, Pill } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { addBuildingAction, switchBuildingAction } from "@/lib/actions/workspace";
import { getSettings } from "@/lib/data/settings";
import { getWorkspace } from "@/lib/data/workspace";
import { fmtPhone } from "@/lib/format";

export const metadata = { title: "Buildings" };

async function switchTo(fd: FormData) {
  "use server";
  return switchBuildingAction(String(fd.get("id") ?? ""));
}

export default async function BuildingsPage() {
  const ws = await getWorkspace();
  const { t, buildings, building, owner, supabase } = ws;
  const { support } = await getSettings(supabase, ["support"]);
  const canAdd = buildings.length < owner.building_limit;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title={t("My buildings", "Meri buildings")}
        subtitle={t(`${buildings.length} of ${owner.building_limit} allowed in your plan`, `Aapke plan mein ${owner.building_limit} mein se ${buildings.length}`)}
        action={
          canAdd ? (
            <FormDialog
              action={addBuildingAction}
              title={t("Add a building", "Building jodein")}
              submitLabel={t("Add building", "Building jodein")}
              trigger={
                <Button>
                  <Plus aria-hidden /> {t("Add", "Jodein")}
                </Button>
              }
            >
              <Field label={t("PG / building name", "PG / building ka naam")} htmlFor="name">
                <Input id="name" name="name" required maxLength={120} />
                <FieldError name="name" />
              </Field>
              <Field label={t("Full address", "Poora address")} htmlFor="address">
                <Textarea id="address" name="address" rows={2} required />
                <FieldError name="address" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("City", "Sheher")} htmlFor="city">
                  <Input id="city" name="city" required />
                  <FieldError name="city" />
                </Field>
                <Field label={t("PIN code", "PIN code")} htmlFor="pincode">
                  <Input id="pincode" name="pincode" inputMode="numeric" maxLength={6} required />
                  <FieldError name="pincode" />
                </Field>
                <Field label={t("Floors", "Floors")} htmlFor="floors_count">
                  <Input id="floors_count" name="floors_count" type="number" inputMode="numeric" min={1} defaultValue={1} required />
                </Field>
                <Field label={t("Rooms", "Rooms")} htmlFor="rooms_count">
                  <Input id="rooms_count" name="rooms_count" type="number" inputMode="numeric" min={1} required />
                  <FieldError name="rooms_count" />
                </Field>
              </div>
              <input type="hidden" name="state" value="Uttar Pradesh" />
              <Field label={t("PG type", "PG type")} htmlFor="pg_type">
                <Select id="pg_type" name="pg_type" defaultValue="boys">
                  <option value="boys">Boys</option>
                  <option value="girls">Girls</option>
                  <option value="coliving">Co-living</option>
                  <option value="other">{t("Other", "Other")}</option>
                </Select>
              </Field>
            </FormDialog>
          ) : undefined
        }
      />

      <ul className="space-y-2.5">
        {buildings.map((b) => (
          <li key={b.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Building2 className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{b.name}</p>
              <p className="truncate text-[0.82rem] text-slate-500">
                {b.city} · {b.rooms_count} {t("rooms", "rooms")}
              </p>
            </div>
            {b.id === building.id ? (
              <Pill tone="success">
                <Check className="size-3.5" aria-hidden /> {t("Selected", "Chuni hui")}
              </Pill>
            ) : (
              <ActionForm action={switchTo}>
                <input type="hidden" name="id" value={b.id} />
                <SubmitButton variant="outline" size="sm">
                  {t("Open", "Kholein")}
                </SubmitButton>
              </ActionForm>
            )}
          </li>
        ))}
      </ul>

      {!canAdd && (
        <Notice tone="brand" title={t("Want to add another building?", "Ek aur building jodni hai?")}>
          <p className="mt-1">
            {t(
              `Your current plan covers ${owner.building_limit} building(s). Contact our team to upgrade — your existing data stays as it is.`,
              `Aapke plan mein ${owner.building_limit} building hai. Upgrade ke liye hamari team se baat karein — aapka data waisa hi rahega.`,
            )}
          </p>
          {(support.phone || support.email) && (
            <p className="mt-2 font-medium">
              {support.phone && <a href={`tel:+91${support.phone}`} className="text-brand-700">{fmtPhone(support.phone)}</a>} {support.email && <a href={`mailto:${support.email}`} className="break-all text-brand-700">{support.email}</a>}
            </p>
          )}
        </Notice>
      )}
    </div>
  );
}
