import { beforeAll, describe, expect, it } from "vitest";
import { approvedOwner, createDb, expectDbError, makeAdmin, type Db, type Q } from "./harness";

/**
 * Running meter readings: each reading continues from the room's last one and
 * (in room-meter buildings) is charged straight to the room's tenants.
 */

let db: Db;
let o: { id: string; buildingId: string };
const room: Record<string, string> = {};
const beds: Record<string, string[]> = {};
let phone = 9700000001;

const tenant = (q: Q, over: Record<string, unknown>) =>
  q<{ id: string }>(`select public.create_tenant($1::jsonb) as id`, [JSON.stringify({
    building_id: o.buildingId, full_name: "Tenant", phone: String(phone++), joined_on: "2026-11-01",
    monthly_rent: 5000, security_deposit: 0, whatsapp_opt_in: false, ...over,
  })]).then((r) => r[0].id);

type SaveOpts = { correction?: boolean; reason?: string; override?: number; reading?: string };
const save = (q: Q, roomId: string, current: number, date: string, x: SaveOpts = {}) =>
  q<{ id: string }>(`select public.save_meter_reading($1, $2, $3::date, null, $4, $5, $6, $7) as id`, [
    roomId, current, date, x.correction ?? false, x.reason ?? null, x.override ?? null, x.reading ?? null,
  ]).then((r) => r[0].id);

const reading = (q: Q, id: string) =>
  q<{ prev: number; cur: number; units: number; previous_date: string | null; is_correction: boolean; rate: number }>(
    `select previous_reading::float as prev, current_reading::float as cur, units::float as units,
            previous_date::text, is_correction, per_unit_rate::float as rate
       from public.electricity_meter_readings where id = $1`, [id]).then((r) => r[0]);

/** electricity on a tenant's bills (optionally one month) */
const elec = (q: Q, tenantId: string, month?: string) =>
  q<{ total: number; n: number }>(
    `select coalesce(sum(i.amount), 0)::float as total, count(*)::int as n
       from public.invoice_items i join public.invoices v on v.id = i.invoice_id
      where v.tenant_id = $1 and i.kind = 'electricity' and ($2::date is null or v.period_month = $2::date)`,
    [tenantId, month ?? null]).then((r) => r[0]);

const linesOf = (q: Q, readingId: string) =>
  q<{ tenant_id: string; amount: number; units: number; description: string }>(
    `select v.tenant_id, i.amount::float as amount, i.units::float as units, i.description
       from public.invoice_items i join public.invoices v on v.id = i.invoice_id
      where i.meter_reading_id = $1 order by i.amount desc`, [readingId]);

beforeAll(async () => {
  db = await createDb();
  await db.setToday("2026-11-30");
  const admin = await makeAdmin(db);
  o = await approvedOwner(db, admin, "meter@test.in", "METERREF0001", 10);
  await db.as(o.id, async (q) => {
    const spec = ["101", "102", "103", "104", "105", "106"].map((name) => ({ floor: 1, name, room_type: "shared", beds: 2, rent: 5000, deposit: 0 }));
    await q(`select public.bulk_add_rooms($1, $2::jsonb)`, [o.buildingId, JSON.stringify(spec)]);
    const r = await q<{ id: string; room_id: string; name: string }>(
      `select b.id, b.room_id, r.name from public.beds b join public.rooms r on r.id = b.room_id order by r.name, b.label`);
    for (const x of r) {
      room[x.name] = x.room_id;
      beds[x.name] = [...(beds[x.name] ?? []), x.id];
    }
  });
  // rooms were "set up" (starting reading recorded) on 1 Nov
  await db.root(`update public.rooms set created_at = '2026-11-01 10:00+05:30'`);
});

