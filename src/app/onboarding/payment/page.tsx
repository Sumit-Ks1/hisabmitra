import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { AlertTriangle, ArrowRight, ShieldCheck, Smartphone } from "lucide-react";
import { PaymentForm } from "@/components/onboarding/payment-form";
import { StepProgress } from "@/components/onboarding/progress";
import { LinkButton } from "@/components/ui/button";
import { Card, Notice, Row } from "@/components/ui/card";
import { homeFor, requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/data/settings";
import type { Building, Subscription } from "@/lib/db-types";
import { fmtPhone, inr } from "@/lib/format";
import { LangProvider } from "@/lib/i18n/client";
import { durationLabel } from "@/lib/pricing";
import { buildUpiUri, isValidUpiId } from "@/lib/upi";

const ALLOWED = ["onboarding", "rejected", "info_required", "payment_pending"];

export default async function OnboardingPaymentPage({ searchParams }: PageProps<"/onboarding/payment">) {
  const ctx = await requireUser();
  const { supabase, userId, t } = ctx;
  const status = ctx.owner?.status ?? "onboarding";
  if (ctx.isAdmin || !ALLOWED.includes(status)) redirect(ctx.isAdmin || status === "approved" ? homeFor(ctx) : "/onboarding/status");

  const { data: s } = await supabase
    .from("building_subscriptions")
    .select("*")
    .eq("owner_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sub = s as Subscription | null;
  if (!sub) redirect("/onboarding");

  const [{ data: b }, settings, sp] = await Promise.all([
    supabase.from("buildings").select("name").eq("id", sub.building_id).eq("owner_id", userId).maybeSingle(),
    getSettings(supabase, ["upi", "support"]),
    searchParams,
  ]);
  const building = b as Pick<Building, "name"> | null;
  const paying = sp.step === "pay";
  const labels = [t("You", "Aap"), t("PG", "PG"), t("Electricity", "Bijli"), t("Review", "Review"), t("Price", "Price"), t("Payment", "Payment")];
  const period = durationLabel(sub.duration_months);

  const priceCard = (
    <Card>
      <h2 className="text-lg font-semibold text-ink">{t("Your subscription", "Aapka subscription")}</h2>
      <p className="mt-0.5 text-[0.9rem] text-slate-500">{building?.name}</p>
      <dl className="mt-3 divide-y divide-slate-100">
        <Row label={t("Number of rooms", "Rooms ki ginti")}>{sub.rooms_count}</Row>
        <Row label={t("Price per room", "Har room ka price")}>{inr(sub.price_per_room)} / {t("month", "mahina")}</Row>
        <Row label={t("Subscription period", "Subscription period")}>{period}</Row>
        {sub.discount_percent > 0 && <Row label={t("Discount", "Discount")}>{sub.discount_percent}%</Row>}
        <Row label={t("Buildings covered", "Kitni buildings")}>1</Row>
      </dl>
      <div className="mt-3 flex items-baseline justify-between rounded-2xl bg-brand-50 px-4 py-3.5">
        <span className="text-[0.95rem] font-medium text-brand-800">{t("Total payable", "Kul dena hai")}</span>
        <span className="text-2xl font-semibold tracking-[-0.02em] text-brand-800 tabular-nums">{inr(sub.amount)}</span>
      </div>
      <p className="mt-2 text-[0.8rem] text-slate-500">
        {sub.rooms_count} × {inr(sub.price_per_room)} × {period}
      </p>
    </Card>
  );

  if (!paying) {
    return (
      <div className="space-y-5">
        <StepProgress steps={labels} current={4} />
        {priceCard}
        <LinkButton href="/onboarding/payment?step=pay" size="lg" block>
          {t("Continue to payment", "Payment ke liye aage badhein")} <ArrowRight aria-hidden />
        </LinkButton>
        <LinkButton href="/onboarding" variant="ghost" block>
          {t("Change PG details", "PG details badlein")}
        </LinkButton>
      </div>
    );
  }

  const upiReady = isValidUpiId(settings.upi.upi_id) && sub.amount > 0;
  let qr: string | null = null;
  let upiUri: string | null = null;
  if (upiReady) {
    upiUri = buildUpiUri({ upiId: settings.upi.upi_id, payeeName: settings.upi.payee_name, amount: sub.amount, note: "HisabMitra subscription" });
    qr = await QRCode.toDataURL(upiUri, { margin: 1, width: 560, errorCorrectionLevel: "M" });
  }

  return (
    <LangProvider lang={ctx.lang}>
      <div className="space-y-5">
        <StepProgress steps={labels} current={5} />

        {status !== "onboarding" && ctx.owner?.review_note && (
          <Notice tone="warm" icon={AlertTriangle} title={t("Message from our team", "Hamari team ka message")}>
            <p className="mt-1 whitespace-pre-wrap">{ctx.owner.review_note}</p>
          </Notice>
        )}

        {!upiReady ? (
          <Notice tone="warm" icon={AlertTriangle} title={t("Payment details are not available yet", "Payment details abhi available nahi hain")}>
            <p className="mt-1">
              {t("Our team has not published the UPI details yet. Your PG details are saved — please check back shortly.", "Hamari team ne abhi UPI details nahi daali hain. Aapki PG details save hain — thodi der baad dobara dekhein.")}
            </p>
            {(settings.support.phone || settings.support.email) && (
              <p className="mt-2">
                {t("Support", "Support")}: {settings.support.phone && fmtPhone(settings.support.phone)} {settings.support.email}
              </p>
            )}
          </Notice>
        ) : (
          <>
            <Card className="text-center">
              <h2 className="text-lg font-semibold text-ink">{t("Pay with any UPI app", "Kisi bhi UPI app se pay karein")}</h2>
              <p className="mt-1 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums">{inr(sub.amount)}</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated on the server */}
              <img src={qr!} alt={t("UPI payment QR code", "UPI payment QR code")} width={240} height={240} className="mx-auto mt-4 size-60 rounded-2xl border border-slate-200 p-2" />
              <p className="mt-3 text-[0.9rem] text-slate-500">UPI ID</p>
              <p className="select-all break-all font-mono text-[1.05rem] font-semibold text-ink">{settings.upi.upi_id}</p>
              <p className="text-[0.85rem] text-slate-500">{settings.upi.payee_name}</p>
              <a href={upiUri!} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-50 text-[0.95rem] font-semibold text-brand-700 sm:hidden">
                <Smartphone className="size-[1.1em]" aria-hidden /> {t("Open UPI app on this phone", "Isi phone mein UPI app kholein")}
              </a>
            </Card>

            <Card>
              <h3 className="text-[0.95rem] font-semibold text-ink">{t("How to pay", "Kaise pay karein")}</h3>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[0.92rem] leading-relaxed text-slate-600">
                <li>{t("Scan the QR code (or use the UPI ID) in any UPI app.", "Kisi bhi UPI app se QR code scan karein (ya UPI ID daalein).")}</li>
                <li>{t(`Pay exactly ${inr(sub.amount)}.`, `Poore ${inr(sub.amount)} pay karein.`)}</li>
                <li>{t("Copy the UPI transaction ID / UTR from your app and enter it below.", "App se UPI transaction ID / UTR copy karke neeche daalein.")}</li>
              </ol>
            </Card>

            <Card>
              <h3 className="mb-3 text-[0.95rem] font-semibold text-ink">{t("After paying, fill this", "Pay karne ke baad yeh bharein")}</h3>
              <PaymentForm today={new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())} />
            </Card>

            <Notice tone="neutral" icon={ShieldCheck}>
              {t(
                "Entering a transaction ID does not activate the account by itself. Our team checks every payment before approval.",
                "Sirf transaction ID daalne se account active nahi hota. Hamari team har payment check karke hi approve karti hai.",
              )}
            </Notice>
          </>
        )}

        <LinkButton href="/onboarding/payment" variant="ghost" block>
          {t("Back to price", "Price par wapas")}
        </LinkButton>
      </div>
    </LangProvider>
  );
}
