import Link from "next/link";
import { BellOff } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { markNotificationsReadAction } from "@/lib/actions/workspace";
import type { SessionContext } from "@/lib/auth/session";
import type { Notification } from "@/lib/db-types";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Notification history, shared by the owner app and the admin panel. */
export async function NotificationList({ ctx }: { ctx: SessionContext }) {
  const { supabase, userId, t } = ctx;
  const { data } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  const items = (data ?? []) as Notification[];
  const unread = items.some((n) => !n.read_at);

  return (
    <div>
      <PageHeader
        title={t("Notifications", "Notifications")}
        action={
          unread ? (
            <ActionForm action={markNotificationsReadAction}>
              <SubmitButton variant="soft" size="sm">
                {t("Mark all read", "Sab padh liya")}
              </SubmitButton>
            </ActionForm>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={BellOff} title={t("No notifications yet", "Abhi koi notification nahi")} body={t("Approvals, payment checks and announcements will appear here.", "Approval, payment check aur announcements yahan dikhenge.")} />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {items.map((n) => {
            const body = (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <p className={cn("text-[0.95rem] text-ink", !n.read_at && "font-semibold")}>
                    {!n.read_at && <span className="mr-2 inline-block size-2 rounded-full bg-brand-600 align-middle" aria-label="unread" />}
                    {n.title}
                  </p>
                  <span className="shrink-0 text-[0.78rem] text-slate-500">{fmtDateTime(n.created_at)}</span>
                </div>
                {n.body && <p className="mt-0.5 whitespace-pre-wrap text-[0.88rem] text-slate-600">{n.body}</p>}
              </>
            );
            const safeLink = n.link && /^\/(app|admin|onboarding)(\/|$)/.test(n.link) ? n.link : null;
            return (
              <li key={n.id}>
                {safeLink ? (
                  <Link href={safeLink} className="block px-4 py-3.5 hover:bg-slate-50">
                    {body}
                  </Link>
                ) : (
                  <div className="px-4 py-3.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
