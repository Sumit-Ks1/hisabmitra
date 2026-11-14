import { describe, expect, it } from "vitest";
import { createDb } from "./harness";

describe("migrations", () => {
  it("apply cleanly on a fresh database", async () => {
    const db = await createDb();
    const rows = await db.root<{ n: number }>(`select count(*)::int as n from pg_tables where schemaname = 'public'`);
    expect(rows[0].n).toBeGreaterThanOrEqual(24);
    const noRls = await db.root(`select tablename from pg_tables where schemaname = 'public' and not rowsecurity`);
    expect(noRls).toEqual([]);
  });
});
