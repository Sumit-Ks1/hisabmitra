import { Building, Eye, FolderCheck, Layers } from "lucide-react";
import { Container } from "@/components/ui/container";

const ITEMS = [
  { icon: Layers, label: "One Platform", note: "Tenants, rent & bills together" },
  { icon: Building, label: "Multiple Properties", note: "Every PG in one view" },
  { icon: FolderCheck, label: "Organized Records", note: "No more loose registers" },
  { icon: Eye, label: "Better Visibility", note: "Know what's paid & pending" },
];

export function TrustStrip() {
  return (
    <section aria-label="What HisabMitra brings together" className="relative pb-6 pt-14 sm:pt-16">
      <Container>
        <ul className="reveal grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-soft lg:grid-cols-4">
          {ITEMS.map(({ icon: Icon, label, note }, i) => (
            <li
              key={label}
              className={[
                "flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:p-5",
                i % 2 === 0 ? "border-r border-slate-100" : "",
                i < 2 ? "border-b border-slate-100 lg:border-b-0" : "",
                i === 1 ? "lg:border-r" : "",
              ].join(" ")}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                <Icon className="size-[1.15rem]" aria-hidden strokeWidth={1.8} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{label}</span>
                <span className="mt-0.5 block text-[0.78rem] leading-snug text-slate-500">{note}</span>
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
