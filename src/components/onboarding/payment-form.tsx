"use client";

import { FileUpload } from "@/components/app/file-upload";
import { ActionForm, FieldError, FormError, SubmitButton } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/input";
import { submitPaymentAction } from "@/lib/actions/onboarding";
import { useT } from "@/lib/i18n/client";

export function PaymentForm({ today }: { today: string }) {
  const t = useT();
  return (
    <ActionForm action={submitPaymentAction} className="space-y-4">
      <Field label={t("UPI transaction ID / UTR", "UPI transaction ID / UTR")} htmlFor="reference" hint={t("Usually 12 digits. Find it in your UPI app's payment details.", "Aksar 12 ank ka hota hai. UPI app ki payment details mein milta hai.")}>
        <Input id="reference" name="reference" required autoCapitalize="characters" autoComplete="off" inputMode="text" maxLength={45} />
        <FieldError name="reference" />
      </Field>
      <Field label={t("Payment date", "Payment ki date")} htmlFor="paid_on">
        <Input id="paid_on" name="paid_on" type="date" required defaultValue={today} max={today} />
        <FieldError name="paid_on" />
      </Field>
      <Field label={t("Payment screenshot", "Payment ka screenshot")} optional hint={t("Helps us verify faster.", "Isse verification jaldi hoti hai.")}>
        <FileUpload kind="payment-proof" name="screenshot_path" label={t("Add screenshot", "Screenshot lagayein")} />
      </Field>
      <FormError />
      <SubmitButton size="lg" block>
        {t("Submit for verification", "Verification ke liye bhejein")}
      </SubmitButton>
    </ActionForm>
  );
}
