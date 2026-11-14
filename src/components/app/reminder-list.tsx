"use client";

import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Eye, Loader2, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { sendRemindersAction } from "@/lib/actions/whatsapp";
import { inr } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { waMeLink } from "@/lib/whatsapp/message";

export type ReminderRow = {
  tenantId: string;
  name: string;
  phone: string;
  total: number;
  paid: number;
  due: number;
  optedIn: boolean;
  eligible: boolean;
  reason: "no_consent" | "invalid_number" | "nothing_due" | null;
  /** international number for the manual wa.me link; null when the number is invalid */
  to: string | null;
  text: string;
  sentToday: boolean;
};

export function ReminderList({ buildingId, rows, live }: { buildingId: string; rows: ReminderRow[]; live: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const sendable = rows.filter((r) => r.eligible && !r.sentToday);
  const [selected, setSelected] = useState<Set<string>>(new Set(sendable.map((r) => r.tenantId)));
  const [preview, setPreview] = useState<ReminderRow | null>(null);
  const [confirming, setConfirming] = useState(false);

  const reasonLabel = {
    no_consent: t("No WhatsApp consent", "WhatsApp consent nahi"),
    invalid_number: t("Invalid number", "Number galat hai"),
    nothing_due: t("Nothing due", "Kuch baaki nahi"),
  };
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("Message copied", "Message copy ho gaya"));
    } catch {
      toast.error(t("Could not copy. Long-press the message to copy it.", "Copy nahi hua. Message ko daba kar copy karein."));
    }
  }

  function send() {
    const ids = [...selected].filter((id) => sendable.some((r) => r.tenantId === id));
    start(async () => {
      try {
        const res = await sendRemindersAction(buildingId, ids);
        setConfirming(false);
        if (res.ok) {
          // the summary says exactly what happened: sent / queued / failed / skipped
          if (res.data && res.data.failed > 0 && res.data.sent === 0) toast.error(res.message);
          else toast.success(res.message);
          router.refresh();
        } else toast.error(res.error);
      } catch {
        setConfirming(false);
        toast.error(t("Not sent. Check your internet and try again.", "Nahi gaya. Internet check karke dobara try karein."));
      }
    });
  }

  const chosen = [...selected].filter((id) => sendable.some((r) => r.tenantId === id)).length;

  return (
    <div>
      {live && sendable.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="soft" onClick={() => setSelected(new Set(sendable.map((r) => r.tenantId)))}>
            {t("Select all pending", "Sabhi baaki wale chunein")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            {t("Clear", "Hatayein")}
          </Button>
        </div>
      )}

      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.tenantId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex items-start gap-3">
              {live && (
                <input
                  type="checkbox"
                  aria-label={t(`Select ${r.name}`, `${r.name} ko chunein`)}
                  className="mt-1 size-5 shrink-0 rounded accent-brand-600 disabled:opacity-40"
                  disabled={!r.eligible || r.sentToday}
                  checked={r.eligible && !r.sentToday && selected.has(r.tenantId)}
                  onChange={() => toggle(r.tenantId)}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{r.name}</p>
                    <p className="text-[0.82rem] tabular-nums text-slate-500">{r.phone}</p>
                  </div>
                  <p className={r.due > 0 ? "shrink-0 font-semibold tabular-nums text-danger-700" : "shrink-0 font-semibold tabular-nums text-success-700"}>{inr(r.due)}</p>
                </div>
                <p className="mt-1 text-[0.82rem] text-slate-500">
                  {t("Total", "Total")} {inr(r.total)} · {t("Paid", "Mila")} {inr(r.paid)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Pill tone={r.optedIn ? "success" : "neutral"}>{r.optedIn ? t("Consent: yes", "Consent: haan") : t("Consent: no", "Consent: nahi")}</Pill>
                  {r.sentToday ? (
                    <Pill tone="brand">{t("Reminded today", "Aaj bhej diya")}</Pill>
                  ) : r.eligible ? (
                    <Pill tone="success">{t("Can be sent", "Bhej sakte hain")}</Pill>
                  ) : (
                    <Pill tone="warm">{reasonLabel[r.reason ?? "nothing_due"]}</Pill>
                  )}
                </div>
                {r.due > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPreview(r)}>
                      <Eye aria-hidden /> {t("Preview", "Preview")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => copy(r.text)}>
                      <Copy aria-hidden /> {t("Copy message", "Message copy karein")}
                    </Button>
                    {r.to && (
                      <a href={waMeLink(r.to, r.text)} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-ink hover:bg-slate-50">
                        <ExternalLink className="size-[1.1em]" aria-hidden /> {t("Open in WhatsApp", "WhatsApp mein kholein")}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {live && (
        <div className="sticky bottom-20 z-20 mt-4 lg:bottom-4">
          <Button size="lg" block disabled={chosen === 0 || pending} onClick={() => setConfirming(true)} className="shadow-lift">
            <Send aria-hidden /> {t(`Send Pending Rent Reminders (${chosen})`, `Rent reminder bhejein (${chosen})`)}
          </Button>
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        {preview && (
          <DialogContent title={t("Message preview", "Message preview")} description={`${preview.name} · ${preview.phone}`}>
            <pre className="whitespace-pre-wrap rounded-2xl bg-[#e7ffdb] p-4 font-sans text-[0.95rem] leading-relaxed text-ink">{preview.text}</pre>
            <Button variant="outline" block className="mt-4" onClick={() => copy(preview.text)}>
              <Copy aria-hidden /> {t("Copy message", "Message copy karein")}
            </Button>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent
          title={t(`Send reminders to ${chosen} tenants?`, `${chosen} tenants ko reminder bhejein?`)}
          description={t("Messages go from your business WhatsApp number. Each tenant gets at most one reminder per day.", "Message aapke business WhatsApp number se jayenge. Har tenant ko din mein ek hi reminder jaata hai.")}
        >
          <div className="flex gap-3">
            <Button variant="outline" block onClick={() => setConfirming(false)} disabled={pending}>
              {t("Cancel", "Cancel")}
            </Button>
            <Button block onClick={send} disabled={pending} aria-busy={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {t("Send now", "Abhi bhejein")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
