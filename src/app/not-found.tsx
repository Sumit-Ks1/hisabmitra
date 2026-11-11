import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  return (
    <section className="relative isolate overflow-hidden pb-24 pt-40 sm:pt-48">
      <div aria-hidden className="bg-grid mask-radial absolute inset-0 -z-10" />
      <Container size="narrow" className="flex flex-col items-center text-center">
        <p className="font-mono text-sm font-medium text-brand-700">404</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">
          Yeh page register mein nahi mila.
        </h1>
        <p className="mt-4 max-w-md text-lg text-slate-600">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <ButtonLink href="/" variant="dark" size="lg" className="mt-8">
          <ArrowLeft className="size-4" aria-hidden /> Back to home
        </ButtonLink>
      </Container>
    </section>
  );
}
