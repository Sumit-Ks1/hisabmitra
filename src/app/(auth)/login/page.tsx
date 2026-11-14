import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Divider, GoogleButton, LoginForm } from "@/components/auth/auth-forms";
import { Skeleton } from "@/components/ui/card";

export const metadata: Metadata = { title: "Login", robots: { index: false } };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-[-0.02em] text-ink">Wapas swagat hai</h1>
      <p className="mt-1 text-[0.92rem] text-slate-500">Login to manage your PG.</p>
      <div className="mt-6 space-y-4">
        <Suspense fallback={<Skeleton className="h-72" />}>
          <GoogleButton label="Continue with Google" />
          <Divider />
          <LoginForm />
        </Suspense>
      </div>
      <p className="mt-6 text-center text-[0.92rem] text-slate-600">
        Naye hain?{" "}
        <Link href="/signup" className="font-semibold text-brand-700 hover:underline">
          Account banayein / Sign up
        </Link>
      </p>
    </>
  );
}
