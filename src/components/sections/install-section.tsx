import { Smartphone } from "lucide-react";
import { InstallCard } from "@/components/pwa/install-card";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

const STEPS = [
  { title: "Android (Chrome)", body: "Open HisabMitra in Chrome → tap the ⋮ menu → Install app. It opens full-screen from your home screen, like any other app." },
  { title: "iPhone / iPad (Safari)", body: "Open HisabMitra in Safari → tap Share → Add to Home Screen. On iPhone this works only from Safari." },
];

export function InstallSection() {
  return (
    <section id="install" aria-labelledby="install-title" className="py-20 sm:py-24">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <SectionHeading
            id="install-title"
            align="left"
            eyebrow="Install"
            title="Phone mein app ki tarah chalayein."
            description="No Play Store needed. Add HisabMitra to your home screen in two taps. You still need internet to see and save records."
          />
          <div className="reveal space-y-3">
            <InstallCard title="Install on this device" icon={<Smartphone className="size-5 text-brand-600" aria-hidden />} />
            {STEPS.map((s) => (
              <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
                <p className="font-semibold text-ink">{s.title}</p>
                <p className="mt-1 text-[0.92rem] leading-relaxed text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
