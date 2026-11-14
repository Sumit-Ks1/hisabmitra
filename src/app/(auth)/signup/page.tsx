import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Divider, GoogleButton, SignupForm } from "@/components/auth/auth-forms";
import { Skeleton } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign up", robots: { index: false } };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-[-0.02em] text-ink">Apni PG ka hisaab shuru karein</h1>
      <p className="mt-1 text-[0.92rem] text-slate-500">Create your HisabMitra account. It takes a minute.</p>
      <div className="mt-6 space-y-4">
        <Suspense fallback={<Skeleton className="h-80" />}>
          <GoogleButton label="Continue with Google" />
          <Divider />
          <SignupForm />
        </Suspense>
      </div>
      <p className="mt-6 text-center text-[0.92rem] text-slate-600">
        Pehle se account hai?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Login
        </Link>
      </p>
    </>
  );
}
