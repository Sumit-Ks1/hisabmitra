import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { whatsappCredentialsPresent } from "@/lib/env";
import { createAdminClient, serviceRoleAvailable } from "@/lib/supabase/server";
import { failStuckMessages, processWhatsappQueue } from "@/lib/whatsapp/queue";

export const maxDuration = 60;

/**
 * Daily housekeeping (see vercel.json):
 *  - expire subscriptions and warn owners 5 days before expiry
 *  - create the month's invoices for every active building (idempotent, so
 *    owners who do not open the app still get correct dues)
 *  - retry queued WhatsApp messages
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!serviceRoleAvailable) return NextResponse.json({ error: "service role not configured" }, { status: 503 });

  const admin = createAdminClient();
  const { data: maintenance, error } = await admin.rpc("run_daily_maintenance");
  if (error) return NextResponse.json({ error: "maintenance failed" }, { status: 500 });

  const { data: buildings } = await admin.from("buildings").select("id").eq("status", "active").limit(5000);
  let invoices = 0;
  let billingErrors = 0;
  for (const b of buildings ?? []) {
    const res = await admin.rpc("ensure_billing", { p_building: b.id, p_force: false });
    if (res.error) billingErrors++;
    else invoices += Number(res.data ?? 0);
  }

  let whatsapp = null;
  if (whatsappCredentialsPresent) {
    const stuck = await failStuckMessages();
    whatsapp = { stuck, ...(await processWhatsappQueue({ limit: 50, budgetMs: 20_000 })) };
  }
  return NextResponse.json({ ok: true, maintenance, buildings: buildings?.length ?? 0, invoices, billingErrors, whatsapp });
}
