import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured } from "@/lib/public-env";
import { createClient } from "@/lib/supabase/server";

function safeNext(next: string | null): string {
  if (!next) return "/app";
  if (!/^\/(app|admin|onboarding|reset-password)(\/|$|\?)/.test(next) || next.includes("//") || next.includes("\\")) return "/app";
  return next;
}

/**
 * Landing point for Google OAuth and for the links in Supabase emails
 * (verify email, reset password). Supports both the PKCE `code` flow and the
 * `token_hash` flow used by custom email templates.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, url.origin));

  if (!supabaseConfigured) return NextResponse.redirect(new URL("/setup-required", url.origin));
  if (url.searchParams.get("error")) return fail("cancelled");

  const supabase = await createClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("link");
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail("link");
  } else {
    return fail("link");
  }

  return NextResponse.redirect(new URL(type === "recovery" ? "/reset-password" : next, url.origin));
}
