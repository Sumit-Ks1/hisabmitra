import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { whatsappCredentialsPresent } from "@/lib/env";
import { serviceRoleAvailable } from "@/lib/supabase/server";
import { failStuckMessages, processWhatsappQueue } from "@/lib/whatsapp/queue";

export const maxDuration = 60;

/**
 * Drains a batch of the WhatsApp queue. Call it every few minutes from any
 * scheduler (Vercel Cron on a paid plan, Supabase pg_cron + pg_net, cron-job.org…).
 * Safe to call concurrently: messages are claimed atomically.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceRoleAvailable || !whatsappCredentialsPresent) return NextResponse.json({ ok: true, skipped: "whatsapp not configured" });
  const stuck = await failStuckMessages();
  const result = await processWhatsappQueue({ limit: 50, budgetMs: 25_000 });
  return NextResponse.json({ ok: true, stuck, ...result });
}
