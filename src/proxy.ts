import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv, supabaseConfigured } from "@/lib/public-env";

const PROTECTED = ["/app", "/admin", "/onboarding"];
const AUTH_PAGES = ["/login", "/signup"];

/**
 * Refreshes the Supabase session cookie and keeps signed-out visitors away from
 * the app. This is only the first gate: every page and Server Action checks the
 * user and role again on the server, and the database enforces RLS.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!supabaseConfigured) {
    return isProtected ? NextResponse.redirect(new URL("/setup-required", request.url)) : NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirect = (to: string) => {
    const res = NextResponse.redirect(new URL(to, request.url));
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user && isProtected) {
    const next = pathname + request.nextUrl.search;
    return redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (user && AUTH_PAGES.includes(pathname)) return redirect("/app");

  // Private pages must never be stored by shared caches.
  if (isProtected) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/onboarding/:path*", "/login", "/signup", "/auth/:path*"],
};
