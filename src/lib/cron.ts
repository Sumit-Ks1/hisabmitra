import "server-only";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/** Cron endpoints accept only `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron sends). */
export function isAuthorizedCron(request: Request): boolean {
  const secret = serverEnv.cronSecret;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
