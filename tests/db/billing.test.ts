import { beforeAll, describe, expect, it } from "vitest";
import { approvedOwner, createDb, expectDbError, makeAdmin, type Db, type Q } from "./harness";

let db: Db;
let admin: string;
let o: { id: string; buildingId: string };
const beds: string[] = [];
const rooms: string[] = [];

const tenant = (q: Q, over: Record<string, unknown>) =>
  q<{ id: string }>(`select public.create_tenant($1::jsonb) as id`, [JSON.stringify({
    building_id: o.buildingId, full_name: "Tenant", phone: "9811111111", joined_on: "2026-11-01",
    monthly_rent: 8000, security_deposit: 0, whatsapp_opt_in: false, ...over,
  })]).then((r) => r[0].id);

const invoices = (q: Q, tenantId: string) =>
  q<{ period_month: string; rent: number; total: number; paid: number; balance: number; status: string; elec: number; other: number; adj: number }>(
    `select period_month::text, rent_amount::float as rent, total_amount::float as total, paid_amount::float as paid,
            balance::float as balance, status, electricity_amount::float as elec, other_amount::float as other,
            adjustment_amount::float as adj
       from public.v_invoices where tenant_id = $1 order by period_month`, [tenantId]);

beforeAll(async () => {
  db = await createDb();
  await db.setToday("2026-11-20");
  admin = await makeAdmin(db);
  o = await approvedOwner(db, admin, "owner@test.in", "BILLINGREF01", 20);
  await db.as(o.id, async (q) => {
    const spec = [
      ...["101", "102", "103", "104", "105"].map((name) => ({ floor: 1, name, room_type: "shared", beds: 2, rent: 8000, deposit: 5000 })),
      ...["201", "202", "203"].map((name) => ({ floor: 2, name, room_type: "single", beds: 1, rent: 9000, deposit: 5000 })),
    ];
    await q(`select public.bulk_add_rooms($1, $2::jsonb)`, [o.buildingId, JSON.stringify(spec)]);
    const r = await q<{ id: string; room_id: string }>(
      `select b.id, b.room_id from public.beds b join public.rooms r on r.id = b.room_id order by r.name, b.label`);
    r.forEach((x) => { beds.push(x.id); if (!rooms.includes(x.room_id)) rooms.push(x.room_id); });
  });
});

describe("rooms, beds and allocation", () => {
  it("creates floors, rooms and beds", async () => {
    const f = await db.as(o.id, (q) => q(`select number from public.floors order by number`));
    expect(f.map((x) => x.number)).toEqual([1, 2]);
    expect(beds).toHaveLength(13);
    const v = await db.as(o.id, (q) => q(`select name, bed_count, occupied_count from public.v_rooms where name = '101'`));
    expect(v[0]).toMatchObject({ bed_count: 2, occupied_count: 0 });
  });

  it("refuses a duplicate room name", async () => {
    await expectDbError(db.as(o.id, (q) => q(`select public.add_room($1, 1, '101', 'shared', 1, 1, 0, null)`, [o.buildingId])), "ROOM_NAME_TAKEN");
  });

  it("prevents two active tenants on one bed", async () => {
    await db.as(o.id, async (q) => {
      const t1 = await tenant(q, { full_name: "Bed One", bed_id: beds[0] });
      const t2 = await tenant(q, { full_name: "Bed Two", phone: "9822222222" });
      await expectDbError(q(`select public.allocate_bed($1, $2, null)`, [t2, beds[0]]), "BED_ALREADY_OCCUPIED");
      // direct insert bypassing the RPC is stopped by the unique index too
      await expectDbError(q(
        `insert into public.room_allocations (owner_id, building_id, tenant_id, room_id, bed_id, started_on)
         values ($1, $2, $3, $4, $5, '2026-11-20')`, [o.id, o.buildingId, t2, rooms[0], beds[0]]), "unique");
      await q(`select public.allocate_bed($1, $2, null)`, [t2, beds[1]]);
      const v = await q(`select occupied_count from public.v_rooms where name = '101'`);
      expect(v[0].occupied_count).toBe(2);
      expect(t1).toBeTruthy();
    });
  });

  it("refuses allocation into a room under maintenance", async () => {
    await db.as(o.id, async (q) => {
      await q(`update public.rooms set maintenance = true where id = $1`, [rooms[7]]);
      const t = await tenant(q, { full_name: "Maint", phone: "9833333333" });
      await expectDbError(q(`select public.allocate_bed($1, $2, null)`, [t, beds[12]]), "ROOM_IN_MAINTENANCE");
    });
  });

  it("swaps two tenants and keeps the full allocation history", async () => {
    await db.as(o.id, async (q) => {
      const ta = await tenant(q, { full_name: "Swap A", phone: "9844444444", bed_id: beds[2] });
      const tb = await tenant(q, { full_name: "Swap B", phone: "9855555555", bed_id: beds[10] });
      await q(`select public.swap_beds($1, $2, '2026-11-20')`, [ta, tb]);
      const cur = await q<{ tenant_id: string; bed_id: string }>(
        `select tenant_id, bed_id from public.room_allocations where tenant_id in ($1, $2) and ended_on is null`, [ta, tb]);
      expect(cur.find((c) => c.tenant_id === ta)?.bed_id).toBe(beds[10]);
      expect(cur.find((c) => c.tenant_id === tb)?.bed_id).toBe(beds[2]);
      const hist = await q(
        `select reason, end_reason, ended_on::text from public.room_allocations where tenant_id = $1 order by created_at, started_on`, [ta]);
      expect(hist).toHaveLength(2);
      expect(hist.some((h) => h.reason === "initial" && h.end_reason === "swap" && h.ended_on === "2026-11-20")).toBe(true);
      expect(hist.some((h) => h.reason === "swap" && h.ended_on === null)).toBe(true);
      // history rows cannot be deleted by the owner
      await expectDbError(q(`delete from public.room_allocations where tenant_id = $1`, [ta]), "permission denied");
    });
  });

  it("an occupied bed or room cannot be removed", async () => {
    await db.as(o.id, async (q) => {
      await expectDbError(q(`update public.beds set deleted_at = now() where id = $1`, [beds[0]]), "BED_OCCUPIED");
      await expectDbError(q(`update public.rooms set deleted_at = now() where id = $1`, [rooms[0]]), "ROOM_OCCUPIED");
    });
  });
});

