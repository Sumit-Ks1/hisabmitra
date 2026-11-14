import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import type { AuditLog } from "@/lib/db-types";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Audit log" };

const HIDDEN = new Set(["value", "updated_by", "id"]);

/** Short, safe summary of the details column (never dumps whole rows). */
function summary(details: Record<string, unknown>): string {
  return Object.entries(details)
    .filter(([k, v]) => !HIDDEN.has(k) && v !== null && v !== "" && typeof v !== "object")
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`)
    .join(" · ");
}

export default async function AdminAuditPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
  const logs = (data ?? []) as AuditLog[];
  const actorIds = [...new Set(logs.map((l) => l.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, email").in("id", actorIds) : { data: [] };
  const emailOf = new Map((actors ?? []).map((a) => [a.id as string, a.email as string]));

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Last 200 sensitive actions. Entries cannot be edited or deleted." />
      {logs.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No entries yet" />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {logs.map((l) => (
            <li key={l.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-[0.88rem] font-medium text-ink">{l.action}</span>
                <span className="shrink-0 text-[0.8rem] text-slate-500">{fmtDateTime(l.created_at)}</span>
              </div>
              <p className="mt-0.5 truncate text-[0.82rem] text-slate-500">
                {l.actor_id ? (emailOf.get(l.actor_id) ?? "user") : "system"}
                {l.owner_id && (
                  <>
                    {" → "}
                    <Link href={`/admin/owners/${l.owner_id}`} className="font-medium text-brand-700">
                      owner
                    </Link>
                  </>
                )}
              </p>
              {summary(l.details) && <p className="mt-0.5 break-words text-[0.82rem] text-slate-600">{summary(l.details)}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
