"use client";

import { ArrowLeftRight, Layers, Plus } from "lucide-react";
import { useState } from "react";
import { ConfirmAction, FieldError, FormDialog } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { addRoomAction, bulkAddRoomsAction, swapBedsAction } from "@/lib/actions/rooms";
import { useT } from "@/lib/i18n/client";

export function RoomTypeSelect({ defaultValue = "shared", id = "room_type" }: { defaultValue?: string; id?: string }) {
  const t = useT();
  return (
    <Select id={id} name="room_type" defaultValue={defaultValue}>
      <option value="single">{t("Single", "Single")}</option>
      <option value="shared">{t("Shared", "Sharing")}</option>
      <option value="dormitory">{t("Dormitory", "Dormitory")}</option>
      <option value="other">{t("Other", "Other")}</option>
    </Select>
  );
}

function RentFields({ perBed }: { perBed: boolean }) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={perBed ? t("Rent per bed (₹)", "Har bed ka rent (₹)") : t("Room rent (₹)", "Room ka rent (₹)")} htmlFor="rent">
        <Input id="rent" name="rent" type="number" inputMode="numeric" min={0} defaultValue={0} />
        <FieldError name="rent" />
      </Field>
      <Field label={t("Security deposit (₹)", "Security deposit (₹)")} htmlFor="deposit">
        <Input id="deposit" name="deposit" type="number" inputMode="numeric" min={0} defaultValue={0} />
        <FieldError name="deposit" />
      </Field>
    </div>
  );
}

export function AddRoomDialog({ buildingId, perBed, defaultFloor }: { buildingId: string; perBed: boolean; defaultFloor: number }) {
  const t = useT();
  return (
    <FormDialog
      action={addRoomAction}
      title={t("Add a room", "Room jodein")}
      submitLabel={t("Add room", "Room jodein")}
      trigger={
        <Button>
          <Plus aria-hidden /> {t("Add room", "Room jodein")}
        </Button>
      }
    >
      <input type="hidden" name="building_id" value={buildingId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Floor", "Floor")} htmlFor="floor" hint={t("0 = ground floor", "0 = ground floor")}>
          <Input id="floor" name="floor" type="number" inputMode="numeric" min={0} max={60} defaultValue={defaultFloor} required />
          <FieldError name="floor" />
        </Field>
        <Field label={t("Room number / name", "Room number / naam")} htmlFor="name">
          <Input id="name" name="name" placeholder="101" required maxLength={30} />
          <FieldError name="name" />
        </Field>
        <Field label={t("Room type", "Room type")} htmlFor="room_type">
          <RoomTypeSelect />
        </Field>
        <Field label={t("Beds", "Beds")} htmlFor="beds">
          <Input id="beds" name="beds" type="number" inputMode="numeric" min={1} max={30} defaultValue={2} required />
          <FieldError name="beds" />
        </Field>
      </div>
      <RentFields perBed={perBed} />
      <Field label={t("Notes", "Notes")} htmlFor="notes" optional>
        <Input id="notes" name="notes" maxLength={300} />
      </Field>
    </FormDialog>
  );
}

export function BulkRoomsDialog({ buildingId, perBed, primary }: { buildingId: string; perBed: boolean; primary?: boolean }) {
  const t = useT();
  return (
    <FormDialog
      action={bulkAddRoomsAction}
      title={t("Quick setup", "Jaldi setup")}
      description={t("Creates rooms like 101, 102… 201, 202… in one go. You can edit any room later.", "101, 102… 201, 202… jaise rooms ek saath ban jayenge. Baad mein koi bhi room badal sakte hain.")}
      submitLabel={t("Create rooms", "Rooms banayein")}
      trigger={
        <Button variant={primary ? "default" : "outline"}>
          <Layers aria-hidden /> {t("Quick setup", "Jaldi setup")}
        </Button>
      }
    >
      <input type="hidden" name="building_id" value={buildingId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Number of floors", "Kitne floors")} htmlFor="floors">
          <Input id="floors" name="floors" type="number" inputMode="numeric" min={1} max={30} defaultValue={1} required />
          <FieldError name="floors" />
        </Field>
        <Field label={t("First floor number", "Pehla floor number")} htmlFor="start_floor" hint={t("0 = ground", "0 = ground")}>
          <Input id="start_floor" name="start_floor" type="number" inputMode="numeric" min={0} max={30} defaultValue={1} required />
        </Field>
        <Field label={t("Rooms on each floor", "Har floor par rooms")} htmlFor="rooms_per_floor">
          <Input id="rooms_per_floor" name="rooms_per_floor" type="number" inputMode="numeric" min={1} max={60} defaultValue={4} required />
          <FieldError name="rooms_per_floor" />
        </Field>
        <Field label={t("Beds in each room", "Har room mein beds")} htmlFor="beds">
          <Input id="beds" name="beds" type="number" inputMode="numeric" min={1} max={30} defaultValue={2} required />
        </Field>
      </div>
      <Field label={t("Room type", "Room type")} htmlFor="room_type">
        <RoomTypeSelect />
      </Field>
      <RentFields perBed={perBed} />
    </FormDialog>
  );
}

export type SwapOption = { tenantId: string; name: string; place: string };

/** Pick two tenants → see exactly what will change → confirm. */
export function SwapForm({ options }: { options: SwapOption[] }) {
  const t = useT();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const A = options.find((o) => o.tenantId === a);
  const B = options.find((o) => o.tenantId === b);
  const ready = A && B && a !== b;

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <Field label={t("First tenant", "Pehla tenant")} htmlFor="swap-a">
          <Select id="swap-a" value={a} onChange={(e) => setA(e.target.value)}>
            <option value="">{t("Choose tenant", "Tenant chunein")}</option>
            {options.map((o) => (
              <option key={o.tenantId} value={o.tenantId} disabled={o.tenantId === b}>
                {o.name} — {o.place}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-center text-slate-400">
          <ArrowLeftRight className="size-5" aria-hidden />
        </div>
        <Field label={t("Second tenant", "Doosra tenant")} htmlFor="swap-b">
          <Select id="swap-b" value={b} onChange={(e) => setB(e.target.value)}>
            <option value="">{t("Choose tenant", "Tenant chunein")}</option>
            {options.map((o) => (
              <option key={o.tenantId} value={o.tenantId} disabled={o.tenantId === a}>
                {o.name} — {o.place}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {ready && (
        <ConfirmAction
          action={swapBedsAction}
          title={t("Swap these rooms?", "Yeh rooms swap karein?")}
          confirmLabel={t("Yes, swap rooms", "Haan, swap karein")}
          redirectTo="/app/rooms"
          trigger={
            <Button size="lg" block>
              <ArrowLeftRight aria-hidden /> {t("Swap Rooms", "Rooms swap karein")}
            </Button>
          }
        >
          <input type="hidden" name="tenant_a" value={a} />
          <input type="hidden" name="tenant_b" value={b} />
          <ul className="space-y-2 rounded-xl bg-slate-50 p-3.5 text-[0.92rem]">
            <li>
              <b className="text-ink">{A.name}</b>: {A.place} → <b className="text-brand-700">{B.place}</b>
            </li>
            <li>
              <b className="text-ink">{B.name}</b>: {B.place} → <b className="text-brand-700">{A.place}</b>
            </li>
          </ul>
          <p className="text-[0.85rem] text-slate-500">{t("Old room history is kept. Rent does not change automatically.", "Purani room history surakshit rahegi. Rent apne aap nahi badlega.")}</p>
        </ConfirmAction>
      )}
    </div>
  );
}
