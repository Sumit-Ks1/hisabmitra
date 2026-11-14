import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, Plus, Trash2, UserPlus } from "lucide-react";
import { RoomTypeSelect } from "@/components/app/room-forms";
import { ActionForm, ConfirmAction, FieldError, FormDialog, FormError, SubmitButton } from "@/components/ui/action-form";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardTitle, PageHeader, Pill } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { addBedAction, allocateBedAction, deleteRoomAction, removeBedAction, updateRoomAction } from "@/lib/actions/rooms";
import { getRoomMap, roomStatus } from "@/lib/data/rooms";
import { getWorkspace } from "@/lib/data/workspace";
import { fmtDate } from "@/lib/format";
import { isUuid } from "@/lib/uploads/rules";

export const metadata = { title: "Room" };

export default async function RoomPage({ params }: PageProps<"/app/rooms/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ws = await getWorkspace();
  const { t, supabase, userId, building } = ws;
  const { rooms, beds, occupants } = await getRoomMap(ws);
  const room = rooms.find((r) => r.id === id);
  if (!room) notFound();

  const roomBeds = beds.filter((b) => b.room_id === id);
  const { data: tenantRows } = await supabase.from("tenants").select("id, full_name").eq("building_id", building.id).eq("owner_id", userId).eq("status", "active").is("deleted_at", null).order("full_name");
  const placed = new Set(occupants.map((o) => o.tenantId));
  const waiting = (tenantRows ?? []).filter((x) => !placed.has(x.id as string)) as { id: string; full_name: string }[];
  const others = (tenantRows ?? []).filter((x) => placed.has(x.id as string) && !occupants.some((o) => o.tenantId === x.id && o.roomId === id)) as { id: string; full_name: string }[];
  const st = roomStatus(room);
  const statusLabel = { available: t("Available", "Khaali"), partial: t("Partly occupied", "Thoda bhara"), full: t("Full", "Poora bhara"), maintenance: t("Maintenance", "Maintenance") }[st];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        back="/app/rooms"
        title={`${t("Room", "Room")} ${room.name}`}
        subtitle={room.floor_number === 0 ? t("Ground floor", "Ground floor") : `${t("Floor", "Floor")} ${room.floor_number}`}
        action={<Pill tone={st === "available" ? "success" : st === "partial" ? "warm" : "neutral"}>{statusLabel}</Pill>}
      />

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>{t("Beds", "Beds")}</CardTitle>
          <ActionForm action={addBedAction}>
            <input type="hidden" name="room_id" value={room.id} />
            <SubmitButton variant="soft" size="sm">
              <Plus aria-hidden /> {t("Add bed", "Bed jodein")}
            </SubmitButton>
          </ActionForm>
        </div>
        <ul className="mt-2 divide-y divide-slate-100">
          {roomBeds.map((bed) => {
            const occ = occupants.find((o) => o.bedId === bed.id);
            return (
              <li key={bed.id} className="flex items-center gap-3 py-3">
                <span className={occ ? "flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink text-white" : "flex size-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-400"}>
                  <BedDouble className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.82rem] text-slate-500">{bed.label}</p>
                  {occ ? (
                    <Link href={`/app/tenants/${occ.tenantId}`} className="block truncate font-medium text-brand-700">
                      {occ.name}
                    </Link>
                  ) : (
                    <p className="font-medium text-success-700">{t("Free", "Khaali")}</p>
                  )}
                  {occ && <p className="text-[0.78rem] text-slate-500">{t("Since", "Kab se")} {fmtDate(occ.since)}</p>}
                </div>
                {!occ && !room.maintenance && (
                  <FormDialog
                    action={allocateBedAction}
                    title={t(`Allocate ${bed.label}`, `${bed.label} allocate karein`)}
                    description={`${t("Room", "Room")} ${room.name}`}
                    submitLabel={t("Confirm allocation", "Allocation confirm karein")}
                    trigger={
                      <Button size="sm">
                        <UserPlus aria-hidden /> {t("Allocate", "Allocate")}
                      </Button>
                    }
                  >
                    <input type="hidden" name="bed_id" value={bed.id} />
                    {waiting.length + others.length === 0 ? (
                      <p className="text-[0.92rem] text-slate-600">{t("No tenants to allocate. Add a tenant first.", "Allocate karne ke liye koi tenant nahi. Pehle tenant jodein.")}</p>
                    ) : (
                      <>
                        <Field label={t("Tenant", "Tenant")} htmlFor={`tenant-${bed.id}`}>
                          <Select id={`tenant-${bed.id}`} name="tenant_id" required defaultValue="">
                            <option value="" disabled>
                              {t("Choose tenant", "Tenant chunein")}
                            </option>
                            {waiting.length > 0 && (
                              <optgroup label={t("Without a room", "Bina room ke")}>
                                {waiting.map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.full_name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {others.length > 0 && (
                              <optgroup label={t("Move from another room", "Doosre room se shift karein")}>
                                {others.map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.full_name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </Select>
                        </Field>
                        <Field label={t("From date", "Kis date se")} htmlFor={`date-${bed.id}`}>
                          <Input id={`date-${bed.id}`} name="date" type="date" defaultValue={ws.today} />
                        </Field>
                      </>
                    )}
                  </FormDialog>
                )}
                {!occ && roomBeds.length > 1 && (
                  <ConfirmAction
                    action={removeBedAction}
                    title={t(`Remove ${bed.label}?`, `${bed.label} hatayein?`)}
                    confirmLabel={t("Remove", "Hatayein")}
                    variant="danger"
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={t(`Remove ${bed.label}`, `${bed.label} hatayein`)}>
                        <Trash2 aria-hidden />
                      </Button>
                    }
                  >
                    <input type="hidden" name="id" value={bed.id} />
                  </ConfirmAction>
                )}
              </li>
            );
          })}
        </ul>
        {waiting.length === 0 && roomBeds.some((b) => !occupants.some((o) => o.bedId === b.id)) && (
          <LinkButton href="/app/tenants/new" variant="outline" size="sm" className="mt-2">
            <UserPlus aria-hidden /> {t("Add new tenant", "Naya tenant jodein")}
          </LinkButton>
        )}
      </Card>

      <Card>
        <CardTitle>{t("Room details", "Room ki details")}</CardTitle>
        <ActionForm action={updateRoomAction} className="mt-3 space-y-4">
          <input type="hidden" name="id" value={room.id} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Room number / name", "Room number / naam")} htmlFor="name">
              <Input id="name" name="name" defaultValue={room.name} required maxLength={30} />
              <FieldError name="name" />
            </Field>
            <Field label={t("Room type", "Room type")} htmlFor="room_type">
              <RoomTypeSelect defaultValue={room.room_type} />
            </Field>
            <Field label={building.rent_basis === "bed" ? t("Rent per bed (₹)", "Har bed ka rent (₹)") : t("Room rent (₹)", "Room ka rent (₹)")} htmlFor="monthly_rent">
              <Input id="monthly_rent" name="monthly_rent" type="number" inputMode="numeric" min={0} defaultValue={room.monthly_rent} />
              <FieldError name="monthly_rent" />
            </Field>
            <Field label={t("Security deposit (₹)", "Security deposit (₹)")} htmlFor="security_deposit">
              <Input id="security_deposit" name="security_deposit" type="number" inputMode="numeric" min={0} defaultValue={room.security_deposit} />
            </Field>
          </div>
          <Field label={t("Notes", "Notes")} htmlFor="notes" optional>
            <Input id="notes" name="notes" defaultValue={room.notes ?? ""} maxLength={300} />
          </Field>
          <Checkbox name="maintenance" defaultChecked={room.maintenance} label={t("Room is under maintenance (cannot be allocated)", "Room maintenance mein hai (allocate nahi hoga)")} />

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-[0.95rem] font-semibold text-ink">{t("Electricity sub-meter", "Bijli sub-meter")}</h3>
            <p className="mt-0.5 text-[0.85rem] text-slate-500">{t("Only if this room has its own meter.", "Sirf tab, jab is room ka apna meter ho.")}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label={t("Meter number", "Meter number")} htmlFor="meter_number" optional>
                <Input id="meter_number" name="meter_number" defaultValue={room.meter_number ?? ""} maxLength={40} />
              </Field>
              <Field label={t("Meter type", "Meter type")} htmlFor="meter_type" optional>
                <Select id="meter_type" name="meter_type" defaultValue={room.meter_type ?? ""}>
                  <option value="">—</option>
                  <option value="digital">Digital</option>
                  <option value="analog">Analog</option>
                  <option value="prepaid">Prepaid</option>
                  <option value="other">{t("Other", "Other")}</option>
                </Select>
              </Field>
              <Field
                label={t("Starting reading", "Shuruaati reading")}
                htmlFor="meter_initial_reading"
                className="col-span-2"
                hint={t(
                  "Meter reading when you started using the app. Used only until the first reading is saved; after that each reading continues from the last one. The rate per unit is set once for the building on the Meter readings page.",
                  "App shuru karte waqt meter ki reading. Sirf pehli reading save hone tak use hoti hai; uske baad har reading pichhli reading se aage chalti hai. Per unit rate poori building ke liye Meter readings page par ek baar set hota hai.",
                )}
              >
                <Input id="meter_initial_reading" name="meter_initial_reading" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={room.meter_initial_reading} />
              </Field>
            </div>
          </div>
          <FormError />
          <SubmitButton block>{t("Save room", "Room save karein")}</SubmitButton>
        </ActionForm>
      </Card>

      {room.occupied_count === 0 && (
        <ConfirmAction
          action={deleteRoomAction}
          title={t(`Remove room ${room.name}?`, `Room ${room.name} hatayein?`)}
          description={t("The room disappears from your list. Past bills and history are kept.", "Room list se hat jayega. Purane bills aur history surakshit rahenge.")}
          confirmLabel={t("Remove room", "Room hatayein")}
          variant="danger"
          redirectTo="/app/rooms"
          trigger={
            <Button variant="danger-outline" block>
              <Trash2 aria-hidden /> {t("Remove this room", "Yeh room hatayein")}
            </Button>
          }
        >
          <input type="hidden" name="id" value={room.id} />
        </ConfirmAction>
      )}
    </div>
  );
}
