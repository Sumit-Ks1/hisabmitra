import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base text-ink placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:border-danger-500 aria-[invalid=true]:ring-danger-100";

export function Input({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={cn(control, "h-12", className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea rows={rows} className={cn(control, "py-3", className)} {...props} />;
}

/** Native select: the most reliable picker on low-end Android phones. */
export function Select({ className, children, ...props }: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      className={cn(
        control,
        "h-12 appearance-none bg-[length:1rem] bg-[right_0.9rem_center] bg-no-repeat pr-10",
        "bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22%2364748b%22%20stroke-width=%222.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%3E%3Cpath%20d=%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }: ComponentPropsWithoutRef<"label">) {
  return <label className={cn("block text-sm font-medium text-slate-700", className)} {...props} />;
}

/** Label + control + hint + error, wired together for screen readers. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1.5 font-normal text-slate-400">(optional)</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-[0.82rem] leading-snug text-slate-500">{hint}</p>}
      {error && (
        <p role="alert" className="text-[0.82rem] font-medium leading-snug text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function Checkbox({ className, label, ...props }: ComponentPropsWithoutRef<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5", className)}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 rounded border-slate-300 accent-brand-600" {...props} />
      <span className="text-[0.92rem] leading-snug text-slate-700">{label}</span>
    </label>
  );
}
