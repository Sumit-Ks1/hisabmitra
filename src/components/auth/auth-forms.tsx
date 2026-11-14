"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import {
  forgotPasswordAction,
  googleSignInAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
} from "@/lib/actions/auth";
import type { ActionResult } from "@/lib/actions/helpers";
import { forgotSchema, loginSchema, resetSchema, signupSchema } from "@/lib/validation";

const OFFLINE = "Could not connect. Check your internet and try again. / Internet check karke dobara try karein.";

/** Runs a Server Action from a react-hook-form submit and maps server errors back onto fields. */
function useSubmit<V extends FieldValues>(form: UseFormReturn<V, unknown, V>) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: (values: V) => Promise<ActionResult<unknown> | undefined>, onOk?: () => void) =>
    form.handleSubmit((values) => {
      setError(null);
      start(async () => {
        try {
          const res = await action(values);
          if (!res) return; // redirected
          if (res.ok) onOk?.();
          else {
            setError(res.error);
            Object.entries(res.fieldErrors ?? {}).forEach(([k, message]) => form.setError(k as Path<V>, { message }));
          }
        } catch (e) {
          // a redirect() from the action surfaces here in some browsers — let it through
          if (e && typeof e === "object" && "digest" in e) throw e;
          setError(OFFLINE);
        }
      });
    });
  return { pending, error, run };
}

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-[0.9rem] font-medium text-danger-700">
      {message}
    </p>
  );
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" size="lg" block disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function GoogleButton({ label }: { label: string }) {
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="lg"
        block
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await googleSignInAction(params.get("next") ?? undefined);
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <GoogleIcon />}
        {label}
      </Button>
      <ErrorBox message={error} />
    </div>
  );
}

export function Divider() {
  return (
    <div className="flex items-center gap-3 py-1 text-[0.8rem] text-slate-400">
      <span className="h-px flex-1 bg-slate-200" /> ya / or <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

const URL_ERRORS: Record<string, string> = {
  link: "This link is invalid or has expired. Please try again. / Yeh link expire ho gaya hai.",
  cancelled: "Sign-in was cancelled. / Login cancel ho gaya.",
};

export function LoginForm() {
  const params = useSearchParams();
  const form = useForm<z.input<typeof loginSchema>, unknown, z.output<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const { pending, error, run } = useSubmit(form);
  const e = form.formState.errors;
  const urlError = URL_ERRORS[params.get("error") ?? ""] ?? null;

  return (
    <form onSubmit={run((v) => signInAction(v, params.get("next") ?? undefined))} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email" error={e.email?.message}>
        <Input id="email" type="email" inputMode="email" autoComplete="email" aria-invalid={!!e.email} {...form.register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={e.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!e.password} {...form.register("password")} />
      </Field>
      <div className="-mt-1 text-right">
        <Link href="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
          Password bhool gaye? / Forgot password?
        </Link>
      </div>
      <ErrorBox message={error ?? urlError} />
      <Submit pending={pending}>Login</Submit>
    </form>
  );
}

export function SignupForm() {
  const [sent, setSent] = useState<string | null>(null);
  const form = useForm<z.input<typeof signupSchema>, unknown, z.output<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { full_name: "", email: "", password: "" },
  });
  const { pending, error, run } = useSubmit(form);
  const e = form.formState.errors;

  if (sent) {
    return (
      <Notice tone="success" icon={MailCheck} title="Email check karein / Check your email">
        <p className="mt-1">
          We sent a verification link to <b className="break-all">{sent}</b>. Open it to activate your account, then log in.
        </p>
        <p className="mt-2 text-slate-600">Link nahi mila? Spam folder dekhein, ya kuch minute baad dobara sign up karein.</p>
      </Notice>
    );
  }

  return (
    <form onSubmit={run((v) => signUpAction(v), () => setSent(form.getValues("email")))} className="space-y-4" noValidate>
      <Field label="Aapka naam / Your name" htmlFor="full_name" error={e.full_name?.message}>
        <Input id="full_name" autoComplete="name" aria-invalid={!!e.full_name} {...form.register("full_name")} />
      </Field>
      <Field label="Email" htmlFor="email" error={e.email?.message}>
        <Input id="email" type="email" inputMode="email" autoComplete="email" aria-invalid={!!e.email} {...form.register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={e.password?.message} hint="Kam se kam 8 characters / At least 8 characters">
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!e.password} {...form.register("password")} />
      </Field>
      <ErrorBox message={error} />
      <Submit pending={pending}>Account banayein / Create account</Submit>
    </form>
  );
}

export function ForgotForm() {
  const [done, setDone] = useState(false);
  const form = useForm<z.input<typeof forgotSchema>, unknown, z.output<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });
  const { pending, error, run } = useSubmit(form);

  if (done) {
    return (
      <Notice tone="success" icon={MailCheck} title="Email check karein / Check your email">
        <p className="mt-1">If an account exists for this email, a password reset link is on its way.</p>
      </Notice>
    );
  }
  return (
    <form onSubmit={run((v) => forgotPasswordAction(v), () => setDone(true))} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
        <Input id="email" type="email" inputMode="email" autoComplete="email" {...form.register("email")} />
      </Field>
      <ErrorBox message={error} />
      <Submit pending={pending}>Reset link bhejein / Send reset link</Submit>
    </form>
  );
}

export function ResetForm() {
  const form = useForm<z.input<typeof resetSchema>, unknown, z.output<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const { pending, error, run } = useSubmit(form);
  const e = form.formState.errors;
  return (
    <form onSubmit={run((v) => resetPasswordAction(v))} className="space-y-4" noValidate>
      <Field label="Naya password / New password" htmlFor="password" error={e.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field label="Password dobara / Confirm password" htmlFor="confirm" error={e.confirm?.message}>
        <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      <ErrorBox message={error} />
      <Submit pending={pending}>Password save karein / Save password</Submit>
    </form>
  );
}
