"use client";

import { useRouter } from "next/navigation";
import { FileStack, FileText, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ActionForm, ConfirmAction, FormError, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Notice } from "@/components/ui/card";
import { Checkbox, Field, Select } from "@/components/ui/input";
import { deleteDocumentsAction, setDocumentConsentAction } from "@/lib/actions/tenants";
import { fmtDate } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { combineIntoPdf, uploadFile } from "@/lib/uploads/client";
import { FileUpload } from "./file-upload";
import { ViewFileButton } from "./view-file-button";

export type Doc = { id: string; doc_type: string; file_name: string; storage_path: string; size_bytes: number; created_at: string };

export function DocumentsPanel({ tenantId, consentAt, docs }: { tenantId: string; consentAt: string | null; docs: Doc[] }) {
  const t = useT();
  const router = useRouter();
  const [docType, setDocType] = useState("id_proof");
  const multi = useRef<HTMLInputElement>(null);
  const [combining, setCombining] = useState<string | null>(null);

  const typeLabel: Record<string, string> = {
    aadhaar: t("Aadhaar card", "Aadhaar card"),
    id_proof: t("ID proof", "ID proof"),
    agreement: t("Agreement", "Agreement"),
    other: t("Other", "Other"),
  };

  async function combine(files: FileList | null) {
    if (!files || files.length === 0) return;
    setCombining(t("Combining pages…", "Pages jod rahe hain…"));
    try {
      const pdf = await combineIntoPdf([...files], `${docType}-combined.pdf`);
      await uploadFile(pdf, "tenant-document", { tenantId, docType }, (p) => setCombining(`${t("Uploading", "Upload ho raha hai")} ${p}%`));
      toast.success(t("Combined PDF uploaded", "Combined PDF upload ho gaya"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Could not combine the files", "Files jud nahi payi"));
    } finally {
      setCombining(null);
      if (multi.current) multi.current.value = "";
    }
  }

  if (!consentAt) {
    return (
      <Card className="space-y-4">
        <CardTitle>{t("Before you upload", "Upload se pehle")}</CardTitle>
        <Notice tone="brand" icon={ShieldCheck}>
          {t(
            "ID documents are sensitive. Upload only what you really need. Files are stored privately and only you can open them. You can delete them any time.",
            "ID documents sensitive hote hain. Sirf wahi upload karein jo sach mein zaroori ho. Files private rehti hain aur sirf aap khol sakte hain. Kabhi bhi delete kar sakte hain.",
          )}
        </Notice>
        <ActionForm action={setDocumentConsentAction} className="space-y-4">
          <input type="hidden" name="id" value={tenantId} />
          <Checkbox name="consent" required label={t("The tenant has agreed that I may store a copy of their documents.", "Tenant ne apne documents ki copy rakhne ki ijazat di hai.")} />
          <FormError />
          <SubmitButton block>{t("Continue", "Aage badhein")}</SubmitButton>
        </ActionForm>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <CardTitle>{t("Add a document", "Document jodein")}</CardTitle>
        <Field label={t("Document type", "Document type")} htmlFor="doc-type">
          <Select id="doc-type" value={docType} onChange={(e) => setDocType(e.target.value)}>
            {Object.entries(typeLabel).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <FileUpload key={docType + docs.length} kind="tenant-document" extra={{ tenantId, docType }} onUploaded={() => router.refresh()} label={t("Choose one file", "Ek file chunein")} />
        <div>
          <Button variant="outline" block disabled={!!combining} onClick={() => multi.current?.click()}>
            {combining ? <Loader2 className="animate-spin" aria-hidden /> : <FileStack aria-hidden />}
            {combining ?? t("Combine several pages into one PDF", "Kai pages ko ek PDF mein jodein")}
          </Button>
          <input ref={multi} type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" aria-label={t("Choose files to combine", "Jodne ke liye files chunein")} onChange={(e) => combine(e.target.files)} />
          <p className="mt-1.5 text-[0.8rem] text-slate-500">{t("Example: front and back of an ID. Pages stay clear and readable.", "Jaise ID ka aage aur peeche ka hissa. Pages saaf padhne layak rehte hain.")}</p>
        </div>
        {docType === "aadhaar" && (
          <p className="text-[0.82rem] text-slate-500">{t("Tip: a masked Aadhaar (first 8 digits hidden) is enough for most purposes. We never read or store the Aadhaar number itself.", "Tip: masked Aadhaar (pehle 8 ank chhupe hue) aksar kaafi hota hai. Hum Aadhaar number kabhi padhte ya store nahi karte.")}</p>
        )}
      </Card>

      <Card>
        <CardTitle>{t("Saved documents", "Saved documents")}</CardTitle>
        {docs.length === 0 ? (
          <p className="mt-2 text-[0.92rem] text-slate-500">{t("No documents yet.", "Abhi koi document nahi.")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-3">
                <FileText className="size-5 shrink-0 text-slate-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.95rem] font-medium text-ink">{typeLabel[d.doc_type] ?? d.doc_type}</p>
                  <p className="truncate text-[0.8rem] text-slate-500">
                    {d.file_name} · {Math.max(1, Math.round(d.size_bytes / 1024))} KB · {fmtDate(d.created_at)}
                  </p>
                </div>
                <ViewFileButton kind="tenant-document" path={d.storage_path} label={t("View", "Dekhein")} />
                <ConfirmAction
                  action={deleteDocumentsAction}
                  title={t("Delete this document?", "Yeh document delete karein?")}
                  description={t("The file is removed permanently and cannot be recovered.", "File hamesha ke liye hat jayegi, wapas nahi aayegi.")}
                  confirmLabel={t("Delete", "Delete")}
                  variant="danger"
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={t("Delete document", "Document delete karein")}>
                      <Trash2 aria-hidden />
                    </Button>
                  }
                >
                  <input type="hidden" name="id" value={d.id} />
                </ConfirmAction>
              </li>
            ))}
          </ul>
        )}
        {docs.length > 0 && (
          <ConfirmAction
            action={deleteDocumentsAction}
            title={t("Delete ALL documents of this tenant?", "Is tenant ke SAARE documents delete karein?")}
            description={t("Use this when the tenant has left and you no longer need their papers.", "Jab tenant ja chuka ho aur papers ki zaroorat na ho tab use karein.")}
            confirmLabel={t("Delete all", "Sab delete karein")}
            variant="danger"
            trigger={
              <Button variant="danger-outline" size="sm" className="mt-3">
                <Trash2 aria-hidden /> {t("Delete all documents", "Saare documents delete karein")}
              </Button>
            }
          >
            <input type="hidden" name="tenant_id" value={tenantId} />
          </ConfirmAction>
        )}
      </Card>
    </div>
  );
}
