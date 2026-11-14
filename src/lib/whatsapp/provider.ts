import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { IntegrationSettings } from "@/lib/db-types";
import { serverEnv, whatsappCredentialsPresent } from "@/lib/env";
import { serviceRoleAvailable } from "@/lib/supabase/server";

/**
 * Official Meta WhatsApp Business Platform (Cloud API) only.
 * No WhatsApp Web automation, no scraping, no unofficial gateways.
 */

export type WhatsappState =
  | { live: true }
  | { live: false; reason: "disabled_by_admin" | "missing_credentials" | "missing_service_key" };

/** Messages are sent only when the admin switch is on AND credentials + an approved template exist. */
export function whatsappState(setting: IntegrationSettings["whatsapp"] | undefined): WhatsappState {
  if (!whatsappCredentialsPresent) return { live: false, reason: "missing_credentials" };
  if (!serviceRoleAvailable) return { live: false, reason: "missing_service_key" };
  if (setting !== "live") return { live: false, reason: "disabled_by_admin" };
  return { live: true };
}

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; retryable: boolean };

// Meta error codes that mean "slow down / try later" rather than "this will never work".
const RETRYABLE_CODES = new Set([4, 80007, 130429, 131016, 131048, 131056, 133016]);

/** Sends one pre-approved template message. `to` is digits only, with country code. */
export async function sendTemplateMessage(input: {
  to: string;
  templateName: string;
  params: string[];
}): Promise<SendResult> {
  const { phoneNumberId, accessToken, templateLanguage, graphVersion } = serverEnv.whatsapp;
  if (!phoneNumberId || !accessToken) return { ok: false, error: "WhatsApp is not configured", retryable: false };

  let res: Response;
  try {
    res = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to,
        type: "template",
        template: {
          name: input.templateName,
          language: { code: templateLanguage },
          components: [{ type: "body", parameters: input.params.map((text) => ({ type: "text", text })) }],
        },
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Could not reach WhatsApp", retryable: true };
  }

  const json = (await res.json().catch(() => null)) as
    | { messages?: { id: string }[]; error?: { message?: string; code?: number } }
    | null;

  const id = json?.messages?.[0]?.id;
  if (res.ok && id) return { ok: true, messageId: id };

  const code = json?.error?.code;
  const retryable = res.status === 429 || res.status >= 500 || (code !== undefined && RETRYABLE_CODES.has(code));
  // Meta's message is safe to store (no secrets), but keep it short.
  const error = (json?.error?.message ?? `WhatsApp error ${res.status}`).slice(0, 300);
  return { ok: false, error, retryable };
}

/** Verifies the X-Hub-Signature-256 header Meta puts on webhook calls. */
export function verifyWebhookSignature(rawBody: string, header: string | null): boolean {
  const secret = serverEnv.whatsapp.appSecret;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  let given: Buffer;
  try {
    given = Buffer.from(header.slice(7), "hex");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}
