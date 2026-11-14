"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { BUILDING_COOKIE } from "@/lib/data/workspace";
import { isUuid } from "@/lib/uploads/rules";
import { addBuildingSchema, profileSchema } from "@/lib/validation";
import { formToObject, must, ownerAction, userAction, validate, type ActionResult } from "./helpers";

export async function switchBuildingAction(buildingId: string): Promise<ActionResult> {
  return ownerAction(async ({ supabase, userId, t }) => {
    if (!isUuid(buildingId)) return { ok: false, error: t("Invalid building", "Building galat hai") };
    const { data } = await supabase.from("buildings").select("id").eq("id", buildingId).eq("owner_id", userId).maybeSingle();
    if (!data) return { ok: false, error: t("Building not found", "Building nahi mili") };
    (await cookies()).set(BUILDING_COOKIE, buildingId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return { ok: true };
  });
}

export async function addBuildingAction(fd: FormData): Promise<ActionResult> {
  return ownerAction(async ({ supabase, t }) => {
    const v = validate(addBuildingSchema, formToObject(fd));
    if (!v.ok) return v.result;
    const id = must(await supabase.rpc("add_building", { p: v.data })) as string;
    (await cookies()).set(BUILDING_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
    revalidatePath("/app", "layout");
    return { ok: true, message: t("Building added", "Building jud gayi") };
  });
}

export async function updateProfileAction(fd: FormData): Promise<ActionResult> {
  return userAction(async ({ supabase, userId, t }) => {
    const v = validate(profileSchema, formToObject(fd));
    if (!v.ok) return v.result;
    must(
      await supabase
        .from("profiles")
        .update({ full_name: v.data.full_name, phone: v.data.phone, whatsapp: v.data.whatsapp || null, language: v.data.language })
        .eq("id", userId),
    );
    revalidatePath("/", "layout");
    return { ok: true, message: t("Profile saved", "Profile save ho gayi") };
  });
}

export async function markNotificationsReadAction(): Promise<ActionResult> {
  return userAction(async ({ supabase, userId }) => {
    must(await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null));
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
