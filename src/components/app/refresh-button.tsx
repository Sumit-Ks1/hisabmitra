"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Re-fetches the current page's server data. */
export function RefreshButton({ label, variant = "outline", ...props }: { label: string } & ButtonProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant={variant} block disabled={pending} onClick={() => start(() => router.refresh())} {...props}>
      <RefreshCw className={cn(pending && "animate-spin")} aria-hidden />
      {label}
    </Button>
  );
}
