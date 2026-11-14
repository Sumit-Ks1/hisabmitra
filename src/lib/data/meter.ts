import "server-only";
import type { MeterReading } from "@/lib/db-types";
import { getRoomMap } from "./rooms";
import type { Workspace } from "./workspace";

/** One saved reading, as shown on a room's card. */
export type ReadingView = {
  id: string;
  previous: number;
  previousDate: string | null;
  current: number;
  date: string;
  units: number;
  rate: number;
  /** units × rate (+ any old fixed charge), whole rupees */
  amount: number;
  isCorrection: boolean;
  correctionReason: string | null;
  photoPath: string | null;
};

/** Who a reading was charged to, and what each of them owes in total now. */
export type ChargeView = { tenantId: string; name: string; amount: number; units: number | null; totalDue: number };

export type MeterRoom = {
  id: string;
  name: string;
  floor: number;
  meterNumber: string | null;
  /** names of the tenants in the room today */
  occupants: string[];
  /** the next reading continues from here */
  base: { reading: number; date: string | null; fromStart: boolean };
  last: ReadingView | null;
  /** only for the latest reading (older readings are locked) */
  charges: ChargeView[];
  /** earlier readings, newest first (at most 6) */
  history: ReadingView[];
  /** how many readings the room has in total */
  count: number;
};

const view = (r: MeterReading): ReadingView => ({
  id: r.id,
  previous: Number(r.previous_reading),
  previousDate: r.previous_date,
  current: Number(r.current_reading),
  date: r.reading_date,
  units: Number(r.units),
  rate: Number(r.per_unit_rate),
  amount: Math.round(Number(r.units) * Number(r.per_unit_rate) + Number(r.fixed_charge)),
  isCorrection: r.is_correction,
  correctionReason: r.correction_reason,
  photoPath: r.photo_path,
});

/**
 * Everything the meter-readings screen needs: per room, the reading the next one
 * continues from, the latest saved reading with who it was charged to (and their
 * total due now), and a short history.
 */
export async function getMeterRooms(ws: Pick<Workspace, "supabase" | "userId" | "building">): Promise<MeterRoom[]> {
  const { supabase, userId, building } = ws;
  const [map, readRes, tenantRes, balRes] = await Promise.all([
    getRoomMap(ws),
    supabase
      .from("electricity_meter_readings")
      .select("*")
      .eq("building_id", building.id)
      .eq("owner_id", userId)
      .order("reading_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase.from("tenants").select("id, full_name").eq("building_id", building.id).eq("owner_id", userId),
    supabase.from("v_tenant_balances").select("tenant_id, balance").eq("building_id", building.id).eq("owner_id", userId),
  ]);
  const readings = (readRes.data ?? []) as MeterReading[];
  const names = new Map((tenantRes.data ?? []).map((x) => [x.id as string, x.full_name as string]));
  const dues = new Map((balRes.data ?? []).map((x) => [x.tenant_id as string, Number(x.balance)]));

  const byRoom = new Map<string, MeterReading[]>();
  for (const r of readings) byRoom.set(r.room_id, [...(byRoom.get(r.room_id) ?? []), r]);

  // who each room's latest reading was charged to
  const latestIds = [...byRoom.values()].map((list) => list[0].id);
  const charges = new Map<string, ChargeView[]>();
  if (latestIds.length) {
    const { data } = await supabase
      .from("invoice_items")
      .select("meter_reading_id, amount, units, invoices(tenant_id)")
      .in("meter_reading_id", latestIds)
      .eq("owner_id", userId);
    for (const row of data ?? []) {
      const inv = (Array.isArray(row.invoices) ? row.invoices[0] : row.invoices) as { tenant_id: string } | null;
      if (!inv) continue;
      const id = row.meter_reading_id as string;
      charges.set(id, [
        ...(charges.get(id) ?? []),
        {
          tenantId: inv.tenant_id,
          name: names.get(inv.tenant_id) ?? "—",
          amount: Number(row.amount),
          units: row.units == null ? null : Number(row.units),
          totalDue: dues.get(inv.tenant_id) ?? 0,
        },
      ]);
    }
  }

  return map.rooms.map((room) => {
    const list = byRoom.get(room.id) ?? [];
    const latest = list[0];
    return {
      id: room.id,
      name: room.name,
      floor: room.floor_number,
      meterNumber: room.meter_number,
      occupants: map.occupants.filter((o) => o.roomId === room.id).map((o) => o.name),
      base: latest
        ? { reading: Number(latest.current_reading), date: latest.reading_date, fromStart: false }
        : { reading: Number(room.meter_initial_reading ?? 0), date: null, fromStart: true },
      last: latest ? view(latest) : null,
      charges: latest ? (charges.get(latest.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)) : [],
      history: list.slice(1, 7).map(view),
      count: list.length,
    };
  });
}
