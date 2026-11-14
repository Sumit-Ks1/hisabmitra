import { MessageCircle, Settings2 } from "lucide-react";
import { ReminderList, type ReminderRow } from "@/components/app/reminder-list";
import { LinkButton } from "@/components/ui/button";
import { Card, CardTitle, EmptyState, Notice, PageHeader, Pill } from "@/components/ui/card";
import { getReminderRows } from "@/lib/data/reminders";
import { getSettings } from "@/lib/data/settings";
import { getWorkspace } from "@/lib/data/workspace";
import type { WhatsappMessage } from "@/lib/db-types";
import { fmtDateTime, monthLabel } from "@/lib/format";
import { checkEligibility, displayNumber, reminderText, totalDue, whatsappNumber } from "@/lib/whatsapp/message";
import { whatsappState } from "@/lib/whatsapp/provider";

export const metadata = { title: "Reminders" };

export default async function RemindersPage() {
  const ws = await getWorkspace();
  const { supabase, userId, building, t, today } = ws;

  const [{ month, rows }, settings, logRes] = await Promise.all([
    getReminderRows(ws),
    getSettings(supabase, ["integrations"]),
    supabase.from("whatsapp_messages").select("id, tenant_id, period_month, to_phone, body_preview, status, error, created_at, sent_at").eq("building_id", building.id).eq("owner_id", userId).order("created_at", { ascending: false }).limit(30),
  ]);
  const state = whatsappState(settings.integrations.whatsapp);
  const log = (logRes.data ?? []) as WhatsappMessage[];
  const istDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));
  const sentToday = new Set(log.filter((m) => m.status !== "failed" && istDay(m.created_at) === today).map((m) => m.tenant_id));
  const nameOf = new Map(rows.map((r) => [r.tenantId, r.tenantName]));

  const list: ReminderRow[] = rows
    .map((r) => {
      const e = checkEligibility(r);
      return {
        tenantId: r.tenantId,
        name: r.tenantName,
        phone: displayNumber(r),
        total: r.total + r.previousDue,
        paid: r.paid,
        due: totalDue(r),
        optedIn: r.optedIn,
        eligible: e.eligible,
        reason: e.eligible ? null : e.reason,
        to: whatsappNumber(r),
        text: reminderText(r, building.name),
        sentToday: sentToday.has(r.tenantId),
      };
    })
    .sort((a, b) => b.due - a.due || a.name.localeCompare(b.name));
  const pendingCount = list.filter((r) => r.due > 0).length;

  const statusTone = { queued: "warm", sending: "warm", sent: "success", delivered: "success", read: "success", failed: "danger" } as const;
  const statusLabel = {
    queued: t("In queue", "Line mein"), sending: t("Sending", "Ja raha hai"), sent: t("Sent", "Chala gaya"),
    delivered: t("Delivered", "Pahunch gaya"), read: t("Read", "Padh liya"), failed: t("Failed", "Fail"),
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("Rent reminders", "Rent reminders")} subtitle={`${monthLabel(month)} · ${t(`${pendingCount} tenants with pending amount`, `${pendingCount} tenants ka baaki hai`)}`} />

      {!state.live && (
        <Notice tone="warm" icon={Settings2} className="mb-4" title={t("WhatsApp sending: setup required", "WhatsApp sending: setup baaki hai")}>
          <p className="mt-1">
            {t(
              "Automatic sending needs an approved WhatsApp Business account and message template, which is not connected yet. Nothing is sent from here right now.",
              "Automatic sending ke liye approved WhatsApp Business account aur message template chahiye, jo abhi connect nahi hai. Abhi yahan se kuch nahi jaata.",
            )}
          </p>
          <p className="mt-1.5 font-medium text-ink">{t("For now: use “Copy message” or “Open in WhatsApp” and send it from your own phone.", "Abhi ke liye: “Message copy karein” ya “WhatsApp mein kholein” se apne phone se bhejein.")}</p>
        </Notice>
      )}

      {list.length === 0 ? (
        <EmptyState icon={MessageCircle} title={t("No active tenants", "Koi active tenant nahi")} action={<LinkButton href="/app/tenants/new">{t("Add tenant", "Tenant jodein")}</LinkButton>} />
      ) : (
        <ReminderList buildingId={building.id} rows={list} live={state.live} />
      )}

      {log.length > 0 && (
        <Card className="mt-6">
          <CardTitle>{t("Message history", "Message history")}</CardTitle>
          <ul className="mt-2 divide-y divide-slate-100">
            {log.map((m) => (
              <li key={m.id} className="py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-[0.92rem] font-medium text-ink">{nameOf.get(m.tenant_id) ?? `+${m.to_phone}`}</p>
                  <Pill tone={statusTone[m.status]}>{statusLabel[m.status]}</Pill>
                </div>
                <p className="text-[0.8rem] text-slate-500">{fmtDateTime(m.created_at)}</p>
                {m.status === "failed" && m.error && <p className="text-[0.82rem] text-danger-700">{m.error}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
