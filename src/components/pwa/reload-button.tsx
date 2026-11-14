"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReloadButton() {
  return (
    <Button size="lg" className="mt-8" onClick={() => window.location.reload()}>
      <RefreshCw aria-hidden /> Dobara try karein / Try again
    </Button>
  );
}
