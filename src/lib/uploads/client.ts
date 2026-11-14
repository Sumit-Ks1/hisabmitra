"use client";

import { createUploadAction, finalizeUploadAction } from "@/lib/actions/uploads";
import { UPLOAD_RULES, type Mime, type UploadKind } from "./rules";

const IMAGE_MAX_EDGE = 2200; // px — keeps small print on ID cards readable
const IMAGE_QUALITY = 0.86;

/**
 * Makes a phone photo smaller without hurting readability: longest edge capped
 * at 2200px, high-quality JPEG. If the result is not smaller, or anything goes
 * wrong, the original file is used unchanged. PDFs are never re-compressed.
 */
export async function optimiseImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 400 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Combines several PDFs / images into ONE PDF, in the order given. Pages are copied, not re-encoded. */
export async function combineIntoPdf(files: File[], name = "documents.pdf"): Promise<File> {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  for (const original of files) {
    if (original.type === "application/pdf") {
      const src = await PDFDocument.load(await original.arrayBuffer(), { ignoreEncryption: false });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
      continue;
    }
    // images: WebP is not supported by PDF, so everything non-PNG goes through JPEG
    let file = await optimiseImage(original);
    if (file.type === "image/webp") file = await toJpeg(file);
    const bytes = await file.arrayBuffer();
    const img = file.type === "image/png" ? await out.embedPng(bytes) : await out.embedJpg(bytes);
    const A4 = { w: 595.28, h: 841.89 };
    const margin = 24;
    const scale = Math.min((A4.w - margin * 2) / img.width, (A4.h - margin * 2) / img.height, 1);
    const page = out.addPage([A4.w, A4.h]);
    const w = img.width * scale;
    const h = img.height * scale;
    page.drawImage(img, { x: (A4.w - w) / 2, y: (A4.h - h) / 2, width: w, height: h });
  }
  const bytes = await out.save({ useObjectStreams: true });
  return new File([bytes as BlobPart], name, { type: "application/pdf" });
}

async function toJpeg(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Could not read image");
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function checkFile(file: File, kind: UploadKind): string | null {
  const rule = UPLOAD_RULES[kind];
  if (!rule.mimes.includes(file.type as Mime)) return "Only PDF, JPG, PNG or WebP files are allowed. / Sirf PDF, JPG, PNG ya WebP file chalegi.";
  if (file.size > rule.maxBytes) return `File is too large (max ${Math.round(rule.maxBytes / 1024 / 1024)} MB). / File bahut badi hai.`;
  if (file.size === 0) return "This file is empty. / Yeh file khaali hai.";
  return null;
}

function put(url: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Timed out"));
    xhr.timeout = 120_000;
    // same multipart shape the official Supabase client sends
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    xhr.send(body);
  });
}

export type UploadExtra = { tenantId?: string; docType?: string };

/**
 * Full upload: ask the server for a signed URL → send the file with progress →
 * ask the server to verify the stored file. Resolves only when the server has
 * confirmed it; throws a user-readable message otherwise.
 */
export async function uploadFile(
  input: File,
  kind: UploadKind,
  extra: UploadExtra,
  onProgress: (percent: number) => void,
): Promise<string> {
  const file = await optimiseImage(input);
  const problem = checkFile(file, kind);
  if (problem) throw new Error(problem);

  const created = await createUploadAction({ kind, mime: file.type, size: file.size, tenantId: extra.tenantId });
  if (!created.ok || !created.data) throw new Error(created.ok ? "Upload failed" : created.error);

  try {
    await put(created.data.signedUrl, file, onProgress);
  } catch {
    throw new Error("Upload failed. Check your internet and try again. / Upload nahi hua, internet check karein.");
  }

  const done = await finalizeUploadAction({ kind, path: created.data.path, tenantId: extra.tenantId, docType: extra.docType, fileName: input.name });
  if (!done.ok || !done.data) throw new Error(done.ok ? "Upload failed" : done.error);
  return done.data.path;
}