describe("rent invoices and proration", () => {
  it("tenant joining on the 1st pays the full month", async () => {
    await db.as(o.id, async (q) => {
      const t = await tenant(q, { full_name: "First Day", phone: "9866666661", joined_on: "2026-11-01" });
      const inv = await invoices(q, t);
      expect(inv).toHaveLength(1);
      expect(inv[0]).toMatchObject({ period_month: "2026-11-01", rent: 8000, total: 8000, status: "overdue" });
    });
  });

  it("tenant joining on 16 Nov pays 15/30 days = ₹4,000", async () => {
    await db.as(o.id, async (q) => {
      const t = await tenant(q, { full_name: "Mid Month", phone: "9866666662", joined_on: "2026-11-16" });
      const inv = await invoices(q, t);
      expect(inv[0].rent).toBe(4000);
      const item = await q(`select description from public.invoice_items i join public.invoices v on v.id = i.invoice_id where v.tenant_id = $1`, [t]);
      expect(item[0].description).toContain("15 days");
    });
  });

  it("supports full-month and custom first-month rules", async () => {
    await db.as(o.id, async (q) => {
      const full = await tenant(q, { full_name: "Full Rule", phone: "9866666663", joined_on: "2026-11-16", proration_rule: "full" });
      expect((await invoices(q, full))[0].rent).toBe(8000);
      const custom = await tenant(q, { full_name: "Custom Rule", phone: "9866666664", joined_on: "2026-11-16", proration_rule: "custom", first_month_amount: 3500, first_month_reason: "Agreed with tenant" });
      expect((await invoices(q, custom))[0].rent).toBe(3500);
      const fixed = await tenant(q, { full_name: "Fixed30", phone: "9866666665", joined_on: "2026-11-21", proration_rule: "fixed30" });
      expect((await invoices(q, fixed))[0].rent).toBe(Math.round((8000 * 10) / 30));
    });
  });

  it("an older tenant is billed from the current month, with previous dues as opening balance", async () => {
    await db.as(o.id, async (q) => {
      const t = await tenant(q, { full_name: "Old Tenant", phone: "9866666666", joined_on: "2026-03-10", opening_balance: 2500 });
      const inv = await invoices(q, t);
      expect(inv).toHaveLength(1);
      expect(inv[0]).toMatchObject({ period_month: "2026-11-01", rent: 8000, other: 2500, total: 10500 });
    });
  });

  it("generating invoices again never creates duplicates", async () => {
    await db.as(o.id, async (q) => {
      const before = await q<{ n: number }>(`select count(*)::int as n from public.invoices`);
      const r1 = await q<{ n: number }>(`select public.generate_invoices($1, '2026-11-01') as n`, [o.buildingId]);
      const r2 = await q<{ n: number }>(`select public.ensure_billing($1, true) as n`, [o.buildingId]);
      expect(r1[0].n).toBe(0);
      expect(r2[0].n).toBe(0);
      const after = await q<{ n: number }>(`select count(*)::int as n from public.invoices`);
      expect(after[0].n).toBe(before[0].n);
      const t = await q<{ id: string; cycle_id: string }>(`select tenant_id as id, cycle_id from public.invoices limit 1`);
      await expectDbError(q(
        `insert into public.invoices (owner_id, building_id, cycle_id, tenant_id, period_month, period_start, period_end, due_date)
         values ($1, $2, $3, $4, '2026-11-01', '2026-11-01', '2026-11-30', '2026-11-05')`, [o.id, o.buildingId, t[0].cycle_id, t[0].id]), "unique");
    });
  });

  it("partial and multiple payments reduce the balance; reminders never mark anything paid", async () => {
    await db.as(o.id, async (q) => {
      const t = await tenant(q, { full_name: "Partial Payer", phone: "9866666667" });
      await q(`select public.record_payment($1, null, 5000, '2026-11-05', 'upi', 'UTR5000A', null, 'rent', 'pay-partial-1')`, [t]);
      let inv = await invoices(q, t);
      expect(inv[0]).toMatchObject({ paid: 5000, balance: 3000, status: "overdue" });
      await q(`select public.record_payment($1, null, 1000, '2026-11-10', 'cash', null, 'second part', 'rent', 'pay-partial-2')`, [t]);
      await q(`select public.record_payment($1, null, 2000, '2026-11-12', 'bank_transfer', 'NEFT2000', null, 'rent', 'pay-partial-3')`, [t]);
      inv = await invoices(q, t);
      expect(inv[0]).toMatchObject({ paid: 8000, balance: 0, status: "paid" });
      const pays = await q(`select 1 from public.rent_payments where tenant_id = $1`, [t]);
      expect(pays).toHaveLength(3);
    });
  });

  it("a double-submitted payment is recorded once; a repeated reference is refused", async () => {
    await db.as(o.id, async (q) => {
      const t = await tenant(q, { full_name: "Double Click", phone: "9866666668" });
      const g1 = await q<{ g: string }>(`select public.record_payment($1, null, 2000, '2026-11-05', 'upi', 'UTRDOUBLE1', null, 'rent', 'pay-double-1') as g`, [t]);
      const g2 = await q<{ g: string }>(`select public.record_payment($1, null, 2000, '2026-11-05', 'upi', 'UTRDOUBLE1', null, 'rent', 'pay-double-1') as g`, [t]);
      expect(g2[0].g).toBe(g1[0].g);
      expect((await invoices(q, t))[0].paid).toBe(2000);
      await expectDbError(q(`select public.record_payment($1, null, 2000, '2026-11-06', 'upi', 'utrdouble1', null, 'rent', 'pay-double-2')`, [t]), "DUPLICATE_REFERENCE");
      await expectDbError(q(`select public.record_payment($1, null, 0, '2026-11-06', 'cash', null, null, 'rent', 'pay-double-3')`, [t]), "INVALID_AMOUNT");
      await expectDbError(q(`select public.record_payment($1, null, -50, '2026-11-06', 'cash', null, null, 'rent', 'pay-double-4')`, [t]), "INVALID_AMOUNT");
    });
  });

  it("payments are voided with a reason, never deleted or edited", async () => {
    await db.as(o.id, async (q) => {
      const t = await tenant(q, { full_name: "Void Me", phone: "9866666669" });
      const g = await q<{ g: string }>(`select public.record_payment($1, null, 8000, '2026-11-05', 'cash', null, null, 'rent', 'pay-void-1') as g`, [t]);
      expect((await invoices(q, t))[0].status).toBe("paid");
      await expectDbError(q(`delete from public.rent_payments where tenant_id = $1`, [t]), "permission denied");
      await expectDbError(q(`update public.rent_payments set amount = 1 where tenant_id = $1`, [t]), "permission denied");
      await expectDbError(q(`select public.void_payment($1, '')`, [g[0].g]), "REASON_REQUIRED");
      await q(`select public.void_payment($1, 'Entered for wrong tenant')`, [g[0].g]);
      expect((await invoices(q, t))[0]).toMatchObject({ paid: 0, balance: 8000 });
      expect(await q(`select 1 from public.rent_payments where tenant_id = $1 and voided_at is not null`, [t])).toHaveLength(1);
    });
  });

  it("invoice totals cannot be edited directly", async () => {
    await db.as(o.id, async (q) => {
      await expectDbError(q(`update public.invoices set paid_amount = total_amount`), "permission denied");
    });
  });

  it("other charges and discounts flow into the total", async () => {
    await db.as(o.id, async (q) => {
      const t = await tenant(q, { full_name: "Extras", phone: "9866666670" });
      const inv = await q<{ id: string }>(`select id from public.invoices where tenant_id = $1`, [t]);
      await q(`insert into public.invoice_items (owner_id, invoice_id, kind, description, amount) values ($1, $2, 'other', 'Laundry', 300), ($1, $2, 'discount', 'Festival discount', -500)`, [o.id, inv[0].id]);
      expect((await invoices(q, t))[0]).toMatchObject({ rent: 8000, other: 300, adj: -500, total: 7800 });
      await expectDbError(q(`insert into public.invoice_items (owner_id, invoice_id, kind, description, amount) values ($1, $2, 'other', 'Negative', -10)`, [o.id, inv[0].id]), "check constraint");
    });
  });

  it("deposit is tracked separately from rent", async () => {
    await db.as(o.id, async (q) => {
      const t = await tenant(q, { full_name: "Deposit", phone: "9866666671", security_deposit: 5000 });
      await q(`select public.record_payment($1, null, 5000, '2026-11-01', 'cash', null, null, 'deposit', 'pay-dep-1')`, [t]);
      await q(`select public.record_payment($1, null, 1000, '2026-11-15', 'cash', null, 'partial refund', 'deposit_refund', 'pay-dep-2')`, [t]);
      const bal = await q<{ deposit_held: number; balance: number }>(`select deposit_held::float as deposit_held, balance::float as balance from public.v_tenant_balances where tenant_id = $1`, [t]);
      expect(bal[0]).toMatchObject({ deposit_held: 4000, balance: 8000 });
    });
  });
});

