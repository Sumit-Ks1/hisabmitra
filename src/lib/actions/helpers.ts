import "server-only";
import type { z } from "zod";
import { getSession, type SessionContext } from "@/lib/auth/session";
import type { OwnerAccount } from "@/lib/db-types";
import { friendlyError } from "@/lib/errors";
import { makeT } from "@/lib/i18n";

export type ActionResult<D = undefined> =
  | { ok: true; message?: string; data?: D }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type OwnerContext = SessionContext & { owner: OwnerAccount };

const SIGNED_OUT: ActionResult<never> = {
  ok: false,
  error: "Please log in again. / Kripya dobara login karein.",
};

type Level = "user" | "owner" | "admin";

/**
 * Every Server Action goes through here: it re-authenticates the caller,
 * re-checks the role on the server, and turns thrown errors into safe messages.
 */
async function run<D, C extends SessionContext>(
  level: Level,
  fn: (ctx: C) => Promise<ActionResult<D>>,
): Promise<ActionResult<D>> {
  const ctx = await getSession();
  if (!ctx) return SIGNED_OUT;
  const { t } = ctx;
  if (level === "admin" && !ctx.isAdmin) {
    return { ok: false, error: t("You are not allowed to do this.", "Aapko iski permission nahi hai.") };
  }
  if (level === "owner" && (ctx.isAdmin || ctx.owner?.status !== "approved")) {
    return { ok: false, error: t("Your account is not active.", "Aapka account active nahi hai.") };
  }
  try {
    return await fn(ctx as C);
  } catch (e) {
    // Next.js control-flow errors (redirect / notFound) must pass through.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error("[action]", e instanceof Error ? e.message : "unknown error");
    return { ok: false, error: friendlyError(e, t) };
  }
}

export const userAction = <D = undefined>(fn: (ctx: SessionContext) => Promise<ActionResult<D>>) => run("user", fn);
export const ownerAction = <D = undefined>(fn: (ctx: OwnerContext) => Promise<ActionResult<D>>) => run("owner", fn);
export const adminAction = <D = undefined>(fn: (ctx: SessionContext) => Promise<ActionResult<D>>) => run("admin", fn);

/** Validates input with Zod and returns per-field messages on failure. */
export function validate<S extends z.ZodType>(
  schema: S,
  input: unknown,
): { ok: true; data: z.infer<S> } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }
  const first = Object.values(fieldErrors)[0];
  return {
    ok: false,
    result: { ok: false, error: first ?? "Please check the form. / Form check karein.", fieldErrors },
  };
}

/** FormData → plain object (strings only; files are ignored). */
export function formToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (typeof v === "string") out[k] = v.trim();
  });
  return out;
}

/** Throws when a Supabase call failed, so `run` can map it to a friendly message. */
export function must<D>(res: { data: D; error: { message: string } | null }): D {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export const fallbackT = makeT("hinglish");
