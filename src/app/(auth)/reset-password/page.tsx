import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-[-0.02em] text-ink">Naya password banayein</h1>
      <p className="mt-1 text-[0.92rem] text-slate-500">Choose a new password for your account.</p>
      <div className="mt-6">
        <ResetForm />
      </div>
    </>
  );
}
