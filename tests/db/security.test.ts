import { beforeAll, describe, expect, it } from "vitest";
import { ONBOARDING, approvedOwner, createDb, expectDbError, makeAdmin, type Db } from "./harness";

let db: Db;
let admin: string;
let a: { id: string; buildingId: string; amount: number };
let b: { id: string; buildingId: string; amount: number };
let aTenant: string;
let aBed: string;
let aRoom: string;

beforeAll(async () => {
  db = await createDb();
  await db.setToday("2026-11-20");
  admin = await makeAdmin(db);
  a = await approvedOwner(db, admin, "a@test.in", "UPIREFAAA111", 20);
  b = await approvedOwner(db, admin, "b@test.in", "UPIREFBBB222", 10);

  await db.as(a.id, async (q) => {
    const room = await q<{ id: string }>(`select public.add_room($1, 1, '101', 'shared', 2, 8000, 5000, null) as id`, [a.buildingId]);
    aRoom = room[0].id;
    const beds = await q<{ id: string }>(`select id from public.beds where room_id = $1 order by label`, [aRoom]);
    aBed = beds[0].id;
    const t = await q<{ id: string }>(`select public.create_tenant($1::jsonb) as id`, [JSON.stringify({
      building_id: a.buildingId, full_name: "Rahul Sharma", phone: "9811111111", joined_on: "2026-11-01",
      monthly_rent: 8000, security_deposit: 5000, bed_id: aBed, whatsapp_opt_in: true,
    })]);
    aTenant = t[0].id;
    await q(`insert into public.tenant_documents (owner_id, building_id, tenant_id, doc_type, file_name, storage_path, mime_type, size_bytes)
             values ($1, $2, $3, 'aadhaar', 'a.pdf', $4, 'application/pdf', 1000)`,
      [a.id, a.buildingId, aTenant, `${a.id}/${aTenant}/a.pdf`]);
    await q(`update public.buildings set electricity_rate = 8 where id = $1`, [a.buildingId]);
    await q(`select public.save_meter_reading($1, 120, '2026-11-20')`, [aRoom]);
    await q(`select public.record_payment($1, null, 3000, '2026-11-05', 'cash', null, null, 'rent', 'key-aaaa-0001')`, [aTenant]);
  });
  await db.root(`insert into storage.objects (bucket_id, name) values ('tenant-documents', $1)`, [`${a.id}/${aTenant}/a.pdf`]);
});

describe("roles and admin protection", () => {
  it("new users are always pg_owner, never admin", async () => {
    const id = await db.createUser("someone@test.in");
    const rows = await db.root(`select role from public.profiles where id = $1`, [id]);
    expect(rows[0].role).toBe("pg_owner");
  });

  it("a user cannot make themselves admin", async () => {
    await expectDbError(db.as(a.id, (q) => q(`update public.profiles set role = 'admin' where id = $1`, [a.id])), /permission denied|ROLE_CHANGE/);
    const rows = await db.root(`select role from public.profiles where id = $1`, [a.id]);
    expect(rows[0].role).toBe("pg_owner");
  });

  it("bootstrap_admin is not callable by API users", async () => {
    await expectDbError(db.as(a.id, (q) => q(`select public.bootstrap_admin('a@test.in')`)), "permission denied");
    await expectDbError(db.anon((q) => q(`select public.bootstrap_admin('a@test.in')`)), "permission denied");
  });

  it("bootstrap_admin refuses an unverified email", async () => {
    const id = await db.createUser("unverified@test.in", { verified: false });
    const res = await db.service((q) => q<{ ok: boolean }>(`select public.bootstrap_admin('unverified@test.in') as ok`));
    expect(res[0].ok).toBe(false);
    const rows = await db.root(`select role from public.profiles where id = $1`, [id]);
    expect(rows[0].role).toBe("pg_owner");
  });

  it("owners cannot run admin operations", async () => {
    await expectDbError(db.as(a.id, (q) => q(`select public.admin_review_owner($1, 'approve', null)`, [a.id])), "FORBIDDEN");
    await expectDbError(db.as(a.id, (q) => q(`select public.admin_update_owner_limits($1, 50, null, null)`, [a.id])), "FORBIDDEN");
    await expectDbError(db.as(a.id, (q) => q(`update public.app_settings set value = '{"price_per_room": 1}' where key = 'pricing'`)), /row-level security|permission denied/i).catch(async () => {
      // an UPDATE filtered by RLS succeeds with 0 rows — verify nothing changed
      const rows = await db.root<{ v: number }>(`select (value ->> 'price_per_room')::int as v from public.app_settings where key = 'pricing'`);
      expect(rows[0].v).toBe(50);
    });
    await expectDbError(db.as(a.id, (q) => q(`update public.pg_owners set building_limit = 99 where id = $1`, [a.id])), "permission denied");
  });

  it("owners cannot read the audit log or other profiles", async () => {
    const logs = await db.as(a.id, (q) => q(`select * from public.admin_audit_logs`));
    expect(logs).toEqual([]);
    const profiles = await db.as(a.id, (q) => q(`select id from public.profiles`));
    expect(profiles.map((p) => p.id)).toEqual([a.id]);
  });

  it("admin actions are written to the audit log", async () => {
    const logs = await db.as(admin, (q) => q<{ action: string }>(`select action from public.admin_audit_logs where owner_id = $1`, [a.id]));
    const actions = logs.map((l) => l.action);
    expect(actions).toContain("payment.verified");
    expect(actions).toContain("owner.approve");
    expect(actions).toContain("owner.payment_submitted");
  });

  it("anon sees only public settings", async () => {
    const rows = await db.anon((q) => q<{ key: string }>(`select key from public.app_settings order by key`));
    expect(rows.map((r) => r.key)).toEqual(["pricing", "support"]);
    await expectDbError(db.anon((q) => q(`select * from public.tenants`)), "permission denied");
  });
});

