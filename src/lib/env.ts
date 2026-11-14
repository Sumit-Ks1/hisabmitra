import "server-only";
import { z } from "zod";

/**
 * Server-only environment. Importing this file from a Client Component is a
 * build error ("server-only"), so none of these values can reach the browser.
 * Everything is optional: a missing integration shows a "setup required" state
 * instead of crashing the app.
 */
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optional,
  ADMIN_EMAIL: optional,
  CRON_SECRET: optional,
  // WhatsApp Cloud API (Meta)
  WHATSAPP_PHONE_NUMBER_ID: optional,
  WHATSAPP_ACCESS_TOKEN: optional,
  WHATSAPP_APP_SECRET: optional,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: optional,
  WHATSAPP_TEMPLATE_NAME: optional,
  WHATSAPP_TEMPLATE_LANGUAGE: optional,
  WHATSAPP_GRAPH_VERSION: optional,
  // BBPS provider (Setu BillPay) — live integration stays off until all are set
  SETU_BILLPAY_BASE_URL: optional,
  SETU_BILLPAY_CLIENT_ID: optional,
  SETU_BILLPAY_CLIENT_SECRET: optional,
  SETU_BILLPAY_BILLER_MAP: optional,
});

const e = schema.parse(process.env);

const adminEmail = e.ADMIN_EMAIL?.toLowerCase();
if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
  // Name only — never log values.
  throw new Error("Invalid environment variable: ADMIN_EMAIL must be an email address");
}

export const serverEnv = {
  serviceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY,
  adminEmail,
  cronSecret: e.CRON_SECRET,
  whatsapp: {
    phoneNumberId: e.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: e.WHATSAPP_ACCESS_TOKEN,
    appSecret: e.WHATSAPP_APP_SECRET,
    webhookVerifyToken: e.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    templateName: e.WHATSAPP_TEMPLATE_NAME,
    templateLanguage: e.WHATSAPP_TEMPLATE_LANGUAGE ?? "en",
    graphVersion: e.WHATSAPP_GRAPH_VERSION ?? "v21.0",
  },
  setu: {
    baseUrl: e.SETU_BILLPAY_BASE_URL,
    clientId: e.SETU_BILLPAY_CLIENT_ID,
    clientSecret: e.SETU_BILLPAY_CLIENT_SECRET,
    billerMap: e.SETU_BILLPAY_BILLER_MAP,
  },
} as const;

export const whatsappCredentialsPresent = Boolean(
  serverEnv.whatsapp.phoneNumberId && serverEnv.whatsapp.accessToken && serverEnv.whatsapp.templateName,
);
export const setuCredentialsPresent = Boolean(
  serverEnv.setu.baseUrl && serverEnv.setu.clientId && serverEnv.setu.clientSecret && serverEnv.setu.billerMap,
);