describe("monthly cycle, carry-forward, advance and vacating", () => {
  let carry: string;
  let adv: string;
  let leaver: string;

  it("sets up November", async () => {
    await db.as(o.id, async (q) => {
      carry = await tenant(q, { full_name: "Carry Forward", phone: "9877777771" });
      await q(`select public.record_payment($1, null, 3000, '2026-11-05', 'cash', null, null, 'rent', 'pay-carry-1')`, [carry]);
      adv = await tenant(q, { full_name: "Advance Payer", phone: "9877777772" });
      await q(`select public.record_payment($1, null, 10000, '2026-11-05', 'upi', 'UTRADV10000', null, 'rent', 'pay-adv-1')`, [adv]);
      leaver = await tenant(q, { full_name: "Leaver", phone: "9877777773", bed_id: beds[4] });
      const bal = await q<{ advance_credit: number; balance: number }>(`select advance_credit::float as advance_credit, balance::float as balance from public.v_tenant_balances where tenant_id = $1`, [adv]);
      expect(bal[0]).toMatchObject({ advance_credit: 2000, balance: -2000 });
    });
  });

  it("vacating mid-month adds a transparent move-out adjustment and frees the bed", async () => {
    await db.as(o.id, async (q) => {
      await q(`select public.vacate_tenant($1, '2026-11-20', true)`, [leaver]);
      const inv = await invoices(q, leaver);
      // 20 of 30 days → 5333; adjustment = 5333 − 8000
      expect(inv[0]).toMatchObject({ rent: 8000, adj: -2667, total: 5333 });
      const alloc = await q(`select ended_on::text, end_reason from public.room_allocations where tenant_id = $1`, [leaver]);
      expect(alloc[0]).toMatchObject({ ended_on: "2026-11-20", end_reason: "vacated" });
      // bed is free again
      const t = await tenant(q, { full_name: "Replacement", phone: "9877777774", joined_on: "2026-11-20", bed_id: beds[4] });
      expect(t).toBeTruthy();
      await expectDbError(q(`select public.vacate_tenant($1, '2026-11-20', true)`, [leaver]), "ALREADY_VACATED");
    });
  });

  it("opening the app in December creates December invoices exactly once", async () => {
    await db.setToday("2026-12-03");
    await db.as(o.id, async (q) => {
      const n1 = await q<{ n: number }>(`select public.ensure_billing($1, false) as n`, [o.buildingId]);
      expect(n1[0].n).toBeGreaterThan(0);
      const n2 = await q<{ n: number }>(`select public.ensure_billing($1, false) as n`, [o.buildingId]);
      const n3 = await q<{ n: number }>(`select public.ensure_billing($1, true) as n`, [o.buildingId]);
      expect(n2[0].n).toBe(0);
      expect(n3[0].n).toBe(0);
      const dup = await q(`select tenant_id from public.invoices group by tenant_id, period_month having count(*) > 1`);
      expect(dup).toEqual([]);
    });
  });

  it("unpaid November balance carries forward into the tenant's outstanding", async () => {
    await db.as(o.id, async (q) => {
      const inv = await invoices(q, carry);
      expect(inv.map((i) => [i.period_month, i.balance])).toEqual([["2026-11-01", 5000], ["2026-12-01", 8000]]);
      const bal = await q<{ balance: number }>(`select balance::float as balance from public.v_tenant_balances where tenant_id = $1`, [carry]);
      expect(bal[0].balance).toBe(13000);
      // a new payment clears the oldest month first
      await q(`select public.record_payment($1, null, 6000, '2026-12-03', 'cash', null, null, 'rent', 'pay-carry-2')`, [carry]);
      const after = await invoices(q, carry);
      expect(after.map((i) => i.balance)).toEqual([0, 7000]);
    });
  });

  it("advance money is applied to the new month automatically", async () => {
    await db.as(o.id, async (q) => {
      const inv = await invoices(q, adv);
      expect(inv[1]).toMatchObject({ period_month: "2026-12-01", paid: 2000, balance: 6000, status: "partial" });
      const bal = await q<{ advance_credit: number; balance: number }>(`select advance_credit::float as advance_credit, balance::float as balance from public.v_tenant_balances where tenant_id = $1`, [adv]);
      expect(bal[0]).toMatchObject({ advance_credit: 0, balance: 6000 });
      const total = await q<{ s: number }>(`select sum(amount)::float as s from public.rent_payments where tenant_id = $1 and voided_at is null`, [adv]);
      expect(total[0].s).toBe(10000);
    });
  });

  it("a vacated tenant is not billed for later months, and their records remain", async () => {
    await db.as(o.id, async (q) => {
      const inv = await invoices(q, leaver);
      expect(inv).toHaveLength(1);
      await expectDbError(q(`delete from public.tenants where id = $1`, [leaver]), "permission denied");
    });
  });

  it("a tenant who vacated before the cycle ran is prorated at generation time", async () => {
    const t = await db.as(o.id, (q) => tenant(q, { full_name: "Dec Leaver", phone: "9877777775", joined_on: "2026-12-01" }));
    await db.setToday("2026-12-10");
    await db.as(o.id, async (q) => {
      await q(`select public.vacate_tenant($1, '2026-12-10', true)`, [t]);
      const inv = await invoices(q, t);
      // invoice already existed (full 8000) → adjustment to 10/31 days = 2581
      expect(inv[0].total).toBe(2581);
    });
  });

  it("late fee is added once after the grace period", async () => {
    await db.as(o.id, async (q) => {
      await q(`update public.buildings set late_fee_amount = 100, grace_days = 2 where id = $1`, [o.buildingId]);
      await q(`select public.ensure_billing($1, true)`, [o.buildingId]);
      await q(`select public.ensure_billing($1, true)`, [o.buildingId]);
      const fees = await q<{ n: number }>(
        `select count(*)::int as n from public.invoice_items i join public.invoices v on v.id = i.invoice_id
          where v.tenant_id = $1 and i.kind = 'late_fee'`, [carry]);
      // December (due 5 Dec + 2 grace < 10 Dec) has a balance → exactly one fee; November is fully paid
      expect(fees[0].n).toBe(1);
      await q(`update public.buildings set late_fee_amount = 0 where id = $1`, [o.buildingId]);
    });
  });
});

