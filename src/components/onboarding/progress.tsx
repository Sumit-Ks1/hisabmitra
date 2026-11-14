import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compact step indicator that fits a 360px screen. */
export function StepProgress({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div>
      <p className="text-[0.82rem] font-medium text-slate-500">
        Step {current + 1} / {steps.length} · <span className="text-ink">{steps[current]}</span>
      </p>
      <ol className="mt-2 flex gap-1.5" aria-label="Progress">
        {steps.map((label, i) => (
          <li key={label} className="flex-1" aria-current={i === current ? "step" : undefined}>
            <span
              className={cn(
                "flex h-1.5 rounded-full",
                i < current ? "bg-success-500" : i === current ? "bg-brand-600" : "bg-slate-200",
              )}
            />
            <span className="sr-only">
              {label}
              {i < current && (
                <>
                  {" "}
                  <Check aria-hidden /> done
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
