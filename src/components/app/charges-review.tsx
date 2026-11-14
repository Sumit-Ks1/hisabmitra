"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Notice } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { confirmChargesAction } from "@/lib/actions/electricity";
import type { ElectricityMethod } from "@/lib/db-types";
import { computeElectricity, reconcile, type AllocReading, type AllocTenant } from "@/lib/electricity/allocation";
import { inr } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

/**
 * Review screen: shows the calculation, lets the owner change any amount, and
 * only then writes the charges to tenant bills.
 */
export function ChargesReview({
  buildingId,
  month,
  tenants,
  readings,
  mainBill,
  defaults,
  alreadyConfirmed,
}: {
  buildingId: string;
  month: string;
  tenants: AllocTenant[];
  readings: AllocReading[];
  mainBill: number | null;
  defaults: { method: ElectricityMethod; commonRule: "none" | "equal" | "proportional" };
  alreadyConfirmed: Record<string, number>;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<ElectricityMethod>(defaults.method);
  const [pool, setPool] = useState(mainBill ? String(mainBill) : "");
  const [common, setCommon] = useState("");
  const [commonRule, setCommonRule] = useState(defaults.commonRule);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const result = useMemo(
    () => computeElectricity({ method, tenants, readings, poolAmount: Number(pool) || 0, commonAmount: Number(common) || 0, commonRule }),
    [method, tenants, readings, pool, common, commonRule],
  );
  const amountOf = (id: string, calculated: number) => (edits[id] !== undefined ? Math.max(0, Math.round(Number(edits[id]) || 0)) : calculated);
  const total = result.rows.reduce((a, r) => a + amountOf(r.tenantId, r.amount), 0);
  const rec = reconcile(mainBill, total);
  const hasConfirmed = Object.keys(alreadyConfirmed).length > 0;

  const note: Record<string, string> = {
    exempt: t("Included in rent", "Rent mein shaamil"),
    no_room: t("No room — enter amount", "Room nahi — amount daalein"),
    no_reading: t("No reading yet", "Reading nahi hai"),
    fixed: t("Fixed amount", "Fixed amount"),
  };

  function confirm() {
    const rows = result.rows.map((r) => {
      const amount = amountOf(r.tenantId, r.amount);
      const edited = edits[r.tenantId] !== undefined && amount !== r.amount;
      return {
        tenant_id: r.tenantId,
        room_id: r.roomId,
        method: edited ? ("custom" as const) : r.method,
        units: r.units,
        base_amount: edited ? amount : r.baseAmount,
        common_amount: edited ? 0 : r.commonAmount,
        amount,
      };
    });
    start(async () => {
      try {
        const res = await confirmChargesAction(buildingId, month, rows);
        if (res.ok) {
          toast.success(res.message);
          router.push("/app/payments");
        } else toast.error(res.error);
      } catch {
        toast.error(t("Not saved. Check your internet and try again.", "Save nahi hua. Internet check karke dobara try karein."));
      }
    });
  }

  return (
    <div className="space-y-4">
      {hasConfirmed && (
        <Notice tone="success" icon={CheckCircle2} title={t("Charges already added for this month", "Is mahine ke charges jud chuke hain")}>
          {t("Confirming again replaces the earlier electricity amounts. It never adds them twice.", "Dobara confirm karne par purane bijli amount badal jayenge. Do baar kabhi nahi judte.")}
        </Notice>
      )}

      <Card className="space-y-4">
        <CardTitle>{t("How to calculate", "Kaise hisaab lagana hai")}</CardTitle>
        <Field label={t("Method", "Tareeka")} htmlFor="method">
          <Select id="method" value={method} onChange={(e) => { setMethod(e.target.value as ElectricityMethod); setEdits({}); }}>
            <option value="submeter">{t("Room meter: units × rate", "Room meter: units × rate")}</option>
            <option value="proportional">{t("Split main bill by units used", "Main bill ko units ke hisaab se baantein")}</option>
            <option value="equal">{t("Split main bill equally", "Main bill barabar baantein")}</option>
            <option value="custom">{t("I will type each amount", "Main har amount khud daalunga")}</option>
          </Select>
        </Field>
        {(method === "proportional" || method === "equal") && (
          <Field label={t("Amount to split (₹)", "Baantne ka amount (₹)")} htmlFor="pool" hint={mainBill ? t(`Main bill: ${inr(mainBill)}`, `Main bill: ${inr(mainBill)}`) : t("No main bill saved for this month — type the amount.", "Is mahine ka main bill save nahi — amount daalein.")}>
            <Input id="pool" type="number" inputMode="decimal" min={0} value={pool} onChange={(e) => { setPool(e.target.value); setEdits({}); }} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Common area charge (₹)", "Common area charge (₹)")} htmlFor="common" optional hint={t("Stairs, motor, lobby…", "Seedhi, motor, lobby…")}>
            <Input id="common" type="number" inputMode="decimal" min={0} value={common} onChange={(e) => { setCommon(e.target.value); setEdits({}); }} />
          </Field>
          <Field label={t("Share it", "Kaise baantein")} htmlFor="commonRule">
            <Select id="commonRule" value={commonRule} onChange={(e) => { setCommonRule(e.target.value as typeof commonRule); setEdits({}); }}>
              <option value="none">{t("Do not charge", "Charge na karein")}</option>
              <option value="equal">{t("Equally", "Barabar")}</option>
              <option value="proportional">{t("By usage", "Use ke hisaab se")}</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>{t("Tenant-wise charges", "Tenant-wise charges")}</CardTitle>
        <p className="mt-0.5 text-[0.85rem] text-slate-500">{t("You can change any amount before adding it to bills.", "Bill mein jodne se pehle koi bhi amount badal sakte hain.")}</p>
        <ul className="mt-3 divide-y divide-slate-100">
          {result.rows.map((r) => (
            <li key={r.tenantId} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{r.name}</p>
                <p className="truncate text-[0.8rem] text-slate-500">
                  {r.roomName ? `${t("Room", "Room")} ${r.roomName}` : t("No room", "Room nahi")}
                  {r.units != null && ` · ${r.units} ${t("units", "units")}`}
                  {r.commonAmount > 0 && ` · +${inr(r.commonAmount)} ${t("common", "common")}`}
                  {r.note && ` · ${note[r.note]}`}
                </p>
              </div>
              <label className="shrink-0">
                <span className="sr-only">{t(`Amount for ${r.name}`, `${r.name} ka amount`)}</span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">₹</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={edits[r.tenantId] ?? String(r.amount)}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [r.tenantId]: e.target.value }))}
                    className="h-11 w-24 text-right font-semibold tabular-nums"
                  />
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>{t("Check the totals", "Total check karein")}</CardTitle>
        <dl className="mt-2 space-y-1.5 text-[0.95rem]">
          <div className="flex justify-between"><dt className="text-slate-500">{t("Main electricity bill", "Main bijli bill")}</dt><dd className="font-medium tabular-nums">{rec.mainBill == null ? t("not saved", "save nahi") : inr(rec.mainBill)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">{t("Tenants will pay", "Tenants denge")}</dt><dd className="font-semibold tabular-nums text-ink">{inr(total)}</dd></div>
          {rec.difference != null && (
            <div className="flex justify-between border-t border-slate-100 pt-1.5">
              <dt className="text-slate-500">{rec.difference >= 0 ? t("Not recovered (you pay)", "Wasool nahi hua (aap denge)") : t("Collected above the bill", "Bill se zyada wasool")}</dt>
              <dd className={rec.difference > 0 ? "font-semibold tabular-nums text-warm-800" : "font-semibold tabular-nums text-ink"}>{inr(Math.abs(rec.difference))}</dd>
            </div>
          )}
        </dl>
        <p className="mt-2 text-[0.82rem] leading-relaxed text-slate-500">
          {t("A difference is normal: the DISCOM bill has fixed charges, common-area use and slab rates that room meters do not show.", "Farq hona aam baat hai: DISCOM bill mein fixed charge, common area ka use aur slab rate hote hain jo room meter mein nahi dikhte.")}
        </p>
      </Card>

      <Button size="lg" block disabled={pending || result.rows.length === 0} aria-busy={pending} onClick={confirm}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t("Confirm & add to tenant bills", "Confirm karein aur bills mein jodein")}
      </Button>
    </div>
  );
}
