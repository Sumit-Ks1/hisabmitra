"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { siteConfig } from "@/lib/config";
import { supabaseConfigured } from "@/lib/public-env";
import { createClient } from "@/lib/supabase/server";
import { forgotSchema, loginSchema, resetSchema, signupSchema } from "@/lib/validation";
import { validate, type ActionResult } from "./helpers";

const NOT_CONFIGURED: ActionResult<never> = {
  ok: false,
  error: "Login is not set up yet. Supabase keys are missing on the server.",
};

/** Only same-site paths into the app are allowed as a post-login destination. */
function safeNext(next: unknown): string {
  if (typeof next !== "string") return "/app";
  if (!/^\/(app|admin|onboarding|reset-password)(\/|$|\?)/.test(next) || next.includes("//") || next.includes("\\")) return "/app";
  return next;
}

async function origin(): Promise<string> {
  const h = await headers();
  const fromHeader = h.get("origin");
  if (fromHeader) return fromHeader;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  return siteConfig.url;
}

export async function signInAction(input: unknown, next?: string): Promise<ActionResult> {
  if (!supabaseConfigured) return NOT_CONFIGURED;
  const v = validate(loginSchema, input);
  if (!v.ok) return v.result;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(v.data);
  if (error) {
    if (/not confirmed/i.test(error.message)) {
      return { ok: false, error: "Please verify your email first. Check your inbox for the link. / Pehle email verify karein — inbox mein link dekhein." };
    }
    // one message for every other failure: never reveal whether the email exists
    return { ok: false, error: "Wrong email or password. / Email ya password galat hai." };
  }
  redirect(safeNext(next));
}

export async function signUpAction(input: unknown): Promise<ActionResult<{ needsVerification: boolean }>> {
  if (!supabaseConfigured) return NOT_CONFIGURED;
  const v = validate(signupSchema, input);
  if (!v.ok) return v.result;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: v.data.email,
    password: v.data.password,
    options: {
      emailRedirectTo: `${await origin()}/auth/callback?next=/app`,
      data: { full_name: v.data.full_name },
    },
  });
  if (error) {
    if (/rate|too many/i.test(error.message)) {
      return { ok: false, error: "Too many attempts. Please try again in a few minutes. / Thodi der baad try karein." };
    }
    if (/password/i.test(error.message)) return { ok: false, error: error.message, fieldErrors: { password: error.message } };
    return { ok: false, error: "Could not create the account. Please try again. / Account nahi ban paya, dobara try karein." };
  }
  // With email confirmation on, Supabase returns no session (and does not say
  // whether the address was already registered — that is intentional).
  if (data.session) redirect("/app");
  return { ok: true, data: { needsVerification: true } };
}

export async function googleSignInAction(next?: string): Promise<ActionResult> {
  if (!supabaseConfigured) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}` },
  });
  if (error || !data.url) {
    return { ok: false, error: "Google sign-in is not available right now. / Google login abhi available nahi hai." };
  }
  redirect(data.url);
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  if (!supabaseConfigured) return NOT_CONFIGURED;
  const v = validate(forgotSchema, input);
  if (!v.ok) return v.result;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(v.data.email, {
    redirectTo: `${await origin()}/auth/callback?next=/reset-password`,
  });
  // Same answer whether or not the account exists.
  return { ok: true };
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  if (!supabaseConfigured) return NOT_CONFIGURED;
  const v = validate(resetSchema, input);
  if (!v.ok) return v.result;
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return { ok: false, error: "This reset link has expired. Please request a new one. / Link expire ho gaya, naya link mangayein." };
  }
  const { error } = await supabase.auth.updateUser({ password: v.data.password });
  if (error) return { ok: false, error: error.message };
  redirect("/app");
}

export async function signOutAction(): Promise<void> {
  if (supabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
