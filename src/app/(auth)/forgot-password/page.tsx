import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-[-0.02em] text-ink">Password bhool gaye?</h1>
      <p className="mt-1 text-[0.92rem] text-slate-500">Enter your email and we will send you a link to set a new password.</p>
      <div className="mt-6">
        <ForgotForm />
      </div>
      <p className="mt-6 text-center text-[0.92rem]">
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Back to login
        </Link>
      </p>
    </>
  );
}
