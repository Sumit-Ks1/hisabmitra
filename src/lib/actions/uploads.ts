"use server";

import { revalidatePath } from "next/cache";
import { EXT, UPLOAD_RULES, isOwnedPath, isUuid, safeDisplayName, sniffMime, type Mime, type UploadKind } from "@/lib/uploads/rules";
import { must, userAction, type ActionResult } from "./helpers";

const DOC_TYPES = ["aadhaar", "id_proof", "agreement", "other"] as const;

type CreateInput = { kind: UploadKind; mime: string; size: number; tenantId?: string };

/**
 * Step 1 of an upload. The server decides the storage path (so a browser can
 * never choose one), checks type / size / ownership, and returns a one-time
 * signed upload URL. The file itself goes straight from the phone to private
 * storage — it never passes through this server and is never logged.
 */
export async function createUploadAction(input: CreateInput): Promise<ActionResult<{ path: string; signedUrl: string }>> {
  return userAction<{ path: string; signedUrl: string }>(async ({ supabase, userId, t, owner }) => {
    const rule = UPLOAD_RULES[input.kind];
    if (!rule) return { ok: false, error: t("Invalid upload", "Upload galat hai") };
    if (!rule.mimes.includes(input.mime as Mime)) {
      return { ok: false, error: t("This file type is not allowed. Use PDF, JPG or PNG.", "Yeh file type allowed nahi hai. PDF, JPG ya PNG use karein.") };
    }
    if (!Number.isFinite(input.size) || input.size <= 0 || input.size > rule.maxBytes) {
      const mb = Math.round(rule.maxBytes / 1024 / 1024);
      return { ok: false, error: t(`File is too large. Maximum ${mb} MB.`, `File bahut badi hai. Maximum ${mb} MB.`) };
    }
    const { data: allowed } = await supabase.rpc("check_rate_limit", { p_action: "upload" });
    if (!allowed) return { ok: false, error: t("Too many uploads. Try again later.", "Bahut zyada uploads. Thodi der baad try karein.") };

    let segment: string;
    if (input.kind === "tenant-document") {
      if (owner?.status !== "approved" || !isUuid(input.tenantId)) return { ok: false, error: t("Tenant not found", "Tenant nahi mila") };
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, documents_consent_at")
        .eq("id", input.tenantId)
        .eq("owner_id", userId)
        .maybeSingle();
      if (!tenant) return { ok: false, error: t("Tenant not found", "Tenant nahi mila") };
      if (!tenant.documents_consent_at) {
        return { ok: false, error: t("Please confirm the tenant's consent first.", "Pehle tenant ki consent confirm karein.") };
      }
      segment = input.tenantId;
    } else if (input.kind === "meter-photo") {
      if (owner?.status !== "approved") return { ok: false, error: t("Not allowed", "Allowed nahi hai") };
      segment = "meters";
    } else {
      segment = input.kind === "avatar" ? "avatar" : "proofs";
    }

    const path = `${userId}/${segment}/${crypto.randomUUID()}.${EXT[input.mime as Mime]}`;
    const { data, error } = await supabase.storage.from(rule.bucket).createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "upload url failed");
    return { ok: true, data: { path, signedUrl: data.signedUrl } };
  });
}

type FinalizeInput = { kind: UploadKind; path: string; tenantId?: string; docType?: string; fileName?: string };

/**
 * Step 2. Re-reads the stored object and checks its REAL content type and size.
 * Anything that is not what it claimed to be is deleted immediately.
 */
export async function finalizeUploadAction(input: FinalizeInput): Promise<ActionResult<{ path: string }>> {
  return userAction<{ path: string }>(async ({ supabase, userId, t }) => {
    const rule = UPLOAD_RULES[input.kind];
    if (!rule || !isOwnedPath(input.path, userId)) return { ok: false, error: t("Invalid upload", "Upload galat hai") };
    const bucket = supabase.storage.from(rule.bucket);
    const reject = async (error: string): Promise<ActionResult<never>> => {
      await bucket.remove([input.path]);
      return { ok: false, error };
    };

    const { data: blob, error } = await bucket.download(input.path);
    if (error || !blob) return { ok: false, error: t("Upload did not finish. Please try again.", "Upload poora nahi hua. Dobara try karein.") };
    if (blob.size > rule.maxBytes) return reject(t("File is too large.", "File bahut badi hai."));

    const mime = sniffMime(new Uint8Array(await blob.slice(0, 16).arrayBuffer()));
    if (!mime || !rule.mimes.includes(mime) || !input.path.endsWith(`.${EXT[mime]}`)) {
      return reject(t("This file is not a valid PDF or image.", "Yeh file sahi PDF ya image nahi hai."));
    }

    if (input.kind === "tenant-document") {
      if (!isUuid(input.tenantId) || input.path.split("/")[1] !== input.tenantId) return reject(t("Invalid upload", "Upload galat hai"));
      const { data: tenant } = await supabase.from("tenants").select("id, building_id").eq("id", input.tenantId).eq("owner_id", userId).maybeSingle();
      if (!tenant) return reject(t("Tenant not found", "Tenant nahi mila"));
      const docType = DOC_TYPES.includes(input.docType as (typeof DOC_TYPES)[number]) ? input.docType : "other";
      const { error: insertError } = await supabase.from("tenant_documents").insert({
        owner_id: userId,
        building_id: tenant.building_id,
        tenant_id: tenant.id,
        doc_type: docType,
        file_name: safeDisplayName(input.fileName ?? "document"),
        storage_path: input.path,
        mime_type: mime,
        size_bytes: blob.size,
      });
      if (insertError) {
        await bucket.remove([input.path]);
        throw new Error(insertError.message);
      }
      revalidatePath(`/app/tenants/${tenant.id}`);
    }

    if (input.kind === "avatar") {
      const { data: profile } = await supabase.from("profiles").select("avatar_path").eq("id", userId).maybeSingle();
      must(await supabase.from("profiles").update({ avatar_path: input.path }).eq("id", userId));
      if (profile?.avatar_path && isOwnedPath(profile.avatar_path, userId)) await bucket.remove([profile.avatar_path]);
      revalidatePath("/", "layout");
    }

    return { ok: true, data: { path: input.path } };
  });
}

/** Short-lived link to view one of the caller's own files. */
export async function signedViewUrlAction(kind: UploadKind, path: string): Promise<ActionResult<{ url: string }>> {
  return userAction<{ url: string }>(async ({ supabase, userId, isAdmin, t }) => {
    const rule = UPLOAD_RULES[kind];
    // owners: only their own folder. admin: payment proofs only (storage policy enforces the same).
    const adminProof = isAdmin && kind === "payment-proof" && /^[0-9a-f-]{36}\/proofs\/[0-9a-f-]{36}\.[a-z]{3,4}$/i.test(path);
    if (!rule || !(isOwnedPath(path, userId) || adminProof)) return { ok: false, error: t("File not found", "File nahi mili") };
    const { data, error } = await supabase.storage.from(rule.bucket).createSignedUrl(path, 60);
    if (error || !data) return { ok: false, error: t("File not found", "File nahi mili") };
    return { ok: true, data: { url: data.signedUrl } };
  });
}