describe("onboarding, pricing and approval", () => {
  it("price is computed by the database (₹50 × rooms), not by the client", async () => {
    expect(a.amount).toBe(1000);
    expect(b.amount).toBe(500);
    const id = await db.createUser("price@test.in");
    const payload = { ...ONBOARDING(30), amount: 1, price_per_room: 0 };
    const res = await db.as(id, (q) => q<{ r: { amount: number } }>(`select public.submit_onboarding($1::jsonb) as r`, [JSON.stringify(payload)]));
    expect(Number(res[0].r.amount)).toBe(1500);
  });

  it("submitting a reference does not approve the account", async () => {
    const id = await db.createUser("pending@test.in");
    await db.as(id, (q) => q(`select public.submit_onboarding($1::jsonb)`, [JSON.stringify(ONBOARDING(10))]));
    await db.as(id, (q) => q(`select public.submit_payment('PENDINGREF001', private.today())`));
    const rows = await db.root(`select status from public.pg_owners where id = $1`, [id]);
    expect(rows[0].status).toBe("submitted");
    // not approved → no tenant management
    const bld = await db.root<{ id: string }>(`select id from public.buildings where owner_id = $1`, [id]);
    await expectDbError(db.as(id, (q) => q(`select public.add_room($1, 1, '101', 'shared', 2, 5000, 0, null)`, [bld[0].id])), "row-level security");
    // admin cannot approve before the payment is verified
    await expectDbError(db.as(admin, (q) => q(`select public.admin_review_owner($1, 'approve', null)`, [id])), "PAYMENT_NOT_VERIFIED");
  });

  it("the same UPI reference cannot be used twice, even by another owner", async () => {
    const id = await db.createUser("dup@test.in");
    await db.as(id, (q) => q(`select public.submit_onboarding($1::jsonb)`, [JSON.stringify(ONBOARDING(10))]));
    await expectDbError(db.as(id, (q) => q(`select public.submit_payment('upi ref aaa 111', private.today())`)), "DUPLICATE_REFERENCE");
  });

  it("rejection needs a reason, is shown to the owner, and allows resubmission", async () => {
    const id = await db.createUser("reject@test.in");
    await db.as(id, (q) => q(`select public.submit_onboarding($1::jsonb)`, [JSON.stringify(ONBOARDING(10))]));
    await db.as(id, (q) => q(`select public.submit_payment('REJECTREF0001', private.today())`));
    await expectDbError(db.as(admin, (q) => q(`select public.admin_review_owner($1, 'reject', '')`, [id])), "REASON_REQUIRED");
    await db.as(admin, (q) => q(`select public.admin_review_owner($1, 'reject', 'Address is incomplete')`, [id]));
    const own = await db.as(id, (q) => q(`select status, review_note from public.pg_owners`));
    expect(own[0]).toMatchObject({ status: "rejected", review_note: "Address is incomplete" });
    // owner corrects details → goes back to the queue because the payment claim is still on file
    const res = await db.as(id, (q) => q<{ r: { awaiting_payment: boolean } }>(`select public.submit_onboarding($1::jsonb) as r`, [JSON.stringify(ONBOARDING(10, "Corrected PG"))]));
    expect(res[0].r.awaiting_payment).toBe(false);
    const after = await db.root(`select status from public.pg_owners where id = $1`, [id]);
    expect(after[0].status).toBe("submitted");
    const blds = await db.root(`select name from public.buildings where owner_id = $1`, [id]);
    expect(blds).toHaveLength(1);
    expect(blds[0].name).toBe("Corrected PG");
  });

  it("approval activates the subscription and notifies the owner", async () => {
    const sub = await db.as(a.id, (q) => q(`select status, expires_on::text, starts_on::text from public.building_subscriptions`));
    expect(sub[0]).toMatchObject({ status: "active", starts_on: "2026-11-20", expires_on: "2026-12-20" });
    const notes = await db.as(a.id, (q) => q<{ title: string }>(`select title from public.notifications`));
    expect(notes.map((n) => n.title)).toContain("Account approved");
  });

  it("an approved owner cannot re-run onboarding to change room count", async () => {
    await expectDbError(db.as(a.id, (q) => q(`select public.submit_onboarding($1::jsonb)`, [JSON.stringify(ONBOARDING(500))])), "ONBOARDING_LOCKED");
    await expectDbError(db.as(a.id, (q) => q(`update public.buildings set rooms_count = 500 where id = $1`, [a.buildingId])), "permission denied");
  });

  it("building limit is enforced server-side and can be raised by the admin", async () => {
    const payload = JSON.stringify({ name: "Second PG", address: "x", city: "Meerut", rooms_count: 5, floors_count: 1 });
    await expectDbError(db.as(a.id, (q) => q(`select public.add_building($1::jsonb)`, [payload])), "BUILDING_LIMIT_REACHED");
    await expectDbError(db.as(a.id, (q) => q(`insert into public.buildings (owner_id, name, rooms_count) values ($1, 'Sneaky', 5)`, [a.id])), "permission denied");
    await db.as(admin, (q) => q(`select public.admin_update_owner_limits($1, 2, null, null)`, [a.id]));
    const res = await db.as(a.id, (q) => q<{ id: string }>(`select public.add_building($1::jsonb) as id`, [payload]));
    expect(res[0].id).toBeTruthy();
    await expectDbError(db.as(a.id, (q) => q(`select public.add_building($1::jsonb)`, [payload])), "BUILDING_LIMIT_REACHED");
  });

  it("room limit follows the paid subscription", async () => {
    const rooms = Array.from({ length: 10 }, (_, i) => ({ floor: 1, name: `B${i + 1}`, room_type: "shared", beds: 1, rent: 5000, deposit: 0 }));
    await db.as(b.id, (q) => q(`select public.bulk_add_rooms($1, $2::jsonb)`, [b.buildingId, JSON.stringify(rooms)]));
    await expectDbError(db.as(b.id, (q) => q(`select public.add_room($1, 1, 'B11', 'shared', 1, 5000, 0, null)`, [b.buildingId])), "ROOM_LIMIT_REACHED");
  });

  it("a suspended owner loses write access immediately", async () => {
    const s = await approvedOwner(db, admin, "susp@test.in", "SUSPREF00001", 5);
    await db.as(admin, (q) => q(`select public.admin_review_owner($1, 'suspend', 'Subscription unpaid')`, [s.id]));
    await expectDbError(db.as(s.id, (q) => q(`select public.add_room($1, 1, '101', 'shared', 1, 5000, 0, null)`, [s.buildingId])), "row-level security");
    await db.as(admin, (q) => q(`select public.admin_review_owner($1, 'reactivate', null)`, [s.id]));
    await db.as(s.id, (q) => q(`select public.add_room($1, 1, '101', 'shared', 1, 5000, 0, null)`, [s.buildingId]));
  });
});

