import type { ElectricityMethod } from "@/lib/db-types";

/**
 * Tenant-wise electricity calculation. Pure — the owner reviews (and may edit)
 * the result before anything is written to invoices.
 *
 * Methods:
 *  - submeter      room units × rate (+ room fixed charge), shared by the room's tenants
 *  - proportional  the main bill amount split in proportion to sub-meter units
 *  - equal         the main bill amount split equally between tenants
 *  - custom        the owner types each amount
 * Common-area charges are added on top, equally or in proportion to the base charge.
 */

export type AllocTenant = {
  tenantId: string;
  name: string;
  roomId: string | null;
  roomName: string | null;
  /** 'none' = exempt, 'custom' = fixed amount for this tenant */
  rule: "building" | "none" | "custom";
  customAmount?: number | null;
};

export type AllocReading = { roomId: string; units: number; rate: number; fixedCharge: number };

export type AllocInput = {
  method: ElectricityMethod;
  tenants: AllocTenant[];
  readings: AllocReading[];
  /** amount to distribute for proportional / equal methods (usually the main bill) */
  poolAmount: number;
  commonAmount: number;
  commonRule: "none" | "equal" | "proportional";
};

export type AllocRow = {
  tenantId: string;
  name: string;
  roomId: string | null;
  roomName: string | null;
  method: ElectricityMethod;
  units: number | null;
  baseAmount: number;
  commonAmount: number;
  amount: number;
  note?: "exempt" | "no_room" | "no_reading" | "fixed";
};

export type AllocResult = { rows: AllocRow[]; totalBase: number; totalCommon: number; total: number };

/** Splits `total` rupees by weights so the parts add up exactly to round(total). */
export function splitByWeights(total: number, weights: number[]): number[] {
  const target = Math.round(total);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (sum <= 0 || target <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (target * w) / sum);
  const parts = exact.map(Math.floor);
  let left = target - parts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0 && k < order.length; k++, left--) parts[order[k].i] += 1;
  return parts;
}

export function computeElectricity(input: AllocInput): AllocResult {
  const readings = new Map(input.readings.map((r) => [r.roomId, r]));
  const rows: AllocRow[] = input.tenants.map((t) => ({
    tenantId: t.tenantId,
    name: t.name,
    roomId: t.roomId,
    roomName: t.roomName,
    method: input.method,
    units: null,
    baseAmount: 0,
    commonAmount: 0,
    amount: 0,
  }));

  // tenants who take part in the building-wide method
  const active: number[] = [];
  input.tenants.forEach((t, i) => {
    if (t.rule === "none") rows[i].note = "exempt";
    else if (t.rule === "custom") {
      rows[i].note = "fixed";
      rows[i].method = "custom";
      rows[i].baseAmount = Math.max(0, Math.round(t.customAmount ?? 0));
    } else active.push(i);
  });

  const byRoom = new Map<string, number[]>();
  for (const i of active) {
    const roomId = input.tenants[i].roomId;
    if (!roomId) {
      if (input.method === "submeter" || input.method === "proportional") rows[i].note = "no_room";
      continue;
    }
    byRoom.set(roomId, [...(byRoom.get(roomId) ?? []), i]);
  }

  if (input.method === "submeter") {
    for (const [roomId, idx] of byRoom) {
      const r = readings.get(roomId);
      if (!r) {
        idx.forEach((i) => (rows[i].note = "no_reading"));
        continue;
      }
      const roomTotal = r.units * r.rate + r.fixedCharge;
      const parts = splitByWeights(roomTotal, idx.map(() => 1));
      idx.forEach((i, k) => {
        rows[i].units = Math.round((r.units / idx.length) * 100) / 100;
        rows[i].baseAmount = parts[k];
      });
    }
  } else if (input.method === "proportional") {
    // weight per tenant = their share of the room's units
    const withUnits: number[] = [];
    const weights: number[] = [];
    for (const [roomId, idx] of byRoom) {
      const r = readings.get(roomId);
      if (!r) {
        idx.forEach((i) => (rows[i].note = "no_reading"));
        continue;
      }
      idx.forEach((i) => {
        rows[i].units = Math.round((r.units / idx.length) * 100) / 100;
        withUnits.push(i);
        weights.push(r.units / idx.length);
      });
    }
    const parts = splitByWeights(input.poolAmount, weights);
    withUnits.forEach((i, k) => (rows[i].baseAmount = parts[k]));
  } else if (input.method === "equal") {
    const parts = splitByWeights(input.poolAmount, active.map(() => 1));
    active.forEach((i, k) => (rows[i].baseAmount = parts[k]));
  }
  // 'custom': base stays 0 for the owner to fill in

  // common-area charge: shared by everyone who is not exempt
  const payers = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.note !== "exempt");
  if (input.commonRule !== "none" && input.commonAmount > 0 && payers.length > 0) {
    const useBase = input.commonRule === "proportional" && payers.some(({ r }) => r.baseAmount > 0);
    const parts = splitByWeights(input.commonAmount, payers.map(({ r }) => (useBase ? r.baseAmount : 1)));
    payers.forEach(({ i }, k) => (rows[i].commonAmount = parts[k]));
  }

  rows.forEach((r) => (r.amount = r.baseAmount + r.commonAmount));
  const totalBase = rows.reduce((a, r) => a + r.baseAmount, 0);
  const totalCommon = rows.reduce((a, r) => a + r.commonAmount, 0);
  return { rows, totalBase, totalCommon, total: totalBase + totalCommon };
}

/** Main bill vs what tenants will pay. A difference is normal (fixed charges, common areas, meter loss). */
export function reconcile(mainBill: number | null, recovered: number) {
  if (mainBill == null) return { mainBill: null, recovered, difference: null as number | null };
  return { mainBill, recovered, difference: Math.round(mainBill - recovered) };
}
