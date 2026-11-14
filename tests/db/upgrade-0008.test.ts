import { beforeAll, describe, expect, it } from "vitest";
import { applyMigration, approvedOwner, createDb, makeAdmin, type Db, type Q } from "./harness";

/**
 * Upgrading a live database to running meter readings (0008): readings saved the
 * old way (one per room per month, rate typed per room) and charges confirmed
 * on the monthly screen must turn into per-reading charges without anyone
 * being charged twice, and amounts the owner changed by hand must stay.
 */

let db: Db;
let o: { id: string; buildingId: string };
const t: Record<string, string> = {};
const room: Record<string, string> = {};

const elec = (q: Q, tenantId: string) =>
  q<{ total: number; n: number; sources: string }>(
    `select coalesce(sum(i.amount), 0)::float as total, count(*)::int as n, coalesce(string_agg(i.source, ',' order by i.source), '') as sources
       from public.invoice_items i join public.invoices v on v.id = i.invoice_id
      where v.tenant_id = $1 and i.kind = 'electricity'`, [tenantId]).then((r) => r[0]);

beforeAll(async () => {
  db = await createDb({ before: "0008" });
  await db.setToday("2026-11-14");
  const admin = await makeAdmin(db);
  o = await approvedOwner(db, admin, "old@test.in", "OLDDATAREF01", 10);
  await db.as(o.id, async (q) => {
    const spec = ["101", "102", "103"].map((name) => ({ floor: 1, name, room_type: "shared", beds: 2, rent: 4000, deposit: 0 }));
    await q(`select public.bulk_add_rooms($1, $2::jsonb)`, [o.buildingId, JSON.stringify(spec)]);
    const beds = await q<{ id: string; room_id: string; name: string }>(
      `select b.id, b.room_id, r.name from public.beds b join public.rooms r on r.id = b.room_id order by r.name, b.label`);
    for (const b of beds) room[b.name] = b.room_id;
    const add = (name: string, phone: string, bed: string) =>
      q<{ id: string }>(`select public.create_tenant($1::jsonb) as id`, [JSON.stringify({
        building_id: o.buildingId, full_name: name, phone, joined_on: "2026-11-14", monthly_rent: 4000,
        security_deposit: 0, whatsapp_opt_in: false, bed_id: bed,
      })]).then((r) => r[0].id);
    // like the live data: two tenants in 101, one in 102, one in 103
    t.a = await add("Aman", "9711111111", beds[0].id);
    t.b = await add("Bhanu", "9722222222", beds[1].id);
    t.c = await add("Chirag", "9733333333", beds[2].id);
    t.d = await add("Dev", "9744444444", beds[4].id);

    // old API: one reading per room per month, rate typed on the form
    await q(`select public.save_meter_reading($1, '2026-11-01', 200, '2026-11-14', 10, 0)`, [room["101"]]);
    await q(`select public.save_meter_reading($1, '2026-11-01', 100, '2026-11-14', 10, 0)`, [room["102"]]);
    await q(`select public.save_meter_reading($1, '2026-11-01', 50, '2026-11-14', 10, 0)`, [room["103"]]);
    // monthly confirm: calculated amounts for A, B, C; D's amount changed by hand to 400
    const rows = [
      { tenant_id: t.a, room_id: room["101"], method: "submeter", units: 100, base_amount: 1000, common_amount: 0, amount: 1000 },
      { tenant_id: t.b, room_id: room["101"], method: "submeter", units: 100, base_amount: 1000, common_amount: 0, amount: 1000 },
      { tenant_id: t.c, room_id: room["102"], method: "submeter", units: 100, base_amount: 1000, common_amount: 0, amount: 1000 },
      { tenant_id: t.d, room_id: room["103"], method: "custom", units: 50, base_amount: 400, common_amount: 0, amount: 400 },
    ];
    await q(`select public.confirm_electricity_charges($1, '2026-11-01', $2::jsonb)`, [o.buildingId, JSON.stringify(rows)]);
  });

  await applyMigration(db, "0008");
});

describe("upgrade to running meter readings (0008)", () => {
  it("takes the building rate from the rate typed on readings", async () => {
    const b = await db.as(o.id, (q) => q<{ rate: number }>(`select electricity_rate::float as rate from public.buildings where id = $1`, [o.buildingId]));
    expect(b[0].rate).toBe(10);
  });

  it("replaces calculated monthly charges with the same per-reading charges — nobody is charged twice", async () => {
    await db.as(o.id, async (q) => {
      expect(await elec(q, t.a)).toEqual({ total: 1000, n: 1, sources: "meter" });
      expect(await elec(q, t.b)).toEqual({ total: 1000, n: 1, sources: "meter" });
      expect(await elec(q, t.c)).toEqual({ total: 1000, n: 1, sources: "meter" });
      const left = await q(`select tenant_id from public.electricity_allocations`);
      expect(left.map((r) => r.tenant_id)).toEqual([t.d]);
    });
  });

  it("keeps an amount the owner changed by hand and does not add meter charges on top", async () => {
    await db.as(o.id, async (q) => {
      expect(await elec(q, t.d)).toEqual({ total: 400, n: 1, sources: "electricity" });
    });
  });

  it("the next reading continues from the old one and is charged", async () => {
    await db.setToday("2026-12-14");
    await db.as(o.id, async (q) => {
      const r = await q<{ id: string }>(`select public.save_meter_reading($1, 260, '2026-12-14') as id`, [room["101"]]);
      const m = await q<{ prev: number; units: number; previous_date: string }>(
        `select previous_reading::float as prev, units::float as units, previous_date::text from public.electricity_meter_readings where id = $1`, [r[0].id]);
      expect(m[0]).toEqual({ prev: 200, units: 60, previous_date: "2026-11-14" });
      // 60 units × ₹10 = ₹600 shared by A and B, on their December bills
      expect((await elec(q, t.a)).total).toBe(1300);
      expect((await elec(q, t.b)).total).toBe(1300);
    });
  });
});
