"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { signedViewUrlAction } from "@/lib/actions/uploads";
import type { UploadKind } from "@/lib/uploads/rules";

/** Opens a private file through a 60-second signed link. The link is never stored in the page. */
export function ViewFileButton({ kind, path, label, ...props }: { kind: UploadKind; path: string; label: string } & ButtonProps) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        // open the tab synchronously so mobile browsers do not block it as a pop-up
        const tab = window.open("", "_blank");
        start(async () => {
          const res = await signedViewUrlAction(kind, path);
          if (res.ok && res.data) {
            if (tab) tab.location.href = res.data.url;
            else window.location.href = res.data.url;
          } else {
            tab?.close();
            toast.error(res.ok ? "File not found" : res.error);
          }
        });
      }}
      {...props}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ExternalLink aria-hidden />}
      {label}
    </Button>
  );
}