describe("cross-owner isolation (Owner B attacking Owner A)", () => {
  const tables = [
    "buildings", "floors", "rooms", "beds", "tenants", "tenant_billing_preferences", "tenant_documents",
    "room_allocations", "billing_cycles", "invoices", "invoice_items", "rent_payments",
    "electricity_connections", "electricity_meter_readings", "whatsapp_consents", "building_subscriptions",
    "payment_submissions",
  ];

  it("owner A really has data in every table (so the checks below mean something)", async () => {
    for (const t of tables) {
      const rows = await db.as(a.id, (q) => q(`select 1 from public.${t} where owner_id = $1`, [a.id]));
      expect(rows.length, t).toBeGreaterThan(0);
    }
  });

  it.each(tables)("B cannot read A's %s", async (t) => {
    const rows = await db.as(b.id, (q) => q(`select 1 from public.${t} where owner_id = $1`, [a.id]));
    expect(rows).toEqual([]);
  });

  it("B cannot read A's data through the views", async () => {
    for (const v of ["v_rooms", "v_invoices", "v_tenant_balances"]) {
      const rows = await db.as(b.id, (q) => q(`select 1 from public.${v} where owner_id = $1`, [a.id]));
      expect(rows, v).toEqual([]);
    }
  });

  it("B cannot fetch A's rows by guessing UUIDs", async () => {
    expect(await db.as(b.id, (q) => q(`select * from public.tenants where id = $1`, [aTenant]))).toEqual([]);
    expect(await db.as(b.id, (q) => q(`select * from public.buildings where id = $1`, [a.buildingId]))).toEqual([]);
  });

  it("B cannot modify or delete A's rows", async () => {
    await db.as(b.id, (q) => q(`update public.tenants set full_name = 'Hacked' where id = $1`, [aTenant]));
    await db.as(b.id, (q) => q(`update public.rooms set monthly_rent = 1 where id = $1`, [aRoom]));
    await db.as(b.id, (q) => q(`delete from public.tenant_documents where tenant_id = $1`, [aTenant]));
    const t = await db.root(`select full_name from public.tenants where id = $1`, [aTenant]);
    expect(t[0].full_name).toBe("Rahul Sharma");
    const r = await db.root(`select monthly_rent::int as rent from public.rooms where id = $1`, [aRoom]);
    expect(r[0].rent).toBe(8000);
    const d = await db.root(`select 1 from public.tenant_documents where tenant_id = $1`, [aTenant]);
    expect(d).toHaveLength(1);
  });

  it("B cannot insert rows into A's building, or rows that claim to be A's", async () => {
    await expectDbError(db.as(b.id, (q) => q(
      `insert into public.tenants (owner_id, building_id, full_name, phone, joined_on, billing_from, monthly_rent)
       values ($1, $2, 'Intruder', '9800000000', '2026-11-01', '2026-11-01', 1)`, [a.id, a.buildingId])), "row-level security");
    // own owner_id but A's building → composite foreign key refuses it
    await expectDbError(db.as(b.id, (q) => q(
      `insert into public.tenants (owner_id, building_id, full_name, phone, joined_on, billing_from, monthly_rent)
       values ($1, $2, 'Intruder', '9800000000', '2026-11-01', '2026-11-01', 1)`, [b.id, a.buildingId])), "foreign key");
  });

  it("B cannot use RPCs on A's records", async () => {
    await expectDbError(db.as(b.id, (q) => q(`select public.add_room($1, 1, 'X1', 'shared', 1, 1, 0, null)`, [a.buildingId])), "NOT_FOUND");
    await expectDbError(db.as(b.id, (q) => q(`select public.generate_invoices($1, '2026-11-01')`, [a.buildingId])), "NOT_FOUND");
    await expectDbError(db.as(b.id, (q) => q(`select public.record_payment($1, null, 100, '2026-11-05', 'cash', null, null, 'rent', 'key-bbbb-0001')`, [aTenant])), "NOT_FOUND");
    await expectDbError(db.as(b.id, (q) => q(`select public.vacate_tenant($1, '2026-11-20', true)`, [aTenant])), "NOT_FOUND");
    await expectDbError(db.as(b.id, (q) => q(`select public.save_meter_reading($1, 999, '2026-11-20')`, [aRoom])), "NOT_FOUND");
    const aReading = await db.as(a.id, (q) => q<{ id: string }>(`select id from public.electricity_meter_readings where room_id = $1`, [aRoom]));
    await expectDbError(db.as(b.id, (q) => q(`select public.delete_meter_reading($1)`, [aReading[0].id])), "NOT_FOUND");
    await expectDbError(db.as(b.id, (q) => q(`select public.save_meter_reading($1, 999, '2026-11-20', null, false, null, null, $2)`, [aRoom, aReading[0].id])), "NOT_FOUND");
    await expectDbError(db.as(b.id, (q) => q(`select public.confirm_electricity_charges($1, '2026-11-01', '[]'::jsonb)`, [a.buildingId])), "NOT_FOUND");
  });

  it("B cannot move one of their tenants into A's bed", async () => {
    const bBed = await db.as(b.id, (q) => q<{ id: string }>(`select id from public.beds limit 1`));
    const bt = await db.as(b.id, (q) => q<{ id: string }>(`select public.create_tenant($1::jsonb) as id`, [JSON.stringify({
      building_id: b.buildingId, full_name: "B Tenant", phone: "9822222222", joined_on: "2026-11-01", monthly_rent: 5000, bed_id: bBed[0].id,
    })]));
    await expectDbError(db.as(b.id, (q) => q(`select public.allocate_bed($1, $2, null)`, [bt[0].id, aBed])), "NOT_FOUND");
    await expectDbError(db.as(b.id, (q) => q(`select public.swap_beds($1, $2, null)`, [bt[0].id, aTenant])), "TENANT_NOT_ALLOCATED");
  });

  it("B cannot see or delete A's stored files, nor upload into A's folder", async () => {
    expect(await db.as(b.id, (q) => q(`select * from storage.objects`))).toEqual([]);
    await db.as(b.id, (q) => q(`delete from storage.objects where name like $1`, [`${a.id}/%`]));
    expect(await db.root(`select 1 from storage.objects`)).toHaveLength(1);
    await expectDbError(db.as(b.id, (q) => q(`insert into storage.objects (bucket_id, name) values ('tenant-documents', $1)`, [`${a.id}/x/evil.pdf`])), "row-level security");
    expect(await db.as(a.id, (q) => q(`select * from storage.objects`))).toHaveLength(1);
  });

  it("a document row cannot point outside the owner's own folder", async () => {
    await expectDbError(db.as(b.id, async (q) => {
      const t = await q<{ id: string }>(`select id from public.tenants limit 1`);
      await q(`insert into public.tenant_documents (owner_id, building_id, tenant_id, file_name, storage_path, mime_type, size_bytes)
               values ($1, $2, $3, 'x.pdf', $4, 'application/pdf', 10)`, [b.id, b.buildingId, t[0].id, `${a.id}/${aTenant}/a.pdf`]);
    }), /check constraint|unique/);
  });

  it("the admin cannot read tenant personal data or ledgers", async () => {
    for (const t of ["tenants", "tenant_documents", "invoices", "rent_payments", "whatsapp_consents"]) {
      expect(await db.as(admin, (q) => q(`select 1 from public.${t}`)), t).toEqual([]);
    }
    expect((await db.as(admin, (q) => q(`select 1 from public.buildings`))).length).toBeGreaterThan(1);
  });

  it("owners cannot forge provider bills, bill payments or WhatsApp messages", async () => {
    const conn = await db.as(a.id, (q) => q<{ id: string }>(`select id from public.electricity_connections`));
    await expectDbError(db.as(a.id, (q) => q(
      `insert into public.electricity_bills (owner_id, building_id, connection_id, bill_month, amount, source)
       values ($1, $2, $3, '2026-11-01', 100, 'setu')`, [a.id, a.buildingId, conn[0].id])), "row-level security");
    await db.as(a.id, (q) => q(
      `insert into public.electricity_bills (owner_id, building_id, connection_id, bill_month, amount, source)
       values ($1, $2, $3, '2026-11-01', 18500, 'manual')`, [a.id, a.buildingId, conn[0].id]));
    const bill = await db.as(a.id, (q) => q<{ id: string }>(`select id from public.electricity_bills`));
    await expectDbError(db.as(a.id, (q) => q(`update public.electricity_bills set status = 'paid' where id = $1`, [bill[0].id])), "permission denied");
    await expectDbError(db.as(a.id, (q) => q(
      `insert into public.electricity_payments (owner_id, building_id, bill_id, amount, provider, status)
       values ($1, $2, $3, 18500, 'manual', 'success')`, [a.id, a.buildingId, bill[0].id])), "permission denied");
    await expectDbError(db.as(a.id, (q) => q(
      `insert into public.whatsapp_messages (owner_id, building_id, tenant_id, period_month, to_phone, template_name, body_preview, dedupe_key)
       values ($1, $2, $3, '2026-11-01', '919811111111', 't', 'x', 'k')`, [a.id, a.buildingId, aTenant])), "permission denied");
  });
});
