"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Registers the service worker (production only) and tells the user when a new
 * version is ready. The update is applied only when they tap "Refresh", so a
 * half-filled form is never thrown away by a surprise reload.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reloading = false;

    const promptUpdate = (reg: ServiceWorkerRegistration) => {
      toast("Naya version available hai / A new version is available", {
        id: "sw-update",
        duration: Infinity,
        action: {
          label: "Refresh",
          onClick: () => reg.waiting?.postMessage({ type: "SKIP_WAITING" }),
        },
      });
    };

    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) promptUpdate(reg);
          });
        });
        // look for a new version whenever the app comes back to the foreground
        const check = () => document.visibilityState === "visible" && reg.update().catch(() => {});
        document.addEventListener("visibilitychange", check);
      })
      .catch(() => {
        /* the app works without a service worker */
      });

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return null;
}
