import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { sendTemplateMessage } from "./provider";

const MAX_ATTEMPTS = 3;

type Claimed = {
  id: string;
  to_phone: string;
  template_name: string;
  template_params: string[];
  attempts: number;
};

export type QueueResult = { sent: number; failed: number; requeued: number };

/**
 * Sends a small batch of queued reminders.
 *
 * Serverless requests cannot be trusted to run for long, so this never tries to
 * drain the queue: it claims a bounded batch (atomically, so two workers cannot
 * take the same message), stops before `budgetMs`, and leaves the rest for the
 * next run (the cron route calls it again). A message is marked "sent" only
 * after Meta has accepted it.
 */
export async function processWhatsappQueue(opts: { ownerId?: string; limit?: number; budgetMs?: number } = {}): Promise<QueueResult> {
  const admin = createAdminClient();
  const deadline = Date.now() + (opts.budgetMs ?? 8000);
  const result: QueueResult = { sent: 0, failed: 0, requeued: 0 };

  const { data, error } = await admin.rpc("claim_whatsapp_messages", {
    p_limit: opts.limit ?? 20,
    p_owner: opts.ownerId ?? null,
  });
  if (error) throw new Error(error.message);
  const batch = (data ?? []) as Claimed[];

  for (let i = 0; i < batch.length; i++) {
    const msg = batch[i];
    if (Date.now() > deadline) {
      // out of time: hand the untouched ones back without counting an attempt
      const rest = batch.slice(i).map((m) => m.id);
      await admin.from("whatsapp_messages").update({ status: "queued" }).in("id", rest).eq("status", "sending");
      result.requeued += rest.length;
      break;
    }

    const res = await sendTemplateMessage({
      to: msg.to_phone,
      templateName: msg.template_name,
      params: msg.template_params,
    });

    if (res.ok) {
      await admin
        .from("whatsapp_messages")
        .update({ status: "sent", provider_message_id: res.messageId, sent_at: new Date().toISOString(), error: null })
        .eq("id", msg.id);
      result.sent++;
    } else if (res.retryable && msg.attempts < MAX_ATTEMPTS) {
      const delayMin = 2 ** msg.attempts * 5; // 10, 20 minutes…
      await admin
        .from("whatsapp_messages")
        .update({
          status: "queued",
          error: res.error,
          next_attempt_at: new Date(Date.now() + delayMin * 60_000).toISOString(),
        })
        .eq("id", msg.id);
      result.requeued++;
    } else {
      await admin.from("whatsapp_messages").update({ status: "failed", error: res.error }).eq("id", msg.id);
      result.failed++;
    }
  }
  return result;
}

/**
 * A worker that died mid-send leaves rows in "sending". We do not know whether
 * Meta received them, so they are marked failed (never silently re-sent, never
 * shown as sent). The owner can send again tomorrow or copy the message.
 */
export async function failStuckMessages(): Promise<number> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data } = await admin
    .from("whatsapp_messages")
    .update({ status: "failed", error: "Sending was interrupted — delivery not confirmed" })
    .eq("status", "sending")
    .lt("updated_at", cutoff)
    .select("id");
  return data?.length ?? 0;
}
