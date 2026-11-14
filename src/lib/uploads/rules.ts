/** Upload rules shared by the browser (early feedback) and the server (the real check). */

export type UploadKind = "tenant-document" | "payment-proof" | "meter-photo" | "avatar";

export type Mime = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

export const UPLOAD_RULES: Record<UploadKind, { bucket: string; maxBytes: number; mimes: Mime[] }> = {
  "tenant-document": {
    bucket: "tenant-documents",
    maxBytes: 10 * 1024 * 1024,
    mimes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  },
  "payment-proof": {
    bucket: "payment-proofs",
    maxBytes: 5 * 1024 * 1024,
    mimes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  },
  "meter-photo": { bucket: "meter-photos", maxBytes: 5 * 1024 * 1024, mimes: ["image/jpeg", "image/png", "image/webp"] },
  avatar: { bucket: "avatars", maxBytes: 2 * 1024 * 1024, mimes: ["image/jpeg", "image/png", "image/webp"] },
};

export const EXT: Record<Mime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Detects the real file type from its first bytes. The browser-reported type is never trusted. */
export function sniffMime(bytes: Uint8Array): Mime | null {
  const b = bytes;
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) {
    return "application/pdf";
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** A display name that is safe to store and show: no paths, no control characters. */
export function safeDisplayName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "file";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\.{2,}/g, ".")
    .trim();
  return (cleaned || "file").slice(0, 100);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** True when `path` is exactly `{ownerId}/{segment}/{uuid}.{ext}` — nothing else is ever accepted. */
export function isOwnedPath(path: string, ownerId: string): boolean {
  const parts = path.split("/");
  if (parts.length !== 3 || parts[0] !== ownerId) return false;
  if (!/^[a-z0-9-]{1,40}$/i.test(parts[1])) return false;
  const [file, ext, ...more] = parts[2].split(".");
  return more.length === 0 && isUuid(file) && Object.values(EXT).includes(ext);
}