describe("readings: one rate, a running chain per room", () => {
  it("needs the building's rate before a reading can be charged", async () => {
    await expectDbError(db.as(o.id, (q) => save(q, room["101"], 10, "2026-11-10")), "RATE_NOT_SET");
    await db.as(o.id, (q) => q(`update public.buildings set electricity_rate = 10 where id = $1`, [o.buildingId]));
  });

  it("the first reading starts from the room's starting reading; each next one from the last saved", async () => {
    await db.as(o.id, async (q) => {
      await q(`update public.rooms set meter_initial_reading = 1000 where id = $1`, [room["101"]]);
      const r1 = await save(q, room["101"], 1085, "2026-11-10");
      expect(await reading(q, r1)).toMatchObject({ prev: 1000, cur: 1085, units: 85, previous_date: null, rate: 10 });
      // 10 days later, same billing month: continues from 1085, not from the month's start
      const r2 = await save(q, room["101"], 1150, "2026-11-20");
      expect(await reading(q, r2)).toMatchObject({ prev: 1085, units: 65, previous_date: "2026-11-10" });
    });
  });

  it("refuses readings out of date order, in the future, lower than the last, or negative", async () => {
    await db.as(o.id, async (q) => {
      await expectDbError(save(q, room["101"], 1200, "2026-11-20"), "READING_DATE_ORDER");
      await expectDbError(save(q, room["101"], 1200, "2026-11-15"), "READING_DATE_ORDER");
      await expectDbError(save(q, room["101"], 1200, "2026-12-05"), "INVALID_DATE");
      await expectDbError(save(q, room["101"], 1100, "2026-11-25"), "READING_DECREASED");
      await expectDbError(save(q, room["101"], -1, "2026-11-25"), "INVALID_READING");
    });
  });

  it("meter replaced: needs a reason, then counting restarts from the new meter", async () => {
    await db.as(o.id, async (q) => {
      await expectDbError(save(q, room["101"], 20, "2026-11-25", { correction: true, reason: "" }), "REASON_REQUIRED");
      const c = await save(q, room["101"], 20, "2026-11-25", { correction: true, reason: "New meter", override: 0 });
      expect(await reading(q, c)).toMatchObject({ prev: 0, units: 20, is_correction: true });
      const n = await save(q, room["101"], 50, "2026-11-28");
      expect(await reading(q, n)).toMatchObject({ prev: 20, units: 30, previous_date: "2026-11-25" });
      // nobody lives in 101: nothing was charged
      expect(await linesOf(q, n)).toHaveLength(0);
    });
  });
});

