/**
 * Values that are safe to ship to the browser. Only NEXT_PUBLIC_* may appear here.
 * (Each variable is referenced literally so Next.js can inline it at build time.)
 */
export const publicEnv = {
  supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(),
  supabaseAnonKey: (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim(),
  buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
} as const;

export const supabaseConfigured =
  /^https?:\/\//.test(publicEnv.supabaseUrl) && publicEnv.supabaseAnonKey.length > 20;
