"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isOwnedPath } from "@/lib/uploads/rules";
import { onboardingSchema, paymentSubmissionSchema } from "@/lib/validation";
import { formToObject, must, userAction, validate, type ActionResult } from "./helpers";

/** Saves a half-filled wizard so the owner can continue later (best effort). */
export async function saveOnboardingDraftAction(draft: unknown): Promise<ActionResult> {
  return userAction(async ({ supabase }) => {
    if (!draft || typeof draft !== "object") return { ok: false, error: "Invalid draft" };
    must(await supabase.rpc("save_onboarding_draft", { p_draft: draft }));
    return { ok: true };
  });
}

/**
 * Submits owner + building + electricity details. The database creates the
 * building and works out the subscription amount itself — nothing about price
 * is accepted from the browser.
 */
export async function submitOnboardingAction(input: unknown): Promise<ActionResult> {
  const res = await userAction<{ awaiting_payment: boolean }>(async ({ supabase, isAdmin, t }) => {
    if (isAdmin) return { ok: false, error: t("Admins do not need onboarding.", "Admin ko onboarding ki zaroorat nahi hai.") };
    const v = validate(onboardingSchema, input);
    if (!v.ok) return v.result;
    const data = must(await supabase.rpc("submit_onboarding", { p: v.data })) as { awaiting_payment: boolean };
    revalidatePath("/onboarding", "layout");
    return { ok: true, data };
  });
  if (!res.ok) return res;
  redirect(res.data?.awaiting_payment ? "/onboarding/payment" : "/onboarding/status");
}

/** Records the owner's CLAIM of payment. Approval still needs an admin to verify it. */
export async function submitPaymentAction(fd: FormData): Promise<ActionResult> {
  const res = await userAction(async ({ supabase, userId, t }) => {
    const v = validate(paymentSubmissionSchema, formToObject(fd));
    if (!v.ok) return v.result;
    const screenshot = v.data.screenshot_path || null;
    if (screenshot && !isOwnedPath(screenshot, userId)) return { ok: false, error: t("Invalid screenshot", "Screenshot galat hai") };
    must(await supabase.rpc("submit_payment", { p_reference: v.data.reference, p_paid_on: v.data.paid_on, p_screenshot_path: screenshot }));
    revalidatePath("/onboarding", "layout");
    return { ok: true };
  });
  if (!res.ok) return res;
  redirect("/onboarding/status");
}
