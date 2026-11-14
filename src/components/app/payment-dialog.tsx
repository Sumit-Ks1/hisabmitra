"use client";

import { IndianRupee } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ActionForm, FieldError, FormError, SubmitButton } from "@/components/ui/action-form";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { recordPaymentAction } from "@/lib/actions/billing";
import { inr } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * "Payment receive hua?" — records money already received.
 * Each time the dialog opens it gets a fresh one-time key; a double tap or a
 * retry re-sends the SAME key, so the database stores the payment only once.
 */
export function PaymentDialog({
  tenantId,
  tenantName,
  invoiceId,
  due,
  today,
  kind = "rent",
  trigger,
  size = "sm",
  variant = "default",
}: {
  tenantId: string;
  tenantName: string;
  invoiceId?: string;
  due?: number;
  today: string;
  kind?: "rent" | "deposit" | "deposit_refund";
  trigger?: ReactNode;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const title = kind === "rent" ? t("Payment received?", "Payment receive hua?") : kind === "deposit" ? t("Deposit received", "Deposit mila") : t("Deposit refund", "Deposit wapas kiya");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setKey(newKey());
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size={size} variant={variant}>
            <IndianRupee aria-hidden /> {kind === "rent" ? t("Record", "Likhein") : title}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={title} description={kind === "rent" && due && due > 0 ? `${tenantName} · ${t("Due", "Baaki")} ${inr(due)}` : tenantName}>
        {open && (
          <ActionForm action={recordPaymentAction} onSuccess={() => setOpen(false)} className="space-y-4">
            <input type="hidden" name="tenant_id" value={tenantId} />
            <input type="hidden" name="invoice_id" value={invoiceId ?? ""} />
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="idempotency_key" value={key} />
            <Field label={t("Amount (₹)", "Amount (₹)")} htmlFor="pay-amount">
              <Input id="pay-amount" name="amount" type="number" inputMode="numeric" min={1} step="1" required autoFocus defaultValue={kind === "rent" && due && due > 0 ? due : ""} className="text-lg font-semibold" />
              <FieldError name="amount" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Date", "Date")} htmlFor="pay-date">
                <Input id="pay-date" name="paid_on" type="date" required defaultValue={today} max={today} />
                <FieldError name="paid_on" />
              </Field>
              <Field label={t("Method", "Kaise mila")} htmlFor="pay-method">
                <Select id="pay-method" name="method" defaultValue="cash">
                  <option value="cash">{t("Cash", "Cash")}</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">{t("Bank transfer", "Bank transfer")}</option>
                  <option value="other">{t("Other", "Other")}</option>
                </Select>
              </Field>
            </div>
            <Field label={t("Transaction reference", "Transaction reference")} htmlFor="pay-ref" optional>
              <Input id="pay-ref" name="reference" maxLength={60} autoComplete="off" />
            </Field>
            <Field label={t("Notes", "Notes")} htmlFor="pay-notes" optional>
              <Input id="pay-notes" name="notes" maxLength={300} />
            </Field>
            {kind === "rent" && (
              <p className="text-[0.82rem] text-slate-500">
                {t("Older unpaid months are cleared first. Extra money is kept as advance.", "Pehle purane mahino ka baaki katega. Zyada paisa advance mein rahega.")}
              </p>
            )}
            <FormError />
            <SubmitButton size="lg" block variant="success">
              {t("Save payment", "Payment save karein")}
            </SubmitButton>
          </ActionForm>
        )}
      </DialogContent>
    </Dialog>
  );
}
