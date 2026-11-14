import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { createAdminClient, serviceRoleAvailable } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/whatsapp/provider";

/** Meta's one-time webhook verification handshake. */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const expected = serverEnv.whatsapp.webhookVerifyToken;
  const given = p.get("hub.verify_token") ?? "";
  const ok =
    Boolean(expected) &&
    p.get("hub.mode") === "subscribe" &&
    given.length === expected!.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected!));
  if (!ok) return new NextResponse("forbidden", { status: 403 });
  return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
}

type Status = { id?: string; status?: string; errors?: { title?: string; message?: string }[] };

// a status may only move forward; "failed" is final unless it was already delivered/read
const ALLOWED_FROM: Record<string, string[]> = {
  sent: ["queued", "sending"],
  delivered: ["queued", "sending", "sent"],
  read: ["queued", "sending", "sent", "delivered"],
  failed: ["queued", "sending", "sent"],
};

/** Delivery receipts from Meta. Only signed requests are accepted. */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("invalid signature", { status: 401 });
  }
  if (!serviceRoleAvailable) return NextResponse.json({ ok: true });

  let body: { entry?: { changes?: { value?: { statuses?: Status[] } }[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }

  const admin = createAdminClient();
  const statuses = (body.entry ?? []).flatMap((e) => e.changes ?? []).flatMap((c) => c.value?.statuses ?? []);
  for (const s of statuses.slice(0, 200)) {
    const from = s.status ? ALLOWED_FROM[s.status] : undefined;
    if (!s.id || !from) continue;
    const error = s.status === "failed" ? (s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? "Delivery failed").slice(0, 300) : null;
    await admin.from("whatsapp_messages").update({ status: s.status, error }).eq("provider_message_id", s.id).in("status", from);
  }
  // Always 200 once the signature is valid, so Meta does not retry endlessly.
  return NextResponse.json({ ok: true });
}
