import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

export type Row = Record<string, unknown>;
export type Q = <T extends Row = Row>(sql: string, params?: unknown[]) => Promise<T[]>;

export type Db = {
  pg: PGlite;
  /** superuser — test setup only */
  root: Q;
  /** run as an authenticated API user (RLS enforced) */
  as: <T>(userId: string, fn: (q: Q) => Promise<T>) => Promise<T>;
  /** run as anon */
  anon: <T>(fn: (q: Q) => Promise<T>) => Promise<T>;
  /** run as the service role (server-side only in the real app) */
  service: <T>(fn: (q: Q) => Promise<T>) => Promise<T>;
  createUser: (email: string, opts?: { verified?: boolean; name?: string }) => Promise<string>;
  setToday: (isoDate: string) => Promise<void>;
};

const migrationFiles = () => readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();

/** Applies one migration file (by name prefix, e.g. "0008") to an existing test database. */
export async function applyMigration(db: Db, prefix: string): Promise<void> {
  const file = migrationFiles().find((f) => f.startsWith(prefix));
  if (!file) throw new Error(`No migration ${prefix}`);
  await db.pg.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
}

/**
 * A fresh in-process Postgres with the Supabase shim and the migrations.
 * `before: "0008"` stops before that migration — for testing upgrades of existing data.
 */
export async function createDb(opts: { before?: string } = {}): Promise<Db> {
  const pg = new PGlite();
  await pg.exec(readFileSync(join(process.cwd(), "tests", "db", "shim.sql"), "utf8"));
  for (const file of migrationFiles()) {
    if (opts.before && file >= opts.before) break;
    try {
      await pg.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
    }
  }

  const root: Q = async (sql, params) => (await pg.query(sql, params)).rows as never;

  async function withRole<T>(role: string, sub: string, fn: (q: Q) => Promise<T>): Promise<T> {
    await pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub]);
    await pg.exec(`set role ${role}`);
    try {
      return await fn(root);
    } finally {
      await pg.exec("reset role");
      await pg.query(`select set_config('request.jwt.claim.sub', '', false)`);
    }
  }

  return {
    pg,
    root,
    as: (userId, fn) => withRole("authenticated", userId, fn),
    anon: (fn) => withRole("anon", "", fn),
    service: (fn) => withRole("service_role", "", fn),
    async createUser(email, opts = {}) {
      const rows = await root<{ id: string }>(
        `insert into auth.users (email, email_confirmed_at, raw_user_meta_data)
         values ($1, $2, $3) returning id`,
        [email, opts.verified === false ? null : new Date().toISOString(), JSON.stringify({ full_name: opts.name ?? "Test User" })],
      );
      return rows[0].id;
    },
    async setToday(isoDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error("bad date");
      await pg.exec(
        `create or replace function private.today() returns date language sql stable as $$ select '${isoDate}'::date $$`,
      );
    },
  };
}

/** Asserts the promise rejects with a Postgres error whose message contains `code`. */
export async function expectDbError(p: Promise<unknown>, code: string | RegExp): Promise<void> {
  try {
    await p;
  } catch (e) {
    const msg = (e as Error).message;
    if (typeof code === "string" ? msg.includes(code) : code.test(msg)) return;
    throw new Error(`Expected error ${code}, got: ${msg}`);
  }
  throw new Error(`Expected error ${code}, but the statement succeeded`);
}

export const ONBOARDING = (rooms = 20, name = "Shanti PG") => ({
  owner: { full_name: "Owner", phone: "9876543210", whatsapp: "", language: "hinglish" },
  building: {
    name, address: "12 Civil Lines", state: "Uttar Pradesh", city: "Meerut", pincode: "250001",
    floors_count: 2, rooms_count: rooms, beds_count: rooms * 2, pg_type: "boys", description: "",
  },
  electricity: { discom: "PVVNL", consumer_number: "1234567890", connection_type: "", meter_number: "", billing_cycle: "" },
});

/** Creates an owner, runs the whole onboarding + admin approval path, returns ids. */
export async function approvedOwner(db: Db, adminId: string, email: string, ref: string, rooms = 20) {
  const id = await db.createUser(email);
  const res = await db.as(id, (q) => q<{ r: { building_id: string; amount: number } }>(
    `select public.submit_onboarding($1::jsonb) as r`, [JSON.stringify(ONBOARDING(rooms, `PG ${email}`))]));
  const buildingId = res[0].r.building_id;
  const pay = await db.as(id, (q) => q<{ id: string }>(`select public.submit_payment($1, private.today()) as id`, [ref]));
  await db.as(adminId, (q) => q(`select public.admin_review_payment($1, true, null)`, [pay[0].id]));
  await db.as(adminId, (q) => q(`select public.admin_review_owner($1, 'approve', null)`, [id]));
  return { id, buildingId, amount: Number(res[0].r.amount) };
}

export async function makeAdmin(db: Db, email = "admin@hisabmitra.test") {
  const id = await db.createUser(email);
  await db.service((q) => q(`select public.bootstrap_admin($1)`, [email]));
  return id;
}
