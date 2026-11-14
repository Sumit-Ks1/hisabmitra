import { redirect } from "next/navigation";
import { Ban, Check, CircleDashed, Clock, Info, PartyPopper, XCircle } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card, Notice, Pill, Row } from "@/components/ui/card";
import { RefreshButton } from "@/components/app/refresh-button";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/data/settings";
import type { OwnerStatus, PaymentSubmission } from "@/lib/db-types";
import { fmtDate, fmtDateTime, fmtPhone, inr } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function OnboardingStatusPage() {
  const ctx = await requireUser();
  const { supabase, userId, t } = ctx;
  if (ctx.isAdmin) redirect("/admin");
  const status: OwnerStatus = ctx.owner?.status ?? "onboarding";
  if (status === "onboarding") redirect("/onboarding");

  const [{ data: p }, settings] = await Promise.all([
    supabase.from("payment_submissions").select("*").eq("owner_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    getSettings(supabase, ["support"]),
  ]);
  const payment = p as PaymentSubmission | null;

  if (status === "approved") {
    return (
      <div className="space-y-5 pt-6 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-success-50 text-success-700">
          <PartyPopper className="size-8" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{t("Your account is approved!", "Aapka account approve ho gaya!")}</h1>
        <p className="text-slate-600">{t("You can now set up rooms and add tenants.", "Ab aap rooms set up karke tenants jod sakte hain.")}</p>
        <LinkButton href="/app" size="lg" block>
          {t("Open my dashboard", "Mera dashboard kholein")}
        </LinkButton>
      </div>
    );
  }

  // the review pipeline, in order
  const order: OwnerStatus[] = ["submitted", "under_review", "payment_pending", "approved"];
  const position = status === "info_required" || status === "rejected" || status === "suspended" ? 1 : order.indexOf(status);
  const paymentVerified = payment?.status === "verified";
  const steps = [
    { label: t("Submitted", "Submit ho gaya"), done: true, active: false },
    { label: t("Under review", "Review ho raha hai"), done: position > 1 || paymentVerified, active: status === "under_review" || status === "submitted" },
    {
      label: paymentVerified ? t("Payment verified", "Payment verify ho gaya") : t("Payment verification pending", "Payment verification baaki hai"),
      done: paymentVerified,
      active: status === "payment_pending" || (!paymentVerified && status === "under_review"),
    },
    { label: t("Approved", "Approved"), done: false, active: false },
  ];

  const blocked = status === "rejected" || status === "info_required" || status === "suspended" || status === "payment_pending";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.45rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {status === "suspended"
            ? t("Your account is suspended", "Aapka account suspend hai")
            : t("Your HisabMitra account is under verification.", "Aapka HisabMitra account verification mein hai.")}
        </h1>
        {!blocked && (
          <p className="mt-2 flex items-start gap-2 text-[0.95rem] text-slate-600">
            <Clock className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
            {t("Our team usually reviews applications within 2–24 hours.", "Hamari team aksar 2–24 ghante mein application review kar leti hai.")}
          </p>
        )}
      </div>

      {status === "rejected" && (
        <Notice tone="danger" icon={XCircle} title={t("Application rejected", "Application reject ho gayi")}>
          <p className="mt-1 whitespace-pre-wrap">{ctx.owner?.review_note}</p>
          <p className="mt-2 text-slate-600">{t("You can correct your details and submit again.", "Aap details theek karke dobara submit kar sakte hain.")}</p>
        </Notice>
      )}
      {status === "info_required" && (
        <Notice tone="warm" icon={Info} title={t("More information required", "Aur jaankari chahiye")}>
          <p className="mt-1 whitespace-pre-wrap">{ctx.owner?.review_note}</p>
        </Notice>
      )}
      {status === "payment_pending" && (
        <Notice tone="warm" icon={Info} title={t("We could not verify your payment", "Aapka payment verify nahi ho paya")}>
          <p className="mt-1 whitespace-pre-wrap">{ctx.owner?.review_note}</p>
          <p className="mt-2 text-slate-600">{t("Please submit the correct transaction ID.", "Kripya sahi transaction ID submit karein.")}</p>
        </Notice>
      )}
      {status === "suspended" && (
        <Notice tone="danger" icon={Ban} title={t("Access is paused", "Access ruka hua hai")}>
          <p className="mt-1 whitespace-pre-wrap">{ctx.owner?.review_note}</p>
          <p className="mt-2 text-slate-600">{t("Your data is safe. Please contact support.", "Aapka data surakshit hai. Kripya support se sampark karein.")}</p>
        </Notice>
      )}

      {status !== "suspended" && (
        <Card>
          <h2 className="mb-3 text-[0.95rem] font-semibold text-ink">{t("Application status", "Application status")}</h2>
          <ol className="space-y-0">
            {steps.map((s, i) => (
              <li key={s.label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full",
                      s.done ? "bg-success-500 text-white" : s.active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-400",
                    )}
                  >
                    {s.done ? <Check className="size-4" aria-hidden /> : <CircleDashed className={cn("size-4", s.active && "animate-spin [animation-duration:3s]")} aria-hidden />}
                  </span>
                  {i < steps.length - 1 && <span className={cn("my-1 w-0.5 flex-1 rounded", s.done ? "bg-success-500" : "bg-slate-200")} style={{ minHeight: "1.25rem" }} />}
                </div>
                <p className={cn("pb-4 pt-0.5 text-[0.95rem]", s.done || s.active ? "font-medium text-ink" : "text-slate-400")}>{s.label}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {payment && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-[0.95rem] font-semibold text-ink">{t("Payment you submitted", "Aapne jo payment bheja")}</h2>
            <Pill tone={payment.status === "verified" ? "success" : payment.status === "rejected" ? "danger" : "warm"}>
              {payment.status === "verified" ? t("Verified", "Verified") : payment.status === "rejected" ? t("Rejected", "Rejected") : t("Pending", "Pending")}
            </Pill>
          </div>
          <dl className="mt-2 divide-y divide-slate-100">
            <Row label={t("Amount", "Amount")}>{inr(payment.amount)}</Row>
            <Row label={t("Transaction ID", "Transaction ID")}>
              <span className="font-mono">{payment.upi_reference}</span>
            </Row>
            <Row label={t("Paid on", "Payment date")}>{fmtDate(payment.paid_on)}</Row>
            <Row label={t("Submitted", "Submit kiya")}>{fmtDateTime(payment.created_at)}</Row>
          </dl>
        </Card>
      )}

      <div className="space-y-3">
        {(status === "rejected" || status === "info_required") && (
          <LinkButton href="/onboarding" size="lg" block>
            {t("Correct details & resubmit", "Details theek karke dobara bhejein")}
          </LinkButton>
        )}
        {status === "payment_pending" && (
          <LinkButton href="/onboarding/payment?step=pay" size="lg" block>
            {t("Submit payment again", "Payment dobara submit karein")}
          </LinkButton>
        )}
        <RefreshButton label={t("Check status again", "Status dobara check karein")} />
      </div>

      {(settings.support.phone || settings.support.email) && (
        <p className="text-center text-[0.9rem] text-slate-500">
          {t("Need help?", "Madad chahiye?")}{" "}
          {settings.support.phone && (
            <a href={`tel:+91${settings.support.phone}`} className="font-medium text-brand-700">
              {fmtPhone(settings.support.phone)}
            </a>
          )}{" "}
          {settings.support.email && (
            <a href={`mailto:${settings.support.email}`} className="break-all font-medium text-brand-700">
              {settings.support.email}
            </a>
          )}
        </p>
      )}
    </div>
  );
}