describe("charging the room's tenants", () => {
  let t1: string;
  let r1: string;
  let r2: string;

  it("charges units × rate to the tenant's bill as soon as the reading is saved", async () => {
    await db.as(o.id, async (q) => {
      t1 = await tenant(q, { full_name: "Asha", bed_id: beds["102"][0] });
      r1 = await save(q, room["102"], 100, "2026-11-10");
      const lines = await linesOf(q, r1);
      expect(lines).toMatchObject([{ tenant_id: t1, amount: 1000, units: 100 }]);
      expect(lines[0].description).toBe("Room 102: 100 units (01 Nov – 10 Nov)");
      const bal = await q<{ b: number }>(`select balance::float as b from public.v_tenant_balances where tenant_id = $1`, [t1]);
      expect(bal[0].b).toBe(5000 + 1000);
    });
  });

  it("a second reading in the same month is a separate line for only the new units", async () => {
    await db.as(o.id, async (q) => {
      r2 = await save(q, room["102"], 150, "2026-11-20");
      expect(await elec(q, t1)).toEqual({ total: 1500, n: 2 });
    });
  });

  it("fixing the latest reading redoes its charge (never doubles); older readings are locked", async () => {
    await db.as(o.id, async (q) => {
      await save(q, room["102"], 170, "2026-11-20", { reading: r2 });
      expect(await elec(q, t1)).toEqual({ total: 1700, n: 2 });
      await expectDbError(save(q, room["102"], 120, "2026-11-10", { reading: r1 }), "NOT_LATEST_READING");
      await expectDbError(q(`select public.delete_meter_reading($1)`, [r1]), "NOT_LATEST_READING");
    });
  });

  it("deleting the latest reading removes its charge; the next reading continues from the one before", async () => {
    await db.as(o.id, async (q) => {
      await q(`select public.delete_meter_reading($1)`, [r2]);
      expect(await elec(q, t1)).toEqual({ total: 1000, n: 1 });
      const r3 = await save(q, room["102"], 130, "2026-11-25");
      expect(await reading(q, r3)).toMatchObject({ prev: 100, units: 30 });
      expect(await elec(q, t1)).toEqual({ total: 1300, n: 2 });
    });
  });

  it("splits by days stayed when a tenant joins between readings", async () => {
    await db.as(o.id, async (q) => {
      const a = await tenant(q, { full_name: "Bina", bed_id: beds["103"][0] });
      await save(q, room["103"], 50, "2026-11-10"); // 1–10 Nov: only Bina
      expect(await elec(q, a)).toMatchObject({ total: 500 });
      const b = await tenant(q, { full_name: "Chetan", joined_on: "2026-11-21", bed_id: beds["103"][1] });
      // 11–30 Nov = 20 days: Bina 20, Chetan 10 (21–30) → 90 units = ₹900 split 2:1
      const r = await save(q, room["103"], 140, "2026-11-30");
      const lines = await linesOf(q, r);
      expect(lines.map((l) => [l.tenant_id, l.amount, l.units])).toEqual([[a, 600, 60], [b, 300, 30]]);
      expect(lines[0].description).toBe("Room 103: 60 of 90 units (11 Nov – 30 Nov)");
    });
  });

  it("a tenant who left is charged only for their days, on their own bill", async () => {
    await db.setToday("2026-12-10");
    await db.as(o.id, async (q) => {
      const [bina, chetan] = (await q<{ id: string }>(`select id from public.tenants where full_name in ('Bina', 'Chetan') order by full_name`)).map((x) => x.id);
      await q(`select public.vacate_tenant($1, '2026-12-05', true)`, [bina]);
      // 1–10 Dec: Bina 5 days, Chetan 10 → 30 units = ₹300 split 1:2
      const r = await save(q, room["103"], 170, "2026-12-10");
      const lines = await linesOf(q, r);
      expect(lines.map((l) => [l.tenant_id, l.amount])).toEqual([[chetan, 200], [bina, 100]]);
      expect((await elec(q, bina, "2026-12-01")).total).toBe(100);
    });
  });

  it("tenants with electricity included in rent are not charged, and their share is not pushed onto room-mates", async () => {
    await db.as(o.id, async (q) => {
      const payer = await tenant(q, { full_name: "Deepak", bed_id: beds["104"][0] });
      const exempt = await tenant(q, { full_name: "Esha", bed_id: beds["104"][1], electricity_rule: "none" });
      const r = await save(q, room["104"], 100, "2026-12-10");
      expect(await linesOf(q, r)).toMatchObject([{ tenant_id: payer, amount: 500 }]);
      expect((await elec(q, exempt)).n).toBe(0);
    });
  });

  it("an empty room is recorded but charges no one", async () => {
    await db.as(o.id, async (q) => {
      const r = await save(q, room["105"], 40, "2026-12-10");
      expect(await reading(q, r)).toMatchObject({ units: 40 });
      expect(await linesOf(q, r)).toHaveLength(0);
    });
  });

  it("shares are whole rupees that add up exactly to the reading's total", async () => {
    await db.as(o.id, async (q) => {
      await tenant(q, { full_name: "Farah", bed_id: beds["106"][0] });
      await tenant(q, { full_name: "Gopal", bed_id: beds["106"][1] });
      await q(`update public.buildings set electricity_rate = 7 where id = $1`, [o.buildingId]);
      const r = await save(q, room["106"], 85, "2026-12-10"); // 85 × 7 = 595
      expect((await linesOf(q, r)).map((l) => l.amount)).toEqual([298, 297]);
      expect((await reading(q, r)).rate).toBe(7);
      await q(`update public.buildings set electricity_rate = 10 where id = $1`, [o.buildingId]);
    });
  });

  it("re-running the charge for a reading never duplicates lines", async () => {
    const r = await db.as(o.id, (q) => q<{ id: string }>(`select id from public.electricity_meter_readings where room_id = $1 order by reading_date desc limit 1`, [room["106"]]));
    await db.root(`select private.charge_meter_reading($1)`, [r[0].id]);
    await db.root(`select private.charge_meter_reading($1)`, [r[0].id]);
    expect(await db.as(o.id, (q) => linesOf(q, r[0].id))).toHaveLength(2);
  });

  it("a fixed-amount tenant gets the fixed amount on each bill, not meter charges", async () => {
    await db.as(o.id, async (q) => {
      const fixed = await tenant(q, { full_name: "Hari", joined_on: "2026-12-01", electricity_rule: "custom", electricity_custom_amount: 300 });
      expect(await elec(q, fixed, "2026-12-01")).toEqual({ total: 300, n: 1 });
    });
  });

  it("buildings that split the main bill only store readings; charging happens on the monthly screen", async () => {
    await db.as(o.id, async (q) => {
      await q(`update public.buildings set electricity_method = 'equal' where id = $1`, [o.buildingId]);
      const r = await save(q, room["102"], 160, "2026-12-10");
      expect(await reading(q, r)).toMatchObject({ prev: 130, units: 30 });
      expect(await linesOf(q, r)).toHaveLength(0);
      // the monthly split cannot run on top of meter charges already on December bills
      await expectDbError(q(`select public.confirm_electricity_charges($1, '2026-12-01', '[]'::jsonb)`, [o.buildingId]), "METER_CHARGES_EXIST");
      await q(`update public.buildings set electricity_method = 'submeter' where id = $1`, [o.buildingId]);
    });
  });
});