describe("electricity", () => {
  it("main-bill split: confirmed charges appear on the invoice once, and re-confirming replaces them", async () => {
    await db.as(o.id, async (q) => {
      // room-meter buildings are charged per reading and cannot use this step
      await expectDbError(q(`select public.confirm_electricity_charges($1, '2026-12-01', '[]'::jsonb)`, [o.buildingId]), "METER_MODE");
      await q(`update public.buildings set electricity_method = 'equal' where id = $1`, [o.buildingId]);
      const t = await tenant(q, { full_name: "Elec Tenant", phone: "9888888881", joined_on: "2026-12-01", bed_id: beds[6] });
      const row = (amount: number) => JSON.stringify([{ tenant_id: t, room_id: rooms[3], method: "submeter", units: 85, base_amount: amount, common_amount: 0, amount }]);
      await q(`select public.confirm_electricity_charges($1, '2026-12-01', $2::jsonb)`, [o.buildingId, row(680)]);
      expect((await invoices(q, t))[0]).toMatchObject({ rent: 8000, elec: 680, total: 8680 });
      await q(`select public.confirm_electricity_charges($1, '2026-12-01', $2::jsonb)`, [o.buildingId, row(700)]);
      expect((await invoices(q, t))[0]).toMatchObject({ elec: 700, total: 8700 });
      const items = await q(`select 1 from public.invoice_items i join public.invoices v on v.id = i.invoice_id where v.tenant_id = $1 and i.kind = 'electricity'`, [t]);
      expect(items).toHaveLength(1);
      expect(await q(`select 1 from public.electricity_allocations where tenant_id = $1`, [t])).toHaveLength(1);
      await q(`update public.buildings set electricity_method = 'submeter' where id = $1`, [o.buildingId]);
    });
  });

  it("a bill is paid only when a payment succeeds; pending and failed never mark it paid", async () => {
    const conn = await db.as(o.id, (q) => q<{ id: string }>(`select id from public.electricity_connections`));
    const bill = await db.service((q) => q<{ id: string }>(
      `insert into public.electricity_bills (owner_id, building_id, connection_id, bill_month, amount, source)
       values ($1, $2, $3, '2026-12-01', 18500, 'mock') returning id`, [o.id, o.buildingId, conn[0].id]));
    const status = async () => (await db.as(o.id, (q) => q<{ status: string; is_mock: boolean }>(`select status, is_mock from public.electricity_bills where id = $1`, [bill[0].id])))[0];
    expect(await status()).toMatchObject({ status: "unpaid", is_mock: true });

    const p1 = await db.service((q) => q<{ id: string }>(
      `insert into public.electricity_payments (owner_id, building_id, bill_id, amount, provider, status)
       values ($1, $2, $3, 18500, 'mock', 'pending') returning id`, [o.id, o.buildingId, bill[0].id]));
    expect((await status()).status).toBe("payment_pending");
    // a second payment cannot start while one is in flight
    await expectDbError(db.service((q) => q(
      `insert into public.electricity_payments (owner_id, building_id, bill_id, amount, provider, status)
       values ($1, $2, $3, 18500, 'mock', 'initiated')`, [o.id, o.buildingId, bill[0].id])), "unique");
    await db.service((q) => q(`update public.electricity_payments set status = 'failed' where id = $1`, [p1[0].id]));
    expect((await status()).status).toBe("unpaid");

    const p2 = await db.service((q) => q<{ id: string }>(
      `insert into public.electricity_payments (owner_id, building_id, bill_id, amount, provider, status)
       values ($1, $2, $3, 18500, 'mock', 'unknown') returning id`, [o.id, o.buildingId, bill[0].id]));
    expect((await status()).status).toBe("payment_pending");
    await db.service((q) => q(`update public.electricity_payments set status = 'success' where id = $1`, [p2[0].id]));
    expect((await status()).status).toBe("paid");
  });
});

describe("whatsapp queue", () => {
  it("the same reminder cannot be queued twice and a worker claims each message once", async () => {
    const t = await db.as(o.id, (q) => q<{ id: string }>(`select id from public.tenants limit 1`));
    const insert = () => db.service((q) => q(
      `insert into public.whatsapp_messages (owner_id, building_id, tenant_id, period_month, to_phone, template_name, body_preview, dedupe_key)
       values ($1, $2, $3, '2026-12-01', '919811111111', 'rent_reminder', 'Namaste', $4)`, [o.id, o.buildingId, t[0].id, `${t[0].id}:2026-12-01:2026-12-10`]));
    await insert();
    await expectDbError(insert(), "unique");
    const c1 = await db.service((q) => q(`select id from public.claim_whatsapp_messages(10, null)`));
    const c2 = await db.service((q) => q(`select id from public.claim_whatsapp_messages(10, null)`));
    expect(c1).toHaveLength(1);
    expect(c2).toHaveLength(0);
    await expectDbError(db.as(o.id, (q) => q(`select public.claim_whatsapp_messages(10, null)`)), "permission denied");
    const seen = await db.as(o.id, (q) => q(`select status from public.whatsapp_messages`));
    expect(seen[0].status).toBe("sending");
  });
});
