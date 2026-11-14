"use client";

import { ChevronRight, Gauge, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { FileUpload } from "@/components/app/file-upload";
import { ViewFileButton } from "@/components/app/view-file-button";
import { ActionForm, ConfirmAction, FieldError, FormDialog, FormError, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { deleteReadingAction, saveReadingAction } from "@/lib/actions/electricity";
import type { MeterRoom, ReadingView } from "@/lib/data/meter";
import { fmtDate, inr } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const nextDay = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const num = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/**
 * One room's meter: the reading the next one continues from, a quick "new
 * reading" box with a live units × rate preview, and the last saved reading
 * with who it was charged to.
 */
export function MeterReadingCard({
  room,
  rate,
  charging,
  today,
}: {
  room: MeterRoom;
  /** building rate per unit */
  rate: number;
  /** true when this building charges tenants per room-meter reading */
  charging: boolean;
  today: string;
}) {
  const t = useT();
  const [value, setValue] = useState("");
  const [formKey, setFormKey] = useState(0);
  const { base, last } = room;

  const typed = value.trim() === "" ? null : Number(value);
  const units = typed === null || Number.isNaN(typed) ? null : Math.round((typed - base.reading) * 100) / 100;
  const lower = units !== null && units < 0;
  const blockedToday = base.date !== null && base.date >= today;
  const minDate = base.date ? nextDay(base.date) : undefined;

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight text-ink">
            {t("Room", "Room")} {room.name}
          </p>
          <p className="truncate text-[0.82rem] text-slate-500">
            {room.occupants.length ? room.occupants.join(", ") : t("Empty room", "Khaali room")}
            {room.meterNumber && ` · ${t("Meter", "Meter")} ${room.meterNumber}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[0.75rem] text-slate-500">{base.fromStart ? t("Starting reading", "Shuruaati reading") : t("Last reading", "Pichhli reading")}</p>
          <p className="text-lg font-semibold leading-tight tabular-nums text-ink">{num(base.reading)}</p>
          {base.date && <p className="text-[0.75rem] text-slate-500">{fmtDate(base.date)}</p>}
        </div>
      </div>

      {/* new reading */}
      {blockedToday ? (
        <p className="mt-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[0.86rem] text-slate-600">
          {t("Today's reading is saved. To change it, use “Fix” below.", "Aaj ki reading save ho chuki hai. Badalne ke liye neeche “Fix” dabayein.")}
        </p>
      ) : (
        <ActionForm
          key={formKey}
          action={saveReadingAction}
          onSuccess={() => {
            setValue("");
            setFormKey((k) => k + 1);
          }}
          className="mt-3 space-y-2.5"
        >
          <input type="hidden" name="room_id" value={room.id} />
          <div className="flex items-end gap-2">
            <Field label={t("New reading", "Nayi reading")} htmlFor={`cur-${room.id}`} className="min-w-0 flex-1">
              <Input
                id={`cur-${room.id}`}
                name="current"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={t(`More than ${num(base.reading)}`, `${num(base.reading)} se zyada`)}
                className="text-lg font-semibold"
              />
            </Field>
            <SubmitButton className="h-12 shrink-0 px-5">{t("Save", "Save")}</SubmitButton>
          </div>
          <FieldError name="current" />

          {units !== null && !lower && (
            <p className="text-[0.88rem] text-slate-600" aria-live="polite">
              <b className="tabular-nums text-ink">{num(units)}</b> {t("units", "units")}
              {charging && rate > 0 && (
                <>
                  {" "}× {inr(rate)} = <b className="tabular-nums text-ink">{inr(Math.round(units * rate))}</b>
                  {room.occupants.length > 0
                    ? ` → ${room.occupants.join(", ")}`
                    : ` · ${t("room is empty, no one will be charged", "room khaali hai, kisi par charge nahi")}`}
                </>
              )}
            </p>
          )}
          {lower && (
            <p className="flex items-start gap-1.5 text-[0.86rem] font-medium text-warm-800" aria-live="polite">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t(
                `Lower than the last reading (${num(base.reading)}). If the meter was replaced, open “Date, photo, meter replaced?”.`,
                `Pichhli reading (${num(base.reading)}) se kam hai. Meter badla ho to “Date, photo, meter badla?” kholein.`,
              )}
            </p>
          )}

          <details className="rounded-xl border border-slate-200 px-3.5 py-2.5" open={lower || undefined}>
            <summary className="cursor-pointer text-[0.88rem] font-medium text-slate-600">{t("Date, photo, meter replaced?", "Date, photo, meter badla?")}</summary>
            <div className="mt-3 space-y-3">
              <Field label={t("Reading date", "Reading ki date")} htmlFor={`date-${room.id}`} hint={base.date ? t(`After ${fmtDate(base.date)}`, `${fmtDate(base.date)} ke baad`) : undefined}>
                <Input id={`date-${room.id}`} name="reading_date" type="date" defaultValue={today} min={minDate} max={today} />
                <FieldError name="reading_date" />
              </Field>
              <Field label={t("Meter photo", "Meter ki photo")} optional>
                <FileUpload kind="meter-photo" name="photo_path" capture="environment" label={t("Take / choose photo", "Photo lein / chunein")} />
              </Field>
              <CorrectionFields idPrefix={`n-${room.id}`} />
            </div>
          </details>
          <FormError />
        </ActionForm>
      )}

      {/* last saved reading */}
      {last && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[0.78rem] font-medium uppercase tracking-wide text-slate-400">{t("Last saved", "Pichhli save")}</p>
              <ReadingLine r={last} charging={charging} />
            </div>
            <div className="flex shrink-0 gap-1">
              <FixReadingDialog room={room} reading={last} rate={rate} charging={charging} today={today} />
              <ConfirmAction
                action={deleteReadingAction}
                title={t("Delete this reading?", "Yeh reading delete karein?")}
                description={
                  charging
                    ? t("Its electricity charges are removed from the tenants' bills too. The next reading will continue from the one before.", "Iske bijli charges bhi tenants ke bill se hat jayenge. Agli reading usse pehle wali se chalegi.")
                    : t("The next reading will continue from the one before.", "Agli reading usse pehle wali se chalegi.")
                }
                confirmLabel={t("Delete", "Delete")}
                variant="danger"
                trigger={
                  <Button variant="ghost" size="sm" className="text-slate-500" aria-label={t("Delete last reading", "Pichhli reading delete karein")}>
                    <Trash2 aria-hidden />
                  </Button>
                }
              >
                <input type="hidden" name="reading_id" value={last.id} />
              </ConfirmAction>
            </div>
          </div>

          {charging && (
            <Charged room={room} last={last} />
          )}
          {last.photoPath && <ViewFileButton kind="meter-photo" path={last.photoPath} label={t("View photo", "Photo dekhein")} className="mt-2" />}
        </div>
      )}

      {room.history.length > 0 && (
        <details className="mt-3">
          <summary className="flex cursor-pointer items-center gap-1 text-[0.85rem] font-medium text-slate-500">
            <ChevronRight className="size-4" aria-hidden /> {t(`Earlier readings (${room.count - 1})`, `Pehle ki readings (${room.count - 1})`)}
          </summary>
          <ul className="mt-2 space-y-2">
            {room.history.map((r) => (
              <li key={r.id} className="rounded-xl bg-slate-50 px-3 py-2">
                <ReadingLine r={r} charging={charging} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

function ReadingLine({ r, charging }: { r: ReadingView; charging: boolean }) {
  const t = useT();
  return (
    <div className="text-[0.88rem] leading-snug">
      <p className="text-slate-600">
        {r.previousDate ? `${fmtDate(r.previousDate)} → ` : `${t("Start", "Shuru")} → `}
        {fmtDate(r.date)} · <span className="tabular-nums">{num(r.previous)} → {num(r.current)}</span>
      </p>
      <p className="font-semibold text-ink">
        <span className="tabular-nums">{num(r.units)}</span> {t("units", "units")}
        {charging && r.amount > 0 && (
          <>
            {" "}× {inr(r.rate)} = <span className="tabular-nums">{inr(r.amount)}</span>
          </>
        )}
        {r.isCorrection && <span className="ml-1.5 text-[0.8rem] font-medium text-warm-800">· {t("meter replaced", "meter badla")}</span>}
      </p>
    </div>
  );
}

/** Who the latest reading was charged to, with each tenant's total due now. */
function Charged({ room, last }: { room: MeterRoom; last: ReadingView }) {
  const t = useT();
  const charged = room.charges.reduce((a, c) => a + c.amount, 0);
  const notCharged = last.amount - charged;
  if (last.amount <= 0) return null;
  return (
    <div className="mt-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
      {room.charges.length > 0 ? (
        <ul className="space-y-1.5">
          {room.charges.map((c) => (
            <li key={c.tenantId} className="flex items-center justify-between gap-2 text-[0.88rem]">
              <span className="min-w-0 truncate text-slate-700">
                {c.name}
                {c.units != null && room.charges.length > 1 && <span className="text-slate-400"> · {num(c.units)} {t("units", "units")}</span>}
              </span>
              <span className="shrink-0 text-right">
                <b className="tabular-nums text-ink">+{inr(c.amount)}</b>
                <span className="ml-2 text-[0.8rem] text-slate-500">
                  {t("total due", "kul baaki")} <b className={cn("tabular-nums", c.totalDue > 0 ? "text-danger-700" : "text-success-700")}>{inr(Math.max(0, c.totalDue))}</b>
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {notCharged > 0 && (
        <p className={cn("text-[0.82rem] text-slate-500", room.charges.length > 0 && "mt-1.5 border-t border-slate-200 pt-1.5")}>
          {room.charges.length === 0
            ? t(`${inr(notCharged)} not charged to anyone: no tenant who pays by meter stayed in this room during this time.`, `${inr(notCharged)} kisi par charge nahi hua: is samay is room mein meter se bill dene wala koi tenant nahi tha.`)
            : t(`${inr(notCharged)} not charged: share of tenants with electricity included in rent or a fixed amount.`, `${inr(notCharged)} charge nahi hua: un tenants ka hissa jinki bijli rent mein shaamil hai ya fixed hai.`)}
        </p>
      )}
    </div>
  );
}

function CorrectionFields({ idPrefix, reading }: { idPrefix: string; reading?: ReadingView }) {
  const t = useT();
  return (
    <>
      <Checkbox
        name="correction"
        defaultChecked={reading?.isCorrection}
        label={t("Meter was replaced or reset (counting starts again from the new meter)", "Meter badla ya reset hua (naye meter se ginti dobara shuru)")}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("New meter's starting reading", "Naye meter ki shuruaati reading")} htmlFor={`${idPrefix}-po`} optional hint={t("Usually 0", "Aksar 0")}>
          <Input id={`${idPrefix}-po`} name="previous_override" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={reading?.isCorrection ? reading.previous : ""} />
        </Field>
        <Field label={t("Reason", "Reason")} htmlFor={`${idPrefix}-cr`} optional>
          <Input id={`${idPrefix}-cr`} name="correction_reason" maxLength={200} defaultValue={reading?.correctionReason ?? ""} placeholder={t("New meter fitted", "Naya meter laga")} />
        </Field>
      </div>
    </>
  );
}

/** Correct the latest reading (wrong number or date). Its charges are redone. */
function FixReadingDialog({ room, reading, rate, charging, today }: { room: MeterRoom; reading: ReadingView; rate: number; charging: boolean; today: string }) {
  const t = useT();
  return (
    <FormDialog
      action={saveReadingAction}
      title={t(`Fix reading · Room ${room.name}`, `Reading theek karein · Room ${room.name}`)}
      description={
        charging
          ? t(`Charges for this reading are recalculated at the current rate (${inr(rate)}/unit) and replace the old ones on the tenants' bills.`, `Is reading ke charges abhi ke rate (${inr(rate)}/unit) se dobara bante hain aur tenants ke bill mein purane charges ki jagah aate hain.`)
          : t("Change the number or the date of the last reading.", "Pichhli reading ka number ya date badlein.")
      }
      submitLabel={t("Save correction", "Correction save karein")}
      trigger={
        <Button variant="ghost" size="sm" className="text-slate-600">
          <Pencil aria-hidden /> {t("Fix", "Fix")}
        </Button>
      }
    >
      <input type="hidden" name="room_id" value={room.id} />
      <input type="hidden" name="reading_id" value={reading.id} />
      <p className="flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[0.88rem] text-slate-600">
        <Gauge className="size-4 shrink-0" aria-hidden />
        {reading.isCorrection ? t("New meter started at", "Naya meter shuru hua") : t("Continues from", "Pichhli reading")}:{" "}
        <b className="tabular-nums text-ink">{num(reading.previous)}</b>
        {!reading.isCorrection && reading.previousDate && <span>({fmtDate(reading.previousDate)})</span>}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Reading", "Reading")} htmlFor={`fix-cur-${reading.id}`}>
          <Input id={`fix-cur-${reading.id}`} name="current" type="number" inputMode="decimal" min={0} step="0.01" required defaultValue={reading.current} className="font-semibold" />
          <FieldError name="current" />
        </Field>
        <Field label={t("Date", "Date")} htmlFor={`fix-date-${reading.id}`}>
          <Input id={`fix-date-${reading.id}`} name="reading_date" type="date" required defaultValue={reading.date} min={reading.previousDate ? nextDay(reading.previousDate) : undefined} max={today} />
          <FieldError name="reading_date" />
        </Field>
      </div>
      <details className="rounded-xl border border-slate-200 px-3.5 py-2.5" open={reading.isCorrection || undefined}>
        <summary className="cursor-pointer text-[0.88rem] font-medium text-slate-600">{t("Meter replaced?", "Meter badla?")}</summary>
        <div className="mt-3 space-y-3">
          <CorrectionFields idPrefix={`fix-${reading.id}`} reading={reading} />
        </div>
      </details>
    </FormDialog>
  );
}
