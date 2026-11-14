"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/helpers";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "./dialog";

type FormState = { pending: boolean; fieldErrors: Record<string, string>; error: string | null };
const FormContext = createContext<FormState>({ pending: false, fieldErrors: {}, error: null });

export const useFormState = () => useContext(FormContext);

type AnyResult = ActionResult<unknown>;

/**
 * A <form> bound to a Server Action that returns ActionResult.
 * Shows a toast, surfaces field errors, refreshes server data on success —
 * and never claims success unless the server said so.
 */
export function ActionForm({
  action,
  children,
  className,
  onSuccess,
  redirectTo,
  resetOnSuccess = false,
}: {
  action: (formData: FormData) => Promise<AnyResult>;
  children: ReactNode;
  className?: string;
  onSuccess?: (result: Extract<AnyResult, { ok: true }>) => void;
  redirectTo?: string;
  resetOnSuccess?: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const [state, setState] = useState<Omit<FormState, "pending">>({ fieldErrors: {}, error: null });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      let res: AnyResult;
      try {
        res = await action(fd);
      } catch {
        res = {
          ok: false,
          error: t("Not saved. Check your internet and try again.", "Save nahi hua. Internet check karke dobara try karein."),
        };
      }
      if (res.ok) {
        setState({ fieldErrors: {}, error: null });
        toast.success(res.message ?? t("Saved", "Save ho gaya"));
        if (resetOnSuccess) form.reset();
        onSuccess?.(res);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } else {
        setState({ fieldErrors: res.fieldErrors ?? {}, error: res.error });
        toast.error(res.error);
      }
    });
  }

  return (
    <FormContext value={{ pending, ...state }}>
      <form onSubmit={submit} className={className} noValidate>
        {children}
      </form>
    </FormContext>
  );
}

export function FieldError({ name }: { name: string }) {
  const { fieldErrors } = useFormState();
  const msg = fieldErrors[name];
  if (!msg) return null;
  return (
    <p role="alert" className="mt-1.5 text-[0.82rem] font-medium text-danger-700">
      {msg}
    </p>
  );
}

export function FormError() {
  const { error } = useFormState();
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-[0.9rem] font-medium text-danger-700">
      {error}
    </p>
  );
}

export function SubmitButton({ children, pending: forced, className, ...props }: ButtonProps & { pending?: boolean }) {
  const ctx = useFormState();
  const pending = forced ?? ctx.pending;
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} className={className} {...props}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

/**
 * A button that asks "are you sure?" before running a Server Action.
 * Used for every destructive or hard-to-undo step.
 */
export function ConfirmAction({
  action,
  trigger,
  title,
  description,
  confirmLabel,
  variant = "default",
  children,
  redirectTo,
  className,
}: {
  action: (formData: FormData) => Promise<AnyResult>;
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  variant?: ButtonProps["variant"];
  /** extra form fields (hidden inputs, a reason box, …) */
  children?: ReactNode;
  redirectTo?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={description}>
        <ActionForm action={action} onSuccess={() => setOpen(false)} redirectTo={redirectTo} className={cn("space-y-4", className)}>
          {children}
          <FormError />
          <div className="flex gap-3">
            <DialogClose asChild>
              <Button variant="outline" block>
                {t("Cancel", "Cancel")}
              </Button>
            </DialogClose>
            <SubmitButton variant={variant} block>
              {confirmLabel}
            </SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog containing a form; closes itself when the action succeeds. */
export function FormDialog({
  trigger,
  title,
  description,
  action,
  children,
  submitLabel,
  redirectTo,
}: {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  action: (formData: FormData) => Promise<AnyResult>;
  children: ReactNode;
  submitLabel: string;
  redirectTo?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={description}>
        {open && (
          <ActionForm action={action} onSuccess={() => setOpen(false)} redirectTo={redirectTo} className="space-y-4">
            {children}
            <FormError />
            <SubmitButton block size="lg">
              {submitLabel}
            </SubmitButton>
          </ActionForm>
        )}
      </DialogContent>
    </Dialog>
  );
}
