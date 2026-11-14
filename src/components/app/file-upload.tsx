"use client";

import { CheckCircle2, FileUp, Loader2, XCircle } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { uploadFile, type UploadExtra } from "@/lib/uploads/client";
import { UPLOAD_RULES, type UploadKind } from "@/lib/uploads/rules";
import { cn } from "@/lib/utils";

type State =
  | { status: "idle" }
  | { status: "uploading"; name: string; percent: number }
  | { status: "done"; name: string }
  | { status: "error"; message: string };

/**
 * Single-file picker with progress, success and error states.
 * `onUploaded` fires only after the server has verified the stored file.
 * When `name` is given, the stored path is also written into a hidden input so
 * it can travel with a surrounding form.
 */
export function FileUpload({
  kind,
  extra = {},
  onUploaded,
  name,
  label,
  capture,
  className,
}: {
  kind: UploadKind;
  extra?: UploadExtra;
  onUploaded?: (path: string) => void;
  name?: string;
  label?: string;
  capture?: "environment";
  className?: string;
}) {
  const t = useT();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const [path, setPath] = useState("");
  const rule = UPLOAD_RULES[kind];

  async function onPick(file: File | undefined) {
    if (!file) return;
    setState({ status: "uploading", name: file.name, percent: 0 });
    try {
      const stored = await uploadFile(file, kind, extra, (percent) => setState({ status: "uploading", name: file.name, percent }));
      setPath(stored);
      setState({ status: "done", name: file.name });
      onUploaded?.(stored);
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : t("Upload failed", "Upload nahi hua") });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  const busy = state.status === "uploading";
  return (
    <div className={className}>
      {name && <input type="hidden" name={name} value={path} />}
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition-colors",
          state.status === "error" ? "border-danger-200 bg-danger-50" : state.status === "done" ? "border-success-500/40 bg-success-50" : "border-slate-300 bg-white hover:border-brand-400",
          busy && "pointer-events-none",
        )}
      >
        {state.status === "uploading" ? (
          <Loader2 className="size-5 shrink-0 animate-spin text-brand-600" aria-hidden />
        ) : state.status === "done" ? (
          <CheckCircle2 className="size-5 shrink-0 text-success-700" aria-hidden />
        ) : state.status === "error" ? (
          <XCircle className="size-5 shrink-0 text-danger-700" aria-hidden />
        ) : (
          <FileUp className="size-5 shrink-0 text-slate-500" aria-hidden />
        )}
        <span className="min-w-0 flex-1 text-[0.92rem]" aria-live="polite">
          {state.status === "idle" && (
            <>
              <span className="block font-medium text-ink">{label ?? t("Choose file", "File chunein")}</span>
              <span className="block text-[0.8rem] text-slate-500">
                {rule.mimes.includes("application/pdf") ? "PDF, JPG, PNG" : "JPG, PNG"} · max {Math.round(rule.maxBytes / 1024 / 1024)} MB
              </span>
            </>
          )}
          {state.status === "uploading" && (
            <>
              <span className="block truncate font-medium text-ink">{state.name}</span>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-200">
                <span className="block h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${state.percent}%` }} />
              </span>
              <span className="mt-1 block text-[0.78rem] text-slate-500">
                {state.percent < 100 ? `${state.percent}%` : t("Checking file…", "File check ho rahi hai…")}
              </span>
            </>
          )}
          {state.status === "done" && (
            <>
              <span className="block truncate font-medium text-success-700">{t("Uploaded", "Upload ho gaya")}</span>
              <span className="block truncate text-[0.8rem] text-slate-600">{state.name} · {t("tap to replace", "badalne ke liye tap karein")}</span>
            </>
          )}
          {state.status === "error" && (
            <>
              <span className="block font-medium text-danger-700">{state.message}</span>
              <span className="block text-[0.8rem] text-slate-600">{t("Tap to try again", "Dobara try karne ke liye tap karein")}</span>
            </>
          )}
        </span>
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        className="sr-only"
        accept={rule.mimes.join(",")}
        capture={capture}
        disabled={busy}
        onChange={(e) => onPick(e.target.files?.[0])}
      />
    </div>
  );
}
